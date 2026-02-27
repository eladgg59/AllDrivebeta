import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    ActivityIndicator,
    FlatList,
    StyleSheet,
    TextInput,
    Linking,
    TouchableOpacity,
    Alert,
    ListRenderItemInfo,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
WebBrowser.maybeCompleteAuthSession();

// ---- Types ----
type DriveFacet = { mimeType?: string } | undefined;
type FolderFacet = { childCount?: number } | undefined;

type OneDriveFile = {
    id: string;
    name: string;
    webUrl?: string;
    size?: number;
    lastModifiedDateTime?: string;
    file?: DriveFacet;      // present for files
    folder?: FolderFacet;   // present for folders
    // Graph may include this short-lived URL in some list responses:
    '@microsoft.graph.downloadUrl'?: string;
};

type GraphListResponse = {
    value: OneDriveFile[];
    '@odata.nextLink'?: string;
    error?: { message?: string };
};

// ---- OAuth endpoints ----
const discovery: AuthSession.DiscoveryDocument = {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

const PAGE_SIZE = 25;

const HomeScreenOneDrive: React.FC = () => {
    // ---- Auth ----
    const redirectUri = useMemo(() => AuthSession.makeRedirectUri(), []);
    const [request, response, promptAsync] = AuthSession.useAuthRequest(
        {
            clientId: '9c5a5d4b-f5f6-4c96-9341-315ea7dc3f54',
            scopes: ['Files.ReadWrite', 'offline_access'],
            redirectUri,
            codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
        },
        discovery
    );

    const [accessToken, setAccessToken] = useState<string | null>(null);

    // ---- UI / Data state ----
    const [files, setFiles] = useState<OneDriveFile[]>([]);
    const [loadingInitial, setLoadingInitial] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const nextLinkRef = useRef<string | null>(null);

    const [searchText, setSearchText] = useState('');
    const [searchQuery, setSearchQuery] = useState(''); // applied on Enter

    // ---- Handle redirect after login ----
    useEffect(() => {
        if (response?.type === 'success' && response.params?.code) {
            (async () => {
                try {
                    // IMPORTANT: use the same verifier created by useAuthRequest
                    const body = new URLSearchParams({
                        client_id: '9c5a5d4b-f5f6-4c96-9341-315ea7dc3f54',
                        scope: 'Files.ReadWrite offline_access',
                        code: response.params.code,
                        redirect_uri: redirectUri,
                        grant_type: 'authorization_code',
                        code_verifier: request?.codeVerifier ?? '',
                    }).toString();

                    const res = await fetch(discovery.tokenEndpoint!, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body,
                    });

                    const data = await res.json();
                    if (!res.ok) throw new Error(data?.error_description || data?.error || 'Token exchange failed');

                    setAccessToken(data.access_token as string);
                    await loadInitial(data.access_token as string);
                } catch (e: any) {
                    setError(e?.message || 'Authentication failed');
                }
            })();
        }
    }, [response, redirectUri, request?.codeVerifier]);

    // ---- Data fetching helpers ----
    const baseListUrl = useMemo(() => {
        // list root children, newest first
        return `https://graph.microsoft.com/v1.0/me/drive/root/children?$orderby=lastModifiedDateTime desc&$top=${PAGE_SIZE}`;
    }, []);

    const searchUrl = (q: string) =>
        `https://graph.microsoft.com/v1.0/me/drive/root/search(q='${encodeURIComponent(q)}')?$top=${PAGE_SIZE}`;

    const fetchPage = async (token: string, url: string, append: boolean) => {
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const data: GraphListResponse = await res.json();

        if (!res.ok) {
            throw new Error(data?.error?.message || 'Failed to fetch files');
        }

        setFiles((prev) => (append ? [...prev, ...data.value] : data.value));
        nextLinkRef.current = data['@odata.nextLink'] ?? null;
    };

    const loadInitial = async (tokenParam?: string) => {
        const token = tokenParam || accessToken;
        if (!token) return;

        setError(null);
        setLoadingInitial(true);
        try {
            const url = searchQuery ? searchUrl(searchQuery) : baseListUrl;
            await fetchPage(token, url, false);
        } catch (e: any) {
            setError(e?.message || 'Failed to load files');
        } finally {
            setLoadingInitial(false);
        }
    };

    const loadMore = async () => {
        if (!accessToken || !nextLinkRef.current || loadingMore) return;
        setLoadingMore(true);
        try {
            await fetchPage(accessToken, nextLinkRef.current, true);
        } catch (e: any) {
            setError(e?.message || 'Failed to load more files');
        } finally {
            setLoadingMore(false);
        }
    };

    // ---- Actions ----
    const handleOpen = (item: OneDriveFile) => {
        if (item.webUrl) {
            Linking.openURL(item.webUrl).catch(() => setError('Failed to open file'));
        } else {
            setError('No web URL for this item');
        }
    };

    const resolveDownloadUrlAndOpen = async (item: OneDriveFile) => {
        // Prefer pre-authenticated URL if present
        if (item['@microsoft.graph.downloadUrl']) {
            Linking.openURL(item['@microsoft.graph.downloadUrl']).catch(() => setError('Failed to open download link'));
            return;
        }
        // Otherwise fetch it for this item
        if (!accessToken) return;
        try {
            const res = await fetch(
                `https://graph.microsoft.com/v1.0/me/drive/items/${item.id}?select=@microsoft.graph.downloadUrl,webUrl`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const data: OneDriveFile = await res.json();
            const dl = (data as any)['@microsoft.graph.downloadUrl'] as string | undefined;
            if (dl) {
                Linking.openURL(dl).catch(() => setError('Failed to open download link'));
            } else if (data.webUrl) {
                // fallback: open in OneDrive
                Linking.openURL(data.webUrl).catch(() => setError('Failed to open file'));
            } else {
                setError('Download URL not available for this item');
            }
        } catch {
            setError('Failed to get download URL');
        }
    };

    const handleDelete = async (fileId: string) => {
        if (!accessToken) return;
        try {
            const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (res.ok) {
                setFiles((prev) => prev.filter((f) => f.id !== fileId));
            } else {
                const text = await res.text();
                throw new Error(text || 'Delete failed');
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to delete file');
        }
    };

    const handleUpload = async () => {
        if (!accessToken) return;
        try {
            const result = await DocumentPicker.getDocumentAsync();
            if (result.canceled || !result.assets?.[0]) return;

            const asset = result.assets[0];
            const fileUri = asset.uri;
            const fileName = asset.name || 'upload.bin';

            // NOTE: Simple upload is for files <= 4 MB.
            // For larger files you need an upload session (chunked). We keep it simple here.
            const blob = await (await fetch(fileUri)).blob();

            const res = await fetch(
                `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(fileName)}:/content`,
                {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}` },
                    body: blob,
                }
            );

            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || 'Upload failed');
            }

            await loadInitial(); // refresh list
        } catch (e: any) {
            setError(e?.message || 'Upload failed');
        }
    };

    const handleSearchSubmit = async () => {
        setSearchQuery(searchText.trim());
        // After applying query, reload from page 1
        await loadInitial();
    };

    // ---- Renderers ----
    const renderItem = ({ item }: ListRenderItemInfo<OneDriveFile>) => {
        const isFile = !!item.file && !item.folder;
        const sizeKB = item.size ? `${(item.size / 1024).toFixed(1)} KB` : '';
        return (
            <View style={styles.fileItem}>
                <Text style={styles.fileName} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.fileDate}>
                    {isFile ? '📄 File' : '📁 Folder'}
                    {item.lastModifiedDateTime ? ` • ${new Date(item.lastModifiedDateTime).toLocaleDateString()}` : ''}
                    {sizeKB ? ` • ${sizeKB}` : ''}
                </Text>

                {isFile && (
                    <TouchableOpacity onPress={() => resolveDownloadUrlAndOpen(item)}>
                        <Text style={styles.downloadText}>Download</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity onPress={() => handleOpen(item)}>
                    <Text style={styles.openText}>Open</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Text style={styles.deleteText}>Delete</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const keyExtractor = (item: OneDriveFile) => item.id;

    // ---- UI ----
    if (!accessToken) {
        return (
            <View style={[styles.container, styles.center]}>
                <TouchableOpacity disabled={!request} onPress={() => promptAsync()} style={styles.loginButton}>
                    <Text style={styles.loginText}>Login with OneDrive</Text>
                </TouchableOpacity>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <View style={styles.headerContainer}>
                <Text style={styles.welcomeText}>Your files:</Text>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search files"
                    value={searchText}
                    onChangeText={setSearchText}
                    onSubmitEditing={handleSearchSubmit}
                    returnKeyType="search"
                />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
                        <Text style={styles.uploadButtonText}>Upload File</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.refreshButton} onPress={() => loadInitial()}>
                        <Text style={styles.refreshText}>Refresh</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {loadingInitial ? (
                <ActivityIndicator size="large" />
            ) : (
                <FlatList
                    data={files}
                    renderItem={renderItem}
                    keyExtractor={keyExtractor}
                    contentContainerStyle={styles.listContainer}
                    keyboardShouldPersistTaps="handled"
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={<Text style={styles.emptyText}>No files found</Text>}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" /> : null}
                />
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
    );
};

export default HomeScreenOneDrive;

// ---- Styles themed like your Google screen ----
const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#fff' },
    container: { flex: 1, backgroundColor: '#fff' },
    center: { justifyContent: 'center', alignItems: 'center' },

    headerContainer: {
        padding: 16,
        backgroundColor: '#f0f0f0',
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    welcomeText: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    searchInput: {
        height: 40,
        borderColor: '#ccc',
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 10,
        marginBottom: 16,
    },

    uploadButton: {
        backgroundColor: '#4633ff',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    refreshButton: {
        backgroundColor: '#e0e0e0',
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
        marginLeft: 10,
    },
    refreshText: { fontWeight: '600', color: '#333' },

    listContainer: { paddingBottom: 16 },
    fileItem: {
        padding: 10,
        borderBottomWidth: 2,
        borderBottomColor: '#00ff2a',
    },
    fileName: { fontSize: 16, fontWeight: '500', marginBottom: 4, textAlign: 'left' },
    fileDate: { fontSize: 12, color: '#666' },
    downloadText: { fontSize: 14, color: '#00ff2a', marginTop: 8 },
    deleteText: { fontSize: 14, color: 'red', marginTop: 8 },
    openText: { fontSize: 14, color: '#4285F4', marginTop: 8 },

    loginButton: { padding: 15, backgroundColor: '#0078D4', borderRadius: 8, alignItems: 'center' },
    loginText: { color: '#fff', fontWeight: 'bold' },

    emptyText: { textAlign: 'center', marginTop: 20, color: '#888' },
    errorText: { color: 'red', textAlign: 'center', margin: 10 },
});

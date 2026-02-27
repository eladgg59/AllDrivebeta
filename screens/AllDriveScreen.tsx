import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';

const GOOGLE_CLIENT_ID = '494172450205-daf4jjdss0u07gau3oge0unndfjvha0b.apps.googleusercontent.com';
const MICROSOFT_CLIENT_ID = '9c5a5d4b-f5f6-4c96-9341-315ea7dc3f54';

const googleDiscovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

const microsoftDiscovery = {
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};

interface CloudFile {
    id?: string;
    name: string;
    source: 'GoogleDrive' | 'OneDrive';
    mimeType?: string;
    webContentLink?: string;
    webUrl?: string;
    lastModified?: string;
}

const AllDriveScreen: React.FC = () => {
    const [files, setFiles] = useState<CloudFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [gAccessToken, setGAccessToken] = useState<string | null>(null);
    const [mAccessToken, setMAccessToken] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState<'name' | 'source'>('name');

    const [gRequest, gResponse, gPromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: GOOGLE_CLIENT_ID,
            scopes: ['https://www.googleapis.com/auth/drive'],
            redirectUri: AuthSession.makeRedirectUri({ scheme: 'alldrive' }),
        },
        googleDiscovery
    );

    const [mRequest, mResponse, mPromptAsync] = AuthSession.useAuthRequest(
        {
            clientId: MICROSOFT_CLIENT_ID,
            scopes: ['Files.ReadWrite', 'offline_access'],
            redirectUri: AuthSession.makeRedirectUri({ scheme: 'alldrive' }),
        },
        microsoftDiscovery
    );

    // Silent login
    useEffect(() => {
        (async () => {
            const gRefresh = await SecureStore.getItemAsync('googleRefreshToken');
            if (gRefresh) {
                const token = await fetchGoogleAccessToken(gRefresh);
                if (token) { setGAccessToken(token); fetchGoogleFiles(token); }
            } else { gPromptAsync(); }
        })();
        (async () => {
            const mRefresh = await SecureStore.getItemAsync('msRefreshToken');
            if (mRefresh) {
                const token = await fetchMicrosoftAccessToken(mRefresh);
                if (token) { setMAccessToken(token); fetchOneDriveFiles(token); }
            } else { mPromptAsync(); }
        })();
    }, []);

    useEffect(() => { if (gResponse?.type === 'success' && gResponse.params.code) exchangeGoogleCode(gResponse.params.code); }, [gResponse]);
    useEffect(() => { if (mResponse?.type === 'success' && mResponse.params.code) exchangeMicrosoftCode(mResponse.params.code); }, [mResponse]);

    // Exchange code to access token
    const exchangeGoogleCode = async (code: string) => {
        const res = await fetch(googleDiscovery.tokenEndpoint!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                code,
                redirect_uri: AuthSession.makeRedirectUri({ scheme: 'alldrive' }),
                grant_type: 'authorization_code',
            }).toString(),
        });
        const data = await res.json();
        if (data.access_token) {
            setGAccessToken(data.access_token);
            if (data.refresh_token) await SecureStore.setItemAsync('googleRefreshToken', data.refresh_token);
            fetchGoogleFiles(data.access_token);
        }
    };

    const exchangeMicrosoftCode = async (code: string) => {
        const res = await fetch(microsoftDiscovery.tokenEndpoint!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: MICROSOFT_CLIENT_ID,
                code,
                redirect_uri: AuthSession.makeRedirectUri({ scheme: 'alldrive' }),
                grant_type: 'authorization_code',
            }).toString(),
        });
        const data = await res.json();
        if (data.access_token) {
            setMAccessToken(data.access_token);
            if (data.refresh_token) await SecureStore.setItemAsync('msRefreshToken', data.refresh_token);
            fetchOneDriveFiles(data.access_token);
        }
    };

    // Refresh token
    const fetchGoogleAccessToken = async (refreshToken: string) => {
        try {
            const res = await fetch(googleDiscovery.tokenEndpoint!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
            });
            const data = await res.json();
            return data.access_token;
        } catch { return null; }
    };

    const fetchMicrosoftAccessToken = async (refreshToken: string) => {
        try {
            const res = await fetch(microsoftDiscovery.tokenEndpoint!, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ client_id: MICROSOFT_CLIENT_ID, grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
            });
            const data = await res.json();
            return data.access_token;
        } catch { return null; }
    };

    // Fetch files
    const fetchGoogleFiles = async (token: string) => {
        setLoading(true);
        try {
            const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,modifiedTime,webContentLink)', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            const gFiles = (data.files || []).map((f: any) => ({
                id: f.id, name: f.name, source: 'GoogleDrive' as const, mimeType: f.mimeType, webContentLink: f.webContentLink, lastModified: f.modifiedTime
            }));
            setFiles(prev => [...prev.filter(f => f.source !== 'GoogleDrive'), ...gFiles]);
        } finally { setLoading(false); }
    };

    const fetchOneDriveFiles = async (token: string) => {
        setLoading(true);
        try {
            const res = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            const mFiles = (data.value || []).map((f: any) => ({
                id: f.id, name: f.name, source: 'OneDrive' as const, webUrl: f.webUrl, lastModified: f.lastModifiedDateTime
            }));
            setFiles(prev => [...prev.filter(f => f.source !== 'OneDrive'), ...mFiles]);
        } finally { setLoading(false); }
    };

    // Upload
    const uploadFile = async (source: 'GoogleDrive' | 'OneDrive') => {
        const token = source === 'GoogleDrive' ? gAccessToken : mAccessToken;
        if (!token) return;
        try {
            const result = await DocumentPicker.getDocumentAsync({});
            if (result.canceled) return;
            const file = result.assets?.[0]; if (!file) return;
            const blob = await (await fetch(file.uri)).blob();
            if (source === 'GoogleDrive') {
                const formData = new FormData();
                formData.append('metadata', new Blob([JSON.stringify({ name: file.name })], { type: 'application/json' }));
                formData.append('file', blob, file.name);
                await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
                fetchGoogleFiles(token);
            } else {
                await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(file.name)}:/content`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.mimeType || 'application/octet-stream' }, body: blob });
                fetchOneDriveFiles(token);
            }
        } catch (err) { console.error(err); }
    };

    // Delete
    const deleteFile = async (file: CloudFile) => {
        const token = file.source === 'GoogleDrive' ? gAccessToken : mAccessToken;
        if (!token) return;
        try {
            if (file.source === 'GoogleDrive') {
                await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            } else {
                await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${file.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
            }
            setFiles(prev => prev.filter(f => f.id !== file.id));
            Alert.alert('Deleted', file.name);
        } catch { Alert.alert('Delete Failed', 'Something went wrong'); }
    };

    const refreshFiles = () => { if (gAccessToken) fetchGoogleFiles(gAccessToken); if (mAccessToken) fetchOneDriveFiles(mAccessToken); };
    const sortedFiles = [...files].sort((a, b) => sortOption === 'name' ? a.name.localeCompare(b.name) : a.source.localeCompare(b.source));
    const openFile = (file: CloudFile) => {
        if (file.source === 'GoogleDrive') {
            let url = file.mimeType?.includes('document') ? `https://docs.google.com/document/d/${file.id}/edit` :
                file.mimeType?.includes('spreadsheet') ? `https://docs.google.com/spreadsheets/d/${file.id}/edit` :
                    file.mimeType?.includes('presentation') ? `https://docs.google.com/presentation/d/${file.id}/edit` :
                        `https://drive.google.com/file/d/${file.id}/view`;
            Linking.openURL(url);
        } else if (file.source === 'OneDrive' && file.webUrl) { Linking.openURL(file.webUrl); }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>AllDrive Files</Text>
            <View style={styles.buttons}>
                <TouchableOpacity onPress={() => uploadFile('GoogleDrive')} style={[styles.loginButton, { backgroundColor: '#34A853' }]}>
                    <Text style={styles.loginText}>Upload Google</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => uploadFile('OneDrive')} style={[styles.loginButton, { backgroundColor: '#0057B8' }]}>
                    <Text style={styles.loginText}>Upload OneDrive</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.buttons}>
                <TouchableOpacity onPress={refreshFiles} style={[styles.loginButton, { backgroundColor: '#FF8C00' }]}>
                    <Text style={styles.loginText}>Refresh</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSortOption(sortOption === 'name' ? 'source' : 'name')} style={[styles.loginButton, { backgroundColor: '#6A5ACD' }]}>
                    <Text style={styles.loginText}>Sort by {sortOption === 'name' ? 'Source' : 'Name'}</Text>
                </TouchableOpacity>
            </View>
            {loading ? <ActivityIndicator size="large" color="blue" /> :
                <FlatList
                    data={sortedFiles}
                    keyExtractor={(item, index) => item.id ? `${item.source}-${item.id}` : `${item.source}-fallback-${index}`}
                    renderItem={({ item }) => (
                        <View style={styles.fileItem}>
                            <Text style={{ flex: 1 }}>{item.name}</Text>
                            <Text style={{ fontSize: 12, color: item.source === 'GoogleDrive' ? 'green' : 'blue', marginRight: 8 }}>{item.source}</Text>
                            <TouchableOpacity onPress={() => openFile(item)}><Text style={{ color: '#0078D4', marginRight: 8 }}>Open</Text></TouchableOpacity>
                            <TouchableOpacity onPress={() => deleteFile(item)}><Text style={{ color: 'red' }}>Delete</Text></TouchableOpacity>
                        </View>
                    )}
                />
            }
        </View>
    );
};

export default AllDriveScreen;

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
    buttons: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
    loginButton: { padding: 10, borderRadius: 6 },
    loginText: { color: '#fff', fontWeight: 'bold' },
    fileItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});

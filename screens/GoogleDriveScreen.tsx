import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  Linking,
  TouchableOpacity,
  Dimensions,
  Platform,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import axios from 'axios';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { isGoogleDriveTokenValid } from "../src/Scripts/GoogleUtils";
import HomeScreenOneDrive from "./HomeScreenOneDrive";
import { NavigationContainer } from '@react-navigation/native';
WebBrowser.maybeCompleteAuthSession();

const { width: screenWidth } = Dimensions.get('window');

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webContentLink?: string;
  accountEmail?: string;
  accountName?: string;
  size?: string;
  starred?: boolean;
}

interface GoogleDriveResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

interface GoogleAccountIdentity {
  email?: string;
  name?: string;
}

interface FolderBreadcrumb {
  accountEmail: string;
  folderId: string;
  folderName: string;
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

const HomeScreen = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '494172450205-daf4jjdss0u07gau3oge0unndfjvha0b.apps.googleusercontent.com',
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
    extraParams: { prompt: 'select_account' },
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<GoogleDriveFile[]>([]);
  const [isRequestReady, setIsRequestReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [filterFileType, setFilterFileType] = useState<string | null>(null);
  const [connectedAccountTokens, setConnectedAccountTokens] = useState<Array<{
    email: string;
    name?: string;
    accessToken: string;
    storageLimit?: number;
    storageUsage?: number;
  }>>([]);
  const [showUploadAccountPicker, setShowUploadAccountPicker] = useState(false);
  const [showUploadFolderAccountPicker, setShowUploadFolderAccountPicker] = useState(false);
  const [folderStack, setFolderStack] = useState<FolderBreadcrumb[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [screenWidthState, setScreenWidthState] = useState(Dimensions.get('window').width);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => setScreenWidthState(Dimensions.get('window').width));
    return () => sub?.remove();
  }, []);

  const HORIZ_PADDING = 16;
  const GAP = 10;
  const minCardWidth = 260;
  const contentWidth = screenWidthState - HORIZ_PADDING * 2;
  const numColumns = Math.max(1, Math.floor((contentWidth + GAP) / (minCardWidth + GAP)));
  const CARD_WIDTH = (contentWidth - (numColumns - 1) * GAP) / numColumns;
  const CARD_HEIGHT = Math.max(CARD_WIDTH * 1.15, 240);
  const spaceBetween = GAP / 2;

  useEffect(() => setIsRequestReady(!!request), [request]);

  const fetchGoogleAccountIdentity = async (accessToken: string): Promise<GoogleAccountIdentity> => {
    try {
      const res = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { email: res.data?.email, name: res.data?.name };
    } catch (e) {
      return {};
    }
  };

  const fetchDriveStorageQuota = async (accessToken: string): Promise<{ limit?: number; usage?: number }> => {
    try {
      const res = await axios.get('https://www.googleapis.com/drive/v3/about', {
        params: { fields: 'storageQuota(limit,usage)' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const sq = res.data?.storageQuota;
      const limit = sq?.limit != null ? parseInt(sq.limit, 10) : undefined;
      const usage = sq?.usage != null ? parseInt(sq.usage, 10) : undefined;
      return { limit: Number.isFinite(limit) ? limit : undefined, usage: Number.isFinite(usage) ? usage : undefined };
    } catch (e) {
      return {};
    }
  };

  const formatStorageFree = (limit?: number, usage?: number): string => {
    if (limit == null || limit < 0) return 'Unlimited';
    const used = usage ?? 0;
    const freeBytes = Math.max(0, limit - used);
    const freeGB = freeBytes / (1024 * 1024 * 1024);
    if (freeGB >= 1) return `${freeGB.toFixed(1)} GB free`;
    return `${Math.round(freeBytes / (1024 * 1024))} MB free`;
  };

  const fetchFilesInFolder = async (accessToken: string, account: GoogleAccountIdentity, parentId: string): Promise<GoogleDriveFile[]> => {
    const allFiles: GoogleDriveFile[] = [];
    let pageToken: string | null = null;
    const baseQ = parentId === 'root' ? "'root' in parents" : `'${parentId}' in parents`;
    const q = `${baseQ} and trashed = false`;

    do {
      const res: { data: GoogleDriveResponse } = await axios.get('https://www.googleapis.com/drive/v3/files', {
        params: {
          q,
          fields: 'files(id, name, mimeType, modifiedTime, webContentLink, size, starred), nextPageToken',
          orderBy: 'folder,name',
          pageSize: 200,
          pageToken: pageToken || undefined,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        },
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 20000,
      });
      const files = res.data?.files ?? [];
      allFiles.push(...files.map((f: GoogleDriveFile) => ({ ...f, accountEmail: account?.email, accountName: account?.name })));
      pageToken = res.data?.nextPageToken || null;
    } while (pageToken);

    return allFiles;
  };

  const loadCurrentFolder = async (accountsOverride?: typeof connectedAccountTokens, folderStackOverride?: FolderBreadcrumb[]) => {
    const accounts = accountsOverride ?? connectedAccountTokens;
    const stack = folderStackOverride ?? folderStack;
    if (accounts.length === 0) {
      setUserInfo([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      let combined: GoogleDriveFile[] = [];
      if (stack.length === 0) {
        for (const acc of accounts) {
          const files = await fetchFilesInFolder(acc.accessToken, { email: acc.email, name: acc.name }, 'root');
          combined = combined.concat(files);
        }
      } else {
        const { accountEmail, folderId } = stack[stack.length - 1];
        const acc = accounts.find((a) => a.email === accountEmail);
        if (acc) combined = await fetchFilesInFolder(acc.accessToken, { email: acc.email, name: acc.name }, folderId);
      }
      setUserInfo(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connectedAccountTokens.length > 0) loadCurrentFolder();
  }, [folderStack, connectedAccountTokens.length]);

  useEffect(() => {
    const handleResponse = async () => {
      try {
        if (response?.type === 'success' && 'params' in response && response.params?.access_token) {
          const accessToken = response.params.access_token;
          const identity = await fetchGoogleAccountIdentity(accessToken);
          const { limit, usage } = await fetchDriveStorageQuota(accessToken);
          const entry = {
            email: identity?.email || `anon-${Date.now()}`,
            name: identity?.name,
            accessToken,
            storageLimit: limit,
            storageUsage: usage,
          };
          const newAccounts = connectedAccountTokens.filter((a) => a.email !== identity?.email).concat(entry);
          setConnectedAccountTokens(newAccounts);
          setFolderStack([]);
          await loadCurrentFolder(newAccounts, []);
        }
      } catch (err) {
        setError('Failed to authenticate');
      }
    };
    if (response) handleResponse();
    else promptAsync();
  }, [response, promptAsync]);

  const getUploadParents = (accountEmail: string): string[] | undefined => {
    if (folderStack.length === 0) return undefined;
    const last = folderStack[folderStack.length - 1];
    return last.accountEmail === accountEmail ? [last.folderId] : undefined;
  };

  const uriToBlob = async (uri: string): Promise<Blob> => {
    const res = await fetch(uri);
    return await res.blob();
  };

  const performUpload = async (account: { email: string; name?: string; accessToken: string }) => {
    try {
      setShowUploadAccountPicker(false);
      const result = await DocumentPicker.getDocumentAsync();
      if (result.canceled) return;
      const file = result.assets?.[0] as { uri: string; name: string } | undefined;
      if (!file) throw new Error('No file selected');
      const blob = await uriToBlob(file.uri);
      const metadata: { name: string; parents?: string[] } = { name: file.name };
      const parents = getUploadParents(account.email);
      if (parents) metadata.parents = parents;
      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob, file.name);
      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${account.accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      setError(null);
      await loadCurrentFolder();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const createDriveFolder = async (accessToken: string, name: string, parentId?: string): Promise<string> => {
    const metadata: { name: string; mimeType: string; parents?: string[] } = { name, mimeType: 'application/vnd.google-apps.folder' };
    if (parentId) metadata.parents = [parentId];
    const res = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!res.ok) throw new Error(`Failed to create folder: ${res.status}`);
    const data = await res.json();
    return data.id;
  };

  const performUploadFolder = async (account: { email: string; name?: string; accessToken: string }) => {
    try {
      setShowUploadFolderAccountPicker(false);
      const parents = getUploadParents(account.email);
      const accessToken = account.accessToken;

      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.setAttribute('webkitdirectory', '');
        input.setAttribute('directory', '');
        input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        const files = await new Promise<File[]>((resolve) => {
          input.onchange = () => {
            const f = input.files ? Array.from(input.files) : [];
            document.body.removeChild(input);
            resolve(f);
          };
          input.click();
        });
        if (files.length === 0) return;

        const folderIdMap: Record<string, string> = {};
        const getOrCreateFolder = async (pathParts: string[]): Promise<string> => {
          const key = pathParts.join('/');
          if (folderIdMap[key]) return folderIdMap[key];
          const parent = pathParts.length > 1 ? await getOrCreateFolder(pathParts.slice(0, -1)) : (parents?.[0]);
          const id = await createDriveFolder(accessToken, pathParts[pathParts.length - 1], parent);
          folderIdMap[key] = id;
          return id;
        };

        for (const file of files) {
          const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          const parts = path.split('/');
          const fileName = parts.pop()!;
          const parentId = parts.length > 0 ? await getOrCreateFolder(parts) : parents?.[0];
          const metadata: { name: string; parents?: string[] } = { name: fileName };
          if (parentId) metadata.parents = [parentId];
          const formData = new FormData();
          formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          formData.append('file', file, fileName);
          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        }
      } else {
        const result = await DocumentPicker.getDocumentAsync({ multiple: true });
        if (result.canceled || !result.assets?.length) return;
        for (const asset of result.assets) {
          const file = asset as { uri: string; name: string };
          const blob = await uriToBlob(file.uri);
          const metadata: { name: string; parents?: string[] } = { name: file.name };
          if (parents) metadata.parents = parents;
          const formData = new FormData();
          formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          formData.append('file', blob, file.name);
          const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: formData,
          });
          if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        }
      }
      setError(null);
      await loadCurrentFolder();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const resolveAccounts = async () => {
    let accounts = [...connectedAccountTokens];
    if (accounts.length === 0 && response?.type === 'success' && 'params' in response && response.params?.access_token) {
      const token = response.params.access_token;
      const identity = await fetchGoogleAccountIdentity(token);
      const { limit, usage } = await fetchDriveStorageQuota(token);
      accounts = [{ email: identity?.email || 'current', name: identity?.name, accessToken: token, storageLimit: limit, storageUsage: usage }];
      setConnectedAccountTokens(accounts);
    }
    return accounts;
  };

  const handleUpload = async () => {
    const accounts = await resolveAccounts();
    if (accounts.length === 0) { setError('Connect a Google account first.'); return; }
    if (accounts.length === 1) { performUpload(accounts[0]); return; }
    setShowUploadAccountPicker(true);
  };

  const handleUploadFolder = async () => {
    const accounts = await resolveAccounts();
    if (accounts.length === 0) { setError('Connect a Google account first.'); return; }
    if (accounts.length === 1) { performUploadFolder(accounts[0]); return; }
    setShowUploadFolderAccountPicker(true);
  };

  const deleteGoogleDriveFile = async (fileId: string, accountEmail?: string) => {
    try {
      let accessToken: string | null = accountEmail ? (connectedAccountTokens.find((a) => a.email === accountEmail)?.accessToken ?? null) : null;
      if (!accessToken && connectedAccountTokens[0]) accessToken = connectedAccountTokens[0].accessToken;
      if (!accessToken && response?.type === 'success' && 'params' in response) accessToken = response.params?.access_token ?? null;
      if (!accessToken) throw new Error('Authentication error.');
      const deleteRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
      if (deleteRes.ok) {
        setUserInfo((prev) => prev.filter((f) => f.id !== fileId));
        await loadCurrentFolder();
        return;
      }
      if (deleteRes.status === 403) {
        const trashRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ trashed: true }),
        });
        if (trashRes.ok) {
          setUserInfo((prev) => prev.filter((f) => f.id !== fileId));
          await loadCurrentFolder();
          return;
        }
      }
      throw new Error('Cannot delete');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Delete failed');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCurrentFolder();
    setRefreshing(false);
  };

  const handleDownload = (url: string) => Linking.openURL(url).catch(() => setError('Download failed'));
  const handleSearchSubmit = () => setSearchQuery(searchText);

  const navigateIntoFolder = (item: GoogleDriveFile) => {
    if (!item.accountEmail) return;
    setFolderStack((prev) => prev.concat({ accountEmail: item.accountEmail!, folderId: item.id, folderName: item.name }));
  };

  const getFileTypeCategory = (mimeType?: string) => {
    if (!mimeType) return 'other';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'document';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
    if (mimeType.includes('image') || mimeType.includes('photo')) return 'image';
    if (mimeType.includes('video')) return 'video';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('folder')) return 'folder';
    return 'other';
  };

  const uniqueAccounts = React.useMemo(() => {
    const seen = new Set<string>();
    const accs: { email: string; name?: string }[] = [];
    userInfo.forEach((f) => {
      if (f.accountEmail && !seen.has(f.accountEmail)) { seen.add(f.accountEmail); accs.push({ email: f.accountEmail, name: f.accountName }); }
    });
    return accs;
  }, [userInfo]);

  const filteredFiles = userInfo
    .filter((f) => {
      if (!f.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterAccount && f.accountEmail !== filterAccount) return false;
      if (filterFileType && getFileTypeCategory(f.mimeType) !== filterFileType) return false;
      return true;
    })
    .sort((a, b) => {
      const aFolder = a.mimeType === FOLDER_MIME;
      const bFolder = b.mimeType === FOLDER_MIME;
      if (aFolder && !bFolder) return -1;
      if (!aFolder && bFolder) return 1;
      const dA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const dB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      return dB - dA;
    });

  const FILE_TYPE_LABELS: Record<string, string> = {
    document: 'Documents', spreadsheet: 'Spreadsheets', presentation: 'Presentations',
    image: 'Images', video: 'Videos', pdf: 'PDFs', folder: 'Folders', other: 'Other',
  };

  const renderFileItem = ({ item }: { item: GoogleDriveFile }) => {
    const isFolder = item.mimeType === FOLDER_MIME;
    if (isFolder) {
      return (
        <TouchableOpacity activeOpacity={0.7} onPress={() => navigateIntoFolder(item)} style={{ borderRadius: 18 }}>
          <BlurView intensity={90} tint="light" style={[styles.fileItem, { width: CARD_WIDTH, height: CARD_HEIGHT, marginHorizontal: spaceBetween / 2 }]}>
            <MaterialCommunityIcons name="folder" size={48} color="#ffb74d" style={{ marginBottom: 8 }} />
            <Text style={styles.fileName}>{item.name}</Text>
            {item.accountEmail && <Text style={styles.accountText}>{item.accountName ? `${item.accountName} • ${item.accountEmail}` : item.accountEmail}</Text>}
            {item.modifiedTime && <Text style={styles.fileDate}>{new Date(item.modifiedTime).toLocaleDateString()}</Text>}
            <Text style={styles.folderHint}>Tap to open</Text>
          </BlurView>
        </TouchableOpacity>
      );
    }
    const handleOpenFile = () => {
      let url = '';
      if (item.mimeType?.includes('document')) url = `https://docs.google.com/document/d/${item.id}/edit`;
      else if (item.mimeType?.includes('spreadsheet')) url = `https://docs.google.com/spreadsheets/d/${item.id}/edit`;
      else if (item.mimeType?.includes('presentation')) url = `https://docs.google.com/presentation/d/${item.id}/edit`;
      else url = `https://drive.google.com/file/d/${item.id}/view`;
      Linking.openURL(url).catch(() => setError('Failed to open'));
    };
    return (
      <View style={{ borderRadius: 18 }}>
        <BlurView intensity={90} tint="light" style={[styles.fileItem, { width: CARD_WIDTH, height: CARD_HEIGHT, marginHorizontal: spaceBetween / 2 }]}>
          <Text style={styles.fileName}>{item.name}</Text>
          {item.accountEmail && <Text style={styles.accountText}>{item.accountName ? `${item.accountName} • ${item.accountEmail}` : item.accountEmail}</Text>}
          {item.modifiedTime && <Text style={styles.fileDate}>{new Date(item.modifiedTime).toLocaleDateString()}</Text>}
          <View style={styles.fileActions}>
            {item.webContentLink && <TouchableOpacity onPress={() => handleDownload(item.webContentLink!)}><Text style={styles.downloadText}>Download</Text></TouchableOpacity>}
            <TouchableOpacity onPress={handleOpenFile}><Text style={styles.openText}>Open</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => deleteGoogleDriveFile(item.id, item.accountEmail)}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>
          </View>
        </BlurView>
      </View>
    );
  };

  const accountWithMostFreeSpace = React.useMemo(() => {
    if (connectedAccountTokens.length === 0) return null;
    const withFree = connectedAccountTokens.map((acc) => {
      const limit = acc.storageLimit;
      const usage = acc.storageUsage ?? 0;
      const free = limit == null || limit < 0 ? Infinity : Math.max(0, limit - usage);
      return { acc, free };
    });
    const best = withFree.reduce((a, b) => (a.free >= b.free ? a : b));
    return best.acc;
  }, [connectedAccountTokens]);

  const uploadModal = (title: string, show: boolean, setShow: (v: boolean) => void, onPick: (acc: typeof connectedAccountTokens[0]) => void) => (
    <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
      <Pressable style={styles.modalOverlay} onPress={() => setShow(false)}>
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          {accountWithMostFreeSpace && (
            <TouchableOpacity style={styles.modalMostFreeButton} onPress={() => onPick(accountWithMostFreeSpace)} activeOpacity={0.7}>
              <Text style={styles.modalMostFreeText}>Upload to account with most free space</Text>
              <Text style={styles.modalMostFreeSubtext}>{accountWithMostFreeSpace.name || accountWithMostFreeSpace.email} • {formatStorageFree(accountWithMostFreeSpace.storageLimit, accountWithMostFreeSpace.storageUsage)}</Text>
            </TouchableOpacity>
          )}
          {connectedAccountTokens.map((acc) => (
            <TouchableOpacity key={acc.email} style={styles.modalAccountButton} onPress={() => onPick(acc)} activeOpacity={0.7}>
              <Text style={styles.modalAccountText}>{acc.name || acc.email}</Text>
              {acc.name && acc.email && <Text style={styles.modalAccountEmail}>{acc.email}</Text>}
              <Text style={styles.modalStorageText}>{formatStorageFree(acc.storageLimit, acc.storageUsage)}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShow(false)}>
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const emptyFolderContent = folderStack.length > 0 && !loading && filteredFiles.length === 0 ? (
    <View style={styles.emptyFolderContainer}>
      <MaterialCommunityIcons name="folder-open-outline" size={64} color="#002b45" style={{ opacity: 0.6 }} />
      <Text style={styles.emptyFolderText}>This folder is empty</Text>
      <TouchableOpacity style={styles.goBackButton} onPress={() => setFolderStack((prev) => prev.slice(0, -1))}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.goBackButtonText}>Go back</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {loading && !userInfo.length ? <Text>Loading your files...</Text> : (
        <>
          <Text style={styles.welcomeText}>Your files</Text>
          <View style={styles.searchRow}>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh} disabled={refreshing || loading}>
              <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
            </TouchableOpacity>
            <TextInput style={styles.searchInput} placeholder="Search files" value={searchText} onChangeText={setSearchText} onSubmitEditing={handleSearchSubmit} returnKeyType="search" />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}><Text style={styles.buttonText}>Search</Text></TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}><Text style={styles.buttonText}>Upload</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { marginLeft: 12 }]} onPress={handleUploadFolder}><Text style={styles.buttonText}>Upload folder</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { marginLeft: 12 }]} onPress={() => isRequestReady && promptAsync()}><Text style={styles.buttonText}>Add Google Account</Text></TouchableOpacity>
          </View>
          <Text style={styles.filterSectionLabel}>Filter by account</Text>
          <View style={styles.filterRow}>
            <TouchableOpacity style={[styles.filterChip, !filterAccount && styles.filterChipActive]} onPress={() => setFilterAccount(null)}><Text style={[styles.filterChipText, !filterAccount && styles.filterChipTextActive]}>All accounts</Text></TouchableOpacity>
            {uniqueAccounts.map((acc) => (
              <TouchableOpacity key={acc.email} style={[styles.filterChip, filterAccount === acc.email && styles.filterChipActive]} onPress={() => setFilterAccount(acc.email)}><Text style={[styles.filterChipText, filterAccount === acc.email && styles.filterChipTextActive]}>{acc.name || acc.email}</Text></TouchableOpacity>
            ))}
          </View>
          {folderStack.length > 0 && (
            <View style={styles.breadcrumbContainer}>
              <TouchableOpacity onPress={() => setFolderStack([])} style={styles.breadcrumbItem}>
                <MaterialCommunityIcons name="folder-multiple" size={18} color="#002b45" />
                <Text style={styles.breadcrumbText}>All files</Text>
              </TouchableOpacity>
              {folderStack.map((crumb, idx) => (
                <View key={crumb.folderId} style={styles.breadcrumbRow}>
                  <Text style={styles.breadcrumbSeparator}> › </Text>
                  <TouchableOpacity onPress={() => setFolderStack((prev) => prev.slice(0, idx + 1))} style={styles.breadcrumbItem}><Text style={styles.breadcrumbText}>{crumb.folderName}</Text></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Text style={styles.filterSectionLabel}>Filter by file type</Text>
          <View style={[styles.filterRow, { marginBottom: 8 }]}>
            <TouchableOpacity style={[styles.filterChip, !filterFileType && styles.filterChipActive]} onPress={() => setFilterFileType(null)}><Text style={[styles.filterChipText, !filterFileType && styles.filterChipTextActive]}>All types</Text></TouchableOpacity>
            {(['document', 'spreadsheet', 'presentation', 'image', 'video', 'pdf', 'other'] as const).map((type) => (
              <TouchableOpacity key={type} style={[styles.filterChip, filterFileType === type && styles.filterChipActive]} onPress={() => setFilterFileType(type)}><Text style={[styles.filterChipText, filterFileType === type && styles.filterChipTextActive]}>{FILE_TYPE_LABELS[type]}</Text></TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <LinearGradient colors={['#4facfe', '#00f2fe']} style={{ flex: 1 }}>
        {uploadModal('Choose account to upload to', showUploadAccountPicker, setShowUploadAccountPicker, performUpload)}
        {uploadModal('Choose account to upload folder to', showUploadFolderAccountPicker, setShowUploadFolderAccountPicker, performUploadFolder)}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: HORIZ_PADDING }} showsVerticalScrollIndicator>
          {renderHeader()}
          {emptyFolderContent}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {filteredFiles.map((file) => <View key={file.id}>{renderFileItem({ item: file })}</View>)}
          </View>
          {loading && <View style={{ marginTop: 16, alignItems: 'center' }}><ActivityIndicator size="small" color="#0000ff" /></View>}
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#4facfe', '#00f2fe']} style={{ flex: 1 }}>
      {uploadModal('Choose account to upload to', showUploadAccountPicker, setShowUploadAccountPicker, performUpload)}
      {uploadModal('Choose account to upload folder to', showUploadFolderAccountPicker, setShowUploadFolderAccountPicker, performUploadFolder)}
      <FlatList
        style={{ flex: 1 }}
        data={filteredFiles}
        renderItem={renderFileItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        key={numColumns}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={emptyFolderContent}
        ListFooterComponent={loading ? <ActivityIndicator size="small" color="#0000ff" /> : null}
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: HORIZ_PADDING }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  headerContainer: { padding: 20, paddingTop: 50 },
  welcomeText: { fontSize: 28, fontWeight: '800', marginBottom: 24, color: '#002b45', letterSpacing: 0.6 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0280da',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchInput: { height: 48, flex: 0.45, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 25, paddingHorizontal: 18, color: '#002b45', fontSize: 16 },
  searchButton: { backgroundColor: '#0280da', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 25, marginLeft: 12, elevation: 4 },
  uploadButton: { backgroundColor: '#0280da', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 25, elevation: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4, textAlign: 'center' },
  filterSectionLabel: { fontSize: 14, fontWeight: '600', color: '#002b45', marginTop: 16, marginBottom: 8 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', marginRight: 8, marginBottom: 8 },
  filterChipActive: { backgroundColor: '#0280da' },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#002b45' },
  filterChipTextActive: { color: '#fff' },
  breadcrumbContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.6)' },
  breadcrumbText: { fontSize: 14, fontWeight: '600', color: '#002b45', marginLeft: 4 },
  breadcrumbSeparator: { fontSize: 16, color: '#002b45', fontWeight: '700' },
  folderHint: { fontSize: 12, color: '#336699', marginTop: 4 },
  emptyFolderContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyFolderText: { fontSize: 18, fontWeight: '600', color: '#002b45', marginTop: 16 },
  goBackButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0280da', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, marginTop: 20 },
  goBackButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#002b45', marginBottom: 16 },
  modalMostFreeButton: { backgroundColor: '#e3f2fd', padding: 16, borderRadius: 12, marginBottom: 12 },
  modalMostFreeText: { fontSize: 16, fontWeight: '600', color: '#0280da' },
  modalMostFreeSubtext: { fontSize: 12, color: '#666', marginTop: 4 },
  modalAccountButton: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalAccountText: { fontSize: 16, fontWeight: '600', color: '#002b45' },
  modalAccountEmail: { fontSize: 12, color: '#666', marginTop: 2 },
  modalStorageText: { fontSize: 12, color: '#0280da', marginTop: 4 },
  modalCancelButton: { marginTop: 16, padding: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 16, color: '#666' },
  fileItem: { margin: 10, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  fileName: { fontSize: 15, fontWeight: '600', color: '#00334d', textAlign: 'center', marginTop: 8 },
  accountText: { fontSize: 10, color: '#336699', marginTop: 4 },
  fileDate: { fontSize: 12, color: '#555', marginTop: 2 },
  fileActions: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginTop: 10 },
  downloadText: { fontSize: 14, fontWeight: '600', color: '#4cafef', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  openText: { fontSize: 14, fontWeight: '600', color: '#00bcd4', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  deleteText: { fontSize: 14, fontWeight: '600', color: '#ff5252', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
});

export default HomeScreen;

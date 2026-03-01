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
  Animated,
} from 'react-native';
import axios from 'axios';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import { /* LinearGradient removed in favour of themed background */ } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../src/Contexts/ThemeContext';

import { isGoogleDriveTokenValid } from "../src/Scripts/GoogleUtils";
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

const AnimatedIcon = Animated.createAnimatedComponent(MaterialCommunityIcons);

// Reusable File Card matching HomePage visuals
function FileCard({ item, width, height, margin, onPress, onDelete, onDownload, textColor, glassBorderColor, blueColor, cardBackgroundColor, iconFillColor }: any) {
  const hoverAnim = useRef(new Animated.Value(0)).current;
  const scale = hoverAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });

  const handleHover = (hovering: boolean) => {
    Animated.spring(hoverAnim, { toValue: hovering ? 1 : 0, useNativeDriver: Platform.OS !== 'web', friction: 8, tension: 40 }).start();
  };

  const isFolder = item.mimeType === FOLDER_MIME;
  const iconName = isFolder ? 'folder' : 
                   item.mimeType?.includes('image') ? 'image' :
                   item.mimeType?.includes('pdf') ? 'file-pdf-box' :
                   item.mimeType?.includes('video') ? 'video' : 
                   item.mimeType?.includes('spreadsheet') ? 'file-excel' :
                   item.mimeType?.includes('presentation') ? 'file-powerpoint' :
                   'file-document';
  const iconColor = isFolder ? '#ffb74d' : '#3b82f6';

  return (
    <Pressable
      onHoverIn={() => handleHover(true)}
      onHoverOut={() => handleHover(false)}
      onPress={onPress}
      style={{ width, height, margin, marginBottom: 20 }}
    >
      <Animated.View style={[
        styles.featureCard,
        {
          borderColor: glassBorderColor,
          transform: [{ scale }],
          backgroundColor: cardBackgroundColor
        }
      ]}>
        <MaterialCommunityIcons name={iconName} size={40} color={iconColor} style={{ marginBottom: 15 }} />
        <Animated.Text numberOfLines={2} style={[styles.featureTitle, { color: textColor }]}>{item.name}</Animated.Text>
        <View style={{ marginTop: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Animated.Text style={[styles.featureDesc, { color: textColor }]}>
            {item.modifiedTime ? new Date(item.modifiedTime).toLocaleDateString() : ''}
          </Animated.Text>
          {!isFolder && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {onDownload && (
                <TouchableOpacity onPress={onDownload}>
                  <AnimatedIcon name="download" size={20} style={{ color: iconFillColor }} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onDelete}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const HomeScreen = () => {
  const { isDark, toggleTheme, themeAnim } = useTheme();
  
  // Interpolations matching HomePage
  const backgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#ffffff', '#000000']
  });
  const textColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0f172a', '#ffffff']
  });
  const glassBorderColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(59, 130, 246, 0.2)', 'rgba(148, 163, 184, 0.2)']
  });
  const blueColor = themeAnim.interpolate({ inputRange: [0, 1], outputRange: ['#3b82f6', '#3b67f6'] });
  
  const inputBackgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)']
  });

  const cardBackgroundColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255,255,255,0.8)', 'rgba(255,255,255,0.05)']
  });

  const iconFillColor = themeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0.6)', 'rgba(255,255,255,0.6)']
  });

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

  const CARD_WIDTH = Math.max(screenWidthState / 8, 240);
  const CARD_HEIGHT = 200; // Fixed height for cleaner grid
  const numColumns = Math.max(1, Math.floor(screenWidthState * 0.95 / CARD_WIDTH));
  const totalCardsWidth = numColumns * CARD_WIDTH;
  const spaceBetween = (screenWidthState - totalCardsWidth) / numColumns;

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
    const q = parentId === 'root' ? "'root' in parents" : `'${parentId}' in parents`;

    do {
      const res: { data: GoogleDriveResponse } = await axios.get('https://www.googleapis.com/drive/v3/files', {
        params: { q, fields: 'files(id, name, mimeType, modifiedTime, webContentLink), nextPageToken', orderBy: 'folder,name', pageSize: 100, pageToken: pageToken || undefined },
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      });
      if (res.data?.files) {
        allFiles.push(...res.data.files.map((f: GoogleDriveFile) => ({ ...f, accountEmail: account?.email, accountName: account?.name })));
        pageToken = res.data.nextPageToken || null;
      } else break;
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
    
    const handleOpenFile = () => {
      if (isFolder) {
        navigateIntoFolder(item);
        return;
      }
      let url = '';
      if (item.mimeType?.includes('document')) url = `https://docs.google.com/document/d/${item.id}/edit`;
      else if (item.mimeType?.includes('spreadsheet')) url = `https://docs.google.com/spreadsheets/d/${item.id}/edit`;
      else if (item.mimeType?.includes('presentation')) url = `https://docs.google.com/presentation/d/${item.id}/edit`;
      else url = `https://drive.google.com/file/d/${item.id}/view`;
      Linking.openURL(url).catch(() => setError('Failed to open'));
    };

    return (
      <FileCard
        item={item}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        margin={spaceBetween / 2}
        onPress={handleOpenFile}
        onDelete={() => deleteGoogleDriveFile(item.id, item.accountEmail)}
        onDownload={item.webContentLink ? () => handleDownload(item.webContentLink!) : undefined}
        textColor={textColor}
        glassBorderColor={glassBorderColor}
        blueColor={blueColor}
        cardBackgroundColor={cardBackgroundColor}
        iconFillColor={iconFillColor}
      />
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
      <MaterialCommunityIcons name="folder-open-outline" size={64} color={isDark ? "#fff" : "#000"} style={{ opacity: 0.6 }} />
      <Text style={styles.emptyFolderText}>This folder is empty</Text>
      <TouchableOpacity style={styles.goBackButton} onPress={() => setFolderStack((prev) => prev.slice(0, -1))}>
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.goBackButtonText}>Go back</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {loading && !userInfo.length ? <Animated.Text style={{ color: textColor as any }}>Loading your files...</Animated.Text> : (
        <>
          <Animated.Text style={[styles.welcomeText, { color: textColor as any }]}>Your Files</Animated.Text>
          <View style={styles.searchRow}>
            <TouchableOpacity onPress={onRefresh} disabled={refreshing || loading}>
              <Animated.View style={[styles.refreshButton, { backgroundColor: blueColor as any }]}>
                <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
              </Animated.View>
            </TouchableOpacity>
            <Animated.View style={[styles.searchContainer, { backgroundColor: inputBackgroundColor, borderColor: glassBorderColor }]}>
              <TextInput 
                style={[styles.searchInput, { color: isDark ? '#fff' : '#000' }]} 
                placeholder="Search files..." 
                placeholderTextColor={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"} 
                value={searchText} 
                onChangeText={setSearchText} 
                onSubmitEditing={handleSearchSubmit} 
                returnKeyType="search" 
              />
            </Animated.View>
            <TouchableOpacity onPress={handleSearchSubmit}>
              <Animated.View style={[styles.searchButton, { backgroundColor: blueColor as any }]}>
                <Animated.Text style={styles.buttonText}>Search</Animated.Text>
              </Animated.View>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={handleUpload}>
              <Animated.View style={[styles.uploadButton, { backgroundColor: blueColor as any }]}>
                <Animated.Text style={styles.buttonText}>Upload</Animated.Text>
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleUploadFolder}>
              <Animated.View style={[styles.uploadButton, { backgroundColor: blueColor as any, marginLeft: 12 }]}>
                <Animated.Text style={styles.buttonText}>Upload folder</Animated.Text>
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => isRequestReady && promptAsync()}>
              <Animated.View style={[styles.uploadButton, { backgroundColor: blueColor as any, marginLeft: 12 }]}>
                <Animated.Text style={styles.buttonText}>Add Google Account</Animated.Text>
              </Animated.View>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleTheme} style={{ marginLeft: 12 }}>
              <Animated.View style={[styles.themeToggle, { borderColor: glassBorderColor as any, backgroundColor: backgroundColor as any }]}>
                <MaterialCommunityIcons name={isDark ? 'white-balance-sunny' : 'moon-waning-crescent'} size={18} color={isDark ? '#fff' : '#000'} />
              </Animated.View>
            </TouchableOpacity>
          </View>
          <Animated.Text style={[styles.filterSectionLabel, { color: textColor as any }]}>Filter by account</Animated.Text>
          <View style={styles.filterRow}>
            <AnimatedTouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: !filterAccount ? blueColor : inputBackgroundColor,
                  borderColor: !filterAccount ? blueColor : glassBorderColor
                }
              ]}
              onPress={() => setFilterAccount(null)}
            >
              <Animated.Text style={[styles.filterChipText, { color: !filterAccount ? '#fff' : (textColor as any) }]}>All accounts</Animated.Text>
            </AnimatedTouchableOpacity>
            {uniqueAccounts.map((acc) => (
              <AnimatedTouchableOpacity
                key={acc.email}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterAccount === acc.email ? blueColor : inputBackgroundColor,
                    borderColor: filterAccount === acc.email ? blueColor : glassBorderColor
                  }
                ]}
                onPress={() => setFilterAccount(acc.email)}
              >
                <Animated.Text style={[styles.filterChipText, { color: filterAccount === acc.email ? '#fff' : (textColor as any) }]}>{acc.name || acc.email}</Animated.Text>
              </AnimatedTouchableOpacity>
            ))}
          </View>
          {folderStack.length > 0 && (
            <View style={styles.breadcrumbContainer}>
              <TouchableOpacity onPress={() => setFolderStack([])} style={styles.breadcrumbItem}>
                <MaterialCommunityIcons name="folder-multiple" size={18} color={isDark ? '#fff' : '#000'} />
                <Animated.Text style={[styles.breadcrumbText, { color: textColor as any }]}>All files</Animated.Text>
              </TouchableOpacity>
              {folderStack.map((crumb, idx) => (
                <View key={crumb.folderId} style={styles.breadcrumbRow}>
                  <Animated.Text style={[styles.breadcrumbSeparator, { color: textColor as any }]}> › </Animated.Text>
                  <TouchableOpacity onPress={() => setFolderStack((prev) => prev.slice(0, idx + 1))} style={styles.breadcrumbItem}><Animated.Text style={[styles.breadcrumbText, { color: textColor as any }]}>{crumb.folderName}</Animated.Text></TouchableOpacity>
                </View>
              ))}
            </View>
          )}
          <Animated.Text style={[styles.filterSectionLabel, { color: textColor as any }]}>Filter by file type</Animated.Text>
          <View style={[styles.filterRow, { marginBottom: 8 }]}>
            <AnimatedTouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor: !filterFileType ? blueColor : inputBackgroundColor,
                  borderColor: !filterFileType ? blueColor : glassBorderColor
                }
              ]}
              onPress={() => setFilterFileType(null)}
            >
              <Animated.Text style={[styles.filterChipText, { color: !filterFileType ? '#fff' : (textColor as any) }]}>All types</Animated.Text>
            </AnimatedTouchableOpacity>
            {(['document', 'spreadsheet', 'presentation', 'image', 'video', 'pdf', 'other'] as const).map((type) => (
              <AnimatedTouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: filterFileType === type ? blueColor : inputBackgroundColor,
                    borderColor: filterFileType === type ? blueColor : glassBorderColor
                  }
                ]}
                onPress={() => setFilterFileType(type)}
              >
                <Animated.Text style={[styles.filterChipText, { color: filterFileType === type ? '#fff' : (textColor as any) }]}>{FILE_TYPE_LABELS[type]}</Animated.Text>
              </AnimatedTouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

  // Use a themed animated container for both web and native so visuals match HomePage.
  return (
    <Animated.View style={[{ flex: 1 }, { backgroundColor }] as any}>
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
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 0 }}
        keyboardShouldPersistTaps="handled"
        indicatorStyle={isDark ? 'white' : 'black'}
      />
    </Animated.View>
  );
};

const pageFont = Platform.select({ web: 'Poppins, Arial, sans-serif', default: 'System' });

const styles = StyleSheet.create({
  headerContainer: { paddingHorizontal: 30, paddingTop: 60, paddingBottom: 20 },
  welcomeText: { fontSize: 40, fontWeight: '700', marginBottom: 30, fontFamily: pageFont, letterSpacing: -1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  searchContainer: { flex: 0.5, height: 50, borderRadius: 25, borderWidth: 1, justifyContent: 'center' },
  searchInput: { paddingHorizontal: 20, fontSize: 16, fontFamily: pageFont, height: '100%' },
  searchButton: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 22, borderRadius: 25, marginLeft: 12 },
  uploadButton: { backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 25 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.4, textAlign: 'center', fontFamily: pageFont },
  filterSectionLabel: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8, opacity: 0.7 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap' },
  filterChip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, marginRight: 8, marginBottom: 8 },
  filterChipText: { fontSize: 14, fontWeight: '600', fontFamily: pageFont },
  filterChipTextActive: { color: '#fff' },
  breadcrumbContainer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  breadcrumbRow: { flexDirection: 'row', alignItems: 'center' },
  breadcrumbItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(150,150,150,0.2)' },
  breadcrumbText: { fontSize: 14, fontWeight: '600', marginLeft: 4, fontFamily: pageFont },
  breadcrumbSeparator: { fontSize: 16, fontWeight: '700', fontFamily: pageFont, marginHorizontal: 4 },
  emptyFolderContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24 },
  emptyFolderText: { fontSize: 18, fontWeight: '600', marginTop: 16, fontFamily: pageFont, opacity: 0.7 },
  goBackButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3b82f6', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 25, marginTop: 20 },
  goBackButtonText: { color: '#fff', fontSize: 16, fontWeight: '700', fontFamily: pageFont },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '90%', maxWidth: 400 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#002b45', marginBottom: 16, fontFamily: pageFont },
  modalMostFreeButton: { backgroundColor: '#e9f2ff', padding: 16, borderRadius: 12, marginBottom: 12 },
  modalMostFreeText: { fontSize: 16, fontWeight: '600', color: '#3b82f6', fontFamily: pageFont },
  modalMostFreeSubtext: { fontSize: 12, color: '#666', marginTop: 4 },
  modalAccountButton: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalAccountText: { fontSize: 16, fontWeight: '600', color: '#002b45', fontFamily: pageFont },
  modalAccountEmail: { fontSize: 12, color: '#666', marginTop: 2, fontFamily: pageFont },
  modalStorageText: { fontSize: 12, color: '#3b82f6', marginTop: 4, fontFamily: pageFont },
  modalCancelButton: { marginTop: 16, padding: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 16, color: '#666', fontFamily: pageFont },
  themeToggle: { padding: 8, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  
  // New Card Styles
  featureCard: {
    width: '100%',
    height: '100%',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'flex-start',
  },
  featureTitle: { fontSize: 16, fontWeight: '700', marginTop: 8, fontFamily: pageFont },
  featureDesc: { fontSize: 12, opacity: 0.7, fontFamily: pageFont },
});

export default HomeScreen;  

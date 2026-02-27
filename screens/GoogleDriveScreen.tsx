import React, { useState, useEffect } from 'react';
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
  PixelRatio,
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

import {isGoogleDriveTokenValid} from "../src/Scripts/GoogleUtils";
import HomeScreenOneDrive from "./HomeScreenOneDrive";
import { NavigationContainer } from '@react-navigation/native';
WebBrowser.maybeCompleteAuthSession();

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const fileItemWidth = Math.max(screenWidth/8, 200);
const fileItemHeight = Math.max(screenWidth/7.5, 240);
const numColumns = Math.floor((screenWidth*0.95) / fileItemWidth);

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  webContentLink?: string;
  // Added: which Google account this file belongs to
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

const HomeScreen = () => {
  const [request, response, promptAsync] = Google.useAuthRequest(
    {
      clientId: '494172450205-daf4jjdss0u07gau3oge0unndfjvha0b.apps.googleusercontent.com',
      scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      // Always show account picker so you can add another account
      extraParams: {
        prompt: 'select_account',
      },
    }
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [userInfo, setUserInfo] = useState<GoogleDriveFile[]>([]);
  const [isRequestReady, setIsRequestReady] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterAccount, setFilterAccount] = useState<string | null>(null); // null = All accounts
  const [filterFileType, setFilterFileType] = useState<string | null>(null); // null = All types
  const [connectedAccountTokens, setConnectedAccountTokens] = useState<
    Array<{
      email: string;
      name?: string;
      accessToken: string;
      storageLimit?: number;
      storageUsage?: number;
    }>
  >([]);
  const [showUploadAccountPicker, setShowUploadAccountPicker] = useState(false);
  const [showUploadFolderAccountPicker, setShowUploadFolderAccountPicker] = useState(false);
  const [folderStack, setFolderStack] = useState<FolderBreadcrumb[]>([]);

    const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
    useEffect(() => {
        const updateDimensions = () => {
            setScreenWidth(Dimensions.get('window').width);
        };
        const subscription = Dimensions.addEventListener('change', updateDimensions);
        return () => subscription?.remove();
    }, []);

    const CARD_WIDTH =  Math.max(screenWidth/8, 225);;
    const CARD_HEIGHT = Math.max(screenWidth/7.5, 300);
    const GRID_PADDING = screenWidth * 0.05;
    const numColumns = Math.max(1, Math.floor(screenWidth*0.95 / CARD_WIDTH));
    const totalCardsWidth = numColumns * CARD_WIDTH;
    const remainingSpace = screenWidth - totalCardsWidth;
    const spaceBetween = remainingSpace / numColumns;

  useEffect(() => {
    setIsRequestReady(!!request);
  }, [request]);

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
          const newAccounts = connectedAccountTokens
            .filter((a) => a.email !== identity?.email)
            .concat(entry);
          setConnectedAccountTokens(newAccounts);
          setFolderStack([]);
          await loadCurrentFolder(newAccounts, []);
        }
      } catch (err) {
        console.error('Error handling response:', err);
        setError('Failed to authenticate');
      }
    };

    if (response) {
      handleResponse();
    } else {
      promptAsync();
    }
  }, [response, promptAsync]);
  const fetchDriveStorageQuota = async (
    accessToken: string
  ): Promise<{ limit?: number; usage?: number }> => {
    try {
      const res = await axios.get<{
        storageQuota?: { limit?: string; usage?: string };
      }>('https://www.googleapis.com/drive/v3/about', {
        params: { fields: 'storageQuota(limit,usage)' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const sq = res.data?.storageQuota;
      const limit = sq?.limit != null ? parseInt(sq.limit, 10) : undefined;
      const usage = sq?.usage != null ? parseInt(sq.usage, 10) : undefined;
      return { limit: Number.isFinite(limit) ? limit : undefined, usage: Number.isFinite(usage) ? usage : undefined };
    } catch (e) {
      console.warn('Failed to fetch Drive storage quota', e);
      return {};
    }
  };

  const formatStorageFree = (limit?: number, usage?: number): string => {
    if (limit == null || limit < 0) return 'Unlimited';
    const used = usage ?? 0;
    const freeBytes = Math.max(0, limit - used);
    const freeGB = freeBytes / (1024 * 1024 * 1024);
    if (freeGB >= 1) return `${freeGB.toFixed(1)} GB free`;
    const freeMB = freeBytes / (1024 * 1024);
    return `${Math.round(freeMB)} MB free`;
  };

  const fetchGoogleAccountIdentity = async (accessToken: string): Promise<GoogleAccountIdentity> => {
    try {
      const res = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      return {
        email: res.data?.email,
        name: res.data?.name,
      };
    } catch (e) {
      console.warn('Failed to fetch Google account identity', e);
      return {};
    }
  };

  const fetchFilesInFolder = async (
    accessToken: string,
    account: GoogleAccountIdentity,
    parentId: string
  ): Promise<GoogleDriveFile[]> => {
    const allFiles: GoogleDriveFile[] = [];
    let pageToken: string | null = null;

    const q = parentId === 'root'
      ? "'root' in parents"
      : `'${parentId}' in parents`;

    do {
      const res: { data: GoogleDriveResponse } = await axios.get<GoogleDriveResponse>(
        'https://www.googleapis.com/drive/v3/files',
        {
          params: {
            q,
            fields: 'files(id, name, mimeType, modifiedTime, webContentLink), nextPageToken',
            orderBy: 'folder,name',
            pageSize: 100,
            pageToken: pageToken || undefined,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      if (res.data?.files) {
        const tagged = res.data.files.map((file: GoogleDriveFile) => ({
          ...file,
          accountEmail: account?.email,
          accountName: account?.name,
        }));
        allFiles.push(...tagged);
        pageToken = res.data.nextPageToken || null;
      } else {
        break;
      }
    } while (pageToken);

    return allFiles;
  };

  const loadCurrentFolder = async (
    accountsOverride?: typeof connectedAccountTokens,
    folderStackOverride?: FolderBreadcrumb[]
  ) => {
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
          const files = await fetchFilesInFolder(
            acc.accessToken,
            { email: acc.email, name: acc.name },
            'root'
          );
          combined = combined.concat(files);
        }
      } else {
        const { accountEmail, folderId } = stack[stack.length - 1];
        const acc = accounts.find((a) => a.email === accountEmail);
        if (acc) {
          combined = await fetchFilesInFolder(
            acc.accessToken,
            { email: acc.email, name: acc.name },
            folderId
          );
        }
      }

      setUserInfo(combined);
    } catch (err) {
      console.error('Error loading folder:', err);
      setError(err instanceof Error ? err.message : 'Failed to load folder');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (connectedAccountTokens.length > 0) {
      loadCurrentFolder();
    }
  }, [folderStack, connectedAccountTokens.length]);

  const handleDownload = (url: string) => {
    Linking.openURL(url).catch((err) => {
      console.error('Error opening URL:', err);
      setError('Failed to download the file');
    });
  };

  const getUploadParents = (accountEmail: string): string[] | undefined => {
    if (folderStack.length === 0) return undefined;
    const last = folderStack[folderStack.length - 1];
    if (last.accountEmail === accountEmail) return [last.folderId];
    return undefined;
  };

  const performUpload = async (account: { email: string; name?: string; accessToken: string }) => {
    try {
      setShowUploadAccountPicker(false);
      const result = await DocumentPicker.getDocumentAsync();

      if (result.canceled) {
        return;
      }

      const file = result.assets?.[0] as { uri: string; name: string; mimeType?: string } | undefined;
      if (!file) {
        throw new Error('No file selected');
      }

      const { uri, name } = file;
      const blob = await uriToBlob(uri);

      const metadata: { name: string; parents?: string[] } = { name };
      const parents = getUploadParents(account.email);
      if (parents) metadata.parents = parents;

      const formData = new FormData();
      formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      formData.append('file', blob, name);

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
        },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed with status: ${res.status}`);
      }

      setError(null);
      await loadCurrentFolder();
    } catch (error) {
      console.error('Error during file upload:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while uploading the file.');
    }
  };

  const performUploadFolder = async (account: { email: string; name?: string; accessToken: string }) => {
    try {
      setShowUploadFolderAccountPicker(false);
      const result = await DocumentPicker.getDocumentAsync({ multiple: true });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const parents = getUploadParents(account.email);
      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      let uploaded = 0;

      for (const asset of result.assets) {
        const file = asset as { uri: string; name: string; mimeType?: string };
        const { uri, name } = file;
        const blob = await uriToBlob(uri);

        const metadata: { name: string; parents?: string[] } = { name };
        if (parents) metadata.parents = parents;

        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        formData.append('file', blob, name);

        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: { Authorization: `Bearer ${account.accessToken}` },
          body: formData,
        });

        if (res.ok) {
          uploaded++;
        }
      }

      setError(null);
      await loadCurrentFolder();
    } catch (error) {
      console.error('Error during folder upload:', error);
      setError(error instanceof Error ? error.message : 'An error occurred while uploading files.');
    }
  };

  const resolveAccounts = async () => {
    let accounts = [...connectedAccountTokens];
    if (accounts.length === 0 && response?.type === 'success' && response.params?.access_token) {
      const token = response.params.access_token;
      const identity = await fetchGoogleAccountIdentity(token);
      const { limit, usage } = await fetchDriveStorageQuota(token);
      const entry = {
        email: identity?.email || 'current',
        name: identity?.name,
        accessToken: token,
        storageLimit: limit,
        storageUsage: usage,
      };
      accounts = [entry];
      setConnectedAccountTokens(accounts);
    }
    return accounts;
  };

  const handleUpload = async () => {
    const accounts = await resolveAccounts();
    if (accounts.length === 0) {
      setError('Connect a Google account first.');
      return;
    }
    if (accounts.length === 1) {
      performUpload(accounts[0]);
      return;
    }
    setShowUploadAccountPicker(true);
  };

  const handleUploadFolder = async () => {
    const accounts = await resolveAccounts();
    if (accounts.length === 0) {
      setError('Connect a Google account first.');
      return;
    }
    if (accounts.length === 1) {
      performUploadFolder(accounts[0]);
      return;
    }
    setShowUploadFolderAccountPicker(true);
  };

  const uriToBlob = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    return await response.blob();
  };

  const deleteGoogleDriveFile = async (fileId: string, accountEmail?: string) => {
    try {
      let accessToken: string | null = null;
      if (accountEmail) {
        const acc = connectedAccountTokens.find((a) => a.email === accountEmail);
        accessToken = acc?.accessToken ?? null;
      }
      if (!accessToken && connectedAccountTokens[0]) {
        accessToken = connectedAccountTokens[0].accessToken;
      }
      if (!accessToken && response?.type === 'success' && 'params' in response) {
        accessToken = response.params?.access_token ?? null;
      }
      if (!accessToken) {
        throw new Error('Authentication error.');
      }

      const deleteRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (deleteRes.ok) {
        console.log('File deleted successfully.');
        setUserInfo((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
        await loadCurrentFolder();
        return;
      }

      if (deleteRes.status === 403) {
        console.log('No permission to delete. Attempting to move to trash...');

        const trashRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trashed: true }),
        });

        if (trashRes.ok) {
          console.log('File moved to trash.');
          setUserInfo((prevFiles) => prevFiles.filter((file) => file.id !== fileId));
          await loadCurrentFolder();
          return;
        } else {
          const trashError = await trashRes.text();
          console.error('Failed to move to trash:', trashError);
          throw new Error('Cannot delete or trash this file.');
        }
      }

      const deleteError = await deleteRes.text();
      console.error('Delete failed:', deleteError);
      throw new Error('Cannot delete this file.');
    } catch (error) {
      console.error('Error deleting file:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete file.');
    }
  };

  const handleSearchSubmit = () => {
    setSearchQuery(searchText);
  };

  const navigateIntoFolder = (item: GoogleDriveFile) => {
    if (!item.accountEmail) return;
    setFolderStack((prev) => prev.concat({
      accountEmail: item.accountEmail!,
      folderId: item.id,
      folderName: item.name,
    }));
  };

  const renderFileItem = ({ item }: { item: GoogleDriveFile }) => {
    const isFolder = item.mimeType === FOLDER_MIME;

    if (isFolder) {
      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigateIntoFolder(item)}
          style={{ borderRadius: 18 }}
        >
          <View style={{ borderRadius: 18 }}>
            <BlurView
              intensity={90}
              tint="light"
              style={[styles.fileItem, styles.folderItem, { width: CARD_WIDTH, height: CARD_HEIGHT, marginHorizontal: spaceBetween / 2 }]}
            >
              <MaterialCommunityIcons name="folder" size={48} color="#ffb74d" style={{ marginBottom: 8 }} />
              <Text style={styles.fileName}>{item.name}</Text>
              {item.accountEmail && (
                <Text style={styles.accountText}>
                  {item.accountName ? `${item.accountName} • ${item.accountEmail}` : item.accountEmail}
                </Text>
              )}
              {item.modifiedTime && (
                <Text style={styles.fileDate}>{new Date(item.modifiedTime).toLocaleDateString()}</Text>
              )}
              <Text style={styles.folderHint}>Tap to open</Text>
            </BlurView>
          </View>
        </TouchableOpacity>
      );
    }

    const handleOpenFile = () => {
      let openUrl = '';
      if (item.mimeType?.includes('document')) {
        openUrl = `https://docs.google.com/document/d/${item.id}/edit`;
      } else if (item.mimeType?.includes('spreadsheet')) {
        openUrl = `https://docs.google.com/spreadsheets/d/${item.id}/edit`;
      } else if (item.mimeType?.includes('presentation')) {
        openUrl = `https://docs.google.com/presentation/d/${item.id}/edit`;
      } else {
        openUrl = `https://drive.google.com/file/d/${item.id}/view`;
      }
      Linking.openURL(openUrl).catch((err) => {
        console.error('Error opening file:', err);
        setError('Failed to open the file');
      });
    };

    return (
      <View style={{ borderRadius: 18 }}>
        <BlurView intensity={90} tint="light" style={[styles.fileItem, { width: CARD_WIDTH, height: CARD_HEIGHT, marginHorizontal: spaceBetween / 2 }]}>
          <Text style={styles.fileName}>{item.name}</Text>
          {item.accountEmail && (
            <Text style={styles.accountText}>
              {item.accountName ? `${item.accountName} • ${item.accountEmail}` : item.accountEmail}
            </Text>
          )}
          {item.modifiedTime && (
            <Text style={styles.fileDate}>{new Date(item.modifiedTime).toLocaleDateString()}</Text>
          )}
          <View style={styles.fileActions}>
            {item.webContentLink && (
              <TouchableOpacity onPress={() => handleDownload(item.webContentLink!)}>
                <Text style={styles.downloadText}>Download</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleOpenFile()}>
              <Text style={styles.openText}>Open</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteGoogleDriveFile(item.id, item.accountEmail)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    );
  };

  const uniqueAccounts = React.useMemo(() => {
    const seen = new Set<string>();
    const accounts: { email: string; name?: string }[] = [];
    userInfo.forEach((f) => {
      if (f.accountEmail && !seen.has(f.accountEmail)) {
        seen.add(f.accountEmail);
        accounts.push({ email: f.accountEmail, name: f.accountName });
      }
    });
    return accounts;
  }, [userInfo]);

  const getFileTypeCategory = (mimeType?: string): string => {
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

  const FILE_TYPE_LABELS: Record<string, string> = {
    document: 'Documents',
    spreadsheet: 'Spreadsheets',
    presentation: 'Presentations',
    image: 'Images',
    video: 'Videos',
    pdf: 'PDFs',
    folder: 'Folders',
    other: 'Other',
  };

  const filteredFiles = userInfo
    .filter((file) => {
      if (!file.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterAccount && file.accountEmail !== filterAccount) return false;
      if (filterFileType && getFileTypeCategory(file.mimeType) !== filterFileType) return false;
      return true;
    })
    .sort((a, b) => {
      const aIsFolder = a.mimeType === FOLDER_MIME;
      const bIsFolder = b.mimeType === FOLDER_MIME;
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      const dateA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
      const dateB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
      return dateB - dateA; // newest first
    });

  const renderFilterChip = (label: string, isActive: boolean, onPress: () => void) => (
    <TouchableOpacity
      key={label}
      style={[styles.filterChip, isActive && styles.filterChipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {loading && !userInfo.length ? (
        <Text>Loading your files...</Text>
      ) : (
        <>
          <Text style={styles.welcomeText}>Your files</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search files"
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
              <Text style={styles.buttonText}>Search</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.uploadButton} onPress={handleUpload}>
              <Text style={styles.buttonText}>Upload</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.uploadButton, { marginLeft: 12 }]} onPress={handleUploadFolder}>
              <Text style={styles.buttonText}>Upload folder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uploadButton, { marginLeft: 12 }]}
              onPress={() => {
                if (isRequestReady) {
                  promptAsync();
                }
              }}
            >
              <Text style={styles.buttonText}>Add Google Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.filterSectionLabel}>Filter by account</Text>
          <View style={styles.filterRow}>
            {renderFilterChip('All accounts', filterAccount === null, () => setFilterAccount(null))}
            {uniqueAccounts.map((acc) => (
              <TouchableOpacity
                key={acc.email}
                style={[styles.filterChip, filterAccount === acc.email && styles.filterChipActive]}
                onPress={() => setFilterAccount(acc.email)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterAccount === acc.email && styles.filterChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {acc.name || acc.email}
                </Text>
              </TouchableOpacity>
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
                  <TouchableOpacity
                    onPress={() => setFolderStack((prev) => prev.slice(0, idx + 1))}
                    style={styles.breadcrumbItem}
                  >
                    <Text style={styles.breadcrumbText}>{crumb.folderName}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.filterSectionLabel}>Filter by file type</Text>
          <View style={[styles.filterRow, { marginBottom: 8 }]}>
            {renderFilterChip('All types', filterFileType === null, () => setFilterFileType(null))}
            {(['document', 'spreadsheet', 'presentation', 'image', 'video', 'pdf', 'other'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.filterChip, filterFileType === type && styles.filterChipActive]}
                onPress={() => setFilterFileType(type)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    filterFileType === type && styles.filterChipTextActive,
                  ]}
                >
                  {FILE_TYPE_LABELS[type]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );

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

  const uploadFolderAccountPickerModal = (
    <Modal
      visible={showUploadFolderAccountPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowUploadFolderAccountPicker(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowUploadFolderAccountPicker(false)}
      >
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Choose account to upload folder to</Text>
          {accountWithMostFreeSpace && (
            <TouchableOpacity
              style={styles.modalMostFreeButton}
              onPress={() => performUploadFolder(accountWithMostFreeSpace)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalMostFreeText}>Upload to account with most free space</Text>
              <Text style={styles.modalMostFreeSubtext}>
                {accountWithMostFreeSpace.name || accountWithMostFreeSpace.email} •{' '}
                {formatStorageFree(
                  accountWithMostFreeSpace.storageLimit,
                  accountWithMostFreeSpace.storageUsage
                )}
              </Text>
            </TouchableOpacity>
          )}
          {connectedAccountTokens.map((acc) => (
            <TouchableOpacity
              key={acc.email}
              style={styles.modalAccountButton}
              onPress={() => performUploadFolder(acc)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalAccountText}>{acc.name || acc.email}</Text>
              {acc.name && acc.email && (
                <Text style={styles.modalAccountEmail}>{acc.email}</Text>
              )}
              <Text style={styles.modalStorageText}>
                {formatStorageFree(acc.storageLimit, acc.storageUsage)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowUploadFolderAccountPicker(false)}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const uploadAccountPickerModal = (
    <Modal
      visible={showUploadAccountPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setShowUploadAccountPicker(false)}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={() => setShowUploadAccountPicker(false)}
      >
        <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Choose account to upload to</Text>
          {accountWithMostFreeSpace && (
            <TouchableOpacity
              style={styles.modalMostFreeButton}
              onPress={() => performUpload(accountWithMostFreeSpace)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalMostFreeText}>Upload to account with most free space</Text>
              <Text style={styles.modalMostFreeSubtext}>
                {accountWithMostFreeSpace.name || accountWithMostFreeSpace.email} •{' '}
                {formatStorageFree(
                  accountWithMostFreeSpace.storageLimit,
                  accountWithMostFreeSpace.storageUsage
                )}
              </Text>
            </TouchableOpacity>
          )}
          {connectedAccountTokens.map((acc) => (
            <TouchableOpacity
              key={acc.email}
              style={styles.modalAccountButton}
              onPress={() => performUpload(acc)}
              activeOpacity={0.7}
            >
              <Text style={styles.modalAccountText}>{acc.name || acc.email}</Text>
              {acc.name && acc.email && (
                <Text style={styles.modalAccountEmail}>{acc.email}</Text>
              )}
              <Text style={styles.modalStorageText}>
                {formatStorageFree(acc.storageLimit, acc.storageUsage)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setShowUploadAccountPicker(false)}
          >
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
      <TouchableOpacity
        style={styles.goBackButton}
        onPress={() => setFolderStack((prev) => prev.slice(0, -1))}
      >
        <MaterialCommunityIcons name="arrow-left" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.goBackButtonText}>Go back</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  // On web: use ScrollView + mapped items (avoids FlatList scroll bugs on RN Web)
  if (Platform.OS === 'web') {
    return (
      <LinearGradient colors={['#4facfe', '#00f2fe']} style={{ flex: 1 }}>
        {uploadAccountPickerModal}
        {uploadFolderAccountPickerModal}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={true}
        >
          {renderHeader()}
          {emptyFolderContent}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
            {filteredFiles.map((file) => (
              <View key={file.id}>{renderFileItem({ item: file })}</View>
            ))}
          </View>
          {loading && (
            <View style={{ marginTop: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#0000ff" />
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#4facfe', '#00f2fe']} style={{ flex: 1 }}>
      {uploadAccountPickerModal}
      {uploadFolderAccountPickerModal}
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
        showsVerticalScrollIndicator={true}
      />
    </LinearGradient>
  );
};


const styles = StyleSheet.create({
    headerContainer: {
        padding: 20,
        paddingTop: 50,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 24,
        color: '#002b45', // deep navy for contrast
        letterSpacing: 0.6,
    },
    loadingText: {
        fontSize: 18,
        color: '#002b45',
        fontWeight: '500',
    },
    searchRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 24,
    },
    searchInput: {
        height: 48,
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 25,
        paddingHorizontal: 18,
        color: '#002b45',
        fontSize: 16,
        flex: 0.45,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
    },
    searchButton: {
        backgroundColor: '#0280da',
        paddingVertical: 12,
        paddingHorizontal: 22,
        borderRadius: 25,
        marginLeft: 12,
        elevation: 4,
    },
    uploadButton: {
        backgroundColor: '#0280da',
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 25,
        elevation: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.4,
        textAlign: "center",
    },
    filterSectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#002b45',
        marginTop: 16,
        marginBottom: 8,
    },
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    filterChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.7)',
        marginRight: 8,
        marginBottom: 8,
    },
    filterChipActive: {
        backgroundColor: '#0280da',
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#002b45',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    breadcrumbContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 12,
    },
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    breadcrumbItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.6)',
    },
    breadcrumbText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#002b45',
        marginLeft: 4,
    },
    breadcrumbSeparator: {
        fontSize: 16,
        color: '#002b45',
        fontWeight: '700',
    },
    folderItem: {},
    folderHint: {
        fontSize: 12,
        color: '#336699',
        marginTop: 4,
    },
    emptyFolderContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        paddingHorizontal: 24,
    },
    emptyFolderText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#002b45',
        marginTop: 16,
    },
    goBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0280da',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        marginTop: 20,
    },
    goBackButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    listContainer: {
        paddingBottom: 20,
        // justifyContent: "center",
    },
    fileItem: {
        // width: fileItemWidth,
        // height: fileItemHeight,
        // marginHorizontal: (screenWidth-(Math.floor((screenWidth*0.95) / fileItemWidth)*fileItemWidth))/16,
        margin: 10,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.8)', // glassy look
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    fileName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#00334d',
        textAlign: 'center',
        marginTop: 8,
    },
    accountText: {
        fontSize: 12,
        color: '#336699',
        marginTop: 4,
        textAlign: 'center',
    },
    fileDate: {
        fontSize: 12,
        color: '#555',
        marginTop: 2,
    },
    downloadText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#4cafef',
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    deleteText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ff5252',
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    openText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#00bcd4',
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 12,
    },
    fileActions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginTop: 10,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 360,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#002b45',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalMostFreeButton: {
        backgroundColor: 'rgba(2,128,218,0.2)',
        borderWidth: 2,
        borderColor: '#0280da',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    modalMostFreeText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0280da',
    },
    modalMostFreeSubtext: {
        fontSize: 13,
        color: '#0280da',
        marginTop: 4,
        opacity: 0.9,
    },
    modalAccountButton: {
        backgroundColor: 'rgba(2,128,218,0.15)',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginBottom: 10,
    },
    modalAccountText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#002b45',
    },
    modalAccountEmail: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    modalStorageText: {
        fontSize: 13,
        color: '#0280da',
        fontWeight: '600',
        marginTop: 4,
    },
    modalCancelButton: {
        marginTop: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '600',
    },
});


export default HomeScreen;

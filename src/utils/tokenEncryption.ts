import CryptoJS from 'crypto-js';

const SALT = 'alldrive-token-v1';

/**
 * Derive a 256-bit key from the user UID for AES encryption.
 */
function deriveKey(uid: string): string {
  return CryptoJS.SHA256(uid + SALT).toString();
}

/**
 * Encrypt an access token before storing in Firestore.
 */
export function encryptToken(token: string, uid: string): string {
  const key = deriveKey(uid);
  return CryptoJS.AES.encrypt(token, key).toString();
}

/**
 * Decrypt an access token loaded from Firestore.
 * Returns null if decryption fails (e.g. corrupted or wrong key).
 */
export function decryptToken(encrypted: string, uid: string): string | null {
  try {
    const key = deriveKey(uid);
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || null;
  } catch {
    return null;
  }
}

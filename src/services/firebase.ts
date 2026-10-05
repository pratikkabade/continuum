import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  Firestore,
} from 'firebase/firestore';
import { ClipItem } from '../types/clipboard';

// Read Firebase config from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let isConfigured = false;

// Only initialize if minimum credentials exist
if (
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'AIzaSyExampleKeyForContinuumClipboard' &&
  !firebaseConfig.apiKey.includes('YOUR_')
) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    isConfigured = true;
    console.log('[Continuum] Firebase Cloud Database Connected');
  } catch (err) {
    console.warn('[Continuum] Firebase initialization skipped:', err);
  }
}

export function isFirebaseConfigured(): boolean {
  return isConfigured && db !== null;
}

/**
 * Real-time listener for cloud clipboard items
 */
export function subscribeToCloudClips(onClips: (clips: ClipItem[]) => void): () => void {
  if (!db) return () => {};

  try {
    const clipsRef = collection(db, 'clips');
    const q = query(clipsRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const cloudClips: ClipItem[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          cloudClips.push({
            id: data.id || docSnap.id,
            content: data.content || '',
            type: data.type || 'text',
            language: data.language,
            colorHex: data.colorHex,
            colorRgb: data.colorRgb,
            imageData: data.imageData,
            createdAt: data.createdAt || Date.now(),
            copyCount: data.copyCount || 0,
          });
        });
        if (cloudClips.length > 0) {
          onClips(cloudClips);
        }
      },
      (error) => {
        console.warn('[Continuum] Firestore snapshot error (fallback to local):', error.message);
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('[Continuum] Failed to subscribe to Firestore:', err);
    return () => {};
  }
}

/**
 * Persist a clip to Firestore Cloud
 */
export async function saveClipToCloud(clip: ClipItem): Promise<boolean> {
  if (!db) return false;
  try {
    // Avoid storing gigantic images exceeding Firestore 1MB document limit
    if (clip.content.length > 900000) {
      console.warn('[Continuum] Clip content exceeds 900KB, kept locally.');
      return false;
    }
    const clipRef = doc(db, 'clips', clip.id);
    await setDoc(clipRef, {
      id: clip.id,
      content: clip.content,
      type: clip.type,
      language: clip.language || null,
      colorHex: clip.colorHex || null,
      colorRgb: clip.colorRgb || null,
      createdAt: clip.createdAt,
      copyCount: clip.copyCount || 0,
    });
    return true;
  } catch (err) {
    console.warn('[Continuum] Failed to save clip to cloud:', err);
    return false;
  }
}

/**
 * Delete a clip from Firestore Cloud
 */
export async function deleteClipFromCloud(id: string): Promise<boolean> {
  if (!db) return false;
  try {
    const clipRef = doc(db, 'clips', id);
    await deleteDoc(clipRef);
    return true;
  } catch (err) {
    console.warn('[Continuum] Failed to delete clip from cloud:', err);
    return false;
  }
}

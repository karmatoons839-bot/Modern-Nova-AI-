/** Account-scoped browser recovery of real audio blobs. Cloud history remains authoritative for completed exports. */
import type { StudioSession } from './studio-session';

export type SavedSegment = { index: number; character: string; text: string; emotion: string | null; status: 'pending' | 'running' | 'done' | 'error'; blob?: Blob; error?: string | undefined };
type Recovery = { fingerprint: string; segments: SavedSegment[]; final?: Blob; finalWav?: Blob; historyId?: string };

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mn-voice-studio-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('projects');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not open project recovery storage.'));
  });
}

async function access<T>(key: string, value?: T): Promise<T | undefined> {
  const db = await database();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction('projects', value === undefined ? 'readonly' : 'readwrite');
      const store = tx.objectStore('projects');
      const request = value === undefined ? store.get(key) : store.put(value, key);
      tx.oncomplete = () => resolve(value === undefined ? request.result as T | undefined : value);
      tx.onerror = () => reject(new Error('Project recovery could not be saved on this device.'));
      tx.onabort = tx.onerror;
    });
  } finally { db.close(); }
}

export const loadDraft = (userId: string) => access<StudioSession>(`${userId}:draft`);
export const saveDraft = (userId: string, draft: StudioSession) => access(`${userId}:draft`, draft);
export const loadAudio = (userId: string) => access<Recovery>(`${userId}:audio`);
export const saveAudio = (userId: string, recovery: Recovery) => access(`${userId}:audio`, recovery);
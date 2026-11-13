/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DB_NAME = 'apex_slash_ai_audio_v1';
const STORE_NAME = 'clips';
const DB_VERSION = 1;

export interface CachedAiAudioRecord {
  key: string; // e.g. 'track:alpine' | 'track:custom' | 'sfx:fever'
  kind: 'track' | 'sfx';
  slotId: string;
  title: string;
  modelUsed: string;
  lyrics?: string;
  audioDataUrl: string;
  updatedAt: number;
}

function openAudioDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveAiAudioClip(record: CachedAiAudioRecord): Promise<void> {
  const db = await openAudioDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadAiAudioClip(key: string): Promise<CachedAiAudioRecord | null> {
  const db = await openAudioDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CachedAiAudioRecord | undefined) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function listAiAudioClips(): Promise<CachedAiAudioRecord[]> {
  const db = await openAudioDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as CachedAiAudioRecord[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function clearAiAudioClips(): Promise<void> {
  const db = await openAudioDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

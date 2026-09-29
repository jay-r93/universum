import { supabase } from '@/lib/supabase';

/**
 * Attachment reference stored in the workspace state instead of inline base64.
 * `dataUrl` is populated lazily when the attachment is displayed.
 */
export type AttachmentRef = {
  id: string;
  name: string;
  type: string;
  /** Supabase Storage path (cloud mode) or IndexedDB key (local mode). Absent on legacy inline attachments. */
  storageKey?: string;
  /** Human-readable size in KB. */
  size: number;
  duration?: number;
  poster?: string;
  /** Populated on-demand by loadAttachmentData. Legacy attachments store it inline. */
  dataUrl?: string;
};

const IDB_DB = 'universum-attachments';
const IDP_STORE = 'blobs';

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) { resolve(null); return; }
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDP_STORE)) db.createObjectStore(IDP_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function idbPut(key: string, blob: Blob): Promise<void> {
  const db = await openIdb();
  if (!db) throw new Error('IndexedDB nicht verfügbar');
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDP_STORE, 'readwrite');
    tx.objectStore(IDP_STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB write failed'));
  });
}

async function idbGet(key: string): Promise<Blob | null> {
  const db = await openIdb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(IDP_STORE, 'readonly');
    const req = tx.objectStore(IDP_STORE).get(key);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDP_STORE, 'readwrite');
    tx.objectStore(IDP_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function clearAllIdb(): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDP_STORE, 'readwrite');
    tx.objectStore(IDP_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Blob konnte nicht gelesen werden'));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = meta.match(/data:([^;]+)/)?.[1] ?? 'application/octet-stream';
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function extFromType(type: string): string {
  if (type === 'image/webp') return 'webp';
  if (type === 'video/webm') return 'webm';
  if (type === 'application/pdf') return 'pdf';
  if (type === 'text/plain') return 'txt';
  return 'bin';
}

/**
 * Stores a compressed attachment (as dataUrl) in Supabase Storage or IndexedDB.
 * Returns a lightweight reference to persist in the workspace state.
 */
export async function storeAttachment(
  dataUrl: string,
  meta: { id: string; name: string; type: string; size: number; duration?: number; poster?: string },
  mode: 'cloud' | 'local',
): Promise<AttachmentRef> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = extFromType(meta.type);
  const storageKey = mode === 'cloud'
    ? `user_${(await supabase?.auth.getUser())?.data.user?.id ?? 'local'}/${meta.id}.${ext}`
    : `local_${meta.id}`;

  if (mode === 'cloud' && supabase) {
    const { error } = await supabase.storage.from('attachments')
      .upload(storageKey, blob, { contentType: meta.type, upsert: false });
    if (error) throw new Error(`Upload fehlgeschlagen: ${error.message}`);
  } else {
    await idbPut(storageKey, blob);
  }

  return {
    id: meta.id,
    name: meta.name,
    type: meta.type,
    storageKey,
    size: meta.size,
    duration: meta.duration,
    poster: meta.poster,
  };
}

/**
 * Loads a stored attachment and returns its dataUrl for display.
 * Caches the result on the ref object.
 */
export async function loadAttachmentData(ref: AttachmentRef, mode: 'cloud' | 'local'): Promise<string> {
  if (ref.dataUrl) return ref.dataUrl;
  if (!ref.storageKey) throw new Error('Anhang ohne Speicherreferenz');

  let blob: Blob | null = null;
  if (mode === 'cloud' && supabase) {
    const { data, error } = await supabase.storage.from('attachments')
      .download(ref.storageKey);
    if (error || !data) throw new Error(`Download fehlgeschlagen: ${error?.message ?? 'unbekannt'}`);
    blob = data;
  } else {
    blob = await idbGet(ref.storageKey);
  }

  if (!blob) throw new Error('Anhang nicht gefunden');
  const dataUrl = await blobToDataUrl(blob);
  ref.dataUrl = dataUrl;
  return dataUrl;
}

/**
 * Deletes a stored attachment from Supabase Storage or IndexedDB.
 */
export async function deleteAttachment(ref: AttachmentRef, mode: 'cloud' | 'local'): Promise<void> {
  if (!ref.storageKey) return;
  if (mode === 'cloud' && supabase) {
    await supabase.storage.from('attachments').remove([ref.storageKey]);
  } else {
    await idbDelete(ref.storageKey);
  }
}

/**
 * Clears all locally stored attachments (IndexedDB).
 */
export async function clearLocalAttachments(): Promise<void> {
  await clearAllIdb();
}

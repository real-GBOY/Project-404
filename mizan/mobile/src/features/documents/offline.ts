// SDK 57's default `expo-file-system` export is the new File/Directory API;
// the classic promise-based API this module uses (documentDirectory,
// downloadAsync, makeDirectoryAsync, getInfoAsync, deleteAsync) lives under
// the `/legacy` subpath.
import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { tokenStore } from "@/lib/auth/token-store";
import { downloadDocumentUrl } from "./api";
import type { DocRow } from "./types";

/**
 * Real offline-document pinning: downloads the file bytes via
 * `expo-file-system` (attaching the bearer token itself, since this isn't a
 * browser session) into local app storage, and keeps a small AsyncStorage
 * index of what's pinned — backs the "Offline documents" rows on both the
 * Files screen and Settings.
 */
const INDEX_KEY = "mizan.offline-documents";
const DIR = `${FileSystem.documentDirectory}offline-documents/`;

export interface OfflineEntry {
  id: string;
  name: string;
  matterReference: string | null;
  sizeBytes: number;
  path: string;
  pinnedAt: string;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
}

async function readIndex(): Promise<Record<string, OfflineEntry>> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OfflineEntry>) : {};
  } catch {
    return {};
  }
}

async function writeIndex(index: Record<string, OfflineEntry>): Promise<void> {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* ignore */
  }
}

export async function listOfflineDocuments(): Promise<OfflineEntry[]> {
  const index = await readIndex();
  return Object.values(index);
}

export async function isPinnedOffline(id: string): Promise<boolean> {
  const index = await readIndex();
  return id in index;
}

export async function getOfflineTotalBytes(): Promise<number> {
  const entries = await listOfflineDocuments();
  return entries.reduce((sum, e) => sum + e.sizeBytes, 0);
}

export async function pinDocumentOffline(doc: DocRow): Promise<void> {
  await ensureDir();
  const path = `${DIR}${doc.id}`;
  const token = tokenStore.getAccess();
  await FileSystem.downloadAsync(downloadDocumentUrl(doc.id), path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const index = await readIndex();
  index[doc.id] = {
    id: doc.id,
    name: doc.name,
    matterReference: doc.matterReference,
    sizeBytes: doc.sizeBytes,
    path,
    pinnedAt: new Date().toISOString(),
  };
  await writeIndex(index);
}

export async function unpinDocumentOffline(id: string): Promise<void> {
  const index = await readIndex();
  const entry = index[id];
  if (entry) {
    await FileSystem.deleteAsync(entry.path, { idempotent: true });
    delete index[id];
    await writeIndex(index);
  }
}

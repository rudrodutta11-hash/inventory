import { db } from '../db';
import { getMeta, setMeta } from './meta';
import { exportData, validateBackup, type BackupFile } from './backup';

/**
 * Layer 3 — automatic off-device copy. Entirely optional and off until a
 * worker URL is pasted into Settings. Debounced 5 s after any mutation,
 * fire-and-forget, every failure silent except the status line in Settings.
 * One device, so last write wins — no conflict resolution.
 */

export type SyncStatus = 'off' | 'ok' | 'failing';

let timer: ReturnType<typeof setTimeout> | undefined;
let pushing = false;
let pushAgain = false;

export function generateSyncKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  let key = '';
  for (const byte of buf) key += chars[byte % chars.length];
  return key;
}

export async function ensureSyncKey(): Promise<string> {
  let key = await getMeta<string>('syncKey');
  if (!key) {
    key = generateSyncKey();
    await setMeta('syncKey', key);
  }
  return key;
}

async function syncEndpoint(): Promise<string | null> {
  const url = await getMeta<string>('syncUrl');
  if (!url) return null;
  const key = await ensureSyncKey();
  return `${url.replace(/\/+$/, '')}/sync/${key}`;
}

async function pushNow(): Promise<void> {
  if (pushing) {
    pushAgain = true;
    return;
  }
  pushing = true;
  try {
    const endpoint = await syncEndpoint();
    if (!endpoint) return;
    const data = await exportData();
    const res = await fetch(endpoint, { method: 'PUT', body: JSON.stringify(data) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await setMeta('lastSyncAt', new Date().toISOString());
    await setMeta('syncStatus', 'ok' satisfies SyncStatus);
  } catch {
    // silent by design; Settings shows "Sync failing"
    try {
      await setMeta('syncStatus', 'failing' satisfies SyncStatus);
    } catch { /* storage itself failing — nothing sane to do */ }
  } finally {
    pushing = false;
    if (pushAgain) {
      pushAgain = false;
      scheduleSync();
    }
  }
}

/** Debounce 5 seconds after any mutation, then push the full blob. */
export function scheduleSync(delayMs = 5000): void {
  if (typeof fetch !== 'function') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void pushNow();
  }, delayMs);
}

/** Push immediately (Settings "Sync now"). Throws on failure so the button can say so. */
export async function syncNow(): Promise<void> {
  const endpoint = await syncEndpoint();
  if (!endpoint) throw new Error('Sync is off');
  const data = await exportData();
  const res = await fetch(endpoint, { method: 'PUT', body: JSON.stringify(data) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await setMeta('lastSyncAt', new Date().toISOString());
  await setMeta('syncStatus', 'ok' satisfies SyncStatus);
}

/**
 * On app open: fetch the remote copy and compare. Returns the remote
 * backup if it is newer than local, so the app can offer a restore.
 * Never auto-overwrites local data.
 */
export async function checkRemote(): Promise<{ remote: BackupFile; remoteAt: string } | null> {
  try {
    const endpoint = await syncEndpoint();
    if (!endpoint) return null;
    const res = await fetch(endpoint);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!validateBackup(data)) return null;
    const localLatest = await latestLocalUpdate();
    if (data.exportedAt > localLatest) {
      return { remote: data, remoteAt: data.exportedAt };
    }
    return null;
  } catch {
    return null; // offline or worker down — silent
  }
}

async function latestLocalUpdate(): Promise<string> {
  const bottles = await db.bottles.toArray();
  let latest = '';
  for (const b of bottles) if (b.updatedAt > latest) latest = b.updatedAt;
  const lastSync = await getMeta<string>('lastSyncAt');
  if (lastSync && lastSync > latest) latest = lastSync;
  return latest;
}

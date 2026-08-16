import { db, type Bottle, type Pour, type Note, type Match, type Meta, type Photo } from '../db';
import { setMeta } from './meta';

export const SCHEMA_VERSION = 1;

export interface PhotoExport {
  id?: number;
  bottleId: number;
  kind: 'front' | 'back' | 'other';
  at: string;
  dataUrl: string;   // photo blob as a base64 data URL
}

export interface BackupFile {
  schemaVersion: number;
  exportedAt: string;
  bottles: Bottle[];
  pours: Pour[];
  notes: Note[];
  matches: Match[];
  photos: PhotoExport[];
  meta: Meta[];
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const type = header.slice(header.indexOf(':') + 1, header.indexOf(';'));
  const binary = atob(dataUrl.slice(comma + 1));
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return new Blob([buf], { type });
}

/** Serialise every table to one JSON-able object. */
export async function exportData(): Promise<BackupFile> {
  const [bottles, pours, notes, matches, photos, meta] = await Promise.all([
    db.bottles.toArray(),
    db.pours.toArray(),
    db.notes.toArray(),
    db.matches.toArray(),
    db.photos.toArray(),
    db.meta.toArray(),
  ]);
  const photoExports: PhotoExport[] = [];
  for (const p of photos) {
    photoExports.push({
      id: p.id,
      bottleId: p.bottleId,
      kind: p.kind,
      at: p.at,
      dataUrl: await blobToDataUrl(p.blob),
    });
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    bottles, pours, notes, matches,
    photos: photoExports,
    meta,
  };
}

export function validateBackup(data: unknown): data is BackupFile {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.schemaVersion === SCHEMA_VERSION &&
    Array.isArray(d.bottles) &&
    Array.isArray(d.pours) &&
    Array.isArray(d.notes) &&
    Array.isArray(d.matches) &&
    Array.isArray(d.photos) &&
    Array.isArray(d.meta)
  );
}

/** Wipe and repopulate every table inside one transaction. */
export async function importData(data: BackupFile): Promise<void> {
  const photos: Photo[] = data.photos.map((p) => ({
    id: p.id,
    bottleId: p.bottleId,
    kind: p.kind,
    at: p.at,
    blob: dataUrlToBlob(p.dataUrl),
  }));
  await db.transaction('rw', [db.bottles, db.pours, db.notes, db.matches, db.photos, db.meta], async () => {
    await Promise.all([
      db.bottles.clear(), db.pours.clear(), db.notes.clear(),
      db.matches.clear(), db.photos.clear(), db.meta.clear(),
    ]);
    await Promise.all([
      db.bottles.bulkAdd(data.bottles),
      db.pours.bulkAdd(data.pours),
      db.notes.bulkAdd(data.notes),
      db.matches.bulkAdd(data.matches),
      db.photos.bulkAdd(photos),
      db.meta.bulkAdd(data.meta),
    ]);
  });
}

/** One-tap export: hand the file to the OS share sheet, else download. */
export async function shareBackup(): Promise<void> {
  const data = await exportData();
  const json = JSON.stringify(data);
  const today = new Date().toISOString().slice(0, 10);
  const blob = new Blob([json], { type: 'application/json' });
  const file = new File([blob], `cabinet-${today}.json`, { type: 'application/json' });

  await setMeta('lastBackupAt', new Date().toISOString());
  await setMeta('editsSinceBackup', 0);

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch {
      // user cancelled the sheet or share failed — fall through to download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cabinet-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

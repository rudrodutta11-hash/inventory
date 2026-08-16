import { db } from '../db';
import { afterMutation } from './mutate';

/**
 * Compress on capture: max edge 1200px, JPEG at 0.7 quality — lands
 * around 150 KB per photo so a full export stays a single small file.
 */
export async function compressImage(file: File | Blob, maxEdge = 1200, quality = 0.7): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality);
  });
}

export async function addPhoto(bottleId: number, file: File, kind: 'front' | 'back' | 'other' = 'front'): Promise<void> {
  const blob = await compressImage(file);
  await db.photos.add({ bottleId, blob, kind, at: new Date().toISOString() });
  await afterMutation();
}

export async function deletePhoto(photoId: number): Promise<void> {
  await db.photos.delete(photoId);
  await afterMutation();
}

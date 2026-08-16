import { db } from '../db';

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function bumpEditsSinceBackup(): Promise<number> {
  const current = (await getMeta<number>('editsSinceBackup')) ?? 0;
  const next = current + 1;
  await setMeta('editsSinceBackup', next);
  return next;
}

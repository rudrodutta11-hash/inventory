import { db } from '../db';

/**
 * Next serial: max(existing numeric serial) + 1, zero-padded to 3.
 * Retired serials (finished bottles) are never reissued, which falls out
 * of scanning every bottle regardless of status.
 */
export async function nextSerial(): Promise<string> {
  const all = await db.bottles.toArray();
  let max = 0;
  for (const b of all) {
    const n = parseInt(b.serial, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, '0');
}

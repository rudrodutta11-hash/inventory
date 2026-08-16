import { db, type Bottle } from '../db';
import { afterMutation } from './mutate';

export interface PourResult {
  emptied: boolean;
  hasBackup: boolean;
  newRemainingMl: number;
}

/**
 * Log a pour: write a Pour row, decrement remainingMl (clamped to 0).
 * If the bottle empties it is marked finished; the caller decides whether
 * to offer "open a backup?" based on the returned flags.
 */
export async function logPour(bottle: Bottle, ml: number, note?: string): Promise<PourResult> {
  const now = new Date().toISOString();
  const newRemaining = Math.max(0, bottle.remainingMl - ml);
  const emptied = newRemaining <= 0;

  await db.transaction('rw', db.bottles, db.pours, async () => {
    await db.pours.add({ bottleId: bottle.id!, ml, at: now, note, kind: 'pour' });
    const patch: Partial<Bottle> = { remainingMl: newRemaining, updatedAt: now };
    if (emptied) {
      patch.status = 'finished';
      patch.isOpen = false;
      patch.finishedDate = now;
    }
    await db.bottles.update(bottle.id!, patch);
  });
  await afterMutation();

  return { emptied, hasBackup: emptied && bottle.sealedCount > 0, newRemainingMl: newRemaining };
}

/**
 * "Set level" drift correction: writes a correction row carrying the delta
 * (positive = spirit removed) so history stays auditable, then sets the level.
 */
export async function correctLevel(bottle: Bottle, newLevelMl: number, note?: string): Promise<PourResult> {
  const now = new Date().toISOString();
  const clamped = Math.min(bottle.sizeMl, Math.max(0, Math.round(newLevelMl)));
  const delta = bottle.remainingMl - clamped;
  const emptied = clamped <= 0;

  await db.transaction('rw', db.bottles, db.pours, async () => {
    await db.pours.add({ bottleId: bottle.id!, ml: delta, at: now, note, kind: 'correction' });
    const patch: Partial<Bottle> = { remainingMl: clamped, updatedAt: now };
    if (emptied) {
      patch.status = 'finished';
      patch.isOpen = false;
      patch.finishedDate = now;
    }
    await db.bottles.update(bottle.id!, patch);
  });
  await afterMutation();

  return { emptied, hasBackup: emptied && bottle.sealedCount > 0, newRemainingMl: clamped };
}

/**
 * "Open a backup?" accepted: decrement sealedCount, refill to sizeMl,
 * back to active with a fresh openedDate.
 */
export async function openBackup(bottleId: number): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.bottles, async () => {
    const b = await db.bottles.get(bottleId);
    if (!b || b.sealedCount <= 0) return;
    await db.bottles.update(bottleId, {
      sealedCount: b.sealedCount - 1,
      remainingMl: b.sizeMl,
      isOpen: true,
      status: 'active',
      finishedDate: undefined,
      openedDate: now,
      updatedAt: now,
    });
  });
  await afterMutation();
}

export async function markFinished(bottleId: number): Promise<void> {
  const now = new Date().toISOString();
  await db.bottles.update(bottleId, {
    status: 'finished',
    isOpen: false,
    remainingMl: 0,
    finishedDate: now,
    updatedAt: now,
  });
  await afterMutation();
}

/** Open a sealed bottle for the first time (from detail or add flow). */
export async function openBottle(bottleId: number): Promise<void> {
  const now = new Date().toISOString();
  const b = await db.bottles.get(bottleId);
  if (!b) return;
  const patch: Partial<Bottle> = { isOpen: true, openedDate: now, updatedAt: now };
  if (!b.isOpen && b.sealedCount > 0) {
    patch.sealedCount = b.sealedCount - 1;
    patch.remainingMl = b.sizeMl;
  }
  await db.bottles.update(bottleId, patch);
  await afterMutation();
}

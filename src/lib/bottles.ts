import { db, type Bottle, type Category } from '../db';
import { nextSerial } from './serial';
import { afterMutation } from './mutate';
import { recomputeRanking } from './ranking';

export interface NewBottleInput {
  name: string;
  category: Category;
  sizeMl: number;
  sealed: boolean;          // stage one: sealed or open
  status?: Bottle['status'];
  details?: Partial<Bottle>;
}

export async function addBottle(input: NewBottleInput): Promise<Bottle> {
  const now = new Date().toISOString();
  const serial = await nextSerial();
  const status = input.status ?? 'active';
  const bottle: Bottle = {
    serial,
    name: input.name.trim(),
    category: input.category,
    sizeMl: input.sizeMl,
    sealedCount: status === 'active' && input.sealed ? 1 : 0,
    isOpen: status === 'active' && !input.sealed,
    remainingMl: status === 'active' && !input.sealed ? input.sizeMl : 0,
    openedDate: status === 'active' && !input.sealed ? now : undefined,
    status,
    createdAt: now,
    updatedAt: now,
    ...input.details,
  };
  const id = await db.bottles.add(bottle);
  await afterMutation();
  return { ...bottle, id };
}

export async function updateBottle(id: number, patch: Partial<Bottle>): Promise<void> {
  await db.bottles.update(id, { ...patch, updatedAt: new Date().toISOString() });
  await afterMutation();
}

/** Hard delete, plus its pours, notes, matches and photos. Reindexes the category. */
export async function deleteBottle(bottle: Bottle): Promise<void> {
  const id = bottle.id!;
  await db.transaction('rw', [db.bottles, db.pours, db.notes, db.matches, db.photos], async () => {
    await db.pours.where('bottleId').equals(id).delete();
    await db.notes.where('bottleId').equals(id).delete();
    await db.photos.where('bottleId').equals(id).delete();
    await db.matches.where('a').equals(id).delete();
    await db.matches.where('b').equals(id).delete();
    await db.bottles.delete(id);
  });
  await recomputeRanking();
  await afterMutation();
}

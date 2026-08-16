import { db, type Bottle, type Category } from '../db';
import { scoreFor } from './score';
import { afterMutation } from './mutate';

/**
 * Binary insertion within category. Orders the list exactly and asks at
 * most ceil(log2 n) questions. The session is a pure state machine so it
 * can be unit-tested without a DOM or a database.
 */
export type Answer = 'new' | 'old' | 'close' | 'skip';

export interface InsertSession {
  lo: number;
  hi: number;
  skipped: number[];   // absolute indices excluded by "can't compare"
  done: boolean;
  insertAt: number;    // valid once done
  asked: number;       // question count, for the UI
}

export function startSession(listLength: number, lo = 0, hi = listLength): InsertSession {
  const s: InsertSession = { lo, hi, skipped: [], done: false, insertAt: lo, asked: 0 };
  if (lo >= hi) {
    s.done = true;
    s.insertAt = lo;
  }
  return s;
}

/** The index to ask about next, or null if the session is done. */
export function nextIndex(s: InsertSession): number | null {
  if (s.done) return null;
  const mid = Math.floor((s.lo + s.hi) / 2);
  if (!s.skipped.includes(mid)) return mid;
  // pick the next untried index in [lo, hi): scan out from mid
  for (let d = 1; d < s.hi - s.lo; d++) {
    const fwd = mid + d;
    if (fwd < s.hi && !s.skipped.includes(fwd)) return fwd;
    const back = mid - d;
    if (back >= s.lo && !s.skipped.includes(back)) return back;
  }
  return null; // none remain — caller settles via answer('skip') path or settle()
}

export function answer(s: InsertSession, index: number, result: Answer): InsertSession {
  const n: InsertSession = { ...s, skipped: [...s.skipped], asked: s.asked + 1 };
  switch (result) {
    case 'new':
      n.hi = index;
      break;
    case 'old':
      n.lo = index + 1;
      break;
    case 'close':
      // too close to call — settle adjacent, stop
      n.lo = index;
      n.hi = index;
      break;
    case 'skip':
      n.skipped.push(index);
      break;
  }
  if (n.lo >= n.hi) {
    n.done = true;
    n.insertAt = n.lo;
  } else if (nextIndex(n) === null) {
    // every index in range skipped — settle at the midpoint
    n.done = true;
    n.insertAt = Math.floor((n.lo + n.hi) / 2);
  }
  return n;
}

/** Active, ranked bottles of a category, best first. */
export async function rankedList(category: Category): Promise<Bottle[]> {
  const list = await db.bottles
    .where('category').equals(category)
    .filter((b) => b.status === 'active' && b.rankIndex !== undefined)
    .toArray();
  return list.sort((a, b) => (a.rankIndex ?? 0) - (b.rankIndex ?? 0));
}

async function writeOrder(ids: number[]): Promise<void> {
  const now = new Date().toISOString();
  await db.transaction('rw', db.bottles, async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.bottles.update(ids[i], {
        rankIndex: i,
        score: scoreFor(i, ids.length),
        updatedAt: now,
      });
    }
  });
}

/** Splice a bottle in at insertAt, reindex the category, recompute scores. */
export async function applyInsertion(category: Category, bottleId: number, insertAt: number): Promise<void> {
  const list = await rankedList(category);
  const ids = list.map((b) => b.id!).filter((id) => id !== bottleId);
  ids.splice(Math.min(insertAt, ids.length), 0, bottleId);
  await writeOrder(ids);
  await afterMutation();
}

/** Reindex + rescore a category after a bottle leaves it (finished/deleted). */
export async function recomputeCategory(category: Category): Promise<void> {
  const list = await rankedList(category);
  await writeOrder(list.map((b) => b.id!));
}

export async function recordMatch(a: number, b: number, result: 'a' | 'b' | 'tie' | 'skip'): Promise<void> {
  await db.matches.add({ a, b, result, at: new Date().toISOString() });
}

/**
 * Re-rank on demand: a forced head-to-head. If the loser currently sits
 * above the winner, remove it and binary-insert it into the range below
 * the winner (never a plain swap). Returns the session + context for the
 * UI to continue asking, or null if the order already agrees.
 */
export interface RerankPlan {
  moving: Bottle;              // the loser being re-inserted
  list: Bottle[];              // ranked list without the loser
  session: InsertSession;
}

export async function planRerank(category: Category, winnerId: number, loserId: number): Promise<RerankPlan | null> {
  const list = await rankedList(category);
  const wIdx = list.findIndex((b) => b.id === winnerId);
  const lIdx = list.findIndex((b) => b.id === loserId);
  if (wIdx === -1 || lIdx === -1) return null;
  if (lIdx > wIdx) return null; // loser already below winner
  const without = list.filter((b) => b.id !== loserId);
  const wIdxAfter = without.findIndex((b) => b.id === winnerId);
  const session = startSession(without.length, wIdxAfter + 1, without.length);
  return { moving: list[lIdx], list: without, session };
}

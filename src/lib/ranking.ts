import { db, type Bottle } from '../db';
import { scoreFor } from './score';
import { getMeta, setMeta } from './meta';
import { afterMutation } from './mutate';

/**
 * One ranked list for the whole cabinet, Beli-style. Every bottle —
 * whisky, rum, gin — inserts into the same order by head-to-head
 * questions (at most ceil(log2 n) of them, binary insertion).
 *
 * The list is a sequence of LEVELS. A level is one or more bottles that
 * are genuinely tied: answering "too close to call" places the new
 * bottle INTO the opponent's level, and everyone in a level shares the
 * same rank number and the same score. rankIndex stores the level
 * number, so ties are just equal rankIndex values.
 */
export type Answer = 'new' | 'old' | 'close' | 'skip';

export interface InsertSession {
  lo: number;
  hi: number;
  skipped: number[];   // level indices excluded by "can't compare"
  done: boolean;
  insertAt: number;    // level position once done
  tieAt?: number;      // set when "too close" — join this level instead
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

/** The level index to ask about next, or null if the session is done. */
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
  return null;
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
      // genuinely tied — join the opponent's level, same score
      n.lo = index;
      n.hi = index;
      n.tieAt = index;
      break;
    case 'skip':
      n.skipped.push(index);
      break;
  }
  if (n.lo >= n.hi) {
    n.done = true;
    n.insertAt = n.lo;
  } else if (nextIndex(n) === null) {
    // every level in range skipped — settle at the midpoint
    n.done = true;
    n.insertAt = Math.floor((n.lo + n.hi) / 2);
  }
  return n;
}

/** All ranked active bottles grouped into levels, best level first. */
export async function rankedLevels(): Promise<Bottle[][]> {
  const ranked = await db.bottles
    .filter((b) => b.status === 'active' && b.rankIndex !== undefined)
    .toArray();
  const byLevel = new Map<number, Bottle[]>();
  for (const b of ranked) {
    const list = byLevel.get(b.rankIndex!) ?? [];
    list.push(b);
    byLevel.set(b.rankIndex!, list);
  }
  return [...byLevel.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, list]) => list.sort((a, b) => a.name.localeCompare(b.name)));
}

/** Flat count of ranked bottles (for "#3 of 24" lines). */
export async function rankedCount(): Promise<number> {
  return db.bottles
    .filter((b) => b.status === 'active' && b.rankIndex !== undefined)
    .count();
}

async function writeLevels(levels: Bottle[][]): Promise<void> {
  const now = new Date().toISOString();
  const kept = levels.filter((level) => level.length > 0);
  await db.transaction('rw', db.bottles, async () => {
    for (let i = 0; i < kept.length; i++) {
      const score = scoreFor(i, kept.length);
      for (const b of kept[i]) {
        await db.bottles.update(b.id!, { rankIndex: i, score, updatedAt: now });
      }
    }
  });
}

/**
 * Place a bottle: into an existing level when tied (tieAt), otherwise as
 * a new level at insertAt. Renumbers every level and recomputes every
 * score — tied bottles share both.
 */
export async function applyInsertion(bottleId: number, insertAt: number, tieAt?: number): Promise<void> {
  const bottle = await db.bottles.get(bottleId);
  if (!bottle) return;
  const levels = (await rankedLevels())
    .map((level) => level.filter((b) => b.id !== bottleId))
    .filter((level) => level.length > 0);
  if (tieAt !== undefined && tieAt < levels.length) {
    levels[tieAt].push(bottle);
  } else {
    levels.splice(Math.min(insertAt, levels.length), 0, [bottle]);
  }
  await writeLevels(levels);
  await afterMutation();
}

/** Reindex + rescore after a ranked bottle leaves the cabinet. */
export async function recomputeRanking(): Promise<void> {
  await writeLevels(await rankedLevels());
}

export async function recordMatch(a: number, b: number, result: 'a' | 'b' | 'tie' | 'skip'): Promise<void> {
  await db.matches.add({ a, b, result, at: new Date().toISOString() });
}

/**
 * Re-rank on demand: a forced head-to-head between any two bottles. If
 * the loser sits at or above the winner's level, it is removed and
 * re-inserted by binary insertion into the range below the winner —
 * never a plain swap. Returns null when the order already agrees.
 */
export interface RerankPlan {
  moving: Bottle;        // the loser being re-inserted
  levels: Bottle[][];    // levels without the loser
  session: InsertSession;
}

export async function planRerank(winnerId: number, loserId: number): Promise<RerankPlan | null> {
  const levels = await rankedLevels();
  const levelOf = (id: number) => levels.findIndex((level) => level.some((b) => b.id === id));
  const wIdx = levelOf(winnerId);
  const lIdx = levelOf(loserId);
  if (wIdx === -1 || lIdx === -1) return null;
  if (lIdx > wIdx) return null; // loser already below winner
  const moving = levels[lIdx].find((b) => b.id === loserId)!;
  const without = levels
    .map((level) => level.filter((b) => b.id !== loserId))
    .filter((level) => level.length > 0);
  const wIdxAfter = without.findIndex((level) => level.some((b) => b.id === winnerId));
  const session = startSession(without.length, wIdxAfter + 1, without.length);
  return { moving, levels: without, session };
}

/**
 * One-time migration from the old per-category ranking: old rankIndex
 * values collide across categories (each category had its own #1), which
 * the level model would misread as ties. Rebuild one global order from
 * the old scores, every bottle on its own level.
 */
export async function ensureGlobalRanking(): Promise<void> {
  const scheme = await getMeta<string>('rankScheme');
  if (scheme === 'global-v2') return;
  const ranked = await db.bottles
    .filter((b) => b.status === 'active' && b.rankIndex !== undefined)
    .toArray();
  ranked.sort((a, b) =>
    (b.score ?? 0) - (a.score ?? 0) ||
    (a.rankIndex ?? 0) - (b.rankIndex ?? 0) ||
    a.name.localeCompare(b.name));
  await writeLevels(ranked.map((b) => [b]));
  await setMeta('rankScheme', 'global-v2');
}

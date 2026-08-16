import type { Bottle } from '../db';

/**
 * Match on name + distillery + serial. Typing "17" finds serial 017:
 * the query is compared against the serial both verbatim and as a number.
 * Ranking: serial hit > name prefix > substring > in-order subsequence.
 */
export function matchBottle(b: Bottle, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;

  const serialNum = parseInt(b.serial, 10);
  const qNum = parseInt(q, 10);
  if (b.serial.toLowerCase().includes(q)) return 100;
  if (Number.isFinite(qNum) && qNum === serialNum && /^\d+$/.test(q)) return 100;

  const hay = `${b.name} ${b.distillery ?? ''}`.toLowerCase();
  if (hay.startsWith(q)) return 90;
  const words = hay.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 80;
  if (hay.includes(q)) return 70;

  // in-order subsequence, e.g. "tlk" matches "talisker"
  let i = 0;
  for (const ch of hay) {
    if (ch === q[i]) i++;
    if (i === q.length) return 40;
  }
  return -1;
}

export function searchBottles(bottles: Bottle[], query: string): Bottle[] {
  const q = query.trim();
  if (!q) return [];
  return bottles
    .map((b) => ({ b, s: matchBottle(b, q) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || x.b.name.localeCompare(y.b.name))
    .map((x) => x.b);
}

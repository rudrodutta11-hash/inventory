import type { Bottle } from '../db';

export type WallSort = 'name' | 'level' | 'brand' | 'score';

export const WALL_SORTS: { key: WallSort; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'level', label: 'Level' },
  { key: 'brand', label: 'Brand' },
  { key: 'score', label: 'Score' },
];

/** Total spirit owned: what's in the open bottle plus sealed backups. */
export function totalMl(b: Bottle): number {
  return b.remainingMl + b.sealedCount * b.sizeMl;
}

export function sortBottles(bottles: Bottle[], mode: WallSort): Bottle[] {
  const byName = (a: Bottle, b: Bottle) => a.name.localeCompare(b.name);
  const sorted = [...bottles];
  switch (mode) {
    case 'level':
      // most spirit first — the shelf reads as a stock count
      sorted.sort((a, b) => totalMl(b) - totalMl(a) || byName(a, b));
      break;
    case 'brand':
      sorted.sort((a, b) =>
        (a.distillery ?? a.name).localeCompare(b.distillery ?? b.name) || byName(a, b));
      break;
    case 'score':
      // best first; unranked bottles sink to the end
      sorted.sort((a, b) =>
        (b.score ?? -1) - (a.score ?? -1) || byName(a, b));
      break;
    default:
      sorted.sort(byName);
  }
  return sorted;
}

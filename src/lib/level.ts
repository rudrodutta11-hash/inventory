import type { Pour } from '../db';

export interface LevelPoint {
  at: string;
  ml: number;
}

/**
 * Reconstruct the fill level over time from the pour log.
 * Pour and correction rows both carry ml as "spirit removed"
 * (corrections may be negative), so the level is a running subtraction.
 */
export function levelSeries(sizeMl: number, pours: Pour[], openedDate?: string): LevelPoint[] {
  const sorted = [...pours].sort((a, b) => a.at.localeCompare(b.at));
  const points: LevelPoint[] = [];
  let level = sizeMl;
  points.push({ at: openedDate ?? sorted[0]?.at ?? new Date().toISOString(), ml: level });
  for (const p of sorted) {
    level = Math.max(0, Math.min(sizeMl, level - p.ml));
    points.push({ at: p.at, ml: level });
  }
  return points;
}

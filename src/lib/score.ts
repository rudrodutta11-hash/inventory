/**
 * Score is derived from rank, never stored as an input.
 *   count == 1 -> 8.5
 *   otherwise  -> round(10 - (rankIndex / (count - 1)) * 6, 1)   // 10.0 -> 4.0
 */
export function scoreFor(rankIndex: number, count: number): number {
  if (count <= 1) return 8.5;
  return Math.round((10 - (rankIndex / (count - 1)) * 6) * 10) / 10;
}

import { describe, it, expect } from 'vitest';
import { sortBottles, totalMl } from '../src/lib/sort';
import type { Bottle } from '../src/db';

function b(over: Partial<Bottle>): Bottle {
  const now = '2026-08-16T12:00:00.000Z';
  return {
    serial: '001', name: 'X', category: 'single_malt', sizeMl: 700,
    sealedCount: 0, isOpen: true, remainingMl: 350, status: 'active',
    createdAt: now, updatedAt: now, ...over,
  };
}

const shelf: Bottle[] = [
  b({ name: 'Talisker 10', distillery: 'Talisker', remainingMl: 300, sealedCount: 1, score: 8.8 }),
  b({ name: 'Ardbeg 10', distillery: 'Ardbeg', remainingMl: 650, score: 10 }),
  b({ name: 'Nikka From the Barrel', distillery: 'Nikka', remainingMl: 100 }),
  b({ name: 'Buffalo Trace', distillery: 'Buffalo Trace', remainingMl: 500, score: 7 }),
];

describe('wall sorting', () => {
  it('name: alphabetical', () => {
    expect(sortBottles(shelf, 'name').map((x) => x.name))
      .toEqual(['Ardbeg 10', 'Buffalo Trace', 'Nikka From the Barrel', 'Talisker 10']);
  });

  it('level: most total spirit first, sealed backups counted', () => {
    // Talisker: 300 + 700 sealed = 1000, beats Ardbeg's 650
    expect(sortBottles(shelf, 'level').map((x) => x.name))
      .toEqual(['Talisker 10', 'Ardbeg 10', 'Buffalo Trace', 'Nikka From the Barrel']);
    expect(totalMl(shelf[0])).toBe(1000);
  });

  it('brand: by distillery, falling back to name', () => {
    const names = sortBottles(shelf, 'brand').map((x) => x.distillery);
    expect(names).toEqual(['Ardbeg', 'Buffalo Trace', 'Nikka', 'Talisker']);
  });

  it('score: best first, unranked last', () => {
    expect(sortBottles(shelf, 'score').map((x) => x.name))
      .toEqual(['Ardbeg 10', 'Talisker 10', 'Buffalo Trace', 'Nikka From the Barrel']);
  });

  it('does not mutate the input', () => {
    const before = shelf.map((x) => x.name);
    sortBottles(shelf, 'score');
    expect(shelf.map((x) => x.name)).toEqual(before);
  });
});

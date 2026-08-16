import { db, type Bottle, type Category } from '../db';
import { scoreFor } from './score';
import { afterMutation } from './mutate';
import { setMeta } from './meta';

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

interface SeedSpec {
  name: string;
  distillery?: string;
  category: Category;
  abv?: number;
  age?: number;
  region?: string;
  sizeMl?: number;
  cask?: string;
  cs?: boolean;          // cask strength
  fill: number;          // 0–1; 1 with sealed=own bottle sealed
  sealed?: number;
  openedDaysAgo?: number;
  finishedDaysAgo?: number;
  rank?: number;         // rankIndex within category
  buyAgain?: boolean;
  location?: string;
  price?: number;
}

const SPECS: SeedSpec[] = [
  // ---- active, open ----
  { name: 'Talisker 10', distillery: 'Talisker', category: 'single_malt', abv: 45.8, age: 10, region: 'Isle of Skye', fill: 0.44, sealed: 1, openedDaysAgo: 122, rank: 2, location: 'Cabinet — top shelf', price: 48 },
  { name: 'Lagavulin 16', distillery: 'Lagavulin', category: 'single_malt', abv: 43, age: 16, region: 'Islay', fill: 0.71, openedDaysAgo: 60, rank: 0, location: 'Cabinet — top shelf', price: 89 },
  { name: 'Glenfarclas 105', distillery: 'Glenfarclas', category: 'single_malt', abv: 60, region: 'Speyside', cask: 'Sherry', cs: true, fill: 0.28, openedDaysAgo: 210, rank: 1, location: 'Cabinet — top shelf', price: 55 },
  { name: 'Clynelish 14', distillery: 'Clynelish', category: 'single_malt', abv: 46, age: 14, region: 'Highlands', fill: 0.9, openedDaysAgo: 20, rank: 3, price: 52 },
  { name: 'Arran 10', distillery: 'Arran', category: 'single_malt', abv: 46, age: 10, region: 'Isle of Arran', fill: 0.12, openedDaysAgo: 290, rank: 4, price: 40 },
  { name: 'Johnnie Walker Black', category: 'blended_scotch', abv: 40, age: 12, fill: 0.55, openedDaysAgo: 75, rank: 0, price: 30 },
  { name: 'Buffalo Trace', distillery: 'Buffalo Trace', category: 'bourbon', abv: 45, region: 'Kentucky', fill: 0.62, sealed: 1, openedDaysAgo: 95, rank: 0, price: 28 },
  { name: 'Rittenhouse Rye', distillery: 'Heaven Hill', category: 'rye', abv: 50, fill: 0.8, openedDaysAgo: 30, rank: 0, price: 32 },
  { name: 'Redbreast 12', distillery: 'Midleton', category: 'irish', abv: 40, age: 12, cask: 'Sherry', fill: 0.35, openedDaysAgo: 150, rank: 0, price: 60 },
  { name: 'Nikka From the Barrel', distillery: 'Nikka', category: 'japanese', abv: 51.4, sizeMl: 500, cs: true, fill: 0.66, openedDaysAgo: 45, rank: 0, price: 45 },
  // ---- active, sealed only ----
  { name: 'Springbank 10', distillery: 'Springbank', category: 'single_malt', abv: 46, age: 10, region: 'Campbeltown', fill: 0, sealed: 1, rank: 5, price: 65 },
  { name: 'El Dorado 12', category: 'rum', abv: 40, age: 12, region: 'Guyana', fill: 0, sealed: 2, price: 38 },
  // ---- graveyard ----
  { name: 'Highland Park 12', distillery: 'Highland Park', category: 'single_malt', abv: 40, age: 12, region: 'Orkney', fill: 0, finishedDaysAgo: 40, buyAgain: true, price: 42 },
  { name: 'Aberlour 12', distillery: 'Aberlour', category: 'single_malt', abv: 40, age: 12, region: 'Speyside', cask: 'Double cask', fill: 0, finishedDaysAgo: 160, price: 44 },
  { name: 'Monkey Shoulder', category: 'blended_scotch', abv: 40, fill: 0, finishedDaysAgo: 320, buyAgain: false, price: 27 },
];

/** Load 12 active + 3 finished demo bottles, with pours, notes, matches and a ranking. */
export async function seedDemo(): Promise<void> {
  const now = new Date().toISOString();
  const rankCounts = new Map<Category, number>();
  for (const s of SPECS) {
    if (s.rank !== undefined && s.finishedDaysAgo === undefined) {
      rankCounts.set(s.category, (rankCounts.get(s.category) ?? 0) + 1);
    }
  }

  await db.transaction('rw', [db.bottles, db.pours, db.notes, db.matches], async () => {
    const bottles: Bottle[] = SPECS.map((s, i) => {
      const sizeMl = s.sizeMl ?? 700;
      const finished = s.finishedDaysAgo !== undefined;
      const open = !finished && s.fill > 0;
      const count = rankCounts.get(s.category) ?? 1;
      return {
        serial: String(i + 1).padStart(3, '0'),
        name: s.name,
        distillery: s.distillery,
        category: s.category,
        abv: s.abv,
        ageStatement: s.age,
        region: s.region,
        sizeMl,
        caskType: s.cask,
        caskStrength: s.cs,
        bottler: 'official',
        location: s.location,
        sealedCount: s.sealed ?? 0,
        isOpen: open,
        remainingMl: open ? Math.round(sizeMl * s.fill) : 0,
        openedDate: open ? iso(s.openedDaysAgo ?? 30) : undefined,
        purchaseDate: iso((s.openedDaysAgo ?? s.finishedDaysAgo ?? 30) + 14),
        purchasePrice: s.price,
        rankIndex: s.rank,
        score: finished ? 7.6 : s.rank !== undefined ? scoreFor(s.rank, count) : undefined,
        status: finished ? 'finished' : 'active',
        finishedDate: finished ? iso(s.finishedDaysAgo!) : undefined,
        notesQuick: s.buyAgain === undefined ? undefined : s.buyAgain ? 'Buy again' : 'Once was enough',
        createdAt: iso(400 - i),
        updatedAt: now,
      };
    });
    const ids = (await db.bottles.bulkAdd(bottles, { allKeys: true })) as number[];

    // a plausible pour history for the open bottles
    const pours = [];
    for (let i = 0; i < bottles.length; i++) {
      const b = bottles[i];
      if (!b.isOpen) continue;
      const poured = b.sizeMl - b.remainingMl;
      const n = Math.max(1, Math.min(6, Math.floor(poured / 45)));
      let left = poured;
      for (let k = 0; k < n; k++) {
        const ml = k === n - 1 ? left : Math.min(left, [30, 45, 60][k % 3]);
        if (ml <= 0) break;
        left -= ml;
        pours.push({
          bottleId: ids[i],
          ml,
          at: iso(Math.round(((SPECS[i].openedDaysAgo ?? 30) * (n - k)) / (n + 1))),
          kind: 'pour' as const,
        });
      }
    }
    await db.pours.bulkAdd(pours);

    await db.notes.bulkAdd([
      { bottleId: ids[0], at: iso(100), text: 'Pepper and salt spray. The one I reach for.', peat: 3, sweet: 2, body: 3 },
      { bottleId: ids[1], at: iso(50), text: 'Big smoke, long dried-fruit finish. Evening only.', peat: 5, sweet: 3, body: 4 },
      { bottleId: ids[8], at: iso(120), text: 'Christmas cake. Softer than expected at 40%.', peat: 0, sweet: 4, body: 3 },
    ]);

    await db.matches.bulkAdd([
      { a: ids[1], b: ids[0], result: 'a', at: iso(58) },
      { a: ids[2], b: ids[0], result: 'a', at: iso(200) },
      { a: ids[2], b: ids[1], result: 'b', at: iso(200) },
      { a: ids[3], b: ids[2], result: 'b', at: iso(18) },
      { a: ids[4], b: ids[3], result: 'b', at: iso(280) },
    ]);
  });
  // marks the cabinet as demo until it is cleared, so made-up bottles are
  // never mistaken for the real ones
  await setMeta('demoLoaded', true);
  await afterMutation();
}

/** One-tap clear: wipes every table. */
export async function clearAll(): Promise<void> {
  await db.transaction('rw', [db.bottles, db.pours, db.notes, db.matches, db.photos], async () => {
    await Promise.all([
      db.bottles.clear(), db.pours.clear(), db.notes.clear(),
      db.matches.clear(), db.photos.clear(),
    ]);
  });
  await setMeta('demoLoaded', false);
  await afterMutation();
}

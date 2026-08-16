// The acceptance-critical test: seed -> export -> wipe -> import ->
// deep equality of every table, photos byte-identical.
// An untested restore path is not a backup.
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, type Bottle } from '../src/db';
import { exportData, importData, validateBackup } from '../src/lib/backup';
import { nextSerial } from '../src/lib/serial';

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  const now = new Date().toISOString();
  return {
    serial: '001',
    name: 'Talisker 10',
    category: 'single_malt',
    sizeMl: 700,
    sealedCount: 1,
    isOpen: true,
    remainingMl: 310,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function wipe() {
  await Promise.all([
    db.bottles.clear(), db.pours.clear(), db.notes.clear(),
    db.matches.clear(), db.photos.clear(), db.meta.clear(),
  ]);
}

async function seed() {
  await db.bottles.bulkAdd([
    bottle(),
    bottle({ serial: '002', name: 'Lagavulin 16', abv: 43, ageStatement: 16, region: 'Islay', remainingMl: 497, rankIndex: 0, score: 10 }),
    bottle({ serial: '003', name: 'Monkey Shoulder', category: 'blended_scotch', status: 'finished', isOpen: false, remainingMl: 0, finishedDate: new Date().toISOString() }),
  ]);
  await db.pours.bulkAdd([
    { bottleId: 1, ml: 45, at: '2026-08-01T18:00:00.000Z', kind: 'pour' },
    { bottleId: 1, ml: -20, at: '2026-08-02T18:00:00.000Z', kind: 'correction', note: 'drift' },
  ]);
  await db.notes.add({ bottleId: 1, at: '2026-08-01T19:00:00.000Z', text: 'Pepper and brine.', peat: 3, sweet: 2, body: 3 });
  await db.matches.add({ a: 2, b: 1, result: 'a', at: '2026-08-03T18:00:00.000Z' });
  // a photo with recognisable bytes, plus a second to test ordering
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 250, 251, 252]);
  await db.photos.add({ bottleId: 1, blob: new Blob([bytes], { type: 'image/jpeg' }), kind: 'front', at: '2026-08-01T12:00:00.000Z' });
  await db.photos.add({ bottleId: 2, blob: new Blob([new Uint8Array(2048).map((_, i) => i % 256)], { type: 'image/jpeg' }), kind: 'back', at: '2026-08-02T12:00:00.000Z' });
  await db.meta.bulkAdd([
    { key: 'syncKey', value: 'abc123' },
    { key: 'editsSinceBackup', value: 7 },
  ]);
}

describe('backup round trip', () => {
  beforeEach(wipe);

  it('export -> wipe -> import restores every table byte-identically', async () => {
    await seed();

    const before = {
      bottles: await db.bottles.toArray(),
      pours: await db.pours.toArray(),
      notes: await db.notes.toArray(),
      matches: await db.matches.toArray(),
      meta: await db.meta.toArray(),
    };
    const photosBefore = await db.photos.toArray();
    const photoBytesBefore = await Promise.all(
      photosBefore.map(async (p) => ({
        id: p.id, bottleId: p.bottleId, kind: p.kind, at: p.at, type: p.blob.type,
        bytes: [...new Uint8Array(await p.blob.arrayBuffer())],
      })),
    );

    const exported = await exportData();
    expect(validateBackup(exported)).toBe(true);

    // simulate the file: stringify + parse
    const file = JSON.parse(JSON.stringify(exported));
    expect(validateBackup(file)).toBe(true);

    await wipe();
    expect(await db.bottles.count()).toBe(0);

    await importData(file);

    expect(await db.bottles.toArray()).toEqual(before.bottles);
    expect(await db.pours.toArray()).toEqual(before.pours);
    expect(await db.notes.toArray()).toEqual(before.notes);
    expect(await db.matches.toArray()).toEqual(before.matches);
    expect(await db.meta.toArray()).toEqual(before.meta);

    const photosAfter = await db.photos.toArray();
    const photoBytesAfter = await Promise.all(
      photosAfter.map(async (p) => ({
        id: p.id, bottleId: p.bottleId, kind: p.kind, at: p.at, type: p.blob.type,
        bytes: [...new Uint8Array(await p.blob.arrayBuffer())],
      })),
    );
    expect(photoBytesAfter).toEqual(photoBytesBefore);
  });

  it('rejects files that are not backups', () => {
    expect(validateBackup(null)).toBe(false);
    expect(validateBackup({})).toBe(false);
    expect(validateBackup({ schemaVersion: 99, bottles: [], pours: [], notes: [], matches: [], photos: [], meta: [] })).toBe(false);
  });
});

describe('serial allocation', () => {
  beforeEach(wipe);

  it('starts at 001, increments past the max, never reuses retired serials', async () => {
    expect(await nextSerial()).toBe('001');
    await db.bottles.add(bottle({ serial: '001' }));
    await db.bottles.add(bottle({ serial: '017', name: 'Finished one', status: 'finished' }));
    // 017 is retired (finished) but still counts: next must be 018, not 002
    expect(await nextSerial()).toBe('018');
  });
});

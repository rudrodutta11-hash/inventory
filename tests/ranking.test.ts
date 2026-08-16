import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db, type Bottle } from '../src/db';
import {
  startSession, nextIndex, answer, applyInsertion, rankedLevels,
  planRerank, ensureGlobalRanking,
  type Answer,
} from '../src/lib/ranking';
import { scoreFor } from '../src/lib/score';

/** Drive a session with an oracle that knows the new bottle's true position. */
function runWithOracle(listLength: number, truePos: number): { insertAt: number; asked: number } {
  let s = startSession(listLength);
  while (!s.done) {
    const idx = nextIndex(s);
    if (idx === null) break;
    s = answer(s, idx, idx >= truePos ? 'new' : 'old');
  }
  return { insertAt: s.insertAt, asked: s.asked };
}

describe('binary insertion (one global list)', () => {
  it('places the bottle exactly for every position, list of 11, within 5 questions', () => {
    for (let truePos = 0; truePos <= 11; truePos++) {
      const { insertAt, asked } = runWithOracle(11, truePos);
      expect(insertAt).toBe(truePos);
      expect(asked).toBeLessThanOrEqual(5);
    }
  });

  it('asks at most ceil(log2(n+1)) questions for n = 30', () => {
    for (let truePos = 0; truePos <= 30; truePos++) {
      const { asked } = runWithOracle(30, truePos);
      expect(asked).toBeLessThanOrEqual(Math.ceil(Math.log2(31)));
    }
  });

  it('empty list needs no questions', () => {
    const s = startSession(0);
    expect(s.done).toBe(true);
    expect(s.insertAt).toBe(0);
  });

  it('"too close" records a tie with the compared level and stops', () => {
    let s = startSession(8);
    const idx = nextIndex(s)!;
    s = answer(s, idx, 'close');
    expect(s.done).toBe(true);
    expect(s.tieAt).toBe(idx);
  });

  it('"can\'t compare" on every level terminates and never loops', () => {
    let s = startSession(8);
    let guard = 0;
    while (!s.done) {
      const idx = nextIndex(s);
      expect(idx).not.toBeNull();
      s = answer(s, idx!, 'skip');
      expect(++guard).toBeLessThan(50);
    }
    expect(s.insertAt).toBe(4);
    expect(s.tieAt).toBeUndefined();
  });

  it('mixed skips never revisit a skipped level', () => {
    let s = startSession(10);
    const seen: number[] = [];
    let guard = 0;
    while (!s.done) {
      const idx = nextIndex(s)!;
      expect(seen).not.toContain(idx);
      seen.push(idx);
      s = answer(s, idx, 'skip');
      expect(++guard).toBeLessThan(50);
    }
  });
});

// ---------- level semantics against the database ----------

function bottle(over: Partial<Bottle>): Bottle {
  const now = '2026-08-16T12:00:00.000Z';
  return {
    serial: '001', name: 'X', category: 'single_malt', sizeMl: 700,
    sealedCount: 0, isOpen: true, remainingMl: 350, status: 'active',
    createdAt: now, updatedAt: now, ...over,
  };
}

async function wipe() {
  await Promise.all([db.bottles.clear(), db.matches.clear(), db.meta.clear()]);
}

describe('global levels and tied scores', () => {
  beforeEach(wipe);

  it('cross-category bottles rank into one list', async () => {
    const a = await db.bottles.add(bottle({ serial: '001', name: 'Malt', category: 'single_malt', rankIndex: 0, score: 10 }));
    await db.bottles.add(bottle({ serial: '002', name: 'Rum', category: 'rum', rankIndex: 1, score: 7 }));
    const gin = await db.bottles.add(bottle({ serial: '003', name: 'Gin', category: 'gin' }));

    await applyInsertion(gin, 1); // between malt and rum
    const levels = await rankedLevels();
    expect(levels.map((l) => l.map((b) => b.name))).toEqual([['Malt'], ['Gin'], ['Rum']]);
    const malt = await db.bottles.get(a);
    expect(malt!.score).toBe(scoreFor(0, 3));
  });

  it('a tie joins the level: same rank number, same score', async () => {
    await db.bottles.add(bottle({ serial: '001', name: 'First', rankIndex: 0, score: 10 }));
    await db.bottles.add(bottle({ serial: '002', name: 'Second', rankIndex: 1, score: 7 }));
    const newcomer = await db.bottles.add(bottle({ serial: '003', name: 'Peer', category: 'bourbon' }));

    await applyInsertion(newcomer, 1, 1); // tied with Second
    const levels = await rankedLevels();
    expect(levels.length).toBe(2);
    expect(levels[1].map((b) => b.name).sort()).toEqual(['Peer', 'Second']);

    const [peer, second] = await Promise.all([
      db.bottles.get(newcomer),
      db.bottles.filter((b) => b.name === 'Second').first(),
    ]);
    expect(peer!.rankIndex).toBe(second!.rankIndex);
    expect(peer!.score).toBe(second!.score);
    // two levels: scores are the two-level spread, shared within the tie
    expect(peer!.score).toBe(scoreFor(1, 2));
  });

  it('re-rank splits a tie when one of the pair wins', async () => {
    await db.bottles.add(bottle({ serial: '001', name: 'A', rankIndex: 0, score: 8.5 }));
    const w = await db.bottles.add(bottle({ serial: '002', name: 'B', rankIndex: 0, score: 8.5 }));
    const l = (await db.bottles.filter((b) => b.name === 'A').first())!.id!;

    const plan = await planRerank(w, l);
    expect(plan).not.toBeNull();
    // only one level below the winner remains — no questions needed
    expect(plan!.session.done).toBe(true);
    await applyInsertion(l, plan!.session.insertAt, plan!.session.tieAt);

    const levels = await rankedLevels();
    expect(levels.map((lv) => lv.map((b) => b.name))).toEqual([['B'], ['A']]);
  });

  it('re-rank returns null when the order already agrees', async () => {
    const top = await db.bottles.add(bottle({ serial: '001', name: 'Top', rankIndex: 0 }));
    const low = await db.bottles.add(bottle({ serial: '002', name: 'Low', rankIndex: 1 }));
    expect(await planRerank(top, low)).toBeNull();
  });

  it('migration flattens colliding per-category ranks into one order by score', async () => {
    // old scheme: two categories each with a #1
    await db.bottles.add(bottle({ serial: '001', name: 'Best malt', category: 'single_malt', rankIndex: 0, score: 10 }));
    await db.bottles.add(bottle({ serial: '002', name: 'Best rum', category: 'rum', rankIndex: 0, score: 8.5 }));
    await db.bottles.add(bottle({ serial: '003', name: 'Lesser malt', category: 'single_malt', rankIndex: 1, score: 4 }));

    await ensureGlobalRanking();
    const levels = await rankedLevels();
    expect(levels.map((l) => l.map((b) => b.name))).toEqual([['Best malt'], ['Best rum'], ['Lesser malt']]);
    // running it again is a no-op (flag set)
    await ensureGlobalRanking();
    expect((await rankedLevels()).length).toBe(3);
  });
});

describe('derived score', () => {
  it('single bottle scores 8.5', () => {
    expect(scoreFor(0, 1)).toBe(8.5);
  });
  it('spans 10.0 to 4.0 across levels', () => {
    expect(scoreFor(0, 11)).toBe(10);
    expect(scoreFor(10, 11)).toBe(4);
  });
});

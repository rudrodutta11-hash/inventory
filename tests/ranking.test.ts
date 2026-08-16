import { describe, it, expect } from 'vitest';
import { startSession, nextIndex, answer, type Answer } from '../src/lib/ranking';
import { scoreFor } from '../src/lib/score';

/** Drive a session with an oracle that knows the new bottle's true position. */
function runWithOracle(listLength: number, truePos: number): { insertAt: number; asked: number } {
  let s = startSession(listLength);
  while (!s.done) {
    const idx = nextIndex(s);
    if (idx === null) break;
    // new bottle beats everything at index >= truePos
    s = answer(s, idx, idx >= truePos ? 'new' : 'old');
  }
  return { insertAt: s.insertAt, asked: s.asked };
}

describe('binary insertion', () => {
  it('places the bottle exactly for every position, list of 11 (12th bottle), within 5 questions', () => {
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

  it('"too close" settles adjacent to the compared bottle and stops', () => {
    let s = startSession(8);
    const idx = nextIndex(s)!;
    s = answer(s, idx, 'close');
    expect(s.done).toBe(true);
    expect(s.insertAt).toBe(idx);
  });

  it('"can\'t compare" on every bottle terminates and never loops', () => {
    let s = startSession(8);
    let guard = 0;
    while (!s.done) {
      const idx = nextIndex(s);
      expect(idx).not.toBeNull();
      s = answer(s, idx!, 'skip');
      expect(++guard).toBeLessThan(50);
    }
    // settles at the midpoint of the untouched range
    expect(s.insertAt).toBe(4);
  });

  it('skip mid-session excludes only that bottle and still lands correctly', () => {
    // true position 2 in a list of 5, but index 2 is unanswerable
    let s = startSession(5);
    let guard = 0;
    while (!s.done) {
      const idx = nextIndex(s)!;
      const result: Answer = idx === 2 ? 'skip' : idx >= 2 ? 'new' : 'old';
      s = answer(s, idx, result);
      expect(++guard).toBeLessThan(20);
    }
    // without the unanswerable bottle the placement can only be off by one
    expect(s.insertAt).toBeGreaterThanOrEqual(2);
    expect(s.insertAt).toBeLessThanOrEqual(3);
  });

  it('mixed skips never revisit a skipped index', () => {
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

describe('derived score', () => {
  it('single bottle in a category scores 8.5', () => {
    expect(scoreFor(0, 1)).toBe(8.5);
  });

  it('spans 10.0 (best) to 4.0 (worst)', () => {
    expect(scoreFor(0, 11)).toBe(10);
    expect(scoreFor(10, 11)).toBe(4);
  });

  it('rounds to one decimal', () => {
    expect(scoreFor(3, 11)).toBe(8.2);   // 10 - (3/10)*6 = 8.2
    expect(scoreFor(1, 3)).toBe(7);      // 10 - 3
  });

  it('recomputing after growth stays monotonic', () => {
    for (let count = 2; count <= 30; count++) {
      for (let i = 1; i < count; i++) {
        expect(scoreFor(i, count)).toBeLessThan(scoreFor(i - 1, count));
      }
    }
  });
});

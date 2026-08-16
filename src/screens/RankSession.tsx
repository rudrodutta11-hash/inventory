import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CATEGORY_LABELS, type Bottle } from '../db';
import {
  startSession, nextIndex, answer, applyInsertion, recordMatch, planRerank,
  rankedLevels, ensureGlobalRanking,
  type InsertSession,
} from '../lib/ranking';
import type { Answer } from '../lib/ranking';
import BottleSilhouette from '../components/BottleSilhouette';

interface LiveSession {
  bottle: Bottle;          // the bottle being placed
  levels: Bottle[][];      // the level list it is being placed into
  session: InsertSession;
}

export default function RankSession() {
  const bottles = useLiveQuery(() => db.bottles.where('status').equals('active').toArray(), []);
  const [live, setLive] = useState<LiveSession | null>(null);
  const [doneMsg, setDoneMsg] = useState('');
  const [pickPair, setPickPair] = useState<Bottle | null>(null);
  const [duel, setDuel] = useState<{ a: Bottle; b: Bottle } | null>(null);

  useEffect(() => {
    void ensureGlobalRanking();
  }, []);

  if (!bottles) return <div className="screen" />;

  const unranked = bottles.filter((b) => b.rankIndex === undefined)
    .sort((a, b) => a.name.localeCompare(b.name));
  const ranked = bottles.filter((b) => b.rankIndex !== undefined)
    .sort((a, b) => (a.rankIndex ?? 0) - (b.rankIndex ?? 0) || a.name.localeCompare(b.name));

  async function finishSession(s: LiveSession) {
    const { insertAt, tieAt } = s.session;
    await applyInsertion(s.bottle.id!, insertAt, tieAt);
    setLive(null);
    if (tieAt !== undefined && s.levels[tieAt]) {
      const partner = s.levels[tieAt][0];
      setDoneMsg(`${s.bottle.name} rated level with ${partner.name} — they share a score.`);
    } else {
      const count = s.levels.length + 1;
      setDoneMsg(`${s.bottle.name} placed #${insertAt + 1} of ${count}.`);
    }
  }

  async function startInsert(bottle: Bottle) {
    setDoneMsg('');
    const levels = (await rankedLevels())
      .map((level) => level.filter((b) => b.id !== bottle.id))
      .filter((level) => level.length > 0);
    const session = startSession(levels.length);
    const s: LiveSession = { bottle, levels, session };
    if (session.done) {
      await finishSession(s);
      return;
    }
    setLive(s);
  }

  async function respond(result: Answer) {
    if (!live) return;
    const idx = nextIndex(live.session);
    if (idx === null) return;
    const opponent = live.levels[idx][0];
    await recordMatch(
      live.bottle.id!, opponent.id!,
      result === 'new' ? 'a' : result === 'old' ? 'b' : result === 'close' ? 'tie' : 'skip',
    );
    const next = answer(live.session, idx, result);
    if (next.done) {
      await finishSession({ ...live, session: next });
    } else {
      setLive({ ...live, session: next });
    }
  }

  async function resolveDuel(winner: Bottle, loser: Bottle) {
    await recordMatch(winner.id!, loser.id!, 'a');
    const plan = await planRerank(winner.id!, loser.id!);
    setDuel(null);
    if (!plan) {
      setDoneMsg('The order already agrees. Nothing to move.');
      return;
    }
    const s: LiveSession = { bottle: plan.moving, levels: plan.levels, session: plan.session };
    if (plan.session.done) {
      await finishSession(s);
      return;
    }
    setLive(s);
  }

  // ---------- active comparison ----------
  if (live) {
    const idx = nextIndex(live.session);
    const level = idx !== null ? live.levels[idx] : null;
    const opponent = level?.[0];
    if (!opponent) return <div className="screen" />;
    return (
      <div className="screen">
        <h1 className="display" style={{ fontSize: 26 }}>Which do you rate higher?</h1>
        <p className="soft small" style={{ marginTop: 4 }}>
          Placing {live.bottle.name} · question {live.session.asked + 1}
        </p>
        <div className="compare-grid">
          <CompareCard bottle={live.bottle} onPick={() => void respond('new')} />
          <CompareCard
            bottle={opponent}
            tiedWith={level.length - 1}
            onPick={() => void respond('old')}
          />
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <button className="btn btn--full" onClick={() => void respond('close')}>
            Too close to call — rate them level
          </button>
          <button className="btn btn--quiet btn--full" onClick={() => void respond('skip')}>
            Can't compare
          </button>
          <button className="btn btn--quiet btn--full" onClick={() => setLive(null)}>
            Stop for now
          </button>
        </div>
      </div>
    );
  }

  // ---------- duel confirmation ----------
  if (duel) {
    return (
      <div className="screen">
        <h1 className="display" style={{ fontSize: 26 }}>Head to head</h1>
        <p className="soft small" style={{ marginTop: 4 }}>Which do you rate higher?</p>
        <div className="compare-grid">
          <CompareCard bottle={duel.a} onPick={() => void resolveDuel(duel.a, duel.b)} />
          <CompareCard bottle={duel.b} onPick={() => void resolveDuel(duel.b, duel.a)} />
        </div>
        <button className="btn btn--quiet btn--full" onClick={() => setDuel(null)}>Never mind</button>
      </div>
    );
  }

  // ---------- hub ----------
  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>Ranking</h1>
      <p className="soft" style={{ fontSize: 15 }}>
        One list for the whole cabinet. A few head-to-head questions place each
        bottle; too close to call means they share a score. <Link to="/rank/list">See the list</Link>.
      </p>

      {doneMsg && <p className="banner" role="status" style={{ marginTop: 16 }}>{doneMsg}</p>}

      <section className="section">
        <div className="section-head">To rank <span className="count">{unranked.length}</span></div>
        {unranked.length === 0 && <p className="small faint">Every bottle in the cabinet is ranked.</p>}
        {unranked.map((b) => (
          <button key={b.id} className="row row-btn" onClick={() => void startInsert(b)}>
            <span>
              <span className="display" style={{ marginRight: 10 }}>{b.serial}</span>
              {b.name}
            </span>
            <span className="small soft smallcaps">{CATEGORY_LABELS[b.category]}</span>
          </button>
        ))}
      </section>

      <section className="section">
        <div className="section-head">Re-rank</div>
        <p className="small soft" style={{ marginBottom: 8 }}>
          {pickPair
            ? `Pick an opponent for ${pickPair.name}.`
            : 'Pick any two ranked bottles to force a head-to-head.'}
        </p>
        {ranked
          .filter((b) => (pickPair ? b.id !== pickPair.id : true))
          .map((b) => (
            <button
              key={b.id}
              className="row row-btn"
              aria-pressed={pickPair?.id === b.id}
              onClick={() => {
                if (!pickPair) setPickPair(b);
                else if (pickPair.id === b.id) setPickPair(null);
                else {
                  setDuel({ a: pickPair, b });
                  setPickPair(null);
                }
              }}
            >
              <span>
                <span className="display" style={{ marginRight: 10 }}>#{(b.rankIndex ?? 0) + 1}</span>
                {b.name}
                {pickPair?.id === b.id && <span className="small soft"> · selected</span>}
              </span>
              <span className="mono small soft">{b.score?.toFixed(1)}</span>
            </button>
          ))}
        {pickPair && (
          <button className="btn btn--quiet btn--full" style={{ marginTop: 8 }} onClick={() => setPickPair(null)}>
            Cancel
          </button>
        )}
      </section>
    </div>
  );
}

function CompareCard({ bottle, tiedWith = 0, onPick }: { bottle: Bottle; tiedWith?: number; onPick: () => void }) {
  return (
    <button className="compare-card" onClick={onPick}>
      <BottleSilhouette bottle={bottle} width={64} />
      <span className="name">{bottle.name}</span>
      <span className="small soft">
        {bottle.ageStatement ? `${bottle.ageStatement} YO` : 'NAS'} · {CATEGORY_LABELS[bottle.category]}
      </span>
      {tiedWith > 0 && (
        <span className="small faint">tied with {tiedWith} other{tiedWith === 1 ? '' : 's'}</span>
      )}
    </button>
  );
}

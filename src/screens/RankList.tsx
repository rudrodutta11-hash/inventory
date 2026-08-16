import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATEGORY_LABELS, type Bottle } from '../db';
import { rankedLevels, ensureGlobalRanking } from '../lib/ranking';
import { useLiveQuery } from 'dexie-react-hooks';

/** The single ranked list. Tied bottles share a number and a score. */
export default function RankList() {
  const navigate = useNavigate();
  const [migrated, setMigrated] = useState(false);

  useEffect(() => {
    void ensureGlobalRanking().then(() => setMigrated(true));
  }, []);

  const levels = useLiveQuery<Bottle[][] | undefined>(
    () => (migrated ? rankedLevels() : Promise.resolve(undefined)),
    [migrated],
  );

  if (!levels) return <div className="screen" />;

  const total = levels.reduce((n, level) => n + level.length, 0);

  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>The list</h1>
      <p className="soft" style={{ fontSize: 15 }}>
        {total === 0
          ? 'One ranking for the whole cabinet.'
          : `${total} ${total === 1 ? 'bottle' : 'bottles'}, best first. Bottles rated level share a number.`}{' '}
        <Link to="/rank">Rank or re-rank</Link>.
      </p>

      {total === 0 && (
        <div className="empty">
          <h1>Nothing ranked yet</h1>
          <p>Rank a bottle and the list builds itself.</p>
          <Link to="/rank" className="btn btn--primary" style={{ textDecoration: 'none' }}>Start ranking</Link>
        </div>
      )}

      <section className="section" style={{ marginTop: 16 }}>
        {levels.map((level, i) =>
          level.map((b, j) => (
            <button
              key={b.id}
              className="rank-list-row row-btn"
              onClick={() => navigate(`/b/${b.serial}`)}
            >
              <span className="pos">{j === 0 ? `#${i + 1}` : '='}</span>
              <span>
                {b.name}
                <span className="small soft smallcaps" style={{ marginLeft: 8 }}>
                  {CATEGORY_LABELS[b.category]}
                </span>
                {level.length > 1 && (
                  <span className="small faint"> · tied</span>
                )}
              </span>
              <span className="score">{b.score?.toFixed(1)}</span>
            </button>
          )),
        )}
      </section>
    </div>
  );
}

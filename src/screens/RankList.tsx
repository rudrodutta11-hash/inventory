import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CATEGORY_LABELS, type Category } from '../db';

export default function RankList() {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = (location.state as { category?: Category } | null)?.category;
  const [category, setCategory] = useState<Category | undefined>(initial);

  const ranked = useLiveQuery(
    () =>
      db.bottles
        .filter((b) => b.status === 'active' && b.rankIndex !== undefined)
        .toArray(),
    [],
  );

  if (!ranked) return <div className="screen" />;

  const byCategory = new Map<Category, typeof ranked>();
  for (const b of ranked) {
    const list = byCategory.get(b.category) ?? [];
    list.push(b);
    byCategory.set(b.category, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => (a.rankIndex ?? 0) - (b.rankIndex ?? 0));
  }
  const categories = [...byCategory.keys()].sort((a, b) =>
    CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]));
  const shown = category && byCategory.has(category) ? [category] : categories;

  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>The lists</h1>
      <p className="soft" style={{ fontSize: 15 }}>
        Ranked by head-to-head. <Link to="/rank">Rank or re-rank</Link>.
      </p>

      {categories.length > 1 && (
        <div className="choice-row" style={{ marginTop: 16 }}>
          <button className="btn" aria-pressed={!category} onClick={() => setCategory(undefined)}>All</button>
          {categories.map((c) => (
            <button key={c} className="btn" aria-pressed={category === c} onClick={() => setCategory(c)}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {categories.length === 0 && (
        <div className="empty">
          <h1>Nothing ranked yet</h1>
          <p>Rank a bottle and the lists build themselves.</p>
          <Link to="/rank" className="btn btn--primary" style={{ textDecoration: 'none' }}>Start ranking</Link>
        </div>
      )}

      {shown.map((c) => (
        <section className="section" key={c}>
          <div className="section-head">
            {CATEGORY_LABELS[c]}
            <span className="count">{byCategory.get(c)!.length}</span>
          </div>
          {byCategory.get(c)!.map((b) => (
            <button
              key={b.id}
              className="rank-list-row row-btn"
              onClick={() => navigate(`/b/${b.serial}`)}
            >
              <span className="pos">#{(b.rankIndex ?? 0) + 1}</span>
              <span>{b.name}</span>
              <span className="score">{b.score?.toFixed(1)}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Bottle } from '../db';
import { searchBottles } from '../lib/fuzzy';
import { sortBottles, WALL_SORTS, type WallSort } from '../lib/sort';
import { getMeta, setMeta } from '../lib/meta';
import { fmtMl, fmtPct, monthsSince, fillFraction } from '../lib/format';
import { shareBackup } from '../lib/backup';
import WallItem from '../components/WallItem';
import BottleSilhouette from '../components/BottleSilhouette';
import { InstallBanner, BackupBanner, RemoteRestoreBanner, FirstRunCard, DemoBanner } from '../components/Banners';

export default function Cabinet() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const bottles = useLiveQuery(() => db.bottles.toArray(), []);
  const sortMode = useLiveQuery(
    async () => (await getMeta<WallSort>('wallSort')) ?? 'name', [], 'name' as WallSort);
  if (!bottles) return <div className="screen" />;

  const active = bottles.filter((b) => b.status === 'active');
  const openAll = sortBottles(active.filter((b) => b.isOpen), sortMode ?? 'name');
  const searching = query.trim().length > 0;
  // typing filters the wall itself; the dropdown only lists matches that
  // are not on the wall (sealed-only, finished, wishlist)
  const open = searching ? searchBottles(openAll, query) : openAll;
  const offWallHits = searching
    ? searchBottles(bottles.filter((b) => !(b.status === 'active' && b.isOpen)), query)
    : [];
  const sealedTotal = active.reduce((n, b) => n + b.sealedCount, 0);
  const needsFinishing = openAll.filter(
    (b) => fillFraction(b.remainingMl, b.sizeMl) < 0.33 && monthsSince(b.openedDate) >= 6,
  );

  if (active.length === 0) {
    return (
      <div className="screen">
        <FirstRunCard />
        <InstallBanner />
        <RemoteRestoreBanner />
        <div className="empty">
          <h1>The cabinet is empty</h1>
          <p>Every collection starts with one bottle. Put yours on the shelf.</p>
          <Link to="/add" className="btn btn--primary btn--full" style={{ textDecoration: 'none', display: 'flex' }}>
            Add a bottle
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="search-wrap">
        <input
          type="search"
          placeholder="Search name, distillery or serial"
          aria-label="Search bottles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {offWallHits.length > 0 && (
          <div className="search-results" role="listbox" aria-label="Matches not on the shelf">
            {offWallHits.slice(0, 6).map((b) => (
              <SearchHit key={b.id} bottle={b} onGo={() => navigate(`/b/${b.serial}`)} />
            ))}
          </div>
        )}
        {searching && open.length === 0 && offWallHits.length === 0 && (
          <div className="search-results">
            <p style={{ padding: 12 }} className="soft">Nothing matches. Try a serial or part of a name.</p>
          </div>
        )}
      </div>

      <DemoBanner />
      <InstallBanner />
      <RemoteRestoreBanner />
      <BackupBanner onExport={() => void shareBackup()} />

      {openAll.length > 1 && !searching && (
        <div className="sort-row" role="group" aria-label="Sort the shelf">
          <span className="smallcaps small soft">Sort</span>
          {WALL_SORTS.map((s) => (
            <button
              key={s.key}
              className="sort-btn"
              aria-pressed={sortMode === s.key}
              onClick={() => void setMeta('wallSort', s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {open.length > 0 && (
        <section className="section" style={{ marginTop: 8 }}>
          <div className="wall">
            {open.map((b) => <WallItem key={b.id} bottle={b} width={84} />)}
          </div>
        </section>
      )}
      {searching && open.length === 0 && offWallHits.length > 0 && (
        <p className="soft small" style={{ marginTop: 12 }}>Nothing open matches — the matches above are sealed, finished or wished for.</p>
      )}

      {sealedTotal > 0 && (
        <section className="section">
          <details className="fold">
            <summary>{sealedTotal === 1 ? '1 sealed bottle' : `${sealedTotal} sealed bottles`}</summary>
            <div>
              {active.filter((b) => b.sealedCount > 0).map((b) => (
                <button key={b.id} className="row row-btn" onClick={() => navigate(`/b/${b.serial}`)}>
                  <span>
                    <span className="display" style={{ marginRight: 10 }}>{b.serial}</span>
                    {b.name}
                    {b.isOpen && <span className="small soft"> · also open</span>}
                  </span>
                  <span className="mono soft">{'×'}{b.sealedCount}</span>
                </button>
              ))}
            </div>
          </details>
        </section>
      )}

      {needsFinishing.length > 0 && (
        <section className="section">
          <div className="section-head">Needs finishing</div>
          <div className="needs-strip">
            {needsFinishing.map((b) => <WallItem key={b.id} bottle={b} width={56} />)}
          </div>
        </section>
      )}

      <section className="section">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link to="/graveyard" className="soft" style={{ fontSize: 15 }}>Graveyard</Link>
          <Link to="/wishlist" className="soft" style={{ fontSize: 15 }}>Wishlist</Link>
        </div>
      </section>
    </div>
  );
}

function SearchHit({ bottle, onGo }: { bottle: Bottle; onGo: () => void }) {
  return (
    <button className="search-hit" onClick={onGo}>
      <span className="serial">{bottle.serial}</span>
      <BottleSilhouette bottle={bottle} width={22} />
      <span style={{ flex: 1 }}>
        {bottle.name}
        {bottle.distillery && <span className="small soft"> · {bottle.distillery}</span>}
      </span>
      {bottle.isOpen && (
        <span className="mono small soft">
          {fmtMl(bottle.remainingMl)} · {fmtPct(bottle.remainingMl, bottle.sizeMl)}
        </span>
      )}
      {!bottle.isOpen && bottle.status === 'active' && <span className="small soft smallcaps">sealed</span>}
      {bottle.status === 'finished' && <span className="small soft smallcaps">finished</span>}
    </button>
  );
}

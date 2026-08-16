import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { fmtDate } from '../lib/format';
import { updateBottle } from '../lib/bottles';
import BottleSilhouette from '../components/BottleSilhouette';

/** Finished bottles: empty outlines, dated, final score, "Buy again?" flag. */
export default function Graveyard() {
  const navigate = useNavigate();
  const finished = useLiveQuery(
    () => db.bottles.where('status').equals('finished').toArray(),
    [],
  );
  if (!finished) return <div className="screen" />;

  const sorted = [...finished].sort((a, b) =>
    (b.finishedDate ?? '').localeCompare(a.finishedDate ?? ''));

  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>Graveyard</h1>
      <p className="soft" style={{ fontSize: 15, marginBottom: 20 }}>
        {sorted.length === 0
          ? 'Nothing finished yet. It comes to us all.'
          : `${sorted.length} finished ${sorted.length === 1 ? 'bottle' : 'bottles'}, newest first.`}
      </p>

      <div className="grave-grid">
        {sorted.map((b) => (
          <div key={b.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button className="wall-item" onClick={() => navigate(`/b/${b.serial}`)}>
              <BottleSilhouette bottle={b} width={72} />
              <span className="name">{b.name}</span>
            </button>
            <span className="small faint mono">{fmtDate(b.finishedDate)}</span>
            {b.score !== undefined && <span className="mono small">{b.score.toFixed(1)}</span>}
            <button
              className="btn btn--quiet"
              style={{ minHeight: 36, padding: '0 8px', fontSize: 13 }}
              aria-pressed={b.notesQuick === 'Buy again'}
              onClick={() =>
                void updateBottle(b.id!, {
                  notesQuick: b.notesQuick === 'Buy again' ? undefined : 'Buy again',
                })}
            >
              {b.notesQuick === 'Buy again' ? 'Would buy again' : 'Buy again?'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

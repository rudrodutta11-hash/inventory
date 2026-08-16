import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CATEGORY_LABELS } from '../db';
import { fmtMl, fmtPct, fmtDate, timeAgo, fmtSize } from '../lib/format';
import { levelSeries } from '../lib/level';
import { openBackup, markFinished, openBottle, type PourResult } from '../lib/pour';
import { updateBottle, deleteBottle } from '../lib/bottles';
import { addPhoto } from '../lib/photos';
import BottleSilhouette from '../components/BottleSilhouette';
import PourSheet from '../components/PourSheet';
import ConfirmDialog from '../components/ConfirmDialog';
import Sparkline from '../components/Sparkline';

export default function BottleDetail({ pourOnOpen = false }: { pourOnOpen?: boolean }) {
  const { serial } = useParams<{ serial: string }>();
  const navigate = useNavigate();

  const bottle = useLiveQuery(
    () => (serial ? db.bottles.where('serial').equals(serial).first() : undefined),
    [serial],
  );
  const pours = useLiveQuery(
    () => (bottle?.id ? db.pours.where('bottleId').equals(bottle.id).toArray() : []),
    [bottle?.id],
  );
  const notes = useLiveQuery(
    () => (bottle?.id ? db.notes.where('bottleId').equals(bottle.id).reverse().sortBy('at') : []),
    [bottle?.id],
  );
  const photos = useLiveQuery(
    () => (bottle?.id ? db.photos.where('bottleId').equals(bottle.id).toArray() : []),
    [bottle?.id],
  );
  const rankInfo = useLiveQuery(
    async () => {
      if (!bottle || bottle.rankIndex === undefined) return undefined;
      const ranked = await db.bottles
        .filter((b) => b.status === 'active' && b.rankIndex !== undefined)
        .toArray();
      return {
        total: ranked.length,
        tied: ranked.filter((b) => b.rankIndex === bottle.rankIndex && b.id !== bottle.id).length,
      };
    },
    [bottle?.id, bottle?.rankIndex],
  );

  const [sheetOpen, setSheetOpen] = useState(pourOnOpen);
  const [toast, setToast] = useState('');
  const [offerBackup, setOfferBackup] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [sliders, setSliders] = useState({ peat: 0, sweet: 0, body: 0 });
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  if (bottle === undefined) return <div className="screen" />;
  if (!bottle) {
    return (
      <div className="screen">
        <div className="empty">
          <h1>No bottle {serial}</h1>
          <p>Nothing in the ledger under that serial.</p>
          <Link to="/" className="btn" style={{ textDecoration: 'none' }}>Back to the cabinet</Link>
        </div>
      </div>
    );
  }

  const finished = bottle.status === 'finished';

  function say(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  function handlePourResult(result: PourResult, ml: number, kind: 'pour' | 'correction') {
    setSheetOpen(false);
    if (kind === 'pour') say(`Poured ${fmtMl(ml)}.`);
    else say(`Level set to ${fmtMl(result.newRemainingMl)}.`);
    if (result.emptied && result.hasBackup) setOfferBackup(true);
    else if (result.emptied) say('Bottle finished. Moved to the graveyard.');
  }

  return (
    <div className="screen">
      <p className="small">
        <Link to="/" className="soft">← Cabinet</Link>
      </p>

      <div className="detail-head" style={{ marginTop: 12 }}>
        <BottleSilhouette bottle={bottle} width={110} animate />
        <div>
          <div className="serial">{bottle.serial}</div>
          <h1>{bottle.name}</h1>
          {bottle.distillery && <p className="soft">{bottle.distillery}</p>}
          <p className="small soft smallcaps">{CATEGORY_LABELS[bottle.category]}</p>
        </div>
      </div>

      {toast && <p className="banner" role="status">{toast}</p>}

      {bottle.isOpen && !finished && (
        <>
          <button className="btn btn--primary btn--full btn--pour" onClick={() => setSheetOpen(true)}>
            Pour
          </button>
          <p className="fill-readout">
            {fmtMl(bottle.remainingMl)} left · {fmtPct(bottle.remainingMl, bottle.sizeMl)}
            {bottle.openedDate && <span className="soft" style={{ fontSize: 15 }}> · opened {timeAgo(bottle.openedDate)}</span>}
          </p>
        </>
      )}

      {!bottle.isOpen && !finished && (
        <button className="btn btn--primary btn--full" onClick={() => void openBottle(bottle.id!).then(() => say('Opened. Slàinte.'))}>
          Open this bottle
        </button>
      )}

      {finished && (
        <p className="fill-readout soft">
          Finished {fmtDate(bottle.finishedDate)}
        </p>
      )}

      {photos && photos.length > 0 && (
        <HeroPhoto blob={photos[0].blob} name={bottle.name} />
      )}

      {!finished && (
        <div className="row">
          <span>Sealed backups</span>
          <span className="stepper">
            <button
              aria-label="One fewer sealed backup"
              disabled={bottle.sealedCount <= 0}
              onClick={() => void updateBottle(bottle.id!, { sealedCount: Math.max(0, bottle.sealedCount - 1) })}
            >−</button>
            <span className="value">{bottle.sealedCount}</span>
            <button
              aria-label="One more sealed backup"
              onClick={() => void updateBottle(bottle.id!, { sealedCount: bottle.sealedCount + 1 })}
            >+</button>
          </span>
        </div>
      )}

      {bottle.score !== undefined && bottle.rankIndex !== undefined && (
        <button
          className="row row-btn"
          onClick={() => navigate('/rank/list')}
        >
          <span className="display" style={{ fontSize: 26 }}>{bottle.score.toFixed(1)}</span>
          <span className="soft">
            #{bottle.rankIndex + 1} of {rankInfo?.total ?? '—'} in the cabinet
            {(rankInfo?.tied ?? 0) > 0 && ` · tied with ${rankInfo!.tied} other${rankInfo!.tied === 1 ? '' : 's'}`}
          </span>
        </button>
      )}

      <section className="section">
        <div className="section-head">Specs</div>
        <div className="specs-grid">
          {bottle.abv !== undefined && <div><div className="k">abv</div><div className="v">{bottle.abv}%</div></div>}
          <div><div className="k">age</div><div className="v">{bottle.ageStatement ? `${bottle.ageStatement} YO` : 'NAS'}</div></div>
          <div><div className="k">size</div><div className="v">{fmtSize(bottle.sizeMl)}</div></div>
          {bottle.caskType && <div><div className="k">cask</div><div className="v">{bottle.caskType}</div></div>}
          {bottle.region && <div><div className="k">region</div><div className="v">{bottle.region}</div></div>}
          {bottle.bottler && <div><div className="k">bottler</div><div className="v">{bottle.bottler}</div></div>}
          {bottle.caskStrength && <div><div className="k">strength</div><div className="v">cask</div></div>}
          {bottle.location && <div><div className="k">location</div><div className="v" style={{ fontFamily: 'var(--font-body)' }}>{bottle.location}</div></div>}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          Photos
          <label className="btn btn--quiet" style={{ minHeight: 40, fontSize: 15, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--font-body)', fontWeight: 400 }}>
            Add photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addPhoto(bottle.id!, f).then(() => say('Photo added.'));
                e.target.value = '';
              }}
            />
          </label>
        </div>
        {photos && photos.length > 0 ? (
          <div className="photo-strip">
            {photos.map((p) => <PhotoThumb key={p.id} blob={p.blob} name={bottle.name} />)}
          </div>
        ) : (
          <p className="small faint">No photos yet.</p>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          Tasting notes
          <button className="btn btn--quiet" style={{ minHeight: 40, fontSize: 15 }} onClick={() => setShowNoteForm((v) => !v)}>
            Add note
          </button>
        </div>
        {showNoteForm && (
          <form
            style={{ marginBottom: 16 }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!noteText.trim()) return;
              void db.notes.add({
                bottleId: bottle.id!,
                at: new Date().toISOString(),
                text: noteText.trim(),
                ...sliders,
              }).then(() => {
                setNoteText('');
                setShowNoteForm(false);
                say('Note added.');
              });
            }}
          >
            <div className="field">
              <label htmlFor="note-text">Note</label>
              <textarea id="note-text" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            </div>
            {(['peat', 'sweet', 'body'] as const).map((k) => (
              <div className="field" key={k}>
                <label htmlFor={`slider-${k}`}>{k} — {sliders[k]}</label>
                <input
                  id={`slider-${k}`}
                  type="range" min={0} max={5} step={1}
                  value={sliders[k]}
                  onChange={(e) => setSliders((s) => ({ ...s, [k]: parseInt(e.target.value, 10) }))}
                />
              </div>
            ))}
            <button type="submit" className="btn btn--primary btn--full">Save note</button>
          </form>
        )}
        {notes && notes.length > 0 ? notes.map((n) => (
          <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--rule)' }}>
            <p>{n.text}</p>
            <p className="small faint mono">
              {fmtDate(n.at)}
              {n.peat !== undefined && ` · peat ${n.peat} · sweet ${n.sweet} · body ${n.body}`}
            </p>
          </div>
        )) : !showNoteForm && <p className="small faint">Nothing written down yet.</p>}
      </section>

      <details className="fold section">
        <summary>Pour history</summary>
        <div style={{ padding: '8px 0' }}>
          <Sparkline points={levelSeries(bottle.sizeMl, pours ?? [], bottle.openedDate)} sizeMl={bottle.sizeMl} />
          {(pours ?? []).slice().sort((a, b) => b.at.localeCompare(a.at)).map((p) => (
            <div className="kv-line" key={p.id}>
              <span className="k">{fmtDate(p.at)}{p.kind === 'correction' ? ' · level set' : ''}</span>
              <span className="v">{p.kind === 'correction' ? (p.ml >= 0 ? `−${Math.abs(Math.round(p.ml))} ml` : `+${Math.abs(Math.round(p.ml))} ml`) : `−${Math.round(p.ml)} ml`}</span>
            </div>
          ))}
        </div>
      </details>

      <details className="fold">
        <summary>Purchase</summary>
        <div style={{ padding: '8px 0' }}>
          <div className="kv-line"><span className="k">Date</span><span className="v">{fmtDate(bottle.purchaseDate) || '—'}</span></div>
          <div className="kv-line"><span className="k">Price</span><span className="v">{bottle.purchasePrice !== undefined ? bottle.purchasePrice.toFixed(2) : '—'}</span></div>
          <div className="kv-line"><span className="k">Place</span><span className="v" style={{ fontFamily: 'var(--font-body)' }}>{bottle.purchasePlace ?? '—'}</span></div>
        </div>
      </details>

      <details className="fold">
        <summary>Danger zone</summary>
        <div style={{ display: 'flex', gap: 8, padding: '12px 0', flexWrap: 'wrap' }}>
          {!finished && (
            <button className="btn btn--danger" onClick={() => setConfirmFinish(true)}>Mark finished</button>
          )}
          {finished && (
            <button
              className="btn"
              onClick={() => void updateBottle(bottle.id!, { status: 'active', isOpen: false, finishedDate: undefined }).then(() => say('Back on the shelf.'))}
            >
              Restore to cabinet
            </button>
          )}
          <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </details>

      {sheetOpen && bottle.isOpen && (
        <PourSheet bottle={bottle} onClose={() => setSheetOpen(false)} onResult={handlePourResult} />
      )}

      <ConfirmDialog
        open={offerBackup}
        confirmLabel="Open a backup"
        cancelLabel="Not now"
        onCancel={() => { setOfferBackup(false); say('Bottle finished. Moved to the graveyard.'); }}
        onConfirm={() => {
          void openBackup(bottle.id!).then(() => {
            setOfferBackup(false);
            say('Backup opened. Full bottle on the shelf.');
          });
        }}
      >
        <p>
          That was the last of it. You have {bottle.sealedCount === 1 ? 'a sealed backup' : `${bottle.sealedCount} sealed backups`} of {bottle.name}. Open one?
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmFinish}
        confirmLabel="Mark finished"
        danger
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          void markFinished(bottle.id!).then(() => {
            setConfirmFinish(false);
            if (bottle.sealedCount > 0) setOfferBackup(true);
            else say('Moved to the graveyard.');
          });
        }}
      >
        <p>Mark {bottle.name} as finished? It moves to the graveyard and keeps its serial and history.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmDelete}
        confirmLabel="Delete forever"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          void deleteBottle(bottle).then(() => navigate('/'));
        }}
      >
        <p>
          Delete {bottle.name} and all its pours, notes and photos? This cannot be undone.
          If the bottle is just empty, mark it finished instead — the graveyard keeps the record.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function useBlobUrl(blob: Blob): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

function HeroPhoto({ blob, name }: { blob: Blob; name: string }) {
  const url = useBlobUrl(blob);
  if (!url) return null;
  return <img className="hero-photo" src={url} alt={`Photo of ${name}`} />;
}

function PhotoThumb({ blob, name }: { blob: Blob; name: string }) {
  const url = useBlobUrl(blob);
  if (!url) return null;
  return <img src={url} alt={`Photo of ${name}`} />;
}

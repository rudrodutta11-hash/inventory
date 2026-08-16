import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import QRCode from 'qrcode';
import { db, type Bottle } from '../db';
import { updateBottle } from '../lib/bottles';
import { useLocation } from 'react-router-dom';
import { stickerUrl, cabinetUrl, printRoot, isLocalHost } from '../lib/urls';

function useQr(text: string): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let alive = true;
    void QRCode.toDataURL(text, { margin: 1, width: 192, errorCorrectionLevel: 'M' })
      .then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [text]);
  return url;
}

/** A4 print sheet of QR labels + one larger cabinet card. */
export default function Stickers() {
  const bottles = useLiveQuery(
    () => db.bottles.filter((b) => b.status !== 'wishlist').toArray(),
    [],
  );
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const { search } = useLocation();
  const { root, overridden } = printRoot(search);

  useEffect(() => {
    if (bottles && selected === null) {
      setSelected(new Set(bottles.filter((b) => !b.hasSticker).map((b) => b.id!)));
    }
  }, [bottles, selected]);

  if (!bottles || selected === null) return <div className="screen" />;

  const sorted = [...bottles].sort((a, b) => a.serial.localeCompare(b.serial));
  const chosen = sorted.filter((b) => selected.has(b.id!));

  function toggle(id: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function markPrinted() {
    for (const b of chosen) await updateBottle(b.id!, { hasSticker: true });
  }

  const local = isLocalHost(root);

  return (
    <div className="screen screen--bare">
      <div className="no-print">
        <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>Stickers</h1>
        <p className="soft" style={{ fontSize: 15, marginBottom: 16 }}>
          Tick the bottles that need a sticker, print on A4, stick each label on its bottle.
          Bottles without one yet are pre-ticked.
        </p>

        <div style={{ marginBottom: 16 }}>
          {sorted.map((b) => (
            <label key={b.id} className="row" style={{ cursor: 'pointer' }}>
              <span>
                <span className="display" style={{ marginRight: 10 }}>{b.serial}</span>
                {b.name}
                {b.hasSticker && <span className="small faint"> · has a sticker</span>}
              </span>
              <input
                type="checkbox"
                checked={selected.has(b.id!)}
                onChange={() => toggle(b.id!)}
                aria-label={`Print sticker for ${b.name}`}
              />
            </label>
          ))}
        </div>

        <div
          className="host-note"
          data-app-root={root}
          style={local ? { borderLeft: '3px solid var(--stencil)' } : undefined}
        >
          <span className="k smallcaps">
            Codes point at{overridden ? ' (set by hand)' : ''}
          </span>
          <span className="mono small" data-testid="sticker-host">{root}</span>
          {local && (
            <span className="small" role="alert">
              This is a local address. Stickers printed now will only work on this
              computer — open the published address before printing.
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button className="btn btn--primary" style={{ flex: 1 }} disabled={chosen.length === 0} onClick={() => window.print()}>
            Print {chosen.length} {chosen.length === 1 ? 'sticker' : 'stickers'}
          </button>
          <button className="btn btn--quiet" disabled={chosen.length === 0} onClick={() => void markPrinted()}>
            Mark as printed
          </button>
        </div>
      </div>

      <div className="sticker-grid">
        {chosen.map((b) => <Sticker key={b.id} bottle={b} root={root} />)}
      </div>

      <CabinetCard root={root} />
    </div>
  );
}

function Sticker({ bottle, root }: { bottle: Bottle; root: string }) {
  const url = stickerUrl(bottle.serial, root);
  const qr = useQr(url);
  return (
    <div className="sticker" data-qr-url={url}>
      {qr && <img src={qr} alt={`QR code for bottle ${bottle.serial}`} />}
      <span className="serial">{bottle.serial}</span>
      <span className="name">{bottle.name}</span>
    </div>
  );
}

function CabinetCard({ root }: { root: string }) {
  const url = cabinetUrl(root);
  const qr = useQr(url);
  return (
    <div className="cabinet-card" data-qr-url={url}>
      {qr && <img src={qr} alt="QR code for the whole cabinet" />}
      <span className="serial" style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, textTransform: 'uppercase' }}>
        The Cabinet
      </span>
      <span className="name">Scan for the full inventory — stick inside the cabinet door</span>
    </div>
  );
}

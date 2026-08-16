import { useState } from 'react';
import type { Bottle } from '../db';
import { logPour, correctLevel, type PourResult } from '../lib/pour';
import { fmtMl } from '../lib/format';

interface Props {
  bottle: Bottle;
  onClose: () => void;
  onResult: (result: PourResult, ml: number, kind: 'pour' | 'correction') => void;
}

/** Bottom sheet: 30 / 45 / 60 / Custom, one tap to log. */
export default function PourSheet({ bottle, onClose, onResult }: Props) {
  const [custom, setCustom] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showLevel, setShowLevel] = useState(false);
  const [level, setLevel] = useState(bottle.remainingMl);
  const [busy, setBusy] = useState(false);

  async function pour(ml: number) {
    if (busy || ml <= 0) return;
    setBusy(true);
    const result = await logPour(bottle, ml);
    onResult(result, ml, 'pour');
  }

  async function applyLevel() {
    if (busy) return;
    setBusy(true);
    const result = await correctLevel(bottle, level);
    onResult(result, bottle.remainingMl - level, 'correction');
  }

  return (
    <>
      <button className="sheet-backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Pour from ${bottle.name}`}>
        <h2>Pour — {bottle.name}</h2>

        {!showCustom && !showLevel && (
          <>
            <div className="pour-grid">
              {[30, 45, 60].map((ml) => (
                <button key={ml} className="btn btn--pour" disabled={busy} onClick={() => pour(ml)}>
                  {ml} ml
                </button>
              ))}
              <button className="btn btn--pour" onClick={() => setShowCustom(true)}>
                Custom
              </button>
            </div>
            <button
              className="btn btn--quiet btn--full"
              style={{ marginTop: 12 }}
              onClick={() => { setLevel(bottle.remainingMl); setShowLevel(true); }}
            >
              Set level
            </button>
          </>
        )}

        {showCustom && (
          <form
            onSubmit={(e) => { e.preventDefault(); void pour(parseInt(custom, 10) || 0); }}
          >
            <div className="field">
              <label htmlFor="custom-ml">Amount in ml</label>
              <input
                id="custom-ml"
                type="number"
                inputMode="numeric"
                min={1}
                max={bottle.sizeMl}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn--quiet" onClick={() => setShowCustom(false)}>Back</button>
              <button type="submit" className="btn btn--primary" style={{ flex: 1 }} disabled={busy || !custom}>
                Pour {custom ? fmtMl(parseInt(custom, 10) || 0) : ''}
              </button>
            </div>
          </form>
        )}

        {showLevel && (
          <div>
            <div className="field">
              <label htmlFor="set-level">
                Set level — corrects drift without rewriting history
              </label>
              <input
                id="set-level"
                type="range"
                min={0}
                max={bottle.sizeMl}
                step={5}
                value={level}
                onChange={(e) => setLevel(parseInt(e.target.value, 10))}
              />
              <p className="mono" aria-live="polite">{fmtMl(level)} · {Math.round((level / bottle.sizeMl) * 100)}%</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--quiet" onClick={() => setShowLevel(false)}>Back</button>
              <button className="btn btn--primary" style={{ flex: 1 }} disabled={busy} onClick={() => void applyLevel()}>
                Set to {fmtMl(level)}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

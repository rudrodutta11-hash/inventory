import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, CATEGORY_LABELS, type Category, type Bottle } from '../db';
import { addBottle } from '../lib/bottles';
import { addPhoto } from '../lib/photos';

/**
 * Two-stage form. Stage one: name, category, size, sealed or open.
 * Save is enabled after name alone. Everything optional hides behind
 * "Add details".
 */
export default function AddBottle() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('single_malt');
  const [sizeMl, setSizeMl] = useState(700);
  const [sealed, setSealed] = useState(false);
  const [wishlist, setWishlist] = useState(false);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  // stage two
  const [d, setD] = useState({
    distillery: '', abv: '', ageStatement: '', region: '', caskType: '',
    bottler: '' as '' | 'official' | 'independent', caskStrength: false,
    location: '', purchaseDate: '', purchasePrice: '', purchasePlace: '', notesQuick: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    const extra: Partial<Bottle> = {};
    if (d.distillery.trim()) extra.distillery = d.distillery.trim();
    if (d.abv) extra.abv = parseFloat(d.abv);
    if (d.ageStatement) extra.ageStatement = parseInt(d.ageStatement, 10);
    if (d.region.trim()) extra.region = d.region.trim();
    if (d.caskType.trim()) extra.caskType = d.caskType.trim();
    if (d.bottler) extra.bottler = d.bottler;
    if (d.caskStrength) extra.caskStrength = true;
    if (d.location.trim()) extra.location = d.location.trim();
    if (d.purchaseDate) extra.purchaseDate = d.purchaseDate;
    if (d.purchasePrice) extra.purchasePrice = parseFloat(d.purchasePrice);
    if (d.purchasePlace.trim()) extra.purchasePlace = d.purchasePlace.trim();
    if (d.notesQuick.trim()) extra.notesQuick = d.notesQuick.trim();

    const bottle = await addBottle({
      name,
      category,
      sizeMl,
      sealed,
      status: wishlist ? 'wishlist' : 'active',
      details: extra,
    });
    if (photoFile && bottle.id) await addPhoto(bottle.id, photoFile);
    navigate(wishlist ? '/wishlist' : `/b/${bottle.serial}`);
  }

  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 16 }}>Add a bottle</h1>
      <form onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <div className="field">
          <label htmlFor="add-name">Name</label>
          <input
            id="add-name" type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Talisker 10"
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="add-category">Category</label>
          <select id="add-category" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>

        <div className="field">
          <label id="size-label">Size</label>
          <div className="choice-row" role="group" aria-labelledby="size-label">
            {[700, 750, 1000, 500, 350].map((s) => (
              <button
                key={s} type="button" className="btn"
                aria-pressed={sizeMl === s}
                onClick={() => setSizeMl(s)}
              >
                {s / 10} cl
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label id="state-label">State</label>
          <div className="choice-row" role="group" aria-labelledby="state-label">
            <button type="button" className="btn" aria-pressed={!sealed && !wishlist} onClick={() => { setSealed(false); setWishlist(false); }}>
              Open
            </button>
            <button type="button" className="btn" aria-pressed={sealed && !wishlist} onClick={() => { setSealed(true); setWishlist(false); }}>
              Sealed
            </button>
            <button type="button" className="btn" aria-pressed={wishlist} onClick={() => setWishlist(true)}>
              Wishlist
            </button>
          </div>
        </div>

        {!details && (
          <button type="button" className="btn btn--quiet btn--full" onClick={() => setDetails(true)}>
            Add details
          </button>
        )}

        {details && (
          <>
            <hr className="hairline" style={{ margin: '20px 0' }} />
            <div className="field">
              <label htmlFor="add-distillery">Distillery</label>
              <input id="add-distillery" type="text" value={d.distillery} onChange={(e) => setD({ ...d, distillery: e.target.value })} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label htmlFor="add-abv">ABV %</label>
                <input id="add-abv" type="number" inputMode="decimal" step="0.1" value={d.abv} onChange={(e) => setD({ ...d, abv: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="add-age">Age (blank = NAS)</label>
                <input id="add-age" type="number" inputMode="numeric" value={d.ageStatement} onChange={(e) => setD({ ...d, ageStatement: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="add-region">Region</label>
              <input id="add-region" type="text" value={d.region} onChange={(e) => setD({ ...d, region: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="add-cask">Cask type</label>
              <input id="add-cask" type="text" value={d.caskType} onChange={(e) => setD({ ...d, caskType: e.target.value })} placeholder="Sherry, bourbon, port finish" />
            </div>
            <div className="field">
              <label id="bottler-label">Bottler</label>
              <div className="choice-row" role="group" aria-labelledby="bottler-label">
                <button type="button" className="btn" aria-pressed={d.bottler === 'official'} onClick={() => setD({ ...d, bottler: d.bottler === 'official' ? '' : 'official' })}>Official</button>
                <button type="button" className="btn" aria-pressed={d.bottler === 'independent'} onClick={() => setD({ ...d, bottler: d.bottler === 'independent' ? '' : 'independent' })}>Independent</button>
                <button type="button" className="btn" aria-pressed={d.caskStrength} onClick={() => setD({ ...d, caskStrength: !d.caskStrength })}>Cask strength</button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="add-location">Location</label>
              <input id="add-location" type="text" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} placeholder="Cabinet — top shelf" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label htmlFor="add-pdate">Purchase date</label>
                <input id="add-pdate" type="date" value={d.purchaseDate} onChange={(e) => setD({ ...d, purchaseDate: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="add-pprice">Price</label>
                <input id="add-pprice" type="number" inputMode="decimal" step="0.01" value={d.purchasePrice} onChange={(e) => setD({ ...d, purchasePrice: e.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="add-pplace">Bought at</label>
              <input id="add-pplace" type="text" value={d.purchasePlace} onChange={(e) => setD({ ...d, purchasePlace: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="add-quick">Quick note</label>
              <input id="add-quick" type="text" value={d.notesQuick} onChange={(e) => setD({ ...d, notesQuick: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="add-photo">Photo</label>
              <input
                id="add-photo" type="file" accept="image/*" capture="environment"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--full"
          style={{ marginTop: 20 }}
          disabled={!name.trim() || busy}
        >
          Save bottle
        </button>
      </form>
    </div>
  );
}

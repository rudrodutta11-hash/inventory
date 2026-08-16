import { useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { CATEGORY_LABELS } from '../db';
import { updateBottle } from '../lib/bottles';

export default function Wishlist() {
  const navigate = useNavigate();
  const wished = useLiveQuery(() => db.bottles.where('status').equals('wishlist').toArray(), []);
  if (!wished) return <div className="screen" />;

  const sorted = [...wished].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="screen">
      <h1 className="display" style={{ fontSize: 26, marginBottom: 4 }}>Wishlist</h1>
      <p className="soft" style={{ fontSize: 15, marginBottom: 20 }}>
        Bottles to look out for. Add one from <Link to="/add">the add screen</Link>.
      </p>

      {sorted.length === 0 && (
        <div className="empty">
          <h1>Nothing on the list</h1>
          <p>The next bottle usually names itself.</p>
        </div>
      )}

      {sorted.map((b) => (
        <div className="row" key={b.id}>
          <button className="row-btn" style={{ flex: 1, minHeight: 48 }} onClick={() => navigate(`/b/${b.serial}`)}>
            {b.name}
            <span className="small soft smallcaps" style={{ marginLeft: 8 }}>{CATEGORY_LABELS[b.category]}</span>
          </button>
          <button
            className="btn btn--quiet"
            style={{ minHeight: 40, fontSize: 15 }}
            onClick={() =>
              void updateBottle(b.id!, {
                status: 'active',
                sealedCount: 1,
                isOpen: false,
                remainingMl: 0,
                purchaseDate: new Date().toISOString(),
              })}
          >
            Bought it
          </button>
        </div>
      ))}
    </div>
  );
}

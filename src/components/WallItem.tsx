import { useNavigate } from 'react-router-dom';
import type { Bottle } from '../db';
import BottleSilhouette from './BottleSilhouette';

/** One bottle in the wall grid: silhouette, name (2 lines max), sealed chip. */
export default function WallItem({ bottle, width = 72 }: { bottle: Bottle; width?: number }) {
  const navigate = useNavigate();
  return (
    <button className="wall-item" onClick={() => navigate(`/b/${bottle.serial}`)}>
      <BottleSilhouette bottle={bottle} width={width} />
      <span className="name">{bottle.name}</span>
      {bottle.sealedCount > 0 && bottle.status === 'active' && (
        <span className="chip">{'×'}{bottle.sealedCount}</span>
      )}
    </button>
  );
}

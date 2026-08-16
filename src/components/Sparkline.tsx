import type { LevelPoint } from '../lib/level';

/** Small line of fill level over time. */
export default function Sparkline({ points, sizeMl }: { points: LevelPoint[]; sizeMl: number }) {
  if (points.length < 2) return <p className="small faint">No pours logged yet.</p>;
  const w = 320, h = 56, pad = 4;
  const t0 = new Date(points[0].at).getTime();
  const t1 = new Date(points[points.length - 1].at).getTime();
  const span = Math.max(1, t1 - t0);
  const x = (t: number) => pad + ((t - t0) / span) * (w - pad * 2);
  const y = (ml: number) => pad + (1 - ml / sizeMl) * (h - pad * 2);

  // step line: level holds until the next pour
  let d = `M ${x(t0)} ${y(points[0].ml)}`;
  for (let i = 1; i < points.length; i++) {
    const t = new Date(points[i].at).getTime();
    d += ` L ${x(t)} ${y(points[i - 1].ml)} L ${x(t)} ${y(points[i].ml)}`;
  }

  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Level over time">
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} />
      <path d={d} />
    </svg>
  );
}

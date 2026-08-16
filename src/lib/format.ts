export function fmtMl(ml: number): string {
  return `${Math.round(ml)} ml`;
}

export function fmtPct(remainingMl: number, sizeMl: number): string {
  if (sizeMl <= 0) return '0%';
  return `${Math.round((remainingMl / sizeMl) * 100)}%`;
}

export function fillFraction(remainingMl: number, sizeMl: number): number {
  if (sizeMl <= 0) return 0;
  return Math.min(1, Math.max(0, remainingMl / sizeMl));
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "opened 4 months ago", "2 hours ago" */
export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, (Date.now() - then) / 1000);
  const min = s / 60, h = min / 60, d = h / 24, mo = d / 30.44, y = d / 365.25;
  if (y >= 1) return y >= 1.5 ? `${Math.round(y)} years ago` : '1 year ago';
  if (mo >= 1) return mo >= 1.5 ? `${Math.round(mo)} months ago` : '1 month ago';
  if (d >= 1) return d >= 1.5 ? `${Math.round(d)} days ago` : '1 day ago';
  if (h >= 1) return h >= 1.5 ? `${Math.round(h)} hours ago` : '1 hour ago';
  if (min >= 1) return min >= 1.5 ? `${Math.round(min)} minutes ago` : '1 minute ago';
  return 'just now';
}

export function monthsSince(iso?: string): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return (Date.now() - then) / (1000 * 60 * 60 * 24 * 30.44);
}

export function fmtSize(sizeMl: number): string {
  return `${sizeMl / 10} cl`;
}

export function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} KB`;
  return `${n} B`;
}

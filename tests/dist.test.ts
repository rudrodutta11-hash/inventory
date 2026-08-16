/**
 * Asserts the *built* output is correct for a GitHub Pages subpath deploy.
 * A wrong scope or start_url is the most common reason an installed PWA
 * opens in a browser tab instead of standalone, and it is invisible in dev.
 *
 * Requires `npm run build` to have run; skips with a clear message if not.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(import.meta.dirname, '..', 'dist');
const BASE = '/inventory/';
const built = existsSync(join(DIST, 'manifest.webmanifest'));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe.skipIf(!built)('built output for the /inventory/ subpath', () => {
  const manifest = built
    ? JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'))
    : {};

  it('manifest uses absolute /inventory/ paths, not /', () => {
    expect(manifest.id).toBe(BASE);
    expect(manifest.scope).toBe(BASE);
    expect(manifest.start_url).toBe(`${BASE}#/`);
    expect(manifest.display).toBe('standalone');
  });

  it('manifest ships a maskable icon and an any-purpose icon', () => {
    const purposes = manifest.icons.map((i: { purpose?: string }) => i.purpose ?? 'any');
    expect(purposes).toContain('maskable');
    expect(purposes).toContain('any');
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('every manifest icon resolves under the base and exists on disk', () => {
    for (const icon of manifest.icons as { src: string }[]) {
      expect(icon.src.startsWith(BASE)).toBe(true);
      const rel = icon.src.slice(BASE.length);
      expect(existsSync(join(DIST, rel))).toBe(true);
    }
  });

  it('service worker is scoped to the base', () => {
    const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
    // navigateFallback must point inside the subpath, never at /index.html
    expect(sw).toContain(`${BASE}index.html`);
  });

  it('no asset reference escapes the base', () => {
    // Any root-absolute /fonts/, /icons/ or /assets/ reference would 404 on
    // Pages, because the site is served from /inventory/.
    const textFiles = walk(DIST).filter((f) => /\.(html|css|js|webmanifest)$/.test(f));
    const offenders: string[] = [];
    for (const file of textFiles) {
      const body = readFileSync(file, 'utf8');
      for (const m of body.matchAll(/["'(](\/(?:fonts|icons|assets)\/[^"')]*)/g)) {
        if (!m[1].startsWith(BASE)) offenders.push(`${file.replace(DIST, '')}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('index.html carries the iOS install meta tags', () => {
    const html = readFileSync(join(DIST, 'index.html'), 'utf8');
    expect(html).toContain('viewport-fit=cover');
    expect(html).toMatch(/apple-mobile-web-app-capable"\s+content="yes"/);
    expect(html).toMatch(/apple-mobile-web-app-title"\s+content="Cabinet"/);
    expect(html).toMatch(/rel="apple-touch-icon"\s+sizes="180x180"/);
    expect(html).toContain('media="(prefers-color-scheme: light)"');
    expect(html).toContain('media="(prefers-color-scheme: dark)"');
    // HashRouter is why no SPA 404 fallback is needed; assert we did not add one
    expect(existsSync(join(DIST, '404.html'))).toBe(false);
  });
});

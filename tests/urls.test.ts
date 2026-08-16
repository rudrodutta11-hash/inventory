// Sticker QR codes become physical objects. If the encoded host is wrong,
// the fix is peeling stickers off 40 bottles — so pin it down here.
import { describe, it, expect } from 'vitest';
import { appRoot, appUrl, isLocalHost, stickerUrl, cabinetUrl } from '../src/lib/urls';

const PROD_ORIGIN = 'https://rudrodutta11-hash.github.io';
const PROD_BASE = '/inventory/';
const PROD_URL = 'https://rudrodutta11-hash.github.io/inventory/';

describe('sticker URLs on the production deployment', () => {
  it('builds the app root with exactly one trailing slash', () => {
    expect(appRoot(PROD_ORIGIN, PROD_BASE)).toBe(PROD_URL);
  });

  it('encodes a bottle sticker as the absolute deployed URL', () => {
    const url = appUrl(PROD_ORIGIN, PROD_BASE, '/b/017');
    expect(url).toBe(`${PROD_URL}#/b/017`);
    expect(url.startsWith(PROD_URL)).toBe(true);
    expect(url).toMatch(/^https:\/\//);
    expect(url).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it('encodes the cabinet-door card as the deployed root', () => {
    expect(appUrl(PROD_ORIGIN, PROD_BASE, '/')).toBe(`${PROD_URL}#/`);
  });

  it('never emits a relative or root-relative path', () => {
    for (const path of ['/b/001', '/b/017', '/']) {
      const url = appUrl(PROD_ORIGIN, PROD_BASE, path);
      expect(url.startsWith('/')).toBe(false);
      expect(url.startsWith('#')).toBe(false);
      expect(url).toContain('/inventory/');
    }
  });

  it('survives a base given without slashes', () => {
    expect(appRoot(PROD_ORIGIN, 'inventory')).toBe(PROD_URL);
    expect(appRoot(`${PROD_ORIGIN}/`, '/inventory/')).toBe(PROD_URL);
  });

  it('works at a root deployment too', () => {
    expect(appUrl('https://example.com', '/', '/b/003')).toBe('https://example.com/#/b/003');
  });

  it('flags local hosts so stickers are not printed against them', () => {
    expect(isLocalHost('http://localhost:4173')).toBe(true);
    expect(isLocalHost('http://127.0.0.1:5173')).toBe(true);
    expect(isLocalHost('http://localhost:4173/inventory/')).toBe(true);
    expect(isLocalHost(PROD_ORIGIN)).toBe(false);
    expect(isLocalHost(PROD_URL)).toBe(false);
  });

  it('renders both QR kinds against an explicit print root', () => {
    expect(stickerUrl('017', PROD_URL)).toBe(`${PROD_URL}#/b/017`);
    expect(cabinetUrl(PROD_URL)).toBe(`${PROD_URL}#/`);
  });
});

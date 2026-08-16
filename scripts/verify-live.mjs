/**
 * End-to-end verification against a deployed build.
 *
 *   node scripts/verify-live.mjs [url]
 *
 * Defaults to the GitHub Pages deployment. Checks the three things that
 * must work on the real host: offline reload, QR deep link, and the pour
 * flow — plus the sticker host, which becomes a physical object.
 */
import { chromium } from 'playwright';

const URL_BASE = (process.argv[2] ?? 'https://rudrodutta11-hash.github.io/inventory/').replace(/\/*$/, '/');
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch({ executablePath: EXEC });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.message)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// 1. loads at all
const res = await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' });
check('site responds 200 over https', res.status() === 200, `status ${res.status()}`);
await page.waitForSelector('.screen', { timeout: 15000 });

// 2. no asset 404s (fonts and icons are the ones a subpath breaks)
const failed = [];
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.reload({ waitUntil: 'networkidle' });
check('no failing asset requests', failed.length === 0, failed.join('; ') || 'all assets 200');

// 3. fonts actually applied (proves the base-relative font URLs resolved)
await page.waitForSelector('.first-run, .empty, .wall', { timeout: 10000 });
const fontsOk = await page.evaluate(async () => {
  const names = ['Big Shoulders Display', 'Public Sans', 'JetBrains Mono'];
  // fonts are fetched lazily on first use, so ask for them explicitly;
  // a failed fetch (wrong base path) rejects here
  const loaded = [];
  for (const n of names) {
    try {
      const faces = await document.fonts.load(`16px "${n}"`);
      if (faces.length > 0) loaded.push(n);
    } catch { /* leave it out of the list */ }
  }
  return loaded;
});
check('all three self-hosted fonts load from the deploy base', fontsOk.length === 3, fontsOk.join(', '));

// 4. manifest fetches and is scoped to the subpath
const manifest = await page.evaluate(async (base) => {
  const r = await fetch(`${base}manifest.webmanifest`);
  return r.ok ? r.json() : null;
}, URL_BASE);
const wantScope = new URL(URL_BASE).pathname;
check('manifest scope/start_url match the deploy path',
  manifest?.scope === wantScope && manifest?.start_url === `${wantScope}#/`,
  `scope=${manifest?.scope} start_url=${manifest?.start_url}`);
check('manifest icons resolve',
  await page.evaluate(async (m) => {
    for (const i of m.icons) { if (!(await fetch(i.src)).ok) return false; }
    return true;
  }, manifest),
  manifest.icons.map((i) => i.src).join(', '));

// 5. seed and exercise the pour flow
await page.goto(`${URL_BASE}#/settings`);
await page.click('text=Load demo cabinet');
await page.waitForTimeout(800);
await page.goto(`${URL_BASE}#/`);
await page.waitForSelector('.wall-item');
check('demo data marker visible', await page.locator('.banner--demo').count() > 0);

await page.goto(`${URL_BASE}#/b/001`);
await page.waitForSelector('.fill-readout');
const before = await page.locator('.fill-readout').innerText();
await page.click('button:has-text("Pour")');
await page.waitForSelector('.sheet');
await page.click('.sheet button:has-text("45 ml")');
await page.waitForSelector('text=Poured 45 ml.');
const after = await page.locator('.fill-readout').innerText();
check('pour logs in 2 taps and updates the level', before !== after, `${before.split('·')[0].trim()} -> ${after.split('·')[0].trim()}`);

await page.reload();
await page.waitForSelector('.fill-readout');
check('pour persists across a hard reload',
  (await page.locator('.fill-readout').innerText()) === after);

// 6. sticker QR encodes the deployed absolute URL
await page.goto(`${URL_BASE}#/stickers`);
await page.waitForSelector('.sticker');
const host = await page.getByTestId('sticker-host').innerText();
const qrUrl = await page.locator('.sticker').first().getAttribute('data-qr-url');
const cabUrl = await page.locator('.cabinet-card').getAttribute('data-qr-url');
check('sticker host line shows the deployed origin', host === URL_BASE, host);
check('bottle QR encodes the absolute deployed URL',
  qrUrl.startsWith(URL_BASE) && qrUrl.includes('#/b/'), qrUrl);
check('cabinet-door QR encodes the deployed root', cabUrl === `${URL_BASE}#/`, cabUrl);
// the warning is correct behaviour when verifying against a local server,
// so assert whichever outcome the target host calls for
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(URL_BASE);
const warned = await page.locator('.host-note [role=alert]').count() > 0;
check(isLocalTarget ? 'localhost warning shown when serving locally' : 'no localhost warning on the deployed host',
  isLocalTarget ? warned : !warned);

// 7. service worker, then offline
await page.goto(URL_BASE);
await page.waitForSelector('.wall-item');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(2500);
await ctx.setOffline(true);

await page.reload();
await page.waitForSelector('.wall-item', { timeout: 20000 });
check('offline: hard reload still renders the cabinet', true);

await page.goto(`${URL_BASE}#/b/002`);
await page.waitForSelector('text=Lagavulin 16', { timeout: 15000 });
check('offline: QR deep link /#/b/002 opens the bottle', true);

await page.click('button:has-text("Pour")');
await page.waitForSelector('.sheet');
await page.click('.sheet button:has-text("30 ml")');
await page.waitForSelector('text=Poured 30 ml.', { timeout: 10000 });
check('offline: pour still logs', true);
await ctx.setOffline(false);

// 8. standalone display mode is what the manifest asks for
check('manifest requests standalone display', manifest.display === 'standalone');

const realErrors = errors.filter((e) => !/favicon|Failed to load resource/i.test(e));
check('no page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failedCount}/${results.length} passed against ${URL_BASE}`);
process.exit(failedCount === 0 ? 0 : 1);

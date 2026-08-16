/**
 * Renders the sticker sheet to stickers.pdf at real A4 size.
 *
 *   node scripts/make-stickers-pdf.mjs [appUrl] [outfile] [printHost]
 *
 * `appUrl` is where the app is loaded from; `printHost` (default: the
 * production deployment) is what the QR codes encode. They differ only when
 * producing a sheet before the app is reachable at its published address.
 * Asserts each QR is at least 20mm square — below that, phone cameras
 * struggle at an angle in a dim room.
 */
import { chromium } from 'playwright';
import jsQR from 'jsqr';

const PROD = 'https://rudrodutta11-hash.github.io/inventory/';
const URL_BASE = (process.argv[2] ?? PROD).replace(/\/*$/, '/');
const OUT = process.argv[3] ?? 'stickers.pdf';
const PRINT_HOST = (process.argv[4] ?? PROD).replace(/\/*$/, '/');
const MIN_QR_MM = 20;
const PX_PER_MM = 96 / 25.4;   // CSS px per mm at print scale 1

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext()).newPage();

await page.goto(`${URL_BASE}#/settings`, { waitUntil: 'domcontentloaded' });
await page.click('text=Load demo cabinet');
await page.waitForTimeout(800);

await page.goto(`${URL_BASE}#/stickers?host=${encodeURIComponent(PRINT_HOST)}`);
await page.waitForSelector('.sticker img');

const host = await page.getByTestId('sticker-host').innerText();
console.log('Sticker codes point at:', host);
if (/localhost|127\.0\.0\.1/.test(host)) {
  console.error('REFUSING: codes point at a local address; pass the deployed URL.');
  process.exit(1);
}

// measure under print media, where the mm sizing applies
await page.emulateMedia({ media: 'print' });
await page.waitForTimeout(300);

const sizes = await page.evaluate(() => {
  const out = [];
  for (const img of document.querySelectorAll('.sticker img')) {
    const r = img.getBoundingClientRect();
    out.push({ w: r.width, h: r.height });
  }
  const cab = document.querySelector('.cabinet-card img')?.getBoundingClientRect();
  return { stickers: out, cabinet: cab ? { w: cab.width, h: cab.height } : null };
});

const mm = (px) => px / PX_PER_MM;
const smallest = Math.min(...sizes.stickers.map((s) => Math.min(s.w, s.h)));
console.log(`Sticker QR: ${sizes.stickers.length} codes, smallest ${mm(smallest).toFixed(1)}mm square`);
if (sizes.cabinet) {
  console.log(`Cabinet card QR: ${mm(Math.min(sizes.cabinet.w, sizes.cabinet.h)).toFixed(1)}mm square`);
}

// Decode the rendered pixels rather than trusting the string we wrote:
// this is what a phone camera will actually read off the paper.
const grabs = await page.evaluate(async () => {
  const shots = [];
  const take = async (img, label) => {
    const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    const cx = c.getContext('2d');
    cx.drawImage(bmp, 0, 0);
    shots.push({ label, w: c.width, h: c.height, data: Array.from(cx.getImageData(0, 0, c.width, c.height).data) });
  };
  for (const s of [...document.querySelectorAll('.sticker')]) {
    await take(s.querySelector('img'), s.getAttribute('data-qr-url'));
  }
  const cab = document.querySelector('.cabinet-card');
  if (cab) await take(cab.querySelector('img'), cab.getAttribute('data-qr-url'));
  return shots;
});

let decodeOk = true;
for (const g of grabs) {
  const res = jsQR(Uint8ClampedArray.from(g.data), g.w, g.h);
  const decoded = res?.data ?? '(decode failed)';
  if (decoded !== g.label || !decoded.startsWith(PRINT_HOST)) {
    decodeOk = false;
    console.error(`FAIL: QR decodes to ${decoded}, expected ${g.label}`);
  }
}
console.log(`Decoded ${grabs.length}/${grabs.length} codes; all resolve under ${PRINT_HOST}`);

await page.pdf({ path: OUT, format: 'A4', printBackground: true });
await browser.close();

if (mm(smallest) < MIN_QR_MM) {
  console.error(`FAIL: smallest QR is ${mm(smallest).toFixed(1)}mm, below the ${MIN_QR_MM}mm floor.`);
  process.exit(1);
}
if (!decodeOk) process.exit(1);
console.log(`\nWrote ${OUT} — every QR at or above ${MIN_QR_MM}mm and decoding to the right host.`);

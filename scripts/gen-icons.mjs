// Generates the PWA icon PNGs (run once; output is committed).
//   node scripts/gen-icons.mjs
// Draws the app mark — an ink bottle silhouette on manila — straight into
// RGBA buffers and encodes minimal PNGs with zlib, no image deps needed.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const MANILA = [0xe5, 0xe1, 0xd6];
const INK = [0x19, 0x1b, 0x19];
const OXBLOOD = [0x7a, 0x2e, 0x23];

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Is (u,v) in unit space [0,1]^2 inside the bottle silhouette?
function inBottle(u, v) {
  // cap
  if (v >= 0.10 && v < 0.16 && Math.abs(u - 0.5) < 0.085) return true;
  // neck
  if (v >= 0.16 && v < 0.34 && Math.abs(u - 0.5) < 0.065) return true;
  // shoulder: widens from neck to body over v in [0.34, 0.46]
  if (v >= 0.34 && v < 0.46) {
    const t = (v - 0.34) / 0.12;
    const half = 0.065 + (0.21 - 0.065) * (t * t * (3 - 2 * t)); // smoothstep
    return Math.abs(u - 0.5) < half;
  }
  // body with rounded bottom corners
  if (v >= 0.46 && v < 0.90) {
    const r = 0.045;
    if (Math.abs(u - 0.5) >= 0.21) return false;
    if (v > 0.90 - r) {
      const cx = u < 0.5 ? 0.5 - 0.21 + r : 0.5 + 0.21 - r;
      const cy = 0.90 - r;
      if (Math.abs(u - 0.5) > 0.21 - r && Math.hypot(u - cx, v - cy) > r) return false;
    }
    return true;
  }
  return false;
}

function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  // maskable icons need the mark inside the 80% safe zone
  const scale = maskable ? 0.72 : 0.88;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // background: manila
      let [r, g, b] = MANILA;
      const u = (x / size - 0.5) / scale + 0.5;
      const v = (y / size - 0.5) / scale + 0.5;
      if (inBottle(u, v)) {
        // liquid line: lower 40% of the body is oxblood-free ink; give the
        // bottle a "fill" band in ink vs deep ink for a bit of shape
        [r, g, b] = v > 0.62 ? OXBLOOD : INK;
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    }
  }
  return encodePng(size, px);
}

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true });
const out = (name, buf) =>
  writeFileSync(new URL(`../public/icons/${name}`, import.meta.url), buf);

out('icon-192.png', draw(192));
out('icon-512.png', draw(512));
out('icon-maskable-512.png', draw(512, { maskable: true }));
out('apple-touch-icon.png', draw(180));
console.log('icons written to public/icons/');

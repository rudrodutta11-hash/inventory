# The Cabinet

A home spirits inventory that lives on your phone. It answers two questions
fast: *what do I have?* and *how much is left?* — and it works with the phone
in airplane mode. No account, no login, no server.

- **The bottle wall** — every open bottle drawn at its actual fill level.
  A full cabinet glows amber; a depleted one goes grey.
- **Log a pour in two taps** — scan the QR sticker on the bottle, tap Pour,
  tap 45 ml. Done.
- **Ranking without ratings** — a few "which do you prefer?" questions place
  each bottle exactly. The score comes from the ranking, so it stays honest.
- **The graveyard** — finished bottles are archived with their dates, scores
  and notes, never deleted.

## Where the data lives (read this once)

Everything is stored **on the phone itself**, in the browser's built-in
database — not on a server, not in an account. That is why the app works in
airplane mode, and it is also why the backup story matters: if the phone is
lost and there is no backup, the records are gone. Three habits keep you
safe. First, **install the app to the home screen** (instructions below) —
installed apps are protected from the automatic storage clean-up Safari does
to ordinary websites. Second, when the app suggests a backup, tap it — one
tap makes a single file with every bottle, pour, note and photo, which you
can save to iCloud, email to yourself, or AirDrop to a computer. Third,
optionally, set up the sync worker (below) and the app quietly keeps an
up-to-date copy off the phone on its own.

## Install on iPhone

1. Open the app's address in **Safari**.
2. Tap the **Share** button (the square with the arrow).
3. Tap **Add to Home Screen**, then **Add**.

It now opens full screen from its own icon, works offline, and its storage
is exempt from Safari's 7-day clean-up. This step is worth doing on day one.

## Printing stickers

Open **Stickers** from the Cabinet screen. Bottles that don't yet have a
sticker are pre-ticked. Tap **Print**, print the page on A4, cut out the
labels and stick each one on its bottle. Scanning a sticker with the normal
camera app opens that bottle's page — even offline. There is also one larger
card with a QR for the whole cabinet, meant for the inside of the cabinet
door. After printing, tap **Mark as printed** so those bottles drop off the
list next time.

## Local development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # unit tests (incl. the backup round-trip test)
npm run build      # production build in dist/
npm run preview    # serve the production build (service worker active)
```

TypeScript + React + Vite. Data layer is Dexie (IndexedDB). PWA via
vite-plugin-pwa. No CSS framework — the design is hand-written in
`src/theme.css`.

## Deploy to static hosting

The app is a static site — any static host works (Netlify, Vercel,
GitHub Pages, Cloudflare Pages).

```bash
npm run build      # output in dist/
```

Point the host at the `dist/` directory. No server-side rewrites are needed:
routing uses the URL hash (`/#/b/017`), so deep links resolve anywhere,
including from QR stickers. The build uses relative asset paths, so it also
works when served from a sub-path (e.g. GitHub Pages project sites).

## Optional: the sync worker

Manual backups don't happen, so there is an automatic layer: a tiny
Cloudflare Worker (free tier) that stores the latest backup off the phone.
Every change is pushed about five seconds later; nothing is sent anywhere
until you set it up. Deployment takes about five minutes — see
[`worker/README.md`](worker/README.md). Then paste the worker's address into
**Settings → Sync** on the phone.

## Evaluating without typing

**Settings → Load demo cabinet** fills the app with 12 realistic bottles,
a few sealed backups, three finished bottles in the graveyard, and a
pre-built ranking. **Clear all data** removes everything again.

# Cabinet sync worker

A tiny Cloudflare Worker that stores the app's backup JSON in Workers KV.
Two routes, no accounts, free tier is plenty:

```
PUT /sync/:key   -> store the body
GET /sync/:key   -> return it (404 if absent)
```

The `:key` is the random 32-character sync key the app generates on first
launch (Settings → Sync → Sync key). Anyone who has the key can read the
backup, so treat the key like a password.

## Deploy (free tier)

Requires a free Cloudflare account and Node.

```bash
cd worker

# 1. Log in (opens a browser)
npx wrangler login

# 2. Create the KV namespace
npx wrangler kv namespace create CABINET
# Copy the printed id into wrangler.toml, replacing
# REPLACE_WITH_YOUR_KV_NAMESPACE_ID

# 3. Deploy
npx wrangler deploy
```

Wrangler prints the worker URL, something like
`https://cabinet-sync.<your-subdomain>.workers.dev`.

## Connect the app

Open the app → Settings → Sync → paste the worker URL into
"Worker address". That's it. Every change is pushed about 5 seconds later.
Sync stays off until a URL is entered, and every network failure is silent —
the status line in Settings is the only place it shows.

## Moving to a new phone

1. Install the app on the new phone.
2. Settings → Sync: enter the same worker address.
3. Copy the sync key from the old phone (Settings → Sync key, copy button or
   QR code) — on the new phone you currently restore by importing a backup
   file, or by letting the app find the remote copy: with the same worker URL
   and key set, the app offers "A newer backup exists. Restore it?" on open.

# Sales Progressor — WhatsApp bridge

A small **always-on** service that links to Ellis's WhatsApp Business account as a
companion device, listens for live messages (received **and** the ones Ellis sends
from his own phone), normalises them, and POSTs them to the PWA ingest endpoint.

**Passive only.** It never sends WhatsApp messages, joins/creates groups, or auto-replies.
It is an unofficial (Baileys) integration — see the risk section in
[`../docs/WHATSAPP_INTEGRATION.md`](../docs/WHATSAPP_INTEGRATION.md).

This folder is **deployed separately** (Railway); it is **not** part of the Vercel app and
is excluded from the main project's TypeScript build.

## What it does

1. Connects via Baileys `useMultiFileAuthState` (session persisted to `AUTH_DIR`, so you
   scan the QR once).
2. Auto-reconnects on transient drops; if WhatsApp logs the device out it stops and asks
   for a re-scan.
3. On `messages.upsert` (live only — `syncFullHistory: false`, no bulk backfill) it
   normalises each message and calls the PWA.
4. Failed POSTs are written to `QUEUE_DIR` and retried every 30s, so nothing is lost while
   the PWA is briefly down.
5. Exposes `GET /health` (open) and `GET /status` + `GET /qr` (bearer `BRIDGE_CONTROL_SECRET`)
   for the Phase 4 in-app connect UI.

## Environment

Copy `.env.example` to `.env` (local) or set as Railway service variables. Required:
`PWA_INGEST_URL`, `WHATSAPP_BRIDGE_SECRET` (must equal the value on the PWA/Vercel for the
same environment). See `.env.example` for the rest.

## Run locally (to link + smoke test against staging)

```bash
cd whatsapp-bridge
cp .env.example .env      # fill in PWA_INGEST_URL (staging) + WHATSAPP_BRIDGE_SECRET
npm install
npm run typecheck         # first real type-check (Baileys types resolve after install)
npm start                 # a QR prints in the terminal
```

Open WhatsApp Business → **Linked Devices → Link a device** → scan the QR. Send a test
message in a `Sale of {address}` group and confirm it appears on that file in the PWA.

## Deploy to Railway

1. New Railway project → **Deploy from repo** → this repo, **root directory** `whatsapp-bridge`.
2. Add a **Volume** mounted at e.g. `/data`; set `AUTH_DIR=/data/auth` and `QUEUE_DIR=/data/queue`
   so the session + queue survive restarts.
3. Set service variables: `PWA_INGEST_URL`, `WHATSAPP_BRIDGE_SECRET`, `BRIDGE_CONTROL_SECRET`.
   (`PORT` is provided by Railway.)
4. Deploy. Open the deploy **logs**, scan the QR shown there once. Status is then visible at
   `/health` and (with the control secret) `/status`.

## Safety notes

- Never commit `auth/` (the linked-device credentials) — it is gitignored.
- The bridge holds the WhatsApp session; the PWA never sees session credentials.
- Logs record ids, counts, and lifecycle only — never message bodies or credentials.

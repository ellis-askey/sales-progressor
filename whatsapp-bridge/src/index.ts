// Sales Progressor WhatsApp bridge — persistent linked-device listener.
// Passive only: it never sends WhatsApp messages. It connects as a companion
// device, listens for live messages (inbound AND Ellis's own app-sent ones),
// normalises them, and forwards them to the PWA ingest endpoint with a
// disk-backed retry queue. See ../docs/WHATSAPP_INTEGRATION.md.

import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode";
import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { Delivery } from "./delivery.js";
import { normaliseMessage } from "./normalise.js";
import { startHttpServer, type BridgeState } from "./server.js";
import { Watermark } from "./watermark.js";
import { rm } from "node:fs/promises";

const cfg = loadConfig();
// History floor: the newest message already forwarded, persisted across
// restarts (see watermark.ts). Messages older than it are archive/backfill and
// skipped; anything newer — including a backlog from downtime — is captured.
const watermark = new Watermark(cfg.queueDir);
const state: BridgeState = { connection: "connecting", qrDataUrl: null, phoneNumber: null, lastMessageAt: null };
const delivery = new Delivery(cfg);
const groupNames = new Map<string, string>();
// Baileys wants a pino-shaped logger; keep it silent — our own logger handles
// lifecycle logging without leaking message bodies or credentials.
const waLogger = pino({ level: "silent" });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let currentSock: WASocket | null = null;

async function clearAuth(): Promise<void> {
  try {
    await rm(cfg.authDir, { recursive: true, force: true });
    log.info("auth credentials cleared");
  } catch (err) {
    log.warn("auth clear failed", { error: (err as Error).message });
  }
}

// Force a fresh pairing: drop the stored credentials and bounce the socket. The
// connection.update "close" handler treats the bounce as transient and
// reconnects; with creds gone it comes back up as a scannable QR. Used both on a
// genuine logout and by the /repair control endpoint, so the bridge can always
// recover to a QR without someone clearing the volume by hand.
async function repair(): Promise<void> {
  await clearAuth();
  try {
    currentSock?.end(new Error("manual re-pair"));
  } catch {
    /* socket already gone */
  }
}

async function groupSubject(sock: WASocket, jid: string): Promise<string | null> {
  const cached = groupNames.get(jid);
  if (cached) return cached;
  // A brand-new group's metadata can lag the first message. Retry a few times
  // before giving up; the message still forwards (pends) either way and
  // self-heals once the name is known.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const meta = await sock.groupMetadata(jid);
      if (meta?.subject) {
        groupNames.set(jid, meta.subject);
        return meta.subject;
      }
    } catch (err) {
      if (attempt === 2) log.warn("groupMetadata failed", { error: (err as Error).message });
    }
    await sleep(800);
  }
  return null;
}

async function connect() {
  const { state: authState, saveCreds } = await useMultiFileAuthState(cfg.authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    logger: waLogger,
    printQRInTerminal: false,
    syncFullHistory: true, // pull the history WhatsApp still holds on (re)link
    markOnlineOnConnect: false, // stay passive — don't flip presence to "online"
  });

  currentSock = sock;
  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      state.connection = "qr";
      state.qrDataUrl = await qrcode.toDataURL(qr).catch(() => null);
      // Also print to logs so the QR can be scanned straight from Railway logs
      // before the in-app connect UI (Phase 4) exists.
      try {
        log.info("scan this QR in WhatsApp > Linked Devices to link the bridge");
        console.log(await qrcode.toString(qr, { type: "terminal", small: true }));
      } catch {
        /* ignore render failure */
      }
    }

    if (connection === "open") {
      state.connection = "open";
      state.qrDataUrl = null;
      const rawId = sock.user?.id ?? "";
      state.phoneNumber = rawId ? `+${rawId.split(":")[0].split("@")[0]}` : null;
      log.info("connected", { phone: state.phoneNumber });
    }

    if (connection === "close") {
      state.connection = "close";
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      log.warn("connection closed", { statusCode, loggedOut });
      if (loggedOut) {
        // Was a permanent dead-end: it returned without clearing creds, so /pair
        // stuck forever. Now we clear and reconnect, which re-emits a QR.
        log.error("logged out — clearing credentials and restarting pairing");
        await clearAuth();
        setTimeout(() => void connect(), 3000);
        return;
      }
      setTimeout(() => void connect(), 3000); // transient — reconnect
    }
  });

  // Learn group names as WhatsApp syncs them, so matching has the name ready
  // (especially for freshly-created groups).
  sock.ev.on("groups.upsert", (groups) => {
    for (const g of groups) if (g.id && g.subject) groupNames.set(g.id, g.subject);
  });
  sock.ev.on("groups.update", (updates) => {
    for (const g of updates) if (g.id && g.subject) groupNames.set(g.id, g.subject);
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // notify = new incoming message; append = often our OWN messages sent from
    // another device (phone/desktop). We want both. Guard against the initial
    // history sync by ignoring anything older than the bridge's boot time.
    if (type !== "notify" && type !== "append") return;
    log.info("messages.upsert", { type, count: messages.length });
    for (const wa of messages) {
      try {
        const remoteJid = wa.key?.remoteJid ?? "";
        const isGroup = remoteJid.endsWith("@g.us");
        const name = isGroup ? await groupSubject(sock, remoteJid) : null;
        const msg = normaliseMessage(wa, name);
        if (!msg) continue;
        if (msg.timestamp < watermark.get() - 60_000) continue; // older than the last-seen floor — archive
        state.lastMessageAt = new Date().toISOString();
        await delivery.send(msg);
        watermark.observe(msg.timestamp);
        // If it carries media, download it and upload after the message row
        // exists (delivery above is awaited, so the PWA can attach it).
        if (msg.media) {
          try {
            const buffer = (await downloadMediaMessage(
              wa,
              "buffer",
              {},
              { logger: waLogger, reuploadRequest: sock.updateMediaMessage },
            )) as Buffer;
            await delivery.sendMedia(msg.waMessageId, buffer, msg.media.mimetype, msg.media.filename);
          } catch (err) {
            log.warn("media download failed", { error: (err as Error).message, waMessageId: msg.waMessageId });
          }
        }
      } catch (err) {
        log.error("message handling failed", { error: (err as Error).message });
      }
    }
  });

  // Backfill: WhatsApp delivers the history it still holds via this event on
  // (re)link. Forward each message regardless of the live watermark (they're
  // older by definition); the PWA dedups by message id, so re-syncs don't
  // double-insert. Text/placeholder only — historical media is frequently
  // expired on WhatsApp's servers, so we don't attempt downloads here.
  sock.ev.on("messaging-history.set", async ({ messages }) => {
    if (!messages?.length) return;
    log.info("history sync batch", { count: messages.length });
    for (const wa of messages) {
      try {
        const remoteJid = wa.key?.remoteJid ?? "";
        const isGroup = remoteJid.endsWith("@g.us");
        const name = isGroup ? await groupSubject(sock, remoteJid) : null;
        const msg = normaliseMessage(wa, name);
        if (!msg) continue;
        await delivery.send(msg);
      } catch (err) {
        log.error("history message handling failed", { error: (err as Error).message });
      }
    }
  });
}

async function start() {
  await watermark.init();
  await delivery.init();
  startHttpServer(cfg, state, { repair });
  await connect();
}

start().catch((err) => {
  log.error("fatal", { error: (err as Error).message });
  process.exit(1);
});

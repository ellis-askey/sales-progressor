// Sales Progressor WhatsApp bridge — persistent linked-device listener.
// Passive only: it never sends WhatsApp messages. It connects as a companion
// device, listens for live messages (inbound AND Ellis's own app-sent ones),
// normalises them, and forwards them to the PWA ingest endpoint with a
// disk-backed retry queue. See ../docs/WHATSAPP_INTEGRATION.md.

import makeWASocket, {
  DisconnectReason,
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

const cfg = loadConfig();
// Anything timestamped before the bridge booted is treated as history and
// ignored, so the initial linked-device sync never backfills the archive.
const BOOT_TIME = Date.now();
const state: BridgeState = { connection: "connecting", qrDataUrl: null, phoneNumber: null, lastMessageAt: null };
const delivery = new Delivery(cfg);
const groupNames = new Map<string, string>();
// Baileys wants a pino-shaped logger; keep it silent — our own logger handles
// lifecycle logging without leaking message bodies or credentials.
const waLogger = pino({ level: "silent" });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

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
    syncFullHistory: false, // live-from-connection; no bulk backfill
    markOnlineOnConnect: false, // stay passive — don't flip presence to "online"
  });

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
        log.error("logged out: clear the auth dir and re-scan the QR to reconnect");
        return; // needs a human re-pair; don't loop
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
        if (msg.timestamp < BOOT_TIME - 60_000) continue; // history / pre-boot — skip
        state.lastMessageAt = new Date().toISOString();
        await delivery.send(msg);
      } catch (err) {
        log.error("message handling failed", { error: (err as Error).message });
      }
    }
  });
}

async function start() {
  await delivery.init();
  startHttpServer(cfg, state);
  await connect();
}

start().catch((err) => {
  log.error("fatal", { error: (err as Error).message });
  process.exit(1);
});

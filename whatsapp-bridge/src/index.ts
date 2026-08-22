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
const state: BridgeState = { connection: "connecting", qrDataUrl: null, phoneNumber: null, lastMessageAt: null };
const delivery = new Delivery(cfg);
const groupNames = new Map<string, string>();
// Baileys wants a pino-shaped logger; keep it silent — our own logger handles
// lifecycle logging without leaking message bodies or credentials.
const waLogger = pino({ level: "silent" });

async function groupSubject(sock: WASocket, jid: string): Promise<string | null> {
  const cached = groupNames.get(jid);
  if (cached) return cached;
  try {
    const meta = await sock.groupMetadata(jid);
    if (meta?.subject) {
      groupNames.set(jid, meta.subject);
      return meta.subject;
    }
  } catch (err) {
    log.warn("groupMetadata failed", { error: (err as Error).message });
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
        log.error("logged out — clear the auth dir and re-scan the QR to reconnect");
        return; // needs a human re-pair; don't loop
      }
      setTimeout(() => void connect(), 3000); // transient — reconnect
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return; // only live messages, never history sync
    for (const wa of messages) {
      try {
        const remoteJid = wa.key?.remoteJid ?? "";
        const isGroup = remoteJid.endsWith("@g.us");
        const name = isGroup ? await groupSubject(sock, remoteJid) : null;
        const msg = normaliseMessage(wa, name);
        if (!msg) continue;
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

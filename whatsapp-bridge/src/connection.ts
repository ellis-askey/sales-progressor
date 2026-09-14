// One linked WhatsApp device — its socket, auth, watermark, and message handling.
// Extracted from the old single-socket index.ts so the bridge can hold many
// connections at once (the internal number + one per agency). Passive only: it
// never sends WhatsApp messages.
//
// Scoping: an agency connection stamps its `id` (the PWA's WhatsAppConnection id)
// onto every forwarded message so the PWA files it against that agency only. The
// internal connection is unscoped (`scoped: false`) and forwards no id, so the
// PWA treats it exactly as before.

import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode";
import { rm } from "node:fs/promises";
import type { BridgeConfig } from "./config.js";
import { log } from "./logger.js";
import type { Delivery } from "./delivery.js";
import { normaliseMessage } from "./normalise.js";
import { Watermark } from "./watermark.js";
import type { BridgeState } from "./types.js";

const waLogger = pino({ level: "silent" });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ConnectionOpts = {
  id: string;
  scoped: boolean; // false = internal number (forwards no connectionId)
  authDir: string;
  watermarkPath: string;
};

export class Connection {
  readonly id: string;
  readonly state: BridgeState = { connection: "connecting", qrDataUrl: null, phoneNumber: null, lastMessageAt: null };

  private scoped: boolean;
  private cfg: BridgeConfig;
  private delivery: Delivery;
  private authDir: string;
  private watermark: Watermark;
  private groupNames = new Map<string, string>();
  private sock: WASocket | null = null;
  private closing = false; // set on deliberate disconnect so we don't auto-reconnect

  constructor(cfg: BridgeConfig, delivery: Delivery, opts: ConnectionOpts) {
    this.cfg = cfg;
    this.delivery = delivery;
    this.id = opts.id;
    this.scoped = opts.scoped;
    this.authDir = opts.authDir;
    this.watermark = new Watermark(opts.watermarkPath);
  }

  async init(): Promise<void> {
    await this.watermark.init();
  }

  private async clearAuth(): Promise<void> {
    try {
      await rm(this.authDir, { recursive: true, force: true });
      log.info("auth credentials cleared", { id: this.id });
    } catch (err) {
      log.warn("auth clear failed", { id: this.id, error: (err as Error).message });
    }
  }

  // Force a fresh pairing: drop stored credentials and bounce the socket. The
  // close handler treats the bounce as transient and reconnects; with creds gone
  // it comes back up as a scannable QR.
  async repair(): Promise<void> {
    this.state.connection = "connecting";
    this.state.qrDataUrl = null;
    await this.clearAuth();
    try {
      this.sock?.end(new Error("manual re-pair"));
    } catch {
      /* socket already gone */
    }
  }

  // Permanently stop this connection: end the socket, don't reconnect, and clear
  // its credentials so it doesn't resume on the next boot.
  async disconnect(): Promise<void> {
    this.closing = true;
    try {
      this.sock?.end(new Error("disconnect"));
    } catch {
      /* already gone */
    }
    await this.clearAuth();
    this.state.connection = "close";
  }

  private async groupSubject(jid: string): Promise<string | null> {
    const cached = this.groupNames.get(jid);
    if (cached) return cached;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const meta = await this.sock?.groupMetadata(jid);
        if (meta?.subject) {
          this.groupNames.set(jid, meta.subject);
          return meta.subject;
        }
      } catch (err) {
        if (attempt === 2) log.warn("groupMetadata failed", { id: this.id, error: (err as Error).message });
      }
      await sleep(800);
    }
    return null;
  }

  async connect(): Promise<void> {
    const { state: authState, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: authState,
      logger: waLogger,
      printQRInTerminal: false,
      // Agency numbers: don't pull full history (fingerprint reduction — capture
      // from link-time forward). Internal number keeps full-history backfill.
      syncFullHistory: !this.scoped,
      markOnlineOnConnect: false, // stay passive
    });

    this.sock = sock;
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.state.connection = "qr";
        this.state.qrDataUrl = await qrcode.toDataURL(qr).catch(() => null);
        try {
          log.info("scan this QR in WhatsApp > Linked Devices to link", { id: this.id });
          console.log(await qrcode.toString(qr, { type: "terminal", small: true }));
        } catch {
          /* ignore render failure */
        }
      }

      if (connection === "open") {
        this.state.connection = "open";
        this.state.qrDataUrl = null;
        const rawId = sock.user?.id ?? "";
        this.state.phoneNumber = rawId ? `+${rawId.split(":")[0].split("@")[0]}` : null;
        log.info("connected", { id: this.id, phone: this.state.phoneNumber });
      }

      if (connection === "close") {
        this.state.connection = "close";
        if (this.closing) {
          log.info("connection stopped", { id: this.id });
          return;
        }
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        log.warn("connection closed", { id: this.id, statusCode, loggedOut });
        if (loggedOut) {
          log.error("logged out — clearing credentials and restarting pairing", { id: this.id });
          await this.clearAuth();
          setTimeout(() => void this.connect(), 3000);
          return;
        }
        setTimeout(() => void this.connect(), 3000); // transient — reconnect
      }
    });

    sock.ev.on("groups.upsert", (groups) => {
      for (const g of groups) if (g.id && g.subject) this.groupNames.set(g.id, g.subject);
    });
    sock.ev.on("groups.update", (updates) => {
      for (const g of updates) if (g.id && g.subject) this.groupNames.set(g.id, g.subject);
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify" && type !== "append") return;
      log.info("messages.upsert", { id: this.id, type, count: messages.length });
      for (const wa of messages) {
        try {
          const remoteJid = wa.key?.remoteJid ?? "";
          const isGroup = remoteJid.endsWith("@g.us");
          const name = isGroup ? await this.groupSubject(remoteJid) : null;
          const msg = normaliseMessage(wa, name);
          if (!msg) continue;
          if (msg.timestamp < this.watermark.get() - 60_000) continue; // archive floor
          if (this.scoped) msg.connectionId = this.id;
          this.state.lastMessageAt = new Date().toISOString();
          await this.delivery.send(msg);
          this.watermark.observe(msg.timestamp);
          if (msg.media) {
            try {
              const buffer = (await downloadMediaMessage(
                wa,
                "buffer",
                {},
                { logger: waLogger, reuploadRequest: sock.updateMediaMessage },
              )) as Buffer;
              await this.delivery.sendMedia(msg.waMessageId, buffer, msg.media.mimetype, msg.media.filename);
            } catch (err) {
              log.warn("media download failed", { id: this.id, error: (err as Error).message, waMessageId: msg.waMessageId });
            }
          }
        } catch (err) {
          log.error("message handling failed", { id: this.id, error: (err as Error).message });
        }
      }
    });

    // Backfill on (re)link — internal number only (agency numbers skip full
    // history). Forwarded regardless of the live watermark; the PWA dedups by id.
    sock.ev.on("messaging-history.set", async ({ messages }) => {
      if (this.scoped) return;
      if (!messages?.length) return;
      log.info("history sync batch", { id: this.id, count: messages.length });
      for (const wa of messages) {
        try {
          const remoteJid = wa.key?.remoteJid ?? "";
          const isGroup = remoteJid.endsWith("@g.us");
          const name = isGroup ? await this.groupSubject(remoteJid) : null;
          const msg = normaliseMessage(wa, name);
          if (!msg) continue;
          await this.delivery.send(msg);
        } catch (err) {
          log.error("history message handling failed", { id: this.id, error: (err as Error).message });
        }
      }
    });
  }
}

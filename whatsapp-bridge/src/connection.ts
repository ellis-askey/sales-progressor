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
  proto,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode";
import { mkdir, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BridgeConfig } from "./config.js";
import { log } from "./logger.js";
import type { Delivery } from "./delivery.js";
import { normaliseMessage } from "./normalise.js";
import { Watermark } from "./watermark.js";
import type { BridgeMessage, BridgeState } from "./types.js";

const waLogger = pino({ level: "silent" });
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// How often to re-attempt downloads that failed their live retries, and how long
// to keep trying. WhatsApp expires media after ~2 weeks, so past that there is
// nothing left to re-request and the queued entry is dropped.
const DOWNLOAD_RETRY_INTERVAL_MS = 60_000;
const DOWNLOAD_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// A message whose media download failed its live retries, persisted so the
// download can be re-attempted later (while the socket is up and WhatsApp still
// holds the media). The encoded proto message is tiny — it carries the media
// *keys*, not the bytes — so this queue stays small.
type DownloadRetryItem = {
  waMessageId: string;
  mimetype?: string;
  filename?: string;
  enqueuedAt: number;
  waB64: string; // proto.WebMessageInfo, protobuf-encoded then base64
};

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
  private downloadQueueDir: string;
  private drainingDownloads = false;

  constructor(cfg: BridgeConfig, delivery: Delivery, opts: ConnectionOpts) {
    this.cfg = cfg;
    this.delivery = delivery;
    this.id = opts.id;
    this.scoped = opts.scoped;
    this.authDir = opts.authDir;
    this.watermark = new Watermark(opts.watermarkPath);
    // Per-connection: a download must be re-requested through the same account's
    // socket, so each connection drains only its own queued downloads.
    this.downloadQueueDir = join(cfg.downloadQueueDir, opts.id.replace(/[^a-zA-Z0-9_-]/g, "_"));
  }

  async init(): Promise<void> {
    await this.watermark.init();
    await mkdir(this.downloadQueueDir, { recursive: true });
    setInterval(() => void this.drainDownloadQueue(), DOWNLOAD_RETRY_INTERVAL_MS);
  }

  private async clearAuth(): Promise<void> {
    // Credentials gone = identity gone. Without this, /status keeps reporting
    // the old phone number after a logout, and the UIs render a device that no
    // longer exists (how the Sept-Oct 2026 outage looked "Connected" for weeks).
    this.state.phoneNumber = null;
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

  // Download WhatsApp media with a few retries. Baileys downloads fail
  // transiently (the media server occasionally needs a reupload request, or
  // drops the first fetch); without a retry those single failures permanently
  // lost the attachment. reuploadRequest asks WhatsApp to re-serve expired media.
  private async downloadMediaWithRetry(wa: proto.IWebMessageInfo, sock: WASocket): Promise<Buffer> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return (await downloadMediaMessage(
          wa,
          "buffer",
          {},
          { logger: waLogger, reuploadRequest: sock.updateMediaMessage },
        )) as Buffer;
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleep(1000 * (attempt + 1));
      }
    }
    throw lastErr;
  }

  // Persist a message whose media download failed its live retries, so we can
  // re-attempt the download later. We store the protobuf-encoded message (the
  // media keys, not the bytes) so decode → downloadMediaMessage works intact; a
  // naive JSON round-trip would corrupt the binary key fields.
  private async enqueueDownloadRetry(wa: proto.IWebMessageInfo, msg: BridgeMessage): Promise<void> {
    try {
      const encoded = proto.WebMessageInfo.encode(wa).finish();
      const item: DownloadRetryItem = {
        waMessageId: msg.waMessageId,
        mimetype: msg.media?.mimetype,
        filename: msg.media?.filename,
        enqueuedAt: Date.now(),
        waB64: Buffer.from(encoded).toString("base64"),
      };
      const safe = msg.waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_");
      await writeFile(join(this.downloadQueueDir, `${safe}.json`), JSON.stringify(item), "utf8");
    } catch (err) {
      log.warn("could not queue media download retry", { id: this.id, error: (err as Error).message, waMessageId: msg.waMessageId });
    }
  }

  // Re-attempt queued media downloads. Needs a live socket (the re-request goes
  // through this account's connection); when the socket is down we skip and try
  // again next interval. A still-failing entry is left queued until it succeeds
  // or ages out (the media has expired and is unrecoverable).
  async drainDownloadQueue(): Promise<void> {
    if (this.drainingDownloads) return;
    const sock = this.sock;
    if (!sock || this.state.connection !== "open") return;
    this.drainingDownloads = true;
    try {
      const files = (await readdir(this.downloadQueueDir)).filter((f) => f.endsWith(".json"));
      if (files.length === 0) return;
      log.info("draining media download queue", { id: this.id, pending: files.length });
      for (const file of files) {
        const path = join(this.downloadQueueDir, file);
        let item: DownloadRetryItem;
        try {
          item = JSON.parse(await readFile(path, "utf8")) as DownloadRetryItem;
        } catch {
          await unlink(path).catch(() => {});
          continue;
        }
        if (Date.now() - item.enqueuedAt > DOWNLOAD_MAX_AGE_MS) {
          log.warn("media download retry expired, dropping", { id: this.id, waMessageId: item.waMessageId });
          await unlink(path).catch(() => {});
          continue;
        }
        try {
          const wa = proto.WebMessageInfo.decode(Buffer.from(item.waB64, "base64"));
          const buffer = await this.downloadMediaWithRetry(wa, sock);
          await this.delivery.sendMedia(item.waMessageId, buffer, item.mimetype, item.filename);
          await unlink(path).catch(() => {});
        } catch (err) {
          log.warn("media download retry still failing", { id: this.id, waMessageId: item.waMessageId, error: (err as Error).message });
          // Leave queued — try again next interval, until it succeeds or ages out.
        }
      }
    } catch (err) {
      log.warn("download queue drain failed", { id: this.id, error: (err as Error).message });
    } finally {
      this.drainingDownloads = false;
    }
  }

  async connect(): Promise<void> {
    const { state: authState, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: authState,
      logger: waLogger,
      printQRInTerminal: false,
      // Agency/business numbers: don't REQUEST full history (fingerprint
      // reduction on a customer's number) — but the recent-history payload
      // WhatsApp sends any new device is accepted below (option A, 2026-10-19).
      // Internal number keeps full-history backfill.
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
          log.error("logged out: clearing credentials and restarting pairing", { id: this.id });
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
              const buffer = await this.downloadMediaWithRetry(wa, sock);
              await this.delivery.sendMedia(msg.waMessageId, buffer, msg.media.mimetype, msg.media.filename);
            } catch (err) {
              log.warn("media download failed after retries, queued for later retry", { id: this.id, error: (err as Error).message, waMessageId: msg.waMessageId });
              await this.enqueueDownloadRetry(wa, msg);
            }
          }
        } catch (err) {
          log.error("message handling failed", { id: this.id, error: (err as Error).message });
        }
      }
    });

    // Backfill on (re)link. The internal number requests FULL history
    // (syncFullHistory above); scoped agency/business connections don't request
    // it, but WhatsApp still hands a new linked device the recent messages per
    // chat — since 2026-10-19 (founder: option A) we accept that payload instead
    // of discarding it, so "I linked on Tuesday but the chain drama happened
    // last week" is covered without the heavier full-history fingerprint on a
    // customer's number. Forwarded regardless of the live watermark; the PWA
    // dedups by id and applies the same scoping + groups-only matching.
    sock.ev.on("messaging-history.set", async ({ messages }) => {
      if (!messages?.length) return;
      log.info("history sync batch", { id: this.id, count: messages.length });
      for (const wa of messages) {
        try {
          const remoteJid = wa.key?.remoteJid ?? "";
          const isGroup = remoteJid.endsWith("@g.us");
          const name = isGroup ? await this.groupSubject(remoteJid) : null;
          const msg = normaliseMessage(wa, name);
          if (!msg) continue;
          if (this.scoped) msg.connectionId = this.id;
          await this.delivery.send(msg);
        } catch (err) {
          log.error("history message handling failed", { id: this.id, error: (err as Error).message });
        }
      }
    });
  }
}

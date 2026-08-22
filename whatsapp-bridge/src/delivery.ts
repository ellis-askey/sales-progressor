// Delivery to the PWA ingest endpoint, with a disk-backed retry queue so nothing
// is lost while the PWA is briefly unavailable. Each failed message is written
// as a JSON file in QUEUE_DIR and retried on an interval.

import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { BridgeConfig } from "./config.js";
import type { BridgeMessage } from "./types.js";
import { log } from "./logger.js";

const RETRY_INTERVAL_MS = 30_000;

export class Delivery {
  private cfg: BridgeConfig;
  private draining = false;

  constructor(cfg: BridgeConfig) {
    this.cfg = cfg;
  }

  async init() {
    await mkdir(this.cfg.queueDir, { recursive: true });
    setInterval(() => void this.drainQueue(), RETRY_INTERVAL_MS);
  }

  // Try an immediate POST; on any failure, persist to the queue for retry.
  async send(msg: BridgeMessage) {
    const ok = await this.post([msg]);
    if (ok) {
      log.info("delivered", { waMessageId: msg.waMessageId, chat: shortJid(msg.waChatId) });
    } else {
      await this.enqueue(msg);
      log.warn("delivery failed, queued", { waMessageId: msg.waMessageId });
    }
  }

  // Best-effort media upload (after the message itself is delivered). Not
  // queued: if it fails the message still shows with its text/placeholder.
  async sendMedia(waMessageId: string, buffer: Buffer, mimetype?: string, filename?: string) {
    try {
      const res = await fetch(this.cfg.pwaMediaUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.bridgeSecret}` },
        body: JSON.stringify({ waMessageId, mimetype, filename, dataBase64: buffer.toString("base64") }),
      });
      if (!res.ok) log.warn("media ingest non-2xx", { status: res.status, waMessageId });
      else log.info("media delivered", { waMessageId, bytes: buffer.length });
    } catch (err) {
      log.warn("media post threw", { error: (err as Error).message, waMessageId });
    }
  }

  private async post(messages: BridgeMessage[]): Promise<boolean> {
    try {
      const res = await fetch(this.cfg.pwaIngestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.cfg.bridgeSecret}`,
        },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) {
        log.warn("ingest non-2xx", { status: res.status });
        return false;
      }
      return true;
    } catch (err) {
      log.warn("ingest request threw", { error: (err as Error).message });
      return false;
    }
  }

  private async enqueue(msg: BridgeMessage) {
    // Filename keyed by message id → idempotent; a replay overwrites, never dupes.
    const safe = msg.waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_");
    await writeFile(join(this.cfg.queueDir, `${safe}.json`), JSON.stringify(msg), "utf8");
  }

  async drainQueue() {
    if (this.draining) return;
    this.draining = true;
    try {
      const files = (await readdir(this.cfg.queueDir)).filter((f) => f.endsWith(".json"));
      if (files.length === 0) return;
      log.info("draining queue", { pending: files.length });
      for (const file of files) {
        const path = join(this.cfg.queueDir, file);
        let msg: BridgeMessage;
        try {
          msg = JSON.parse(await readFile(path, "utf8")) as BridgeMessage;
        } catch {
          await unlink(path).catch(() => {});
          continue;
        }
        const ok = await this.post([msg]);
        if (ok) await unlink(path).catch(() => {});
        else break; // PWA still down — try again next interval
      }
    } catch (err) {
      log.warn("drain failed", { error: (err as Error).message });
    } finally {
      this.draining = false;
    }
  }
}

function shortJid(jid: string): string {
  return jid.split("@")[0] ?? jid;
}

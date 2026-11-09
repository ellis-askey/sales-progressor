// Delivery to the PWA ingest endpoint, with disk-backed retry queues so nothing
// is lost while the PWA is briefly unavailable. Each failed message is written as
// a JSON file in QUEUE_DIR; media uploads have a parallel queue in MEDIA_QUEUE_DIR
// (same pattern) so a failed attachment is retried rather than dropped.

import { mkdir, readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { BridgeConfig } from "./config.js";
import type { BridgeMessage } from "./types.js";
import { log } from "./logger.js";

const RETRY_INTERVAL_MS = 30_000;
// WhatsApp expires media after a couple of weeks; past this there is nothing to
// re-fetch, so a queued upload that still hasn't landed is dropped rather than
// retried forever.
const MEDIA_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

// A media upload that failed its immediate POST, persisted to disk so an endpoint
// outage (or a message that hasn't been ingested yet) can't lose the attachment.
type QueuedMedia = {
  waMessageId: string;
  mimetype?: string;
  filename?: string;
  dataBase64: string;
  enqueuedAt: number; // unix ms — bounds the retry window (MEDIA_MAX_AGE_MS)
};

// Outcome of a media POST, so both the immediate attempt and the drain can decide
// whether to retry, give up, or keep waiting for the message to be ingested.
type MediaResult =
  | "ok" // uploaded and attached to the message/pending row
  | "pending" // uploaded, but the message isn't ingested yet — keep queued, attach later
  | "drop" // permanently bad payload (empty / too large) — never going to succeed
  | "down"; // endpoint unreachable / server error — retry the whole queue later

export class Delivery {
  private cfg: BridgeConfig;
  private draining = false;
  private drainingMedia = false;

  constructor(cfg: BridgeConfig) {
    this.cfg = cfg;
  }

  async init() {
    await mkdir(this.cfg.queueDir, { recursive: true });
    await mkdir(this.cfg.mediaQueueDir, { recursive: true });
    // Drain text first, then media: a message must be ingested before its media
    // can attach, so flushing the message queue ahead of the media queue each
    // tick avoids orphaning media during outage recovery.
    setInterval(() => void this.drainAll(), RETRY_INTERVAL_MS);
  }

  private async drainAll() {
    await this.drainQueue();
    await this.drainMediaQueue();
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

  // Media upload (after the message itself is delivered). Disk-backed retry queue,
  // mirroring the message queue: a failed or not-yet-attachable upload is persisted
  // and re-sent on the drain interval, so an endpoint outage no longer silently
  // loses photos / voice notes / documents.
  async sendMedia(waMessageId: string, buffer: Buffer, mimetype?: string, filename?: string) {
    const item: QueuedMedia = {
      waMessageId,
      mimetype,
      filename,
      dataBase64: buffer.toString("base64"),
      enqueuedAt: Date.now(),
    };
    const result = await this.postMedia(item);
    if (result === "ok") {
      log.info("media delivered", { waMessageId, bytes: buffer.length });
      return;
    }
    if (result === "drop") {
      log.warn("media rejected, dropping", { waMessageId });
      return;
    }
    // "pending" (message not ingested yet) or "down" (endpoint unreachable): keep it.
    await this.enqueueMedia(item);
    log.warn("media upload deferred, queued", { waMessageId, reason: result });
  }

  // POST one media item. Classifies the response so the caller can retry, wait, or
  // give up without one bad item ever blocking the queue.
  private async postMedia(item: QueuedMedia): Promise<MediaResult> {
    try {
      const res = await fetch(this.cfg.pwaMediaUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.bridgeSecret}` },
        body: JSON.stringify({
          waMessageId: item.waMessageId,
          mimetype: item.mimetype,
          filename: item.filename,
          dataBase64: item.dataBase64,
        }),
      });
      if (res.ok) {
        // The endpoint reports whether it found a message/pending row to attach to.
        // If not, the message hasn't been ingested yet — keep the media queued.
        // Older endpoint with no field → assume attached.
        const body = (await res.json().catch(() => ({}))) as { attached?: boolean };
        return body.attached !== false ? "ok" : "pending";
      }
      // 400 (empty / missing) and 413 (too large) can never succeed on retry.
      if (res.status === 400 || res.status === 413) return "drop";
      log.warn("media ingest non-2xx", { status: res.status, waMessageId: item.waMessageId });
      return "down";
    } catch (err) {
      log.warn("media post threw", { error: (err as Error).message, waMessageId: item.waMessageId });
      return "down";
    }
  }

  private async enqueueMedia(item: QueuedMedia) {
    // Keyed by message id → idempotent; a replay overwrites, never dupes.
    const safe = item.waMessageId.replace(/[^a-zA-Z0-9_-]/g, "_");
    await writeFile(join(this.cfg.mediaQueueDir, `${safe}.json`), JSON.stringify(item), "utf8");
  }

  async drainMediaQueue() {
    if (this.drainingMedia) return;
    this.drainingMedia = true;
    try {
      const files = (await readdir(this.cfg.mediaQueueDir)).filter((f) => f.endsWith(".json"));
      if (files.length === 0) return;
      log.info("draining media queue", { pending: files.length });
      for (const file of files) {
        const path = join(this.cfg.mediaQueueDir, file);
        let item: QueuedMedia;
        try {
          item = JSON.parse(await readFile(path, "utf8")) as QueuedMedia;
        } catch {
          await unlink(path).catch(() => {});
          continue;
        }
        if (Date.now() - item.enqueuedAt > MEDIA_MAX_AGE_MS) {
          log.warn("media queue entry expired, dropping", { waMessageId: item.waMessageId });
          await unlink(path).catch(() => {});
          continue;
        }
        const result = await this.postMedia(item);
        if (result === "ok" || result === "drop") {
          await unlink(path).catch(() => {});
        } else if (result === "pending") {
          continue; // message still not ingested — leave queued, try the rest
        } else {
          break; // endpoint down — stop and try the whole queue next interval
        }
      }
    } catch (err) {
      log.warn("media drain failed", { error: (err as Error).message });
    } finally {
      this.drainingMedia = false;
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

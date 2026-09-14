// Holds every live WhatsApp connection: the internal number plus one per agency.
// Auth for each lives on the Railway persistent disk under AUTH_DIR, so on a
// restart/redeploy every previously-linked connection resumes automatically.

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { BridgeConfig } from "./config.js";
import type { Delivery } from "./delivery.js";
import { Connection } from "./connection.js";
import { log } from "./logger.js";

// Reserved id for the internal number. It keeps the original auth/watermark paths
// (AUTH_DIR root) so it never has to be re-scanned, and forwards no connectionId.
export const INTERNAL_ID = "internal";

export class ConnectionManager {
  private cfg: BridgeConfig;
  private delivery: Delivery;
  private conns = new Map<string, Connection>();

  constructor(cfg: BridgeConfig, delivery: Delivery) {
    this.cfg = cfg;
    this.delivery = delivery;
  }

  // Auth + watermark locations per connection. The internal number keeps the
  // legacy root paths; agency connections live under a per-id subfolder.
  private pathsFor(id: string): { authDir: string; watermarkPath: string } {
    if (id === INTERNAL_ID) {
      return { authDir: this.cfg.authDir, watermarkPath: join(this.cfg.queueDir, "watermark.json") };
    }
    return {
      authDir: join(this.cfg.authDir, "conn", id),
      watermarkPath: join(this.cfg.queueDir, "conn", `${id}.watermark.json`),
    };
  }

  // Start a connection if it isn't already running; returns the existing one if
  // it is. Idempotent — safe to call from a repeated /pair request.
  async ensure(id: string): Promise<Connection> {
    const existing = this.conns.get(id);
    if (existing) return existing;
    const { authDir, watermarkPath } = this.pathsFor(id);
    const conn = new Connection(this.cfg, this.delivery, {
      id,
      scoped: id !== INTERNAL_ID,
      authDir,
      watermarkPath,
    });
    this.conns.set(id, conn);
    await conn.init();
    await conn.connect();
    return conn;
  }

  get(id: string): Connection | undefined {
    return this.conns.get(id);
  }

  list(): Connection[] {
    return [...this.conns.values()];
  }

  // Permanently drop a connection (agent unlinked): stop the socket, clear its
  // creds, forget it.
  async remove(id: string): Promise<void> {
    const conn = this.conns.get(id);
    if (!conn) return;
    await conn.disconnect();
    this.conns.delete(id);
  }

  // Boot: bring up the internal number, then every agency connection whose auth
  // survived on disk from before the restart.
  async resumeAll(): Promise<void> {
    await this.ensure(INTERNAL_ID).catch((err) =>
      log.error("internal connect failed", { error: (err as Error).message }),
    );
    try {
      const base = join(this.cfg.authDir, "conn");
      const entries = await readdir(base, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        await this.ensure(e.name).catch((err) =>
          log.warn("resume failed", { id: e.name, error: (err as Error).message }),
        );
      }
    } catch {
      // No agency connections yet (conn/ dir absent) — nothing to resume.
    }
  }
}

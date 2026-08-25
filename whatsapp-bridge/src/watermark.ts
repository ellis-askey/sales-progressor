// Persisted "last message seen" timestamp. Without this the bridge used the
// process boot time as its history floor, so every restart / redeploy / reconnect
// silently dropped every message that arrived while it was down. The watermark
// survives restarts on the persistent volume, so the floor is "the newest message
// we've already forwarded" — messages that piled up during downtime are newer
// than it and get captured, while ancient archive backfill stays excluded.
//
// First-ever boot (no file) defaults to now, so a fresh link never floods the
// files with old history; that history is what the paste importer is for.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export class Watermark {
  private path: string;
  private value: number;
  private dirty = false;

  constructor(dir: string) {
    this.path = join(dir, "watermark.json");
    this.value = Date.now();
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf8");
      const n = Number((JSON.parse(raw) as { ts?: unknown })?.ts);
      if (Number.isFinite(n) && n > 0) this.value = n;
    } catch {
      // First boot — keep the default (now). Nothing to backfill.
    }
    setInterval(() => void this.flush(), 10_000);
  }

  get(): number {
    return this.value;
  }

  observe(ts: number): void {
    if (ts > this.value) {
      this.value = ts;
      this.dirty = true;
    }
  }

  private async flush(): Promise<void> {
    if (!this.dirty) return;
    this.dirty = false;
    try {
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(this.path, JSON.stringify({ ts: this.value }), "utf8");
    } catch {
      this.dirty = true; // retry next tick
    }
  }
}

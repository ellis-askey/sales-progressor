// Sales Progressor WhatsApp bridge — persistent linked-device listener.
// Passive only: it never sends WhatsApp messages. It holds one or more companion
// device connections (the internal number + one per agency), listens for live
// messages (inbound AND own app-sent ones), normalises them, and forwards them to
// the PWA ingest endpoint with a disk-backed retry queue. Each connection's auth
// lives on the Railway persistent disk, so all connections resume after a
// restart/redeploy. See ../docs/WHATSAPP_INTEGRATION.md.

import { loadConfig } from "./config.js";
import { log } from "./logger.js";
import { Delivery } from "./delivery.js";
import { startHttpServer } from "./server.js";
import { ConnectionManager } from "./manager.js";

const cfg = loadConfig();

async function start() {
  const delivery = new Delivery(cfg);
  await delivery.init();
  const manager = new ConnectionManager(cfg, delivery);
  // Start the HTTP surface first so /status responds during startup, then bring
  // up the internal number and any previously-linked agency connections.
  startHttpServer(cfg, manager);
  await manager.resumeAll();
}

start().catch((err) => {
  log.error("fatal", { error: (err as Error).message });
  process.exit(1);
});

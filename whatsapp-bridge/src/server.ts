// Tiny HTTP surface for health + pairing. /health is open (for platform health
// checks); /status and /qr require the control secret so the PWA can read the
// pairing QR and connection state during Phase 4's connect flow.

import http from "node:http";
import type { BridgeConfig } from "./config.js";
import { log } from "./logger.js";

export type BridgeState = {
  connection: "connecting" | "qr" | "open" | "close";
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastMessageAt: string | null;
};

export function startHttpServer(cfg: BridgeConfig, state: BridgeState) {
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";

    if (req.method === "GET" && url === "/health") {
      return json(res, 200, { status: "ok", connection: state.connection });
    }

    if (req.method === "GET" && (url === "/status" || url === "/qr")) {
      if (req.headers["authorization"] !== `Bearer ${cfg.controlSecret}`) {
        return json(res, 401, { error: "unauthorized" });
      }
      if (url === "/status") {
        return json(res, 200, {
          connection: state.connection,
          phoneNumber: state.phoneNumber,
          hasQr: state.qrDataUrl != null,
          lastMessageAt: state.lastMessageAt,
        });
      }
      return json(res, 200, { qr: state.qrDataUrl, connection: state.connection });
    }

    json(res, 404, { error: "not_found" });
  });

  server.listen(cfg.port, () => log.info("http server listening", { port: cfg.port }));
  return server;
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

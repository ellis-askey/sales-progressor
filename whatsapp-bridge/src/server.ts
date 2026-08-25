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

export type BridgeControls = {
  // Drop credentials and bounce the socket so a fresh QR is emitted.
  repair: () => Promise<void>;
};

export function startHttpServer(cfg: BridgeConfig, state: BridgeState, controls?: BridgeControls) {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url ?? "/", "http://localhost");
    const path = parsed.pathname;

    if (req.method === "GET" && path === "/health") {
      return json(res, 200, { status: "ok", connection: state.connection });
    }

    // Force a re-pair: clears credentials and restarts pairing so a new QR shows.
    // Secret-gated. Called by the Command Centre "Re-pair" control.
    if (req.method === "POST" && path === "/repair") {
      if (req.headers["authorization"] !== `Bearer ${cfg.controlSecret}`) {
        return json(res, 401, { error: "unauthorized" });
      }
      state.connection = "connecting";
      state.qrDataUrl = null;
      void controls?.repair();
      return json(res, 200, { ok: true });
    }

    // Browser pairing page — shows a clean, auto-refreshing QR to scan.
    // Secret-gated via ?key= because scanning this QR links a device to the
    // WhatsApp account. Meant for one-time pairing from a browser.
    if (req.method === "GET" && path === "/pair") {
      if (parsed.searchParams.get("key") !== cfg.controlSecret) {
        return html(res, 401, "<h1>Unauthorized</h1><p>Add ?key=YOUR_SECRET to the URL.</p>");
      }
      return html(res, 200, pairPage(state));
    }

    if (req.method === "GET" && (path === "/status" || path === "/qr")) {
      if (req.headers["authorization"] !== `Bearer ${cfg.controlSecret}`) {
        return json(res, 401, { error: "unauthorized" });
      }
      if (path === "/status") {
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

// A self-refreshing pairing page. Refreshes every 4s so a rotated QR (WhatsApp
// cycles it) or the "connected" state shows up without a manual reload.
function pairPage(state: BridgeState): string {
  const body =
    state.connection === "open"
      ? `<h1>Connected${state.phoneNumber ? ` as ${escapeHtml(state.phoneNumber)}` : ""}</h1>
         <p>The bridge is linked. You can close this tab.</p>`
      : state.qrDataUrl
        ? `<h1>Scan to link the bridge</h1>
           <img src="${state.qrDataUrl}" width="300" height="300" alt="WhatsApp QR" />
           <p>WhatsApp Business &rarr; Settings &rarr; Linked Devices &rarr; Link a device, then scan.</p>
           <p style="color:#888">This page refreshes itself; if the code changes, just scan the new one.</p>`
        : `<h1>Starting up&hellip;</h1><p>Waiting for the QR code. This page refreshes automatically.</p>`;
  return `<!doctype html><html><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="4" />
    <title>Link WhatsApp bridge</title></head>
    <body style="font-family:system-ui,sans-serif;text-align:center;padding:32px;background:#0a0a0a;color:#e5e5e5">
    ${body}
    </body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function html(res: http.ServerResponse, status: number, body: string) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

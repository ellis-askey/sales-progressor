// HTTP surface for health, pairing, and per-connection control. /health is open
// (platform health checks); everything else needs the control secret so the PWA
// (and a browser, for manual pairing) can drive and read connections.
//
// Back-compat: the bare /status, /qr, /pair, /repair endpoints operate on the
// internal number, exactly as before. Agency connections use /connections/:id/*.

import http from "node:http";
import type { BridgeConfig } from "./config.js";
import type { BridgeState } from "./types.js";
import { ConnectionManager, INTERNAL_ID } from "./manager.js";
import { log } from "./logger.js";

const DEFAULT_STATE: BridgeState = { connection: "connecting", qrDataUrl: null, phoneNumber: null, lastMessageAt: null };

export function startHttpServer(cfg: BridgeConfig, manager: ConnectionManager) {
  const stateOf = (id: string): BridgeState => manager.get(id)?.state ?? DEFAULT_STATE;
  const authed = (req: http.IncomingMessage) => req.headers["authorization"] === `Bearer ${cfg.controlSecret}`;

  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url ?? "/", "http://localhost");
    const path = parsed.pathname;
    const method = req.method ?? "GET";

    if (method === "GET" && path === "/health") {
      return json(res, 200, { status: "ok", connection: stateOf(INTERNAL_ID).connection });
    }

    // ── Per-connection control: /connections/:id/<action> ──
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "connections" && parts.length >= 2) {
      const id = decodeURIComponent(parts[1]);
      const action = parts[2] ?? "";

      // Browser pairing page for a specific connection (secret via ?key=).
      if (method === "GET" && action === "pair-page") {
        if (parsed.searchParams.get("key") !== cfg.controlSecret) {
          return html(res, 401, "<h1>Unauthorized</h1><p>Add ?key=YOUR_SECRET to the URL.</p>");
        }
        void manager.ensure(id).catch((err) => log.warn("ensure failed", { id, error: (err as Error).message }));
        return html(res, 200, pairPage(stateOf(id)));
      }

      if (!authed(req)) return json(res, 401, { error: "unauthorized" });

      if (method === "POST" && action === "pair") {
        void manager.ensure(id).catch((err) => log.warn("ensure failed", { id, error: (err as Error).message }));
        return json(res, 200, { ok: true });
      }
      if (method === "GET" && action === "status") {
        const s = stateOf(id);
        return json(res, 200, {
          connection: s.connection,
          phoneNumber: s.phoneNumber,
          hasQr: s.qrDataUrl != null,
          lastMessageAt: s.lastMessageAt,
        });
      }
      if (method === "GET" && action === "qr") {
        const s = stateOf(id);
        return json(res, 200, { qr: s.qrDataUrl, connection: s.connection });
      }
      if (method === "POST" && action === "repair") {
        void manager.get(id)?.repair();
        return json(res, 200, { ok: true });
      }
      if (method === "POST" && action === "disconnect") {
        void manager.remove(id);
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "not_found" });
    }

    // ── Internal number (back-compat) ──
    if (method === "POST" && path === "/repair") {
      if (!authed(req)) return json(res, 401, { error: "unauthorized" });
      void manager.get(INTERNAL_ID)?.repair();
      return json(res, 200, { ok: true });
    }

    if (method === "GET" && path === "/pair") {
      if (parsed.searchParams.get("key") !== cfg.controlSecret) {
        return html(res, 401, "<h1>Unauthorized</h1><p>Add ?key=YOUR_SECRET to the URL.</p>");
      }
      return html(res, 200, pairPage(stateOf(INTERNAL_ID)));
    }

    if (method === "GET" && (path === "/status" || path === "/qr")) {
      if (!authed(req)) return json(res, 401, { error: "unauthorized" });
      const s = stateOf(INTERNAL_ID);
      if (path === "/status") {
        return json(res, 200, {
          connection: s.connection,
          phoneNumber: s.phoneNumber,
          hasQr: s.qrDataUrl != null,
          lastMessageAt: s.lastMessageAt,
        });
      }
      return json(res, 200, { qr: s.qrDataUrl, connection: s.connection });
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

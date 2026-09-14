// Server-side client for the WhatsApp bridge's per-connection control API
// (Phase 3). Mirrors the env + fetch pattern in lib/command/whatsapp.ts. Never
// throws — returns a typed result so callers degrade gracefully when the bridge
// is unconfigured or unreachable. The bridge secret stays server-side; the agent
// app never talks to the bridge directly.

function bridgeEnv(): { base: string; secret: string } | null {
  const base = process.env.WHATSAPP_BRIDGE_URL?.trim().replace(/\/$/, "");
  const secret = process.env.WHATSAPP_BRIDGE_SECRET?.trim();
  if (!base || !secret) return null;
  return { base, secret };
}

export function isBridgeConfigured(): boolean {
  return bridgeEnv() !== null;
}

export type BridgeConnStatus = {
  configured: boolean;
  reachable: boolean;
  connection?: string; // connecting | qr | open | close
  phoneNumber?: string | null;
  hasQr?: boolean;
  lastMessageAt?: string | null;
};

const connPath = (id: string, action: string) =>
  `/connections/${encodeURIComponent(id)}/${action}`;

export async function bridgeStartPairing(connectionId: string): Promise<{ ok: boolean; error?: string }> {
  const env = bridgeEnv();
  if (!env) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${env.base}${connPath(connectionId, "pair")}`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.secret}` },
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, error: `bridge_${res.status}` };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

export async function bridgeConnectionStatus(connectionId: string): Promise<BridgeConnStatus> {
  const env = bridgeEnv();
  if (!env) return { configured: false, reachable: false };
  try {
    const res = await fetch(`${env.base}${connPath(connectionId, "status")}`, {
      headers: { authorization: `Bearer ${env.secret}` },
      cache: "no-store",
    });
    if (!res.ok) return { configured: true, reachable: false };
    const d = (await res.json()) as {
      connection?: string;
      phoneNumber?: string | null;
      hasQr?: boolean;
      lastMessageAt?: string | null;
    };
    return {
      configured: true,
      reachable: true,
      connection: d.connection,
      phoneNumber: d.phoneNumber ?? null,
      hasQr: !!d.hasQr,
      lastMessageAt: d.lastMessageAt ?? null,
    };
  } catch {
    return { configured: true, reachable: false };
  }
}

export async function bridgeConnectionQr(connectionId: string): Promise<{ qr: string | null; connection?: string }> {
  const env = bridgeEnv();
  if (!env) return { qr: null };
  try {
    const res = await fetch(`${env.base}${connPath(connectionId, "qr")}`, {
      headers: { authorization: `Bearer ${env.secret}` },
      cache: "no-store",
    });
    if (!res.ok) return { qr: null };
    const d = (await res.json()) as { qr?: string | null; connection?: string };
    return { qr: d.qr ?? null, connection: d.connection };
  } catch {
    return { qr: null };
  }
}

export async function bridgeDisconnect(connectionId: string): Promise<{ ok: boolean; error?: string }> {
  const env = bridgeEnv();
  if (!env) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(`${env.base}${connPath(connectionId, "disconnect")}`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.secret}` },
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, error: `bridge_${res.status}` };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

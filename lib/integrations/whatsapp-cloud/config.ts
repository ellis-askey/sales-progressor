// WhatsApp Cloud API (official Meta integration) — environment configuration.
// Phase 1 of docs/active/whatsapp-rebuild/REBUILD_PLAN.md. All vars are for
// TSP's OWN number; tenant numbers (Phase 8) arrive via Embedded Signup and
// live only in WhatsAppBusinessNumber rows, never in env.
//
// Vars (set per environment, staging + prod values differ):
//   WHATSAPP_CLOUD_ACCESS_TOKEN   — system-user token (never-expiring preferred)
//   WHATSAPP_CLOUD_PHONE_NUMBER_ID — Meta business phone number id
//   WHATSAPP_CLOUD_WABA_ID        — WhatsApp Business Account id
//   WHATSAPP_CLOUD_APP_SECRET     — Meta app secret (webhook signature key)
//   WHATSAPP_CLOUD_VERIFY_TOKEN   — any string; must match the webhook config in
//                                   the Meta App Dashboard (GET handshake)
//   WHATSAPP_GRAPH_VERSION        — optional; defaults below

const DEFAULT_GRAPH_VERSION = "v26.0";

export type CloudEnv = {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
};

export function cloudEnv(): CloudEnv | null {
  const accessToken = process.env.WHATSAPP_CLOUD_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID?.trim();
  const wabaId = process.env.WHATSAPP_CLOUD_WABA_ID?.trim();
  const appSecret = process.env.WHATSAPP_CLOUD_APP_SECRET?.trim();
  const verifyToken = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN?.trim();
  if (!accessToken || !phoneNumberId || !wabaId || !appSecret || !verifyToken) return null;
  return {
    accessToken,
    phoneNumberId,
    wabaId,
    appSecret,
    verifyToken,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION,
  };
}

export function isCloudConfigured(): boolean {
  return cloudEnv() !== null;
}

export function graphBase(): string {
  const v = process.env.WHATSAPP_GRAPH_VERSION?.trim() || DEFAULT_GRAPH_VERSION;
  return `https://graph.facebook.com/${v}`;
}

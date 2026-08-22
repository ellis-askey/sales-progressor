// WhatsApp integration config. See docs/WHATSAPP_INTEGRATION.md.
// The off-platform Baileys bridge authenticates to the PWA ingest endpoint with
// a shared bearer secret. Same var name, different value per environment.

export function getWhatsAppBridgeSecret(): string | null {
  return process.env.WHATSAPP_BRIDGE_SECRET?.trim() || null;
}

// Gates the ingest endpoint and (later) the connect UI — mirrors
// isOutlookConfigured(). When unset the endpoint returns 503 rather than
// accepting unauthenticated posts.
export function isWhatsAppConfigured(): boolean {
  return getWhatsAppBridgeSecret() !== null;
}

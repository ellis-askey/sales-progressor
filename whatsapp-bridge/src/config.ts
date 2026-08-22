// Bridge configuration from environment. Fails fast on the two required values.

export type BridgeConfig = {
  pwaIngestUrl: string;
  bridgeSecret: string;
  controlSecret: string;
  authDir: string;
  queueDir: string;
  port: number;
};

export function loadConfig(): BridgeConfig {
  const pwaIngestUrl = (process.env.PWA_INGEST_URL ?? "").trim();
  const bridgeSecret = (process.env.WHATSAPP_BRIDGE_SECRET ?? "").trim();

  const missing: string[] = [];
  if (!pwaIngestUrl) missing.push("PWA_INGEST_URL");
  if (!bridgeSecret) missing.push("WHATSAPP_BRIDGE_SECRET");
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    pwaIngestUrl,
    bridgeSecret,
    // Guards /status + /qr; falls back to the ingest secret if not set separately.
    controlSecret: (process.env.BRIDGE_CONTROL_SECRET ?? "").trim() || bridgeSecret,
    authDir: (process.env.AUTH_DIR ?? "./auth").trim(),
    queueDir: (process.env.QUEUE_DIR ?? "./queue").trim(),
    port: Number(process.env.PORT ?? 8080) || 8080,
  };
}

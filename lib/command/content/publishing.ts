// Publishing seam (docs/active/content-brand/SPEC.md, Phase 6.1). No social
// publishing integration exists yet, so this reports an honest connection status
// derived from env vars. When a provider (a broker like Ayrshare, or per-network
// tokens) is configured, the calendar/composer can offer real publishing; until
// then, "publish" stays manual (mark as posted). Server-only (reads process.env).

export type PublishProvider = { id: string; label: string; connected: boolean };

export type PublishingStatus = {
  connected: boolean;
  providers: PublishProvider[];
};

export function getPublishingStatus(): PublishingStatus {
  // A single broker can cover all three; per-network tokens also count.
  const broker = !!process.env.AYRSHARE_API_KEY;
  const linkedin = broker || !!process.env.LINKEDIN_ACCESS_TOKEN;
  const meta = broker || !!process.env.META_ACCESS_TOKEN; // Meta Graph covers IG + FB

  const providers: PublishProvider[] = [
    { id: "linkedin", label: "LinkedIn", connected: linkedin },
    { id: "instagram", label: "Instagram", connected: meta },
    { id: "facebook", label: "Facebook", connected: meta },
  ];

  return { connected: providers.some((p) => p.connected), providers };
}

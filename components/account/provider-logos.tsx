// components/account/provider-logos.tsx
//
// Brand marks for the email-connection surfaces (tiles + connected rows +
// the Outlook card). Bundled inline SVGs — the Artifact-style CSP lesson
// applies here too: no external image fetches, no CDN. Simplified official
// marks, each rendered as a self-contained rounded tile so callers never
// restyle internals. Domain-specific to Account connections; not a ui/
// primitive (single consumer surface).

import type { CSSProperties } from "react";

const TILE_STYLE = (size: number, bg: string, border?: boolean): CSSProperties => ({
  width: size,
  height: size,
  borderRadius: Math.round(size * 0.24),
  background: bg,
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  ...(border ? { border: "1px solid #eceef1" } : {}),
});

export function GmailLogo({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.62);
  return (
    <span style={TILE_STYLE(size, "#ffffff", true)} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M3.2 7v11.2c0 .44.36.8.8.8h2.6V10.6L3.2 7z" fill="#4285f4" />
        <path d="M20.8 7v11.2c0 .44-.36.8-.8.8h-2.6V10.6L20.8 7z" fill="#34a853" />
        <path d="M3 7.2 12 14l9-6.8" stroke="#ea4335" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M3.2 7 6.6 9.6V6l-2.2-.5c-.7-.15-1.2.4-1.2 1z" fill="#fbbc04" opacity="0.9" />
      </svg>
    </span>
  );
}

export function OutlookLogo({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.62);
  return (
    <span style={TILE_STYLE(size, "#0f6cbd")} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24">
        <rect x="13.5" y="7.5" width="7.5" height="9" rx="1" fill="#28a8ea" />
        <ellipse cx="9.6" cy="12" rx="6.6" ry="7" fill="#0f6cbd" />
        <ellipse cx="9.6" cy="12" rx="5.4" ry="5.8" fill="#fff" />
        <ellipse cx="9.6" cy="12" rx="2.6" ry="3.1" fill="#0f6cbd" />
      </svg>
    </span>
  );
}

export function YahooLogo({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.52);
  return (
    <span style={TILE_STYLE(size, "#5f01d1")} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M4 5l5 8v6h3v-6l5-8h-3.4L10.5 10 7.4 5z" fill="#fff" />
        <circle cx="19.4" cy="17.2" r="1.7" fill="#fff" />
      </svg>
    </span>
  );
}

export function ICloudLogo({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.66);
  return (
    <span style={TILE_STYLE(size, "linear-gradient(180deg,#8fd2ff,#1e7fe0)")} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24">
        <path d="M7 16.5h10.2a3.3 3.3 0 0 0 .6-6.55A5 5 0 0 0 8.2 8.9 3.8 3.8 0 0 0 7 16.5z" fill="#fff" />
      </svg>
    </span>
  );
}

export function ZohoLogo({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.6);
  return (
    <span style={TILE_STYLE(size, "#ffffff", true)} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="3" fill="#e42527" />
        <path d="M8 9h8l-8 6h8" stroke="#fff" strokeWidth="2.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ExpLogo({ size = 34 }: { size?: number }) {
  return (
    <span style={TILE_STYLE(size, "#0c1e3c")} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 32 32">
        <text
          x="16"
          y="21"
          fontFamily="-apple-system, 'Segoe UI', sans-serif"
          fontSize="11"
          fontWeight="700"
          fill="#fff"
          textAnchor="middle"
        >
          eXp
        </text>
      </svg>
    </span>
  );
}

export function GenericMailLogo({ size = 34 }: { size?: number }) {
  const s = Math.round(size * 0.6);
  return (
    <span style={TILE_STYLE(size, "#f3f4f6")} aria-hidden="true">
      <svg width={s} height={s} viewBox="0 0 24 24">
        <rect x="3.5" y="6" width="17" height="12" rx="2" fill="none" stroke="#6b7280" strokeWidth="1.8" />
        <path d="m4.5 7.5 7.5 5.5 7.5-5.5" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/**
 * The right mark for a connected mailbox row. eXp UK addresses are hosted on
 * Zoho (the stored provider is "zoho"), but the agent thinks of it as their
 * eXp email — the address wins over the plumbing.
 */
export function ProviderLogo({ provider, email, size = 28 }: { provider: string; email?: string; size?: number }) {
  if (email?.toLowerCase().endsWith("@expuk.com")) return <ExpLogo size={size} />;
  switch (provider) {
    case "gmail":
      return <GmailLogo size={size} />;
    case "outlook":
      return <OutlookLogo size={size} />;
    case "yahoo":
      return <YahooLogo size={size} />;
    case "icloud":
      return <ICloudLogo size={size} />;
    case "zoho":
      return <ZohoLogo size={size} />;
    default:
      return <GenericMailLogo size={size} />;
  }
}

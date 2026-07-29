// Simple illustrated icons for the phase-journey timeline.
// Each is an inline SVG so we can theme via currentColor + gradient defs.

type IconKind = "key" | "document" | "envelope" | "handshake" | "house";

export function PhaseIcon({ kind, size = 28 }: { kind: IconKind; size?: number }) {
  const s = size;
  switch (kind) {
    case "key":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <circle cx="11" cy="16" r="6" stroke="currentColor" strokeWidth="1.8" />
          <path d="M17 16 L26 16 M22 16 L22 20 M26 16 L26 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case "document":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M9 5 L20 5 L23 8 L23 27 L9 27 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M20 5 L20 8 L23 8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M13 14 L19 14 M13 18 L19 18 M13 22 L17 22" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "envelope":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <rect x="5" y="9" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M5 11 L16 19 L27 11" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      );
    case "handshake":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M4 15 L10 11 L15 15 L20 12 L26 15 L26 19 L20 22 L15 19 L10 22 L4 19 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1" />
          <path d="M15 15 L15 19" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
    case "house":
      return (
        <svg width={s} height={s} viewBox="0 0 32 32" fill="none">
          <path d="M6 15 L16 6 L26 15 L26 26 L6 26 Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <rect x="13" y="18" width="6" height="8" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
  }
}

import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const W = 1200;
const H = 628;

// The real brand icon (coral C mark). next/og fetches the asset by absolute URL
// (edge-safe — no file reads); the src is built from the request origin in GET.
function BrandMark({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={32} height={32} alt="" style={{ display: "block" }} />;
}

const DARK_BACKGROUNDS = [
  // Dark navy — matches marketing site primary (dark navy + coral)
  { bg: "#0a0e1a", glow: "radial-gradient(ellipse 60% 50% at 15% 80%, rgba(255,107,74,0.22) 0%, transparent 70%)" },
  // Deeper navy-blue
  { bg: "#0d1117", glow: "radial-gradient(ellipse 50% 40% at 85% 20%, rgba(255,138,101,0.15) 0%, transparent 65%)" },
  // Rich navy with subtle coral warmth
  { bg: "#0a0f1e", glow: "radial-gradient(ellipse 70% 60% at 50% 100%, rgba(255,107,74,0.12) 0%, transparent 60%)" },
];

const LIGHT_BACKGROUNDS = [
  // Warm cream
  { bg: "#FFFBF5", accent: "#FF6B4A" },
  // Slightly warmer
  { bg: "#FFF5EC", accent: "#FF6B4A" },
  // Very light coral tint
  { bg: "#FFF8F5", accent: "#E55B3D" },
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text") ?? "The silence ends at offer accepted.";
  const variant = searchParams.get("variant") ?? "dark";
  const logoStyle = searchParams.get("logo") ?? "icon-text"; // "icon-text" | "text-only" | "icon-only"
  const logoUrl = new URL("/brand-icon.png", req.url).toString();
  // Rotate through backgrounds for variety
  const bgIndex = Math.abs(text.length) % 3;

  const isDark = variant !== "light";

  const darkBg = DARK_BACKGROUNDS[bgIndex];
  const lightBg = LIGHT_BACKGROUNDS[bgIndex];

  const bg = isDark ? darkBg.bg : lightBg.bg;
  const textColor = isDark ? "#f5f5f5" : "#2D1810";
  const mutedColor = isDark ? "rgba(255,255,255,0.35)" : "rgba(45,24,16,0.45)";
  const accentColor = "#FF6B4A";

  // Truncate text for display
  const displayText = text.length > 180 ? text.slice(0, 177) + "…" : text;

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: bg,
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Background glow for dark variants */}
        {isDark && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: darkBg.glow,
            }}
          />
        )}

        {/* Decorative rule top-left */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 4,
            height: "100%",
            background: `linear-gradient(180deg, ${accentColor} 0%, transparent 100%)`,
            opacity: isDark ? 0.6 : 0.4,
          }}
        />

        {/* Main text */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", position: "relative" }}>
          <p
            style={{
              fontSize: displayText.length > 100 ? 42 : displayText.length > 60 ? 52 : 64,
              fontWeight: 600,
              color: textColor,
              lineHeight: 1.25,
              letterSpacing: "-0.02em",
              maxWidth: 900,
              margin: 0,
            }}
          >
            {displayText}
          </p>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {(logoStyle === "icon-text" || logoStyle === "icon-only") && (
              <BrandMark src={logoUrl} />
            )}
            {(logoStyle === "icon-text" || logoStyle === "text-only") && (
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: isDark ? "rgba(255,255,255,0.7)" : accentColor,
                  letterSpacing: "-0.01em",
                }}
              >
                Sales Progressor
              </span>
            )}
          </div>

          {/* Tagline */}
          <span style={{ fontSize: 14, color: mutedColor, letterSpacing: "0.02em" }}>
            portal.thesalesprogressor.co.uk
          </span>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
}

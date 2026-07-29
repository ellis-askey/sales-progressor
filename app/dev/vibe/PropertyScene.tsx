"use client";

// PropertyScene — an abstract SVG scene of a house / neighbourhood.
// Six palettes so each property in a hub grid feels visually distinct
// without needing real photos. Each scene: layered sky, distant trees,
// house silhouette, windows glowing warm, light source. Feels like a
// stylised photo without pretending to be one.

export type ScenePalette =
  | "golden"    // dawn / dusk warm oranges
  | "spring"    // soft greens + cream cottage
  | "dusk"      // deep purple sky, warm windows
  | "autumn"    // rich orange sky, brown ground
  | "mist"      // grey-blue morning fog
  | "dawn";     // soft pink sunrise

type PalettePreset = {
  skyA: string;
  skyB: string;
  ground: string;
  distant: string;
  house: string;
  roof: string;
  window: string;
  windowGlow: string;
  door: string;
  light: string;
  lightGlow: string;
  showLight: "sun" | "moon";
};

const PALETTES: Record<ScenePalette, PalettePreset> = {
  golden: {
    skyA: "#F5A65B", skyB: "#D46B3B",
    ground: "#3B1F14",
    distant: "#4A2618",
    house: "#1C0F0A",
    roof: "#0F0603",
    window: "#FFC777",
    windowGlow: "rgba(255,199,119,0.55)",
    door: "#0C0503",
    light: "#FFD98A",
    lightGlow: "rgba(255,217,138,0.65)",
    showLight: "sun",
  },
  spring: {
    skyA: "#DDEDF5", skyB: "#A2C7D9",
    ground: "#7BAA6A",
    distant: "#5D8B4E",
    house: "#F5EBD4",
    roof: "#8B5A3B",
    window: "#F0DDA8",
    windowGlow: "rgba(240,221,168,0.6)",
    door: "#5A3822",
    light: "#FFF6C7",
    lightGlow: "rgba(255,246,199,0.45)",
    showLight: "sun",
  },
  dusk: {
    skyA: "#2D1B4E", skyB: "#5E2C74",
    ground: "#1A0F2E",
    distant: "#241640",
    house: "#0E0817",
    roof: "#050208",
    window: "#FFB86A",
    windowGlow: "rgba(255,184,106,0.7)",
    door: "#030106",
    light: "#E4C1FF",
    lightGlow: "rgba(228,193,255,0.5)",
    showLight: "moon",
  },
  autumn: {
    skyA: "#E88B4E", skyB: "#A64C2A",
    ground: "#4A2A18",
    distant: "#6B3D26",
    house: "#2C1810",
    roof: "#1A0D07",
    window: "#FFCF8A",
    windowGlow: "rgba(255,207,138,0.6)",
    door: "#150806",
    light: "#F5A050",
    lightGlow: "rgba(245,160,80,0.55)",
    showLight: "sun",
  },
  mist: {
    skyA: "#C4CFDA", skyB: "#95A4B4",
    ground: "#8AA598",
    distant: "#6D8880",
    house: "#4E5D6C",
    roof: "#2E3944",
    window: "#F5EED2",
    windowGlow: "rgba(245,238,210,0.5)",
    door: "#1F272F",
    light: "#F5F1E4",
    lightGlow: "rgba(245,241,228,0.4)",
    showLight: "sun",
  },
  dawn: {
    skyA: "#F5C9D2", skyB: "#E88CA4",
    ground: "#7AA88F",
    distant: "#5D8873",
    house: "#F0E6D8",
    roof: "#B85A6F",
    window: "#FFE7A8",
    windowGlow: "rgba(255,231,168,0.6)",
    door: "#6B2D3E",
    light: "#FFF0D4",
    lightGlow: "rgba(255,240,212,0.55)",
    showLight: "sun",
  },
};

export function PropertyScene({
  palette = "golden",
  className,
  style,
  seed = 0,
}: {
  palette?: ScenePalette;
  className?: string;
  style?: React.CSSProperties;
  seed?: number;
}) {
  const p = PALETTES[palette];
  // seed lets us subtly vary tree positions etc so cards don't look identical
  const treeOffset = (seed % 3) * 14;
  const gradId = `sky-${palette}`;
  const glowId = `glow-${palette}`;
  const groundGradId = `ground-${palette}`;

  return (
    <svg
      viewBox="0 0 320 220"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.skyA} />
          <stop offset="100%" stopColor={p.skyB} />
        </linearGradient>
        <linearGradient id={groundGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.distant} />
          <stop offset="100%" stopColor={p.ground} />
        </linearGradient>
        <radialGradient id={glowId} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor={p.lightGlow} />
          <stop offset="100%" stopColor={p.lightGlow.replace(/[\d.]+\)$/, "0)")} />
        </radialGradient>
      </defs>

      {/* Sky */}
      <rect x="0" y="0" width="320" height="220" fill={`url(#${gradId})`} />

      {/* Light source (sun / moon) glow */}
      <circle cx={240 + (seed % 2 === 0 ? 0 : -20)} cy="50" r="60" fill={`url(#${glowId})`} opacity="0.9" />
      <circle cx={240 + (seed % 2 === 0 ? 0 : -20)} cy="50" r="16" fill={p.light} opacity={p.showLight === "moon" ? 0.85 : 1} />
      {p.showLight === "moon" && (
        <circle cx={244 + (seed % 2 === 0 ? 0 : -20)} cy="46" r="14" fill={p.skyB} opacity="0.8" />
      )}

      {/* Distant hills */}
      <path
        d={`M0,155 Q60,${135 + treeOffset} 130,148 T260,140 T320,150 L320,220 L0,220 Z`}
        fill={p.distant}
        opacity="0.85"
      />

      {/* Ground */}
      <rect x="0" y="170" width="320" height="50" fill={`url(#${groundGradId})`} />

      {/* Distant trees (small silhouettes) */}
      <g fill={p.distant} opacity="0.9">
        <ellipse cx={40 + treeOffset} cy="160" rx="18" ry="14" />
        <ellipse cx={70 + treeOffset} cy="162" rx="14" ry="11" />
        <ellipse cx={280 - treeOffset} cy="158" rx="16" ry="12" />
      </g>

      {/* House body */}
      <g>
        {/* House rectangle */}
        <rect x="105" y="120" width="110" height="70" fill={p.house} />
        {/* Roof */}
        <polygon points="100,120 160,80 220,120" fill={p.roof} />
        {/* Chimney */}
        <rect x="185" y="88" width="12" height="24" fill={p.roof} />

        {/* Door */}
        <rect x="150" y="150" width="20" height="40" fill={p.door} />
        <circle cx="167" cy="171" r="1.2" fill={p.window} />

        {/* Windows — left */}
        <rect x="118" y="135" width="20" height="18" fill={p.window} opacity="0.95" />
        <line x1="128" y1="135" x2="128" y2="153" stroke={p.house} strokeWidth="1" />
        <line x1="118" y1="144" x2="138" y2="144" stroke={p.house} strokeWidth="1" />
        {/* Windows — right */}
        <rect x="182" y="135" width="20" height="18" fill={p.window} opacity="0.95" />
        <line x1="192" y1="135" x2="192" y2="153" stroke={p.house} strokeWidth="1" />
        <line x1="182" y1="144" x2="202" y2="144" stroke={p.house} strokeWidth="1" />

        {/* Warm window glow */}
        <rect x="115" y="132" width="26" height="24" fill={p.windowGlow} opacity="0.45" filter="blur(4px)" />
        <rect x="179" y="132" width="26" height="24" fill={p.windowGlow} opacity="0.45" filter="blur(4px)" />
      </g>

      {/* Foreground tree */}
      <g>
        <rect x={57 - treeOffset / 2} y="150" width="4" height="30" fill={p.roof} />
        <ellipse cx={59 - treeOffset / 2} cy="150" rx="18" ry="22" fill={p.distant} />
      </g>

      {/* Bottom fade so overlay text stays readable */}
      <rect x="0" y="140" width="320" height="80" fill="url(#bottomFade)" opacity="0.6" />
      <defs>
        <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

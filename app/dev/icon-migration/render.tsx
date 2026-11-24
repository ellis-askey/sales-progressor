"use client";

// Renders the CURRENT icon (its real Phosphor/Lucide component) and the PROPOSED
// Solar Bold Duotone icon (genuine baked SVG), at the same size and colour so the
// before/after is faithful. Solar duotone is currentColor-driven: it inherits the
// occurrence's colour and renders the proper two-tone character — no backgrounds,
// tiles or gradients are ever added.

import * as React from "react";
import { PH, LU } from "./data/currentGlyphs.generated";
import { SOLAR_BODIES } from "./data/solar.generated";

// Resolve a parsed colour hint to a usable CSS colour. Tailwind text-* classes map
// to their palette value; hex / CSS vars pass through; everything else inherits.
const TW: Record<string, string> = {
  "gray-300": "#d1d5db", "gray-400": "#9ca3af", "gray-500": "#6b7280", "gray-600": "#4b5563", "gray-700": "#374151", "gray-800": "#1f2937", "gray-900": "#111827",
  "slate-400": "#94a3b8", "slate-500": "#64748b", "slate-600": "#475569", "slate-700": "#334155",
  "red-500": "#ef4444", "red-600": "#dc2626", "rose-500": "#f43f5e",
  "emerald-500": "#10b981", "emerald-600": "#059669", "green-500": "#22c55e", "green-600": "#16a34a",
  "amber-500": "#f59e0b", "amber-600": "#d97706", "yellow-500": "#eab308",
  "blue-500": "#3b82f6", "blue-600": "#2563eb", "indigo-500": "#6366f1",
  "white": "#ffffff", "black": "#000000",
};
export function resolveColor(hint: string | null | undefined): string | undefined {
  if (!hint) return undefined;
  if (/^#|^rgb|^hsl|^var\(/.test(hint)) return hint;
  const arb = hint.match(/text-\[(#[0-9a-fA-F]{3,8}|var\([^)]+\))\]/);
  if (arb) return arb[1];
  const tw = hint.match(/text-([a-z]+-\d{3}|white|black)/);
  if (tw && TW[tw[1]]) return TW[tw[1]];
  return undefined;
}

export function CurrentIcon({ lib, name, size, color, weight }: { lib: "phosphor" | "lucide"; name: string; size: number; color?: string; weight?: string | null }) {
  if (lib === "phosphor") {
    const C = PH[name];
    if (!C) return <Missing size={size} />;
    return <C size={size} weight={(weight as never) || "regular"} color={color || "currentColor"} />;
  }
  const C = LU[name];
  if (!C) return <Missing size={size} />;
  return <C size={size} color={color || "currentColor"} />;
}

export function SolarIcon({ solar, size, color }: { solar: string | null; size: number; color?: string }) {
  if (!solar) return <KeepTag size={size} />;
  const b = SOLAR_BODIES[solar];
  if (!b) return <Missing size={size} />;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${b.w} ${b.h}`}
      style={{ display: "block", color: color || "currentColor", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: b.body }}
    />
  );
}

function Missing({ size }: { size: number }) {
  return <span style={{ display: "inline-flex", width: size, height: size, alignItems: "center", justifyContent: "center", color: "#cbd5e1", fontSize: size * 0.7 }}>·</span>;
}
function KeepTag({ size }: { size: number }) {
  return <span title="keep existing" style={{ display: "inline-flex", width: size, height: size, alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: Math.max(8, size * 0.42), fontWeight: 700 }}>keep</span>;
}

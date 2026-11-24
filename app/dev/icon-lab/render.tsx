"use client";

// Renders REAL icon artwork — the genuine SVG body from each collection, drawn
// directly with NO container, tile, gradient or shadow. Mono families inherit the
// surrounding text colour (so they tint); colour families keep their own fills.
// The "current" baseline is our live Phosphor icon, for honest comparison.

import * as React from "react";
import { PH } from "./data/glyphMap.generated";
import { REAL_BODIES, REAL_FAMILIES } from "./data/realIcons.generated";
import { SEMANTIC } from "./data/semantic";

const PALETTE: Record<string, "mono" | "color"> = Object.fromEntries(
  REAL_FAMILIES.map((f) => [f.id, f.palette]),
);

function phosphorName(key: string): string | undefined {
  return SEMANTIC.find((s) => s.key === key)?.phosphor;
}

// Draw a raw SVG body. Mono → currentColor (inherits ink). Colour → as authored.
function RawSvg({ body, w, h, size }: { body: string; w: number; h: number; size: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${w} ${h}`}
      style={{ display: "block", flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

// Returns the rendered icon, or null when a family has no equivalent for a meaning.
export function renderFamilyIcon(familyId: string, key: string, size: number): React.ReactNode {
  if (familyId === "current") {
    const name = phosphorName(key);
    const C = name ? PH[name] : undefined;
    return C ? <C size={size} weight="regular" /> : null;
  }
  const body = REAL_BODIES[familyId]?.[key];
  if (!body) return null;
  const mono = PALETTE[familyId] !== "color";
  // For mono sets we wrap so the icon inherits the ink colour of its context.
  const node = <RawSvg body={body.body} w={body.w} h={body.h} size={size} />;
  return mono ? <span style={{ color: "inherit", display: "inline-flex" }}>{node}</span> : node;
}

export function familyPalette(familyId: string): "mono" | "color" {
  return familyId === "current" ? "mono" : PALETTE[familyId] ?? "mono";
}

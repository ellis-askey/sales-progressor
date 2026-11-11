"use client";
// Slab-optics refraction map for TSP Liquid Glass (EXPERIMENTAL lens material).
//
// Adapted from Glassy UI's `registry/glassyui/lib/refraction-map.ts` and
// `lib/slab-optics.ts` (https://github.com/alexburlis/glassyui), MIT License,
// Copyright (c) 2026 Glassy UI contributors. The rounded-rect SDF, the
// edge-band / (1-t)^2 inward-rim-pull model, the neutral-centre ratio and the
// R/G = 0.5 + 0.5*offset channel packing are reused under the MIT terms and
// trimmed for our engine. Keep this attribution if you copy it.
//
// Why this exists: our original map was a LINEAR gradient (shift/tilt, no
// magnification) which, under a strong 3-pass chromatic displacement, split a
// bright line into streaks. This instead models a glass SLAB: a crisp neutral
// centre with the bend concentrated in a thin rim band that pulls INWARD, so the
// backdrop is cleanly magnified at the edge. One displacement pass, no streaks.
//
// MIT permission notice (from the Glassy UI LICENSE):
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software... The above copyright notice and this permission notice
//   shall be included in all copies or substantial portions of the Software.

export type RefractionStrength = "soft" | "strong";

type Preset = { centerNeutralRatio: number; defaultDisplacement: number; edgeBandRatio: number; edgeWidth: number; rimPull: number };
const PRESETS: Record<RefractionStrength, Preset> = {
  soft: { centerNeutralRatio: 0.68, defaultDisplacement: 72, edgeBandRatio: 0.18, edgeWidth: 1.08, rimPull: 0.22 },
  strong: { centerNeutralRatio: 0.58, defaultDisplacement: 112, edgeBandRatio: 0.2, edgeWidth: 1.22, rimPull: 0.34 },
};
const MAX_RIM_PULL = 0.34;
const MAX_CHROMATIC_RIM_PULL = 0.4;
const RIM_BLUR = 0.8;
const MAX_MAP_PIXELS = 160000;

export function clamp(v: number, min: number, max: number) { return Math.min(max, Math.max(min, v)); }
function smoothstep(e0: number, e1: number, v: number) { const t = clamp((v - e0) / Math.max(e1 - e0, 0.0001), 0, 1); return t * t * (3 - 2 * t); }

type Edge = { distance: number; normalX: number; normalY: number };
// Signed distance to a rounded rectangle + its outward unit normal. (Glassy UI, MIT)
function roundedRectEdge(x: number, y: number, width: number, height: number, radius: number, edge: Edge) {
  const px = x - width / 2, py = y - height / 2;
  const qx = Math.abs(px) - (width / 2 - radius), qy = Math.abs(py) - (height / 2 - radius);
  const signX = px < 0 ? -1 : 1, signY = py < 0 ? -1 : 1;
  if (qx > 0 && qy > 0) { const len = Math.hypot(qx, qy) || 1; edge.distance = len - radius; edge.normalX = (signX * qx) / len; edge.normalY = (signY * qy) / len; }
  else if (qx > qy) { edge.distance = qx - radius; edge.normalX = signX; edge.normalY = 0; }
  else { edge.distance = qy - radius; edge.normalX = 0; edge.normalY = signY; }
  return edge;
}

export type LensMetrics = {
  cacheKey: string; edgeBand: number; fieldRadius: number; filterPadding: number;
  filterScale: number; mapWidth: number; mapHeight: number; paddedWidth: number; paddedHeight: number;
  width: number; height: number; rimBlur: number;
};

export function computeLensMetrics(opts: { width: number; height: number; radius: number; strength: RefractionStrength; thickness?: number; displacement?: number; dpr?: number }): LensMetrics {
  const preset = PRESETS[opts.strength];
  const width = Math.max(0, opts.width), height = Math.max(0, opts.height);
  const minDim = Math.min(width, height);
  const radius = clamp(opts.radius, 0, minDim / 2);
  const displacement = clamp(opts.displacement ?? preset.defaultDisplacement, 0, 196);
  const thickness = clamp(opts.thickness ?? 1, 0.1, 4);
  const rimWidth = 0.6 + 0.4 * thickness;
  const dispersion = clamp((thickness - 1) * 0.2, 0, 0.6);
  const blueFactor = 1 + dispersion / 2;
  const neutralInset = (minDim * (1 - preset.centerNeutralRatio)) / 2;
  const edgeBand = clamp(Math.min(minDim * preset.edgeBandRatio, neutralInset) * preset.edgeWidth * rimWidth, 6, Math.min(72 * rimWidth, (radius || 56) * 1.15 * rimWidth, minDim * 0.48));
  const fieldRadius = clamp(Math.max(radius, edgeBand), 0, minDim / 2);
  const pull = edgeBand * Math.min(MAX_RIM_PULL, MAX_CHROMATIC_RIM_PULL / blueFactor, (preset.rimPull * displacement) / preset.defaultDisplacement);
  const filterPadding = Math.ceil(pull * blueFactor + RIM_BLUR * 3) + 2;
  const paddedWidth = width + filterPadding * 2, paddedHeight = height + filterPadding * 2;
  const targetRatio = clamp((opts.dpr ?? 1) * 1.12, 1.15, 2.1);
  let mapWidth = clamp(Math.round(paddedWidth * targetRatio), 32, 1800);
  let mapHeight = clamp(Math.round(paddedHeight * targetRatio), 32, 1200);
  if (mapWidth * mapHeight > MAX_MAP_PIXELS) { const r = Math.sqrt(MAX_MAP_PIXELS / (mapWidth * mapHeight)); mapWidth = Math.max(32, Math.floor(mapWidth * r)); mapHeight = Math.max(32, Math.floor(mapHeight * r)); }
  const cacheKey = [mapWidth, mapHeight, Math.round(width), Math.round(height), Math.round(fieldRadius * 10), Math.round(edgeBand * 10), filterPadding].join(":");
  return { cacheKey, edgeBand, fieldRadius, filterPadding, filterScale: Math.round(pull * 2 * 100) / 100, mapWidth, mapHeight, paddedWidth, paddedHeight, width, height, rimBlur: RIM_BLUR };
}

const cache = new Map<string, string>();
const MAX_CACHE = 48;

// Builds the displacement map data URL. R/G = 0.5 + 0.5*inward offset (neutral
// 128 centre → crisp), B = rim-blur mask. (Glassy UI pixel loop, MIT.)
export function buildLensMap(m: LensMetrics): string {
  const hit = cache.get(m.cacheKey);
  if (hit) return hit;
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = m.mapWidth; canvas.height = m.mapHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const data = new Uint8ClampedArray(m.mapWidth * m.mapHeight * 4);
  const edge: Edge = { distance: 0, normalX: 0, normalY: 0 };
  for (let yi = 0; yi < m.mapHeight; yi += 1) {
    const y = ((yi + 0.5) / m.mapHeight) * m.paddedHeight - m.filterPadding;
    for (let xi = 0; xi < m.mapWidth; xi += 1) {
      const x = ((xi + 0.5) / m.mapWidth) * m.paddedWidth - m.filterPadding;
      const i = (yi * m.mapWidth + xi) * 4;
      roundedRectEdge(x, y, m.width, m.height, m.fieldRadius, edge);
      const depth = clamp(-edge.distance / m.edgeBand, 0, 1);
      const falloff = (1 - depth) ** 2;
      data[i] = Math.round((0.5 + (-edge.normalX * falloff) / 2) * 255);
      data[i + 1] = Math.round((0.5 + (-edge.normalY * falloff) / 2) * 255);
      data[i + 2] = Math.round((1 - smoothstep(0.5, 1, depth)) * 255);
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(new ImageData(data, m.mapWidth, m.mapHeight), 0, 0);
  const href = canvas.toDataURL("image/png");
  cache.set(m.cacheKey, href);
  if (cache.size > MAX_CACHE) { const k = cache.keys().next().value; if (k) cache.delete(k); }
  return href;
}

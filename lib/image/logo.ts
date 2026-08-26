// Agency logo normalisation + background-colour detection.
//
// Agents upload logos in every shape: transparent PNGs, solid-colour blocks,
// wide wordmarks, square monograms, artwork that bleeds to the edge. This
// prepares any of them for a client email:
//   1. trim the dead margin so the artwork fills the frame,
//   2. cap the size (emails don't need a 5MP logo),
//   3. convert to PNG (email clients render webp inconsistently),
//   4. detect the tile colour to sit it on.
//
// Detector rule (proven across the real Meldone / eXp / Akeman / VIA / ERS
// logos, 2026-08-26):
//   - >35% of the logo is transparent  -> it's a "transparent" logo, so pick a
//     tile that contrasts the artwork (light art -> dark tile, dark art -> light).
//   - otherwise it's opaque, and the tile is its DOMINANT colour (by colour
//     frequency) — which is the background even when the artwork touches the edge.

import sharp from "sharp";

export type LogoScale = "sm" | "md" | "lg";
export type LogoAlign = "left" | "center";

export interface NormalisedLogo {
  png: Buffer;
  tileColor: string; // hex, e.g. "#0f766e"
  width: number;
  height: number;
}

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

const DARK_TILE = "#12233b"; // for light/white artwork on transparent
const LIGHT_TILE = "#ffffff"; // for dark artwork on transparent

// Read the tile colour from the ORIGINAL image (clean colour margins intact).
export async function detectTileColor(input: Buffer): Promise<string> {
  const { data, info } = await sharp(input)
    .resize({ width: 320, height: 320, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;

  let transparent = 0;
  let total = 0;
  let lumSum = 0;
  let aSum = 0;
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += ch) {
    total++;
    const a = data[i + 3] / 255;
    if (a < 0.2) {
      transparent++;
      continue;
    }
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    lumSum += (0.2126 * r + 0.7152 * g + 0.0722 * b) * a;
    aSum += a;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4); // 16-level buckets
    const e = buckets.get(key);
    if (e) {
      e.n++;
      e.r += r;
      e.g += g;
      e.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }

  const transpFrac = total ? transparent / total : 1;

  // Genuinely transparent logo: contrast the artwork.
  if (transpFrac > 0.35) {
    const avg = aSum ? lumSum / aSum : 0;
    return avg > 150 ? DARK_TILE : LIGHT_TILE;
  }

  // Opaque logo: dominant colour is the background.
  let best = { n: 0, r: 255, g: 255, b: 255 };
  for (const e of buckets.values()) if (e.n > best.n) best = e;
  return toHex(best.r / best.n, best.g / best.n, best.b / best.n);
}

// Trim + cap + PNG, and detect the tile colour from the original.
export async function normaliseLogo(input: Buffer): Promise<NormalisedLogo> {
  const tileColor = await detectTileColor(input);

  let trimmed = input;
  try {
    trimmed = await sharp(input).trim({ threshold: 12 }).toBuffer();
  } catch {
    // A single-colour image can't be trimmed — keep the original.
    trimmed = input;
  }

  const out = await sharp(trimmed)
    .resize({ height: 240, width: 900, fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
  const meta = await sharp(out).metadata();

  return { png: out, tileColor, width: meta.width ?? 0, height: meta.height ?? 0 };
}

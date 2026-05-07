// scripts/help-screenshots/polish.ts
//
// Sharp-based image processor. Takes a raw PNG from Playwright and produces
// a polished version: crop, resize, border, shadow, rounded corners.

import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

export interface PolishOptions {
  /** Output width in px. Sharp preserves aspect ratio. Default: 1200. */
  width?: number;
  /** Optional crop: { left, top, width, height } in px relative to the raw capture. */
  crop?: { left: number; top: number; width: number; height: number };
}

/**
 * Polish a single raw screenshot.
 *
 * @param rawPath  Absolute path to the raw PNG.
 * @param outPath  Absolute path for the polished PNG.
 * @param opts     Optional polish options.
 */
export async function polish(
  rawPath: string,
  outPath: string,
  opts: PolishOptions = {}
): Promise<void> {
  const { width = 1200, crop } = opts;

  if (!fs.existsSync(rawPath)) {
    throw new Error(`Raw screenshot not found: ${rawPath}`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  let img = sharp(rawPath);
  if (crop) img = img.extract(crop);

  const meta = await img.metadata();
  const imgW = meta.width ?? width;

  // Target resize width capped to actual image width
  const targetW = Math.min(width, imgW);

  // ── Add a 1px coral border at 8% opacity as an SVG overlay ───────────────
  // Coral: rgb(255, 107, 74) → at 8% alpha ≈ 20/255

  const resized = await img.resize({ width: targetW }).png().toBuffer();
  const resizedMeta = await sharp(resized).metadata();
  const rW = resizedMeta.width ?? targetW;
  const rH = resizedMeta.height ?? 600;

  // Compose: shadow (blur a dark rectangle), then rounded clip, then border overlay
  const cornerR = 4;
  const borderColor = "rgba(255,107,74,0.06)";

  // SVG mask for rounded corners
  const mask = Buffer.from(
    `<svg width="${rW}" height="${rH}">
      <rect x="0" y="0" width="${rW}" height="${rH}" rx="${cornerR}" ry="${cornerR}" fill="white"/>
    </svg>`
  );

  // SVG border overlay
  const borderOverlay = Buffer.from(
    `<svg width="${rW}" height="${rH}">
      <rect x="0.5" y="0.5" width="${rW - 1}" height="${rH - 1}"
        rx="${cornerR - 0.5}" ry="${cornerR - 0.5}"
        fill="none" stroke="${borderColor}" stroke-width="1"/>
    </svg>`
  );

  // Drop shadow: add padding around the image so the shadow isn't clipped.
  // We extend the canvas 20px on each side for the shadow, then composite.
  const pad = 20;
  const totalW = rW + pad * 2;
  const totalH = rH + pad * 2;

  const shadowSvg = Buffer.from(
    `<svg width="${totalW}" height="${totalH}">
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="rgba(0,0,0,0.06)"/>
        </filter>
      </defs>
      <rect x="${pad}" y="${pad}" width="${rW}" height="${rH}"
        rx="${cornerR}" ry="${cornerR}" fill="white" filter="url(#s)"/>
    </svg>`
  );

  const shadow = await sharp({
    create: { width: totalW, height: totalH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: shadowSvg, top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Apply rounded corners mask to the screenshot
  const clipped = await sharp(resized)
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  // Add border overlay
  const withBorder = await sharp(clipped)
    .composite([{ input: borderOverlay, blend: "over", top: 0, left: 0 }])
    .png()
    .toBuffer();

  // Combine: shadow canvas + clipped screenshot on top
  await sharp(shadow)
    .composite([{ input: withBorder, top: pad, left: pad }])
    .png()
    .toFile(outPath);
}

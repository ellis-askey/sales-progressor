// The agency logo band shown at the top of client emails (Option B: the logo's
// colour fills a full-width band, edge to edge, above the coral milestone hero).
//
// This is the SINGLE source of truth for the band's measurements so the live
// preview in the branding studio (Account > Profile) can render an identical
// header and never drift from what actually sends. Pure constants + a string
// builder — safe to import from both server (email) and client (preview).

import type { LogoScale, LogoAlign } from "@/lib/image/logo";

// Logo height per size choice, and the vertical padding of the band around it.
export const LOGO_HEIGHTS: Record<LogoScale, number> = { sm: 30, md: 42, lg: 56 };
export const LOGO_BAND_PADDING_Y: Record<LogoScale, number> = { sm: 18, md: 22, lg: 26 };
export const LOGO_BAND_PADDING_X = 32;
export const LOGO_MAX_WIDTH = 260;

export interface LogoHeader {
  logoUrl?: string | null;
  tileColor?: string | null;
  scale?: LogoScale | null;
  align?: LogoAlign | null;
}

function resolve(h: LogoHeader) {
  const scale: LogoScale = h.scale === "sm" || h.scale === "lg" ? h.scale : "md";
  const align: LogoAlign = h.align === "center" ? "center" : "left";
  return {
    height: LOGO_HEIGHTS[scale],
    padY: LOGO_BAND_PADDING_Y[scale],
    padX: LOGO_BAND_PADDING_X,
    bg: h.tileColor && /^#[0-9a-fA-F]{6}$/.test(h.tileColor) ? h.tileColor : "#ffffff",
    align,
  };
}

// Email markup for the band. Returns "" when there's no logo, so the header
// falls back to the plain coral-top design.
export function agencyLogoHeaderHtml(h: LogoHeader): string {
  if (!h.logoUrl) return "";
  const { height, padY, padX, bg, align } = resolve(h);
  const display = align === "center" ? "inline-block" : "block";
  return (
    `<div style="background:${bg};padding:${padY}px ${padX}px;text-align:${align === "center" ? "center" : "left"}">` +
    `<img src="${h.logoUrl}" alt="" height="${height}" style="height:${height}px;max-width:${LOGO_MAX_WIDTH}px;display:${display};object-fit:contain" />` +
    `</div>`
  );
}

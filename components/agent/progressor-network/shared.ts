// Small shared helpers for the Progressor Network cards + profile drawer.

import {
  MapPin, Key, House, LinkSimple, Sparkle, Star, UsersThree, Tag,
  type Icon,
} from "@phosphor-icons/react";

/**
 * Leading glyph for a coverage/specialism chip. Coverage gets a pin; each
 * specialism gets a themed glyph; anything unmapped falls back to a tag glyph so
 * a new specialism never renders blank.
 */
export function tagIcon(tag: string): Icon {
  const t = tag.toLowerCase();
  if (t.includes("nationwide") || t.includes("uk-wide") || t.includes("wide")) return MapPin;
  if (t.includes("leasehold")) return Key;
  if (t.includes("new-build") || t.includes("new build")) return House;
  if (t.includes("chain")) return LinkSimple;
  if (t.includes("high-value") || t.includes("high value")) return Sparkle;
  if (t.includes("first-time") || t.includes("first time")) return Star;
  if (t.includes("shared")) return UsersThree;
  return Tag;
}

/** A readable text colour (dark or white) for an arbitrary brand-tile colour. */
export function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return "#ffffff";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "rgba(15,23,42,0.88)" : "#ffffff";
}

/** "~12 wks", or an en-dash when a business has no track record yet. */
export function formatAvgExchange(weeks: number | null): string {
  return weeks == null ? "–" : `~${weeks} wks`;
}

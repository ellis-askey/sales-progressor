// Thin wrapper kept so existing call-sites stay stable: renders the GENUINE
// Boardwalk wordmark (BoardwalkLogo, extracted from their site's SVG) instead
// of the old typographic stand-in. Colour follows CSS `color`.
import { BoardwalkLogo } from "./BoardwalkLogo";

export function BoardwalkWordmark({ size = 22 }: { size?: number }) {
  return <BoardwalkLogo height={size} style={{ color: "var(--bw-ink, #404648)" }} />;
}

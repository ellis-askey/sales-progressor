import { type CSSProperties } from "react";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

// Inline arrow for agent-app "→" links. Replaces the literal "→" glyph (and
// static <ArrowRight> icons) so the arrow can NUDGE on hover (.agent-arrow-i,
// see agent-system.css) — and, when it sits inside an .agent-link, the CSS
// drops that link's spreading underline so the two affordances don't double
// up. Agent/internal surfaces only.
//
// Trailing by default (arrow after the label). Pass `leading` for the handful
// of "→ label" cases. `size` + `style` cover row end-cap indicators that need
// a larger, muted arrow rather than the default inline link caret.
export function LinkArrow({
  leading = false,
  size = 12,
  style,
}: {
  leading?: boolean;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <CaretRight
      size={size}
      weight="bold"
      aria-hidden
      className="agent-arrow-i"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginLeft: leading ? 0 : 3,
        marginRight: leading ? 3 : 0,
        ...style,
      }}
    />
  );
}

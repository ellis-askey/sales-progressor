import { CaretRight } from "@phosphor-icons/react/dist/ssr";

// Inline arrow for agent-app "→" links. Replaces the literal "→" glyph so the
// arrow can NUDGE on hover (.agent-arrow-i, see agent-system.css) — and, when
// it sits inside an .agent-link, the CSS drops that link's spreading underline
// so the two affordances don't double up. Agent/internal surfaces only.
//
// Trailing by default (arrow after the label). Pass `leading` for the handful
// of "→ label" cases (arrow before the label).
export function LinkArrow({ leading = false }: { leading?: boolean }) {
  return (
    <CaretRight
      size={12}
      weight="bold"
      aria-hidden
      className="agent-arrow-i"
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        marginLeft: leading ? 0 : 3,
        marginRight: leading ? 3 : 0,
      }}
    />
  );
}

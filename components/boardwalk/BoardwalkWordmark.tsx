// Boardwalk wordmark — a tasteful typographic treatment (no logo asset exists
// in the repo), deliberately easy to swap for a real logo file later.
export function BoardwalkWordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="bw-display"
      style={{
        fontSize: size,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        color: "var(--bw-ink)",
        display: "inline-flex",
        alignItems: "baseline",
        gap: 7,
      }}
    >
      <span
        aria-hidden
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: "999px 999px 999px 2px",
          background: "var(--bw-green)",
          display: "inline-block",
          transform: "translateY(1px)",
        }}
      />
      Boardwalk
      <span style={{ color: "var(--bw-green)", fontWeight: 480, fontStyle: "italic" }}>Forms</span>
    </span>
  );
}

"use client";

// Small "Saving…" indicator with three pulsing dots. Used wherever a
// server roundtrip is in flight and the user has already seen the
// optimistic result. Visual feedback that something is happening
// without screaming about latency.
//
// Usage:
//   {saving && <SavingPulse />}
//   {saving && <SavingPulse label="Sending…" />}

type Props = {
  label?: string;
  /** Optional tone — primary uses brand coral, muted uses text-muted. */
  tone?: "muted" | "primary";
};

export function SavingPulse({ label = "Saving…", tone = "muted" }: Props) {
  const color = tone === "primary" ? "var(--agent-coral, #FF6B4A)" : "var(--agent-text-muted, rgba(15,23,42,0.50))";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 500,
        color,
        lineHeight: 1,
      }}
    >
      <span style={{ display: "inline-flex", gap: 2 }} aria-hidden>
        <span style={dot(color, 0)} />
        <span style={dot(color, 160)} />
        <span style={dot(color, 320)} />
      </span>
      <span>{label}</span>
      <style>{`
        @keyframes savingPulseBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </span>
  );
}

function dot(color: string, delayMs: number): React.CSSProperties {
  return {
    width: 5,
    height: 5,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    animation: `savingPulseBounce 1100ms ease-in-out ${delayMs}ms infinite`,
  };
}

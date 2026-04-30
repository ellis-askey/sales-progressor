interface DeltaPillProps {
  current: number;
  previous: number;
  periodWord: string;
}

export function DeltaPill({ current, previous, periodWord }: DeltaPillProps) {
  const diff = current - previous;

  let arrow: string;
  let label: string;
  let color: string;
  let bg: string;

  if (diff > 0) {
    arrow = "↑";
    label = `${diff} vs last ${periodWord}`;
    color = "var(--agent-success)";
    bg    = "var(--agent-success-bg)";
  } else if (diff < 0) {
    arrow = "↓";
    label = `${Math.abs(diff)} vs last ${periodWord}`;
    color = "var(--agent-warning)";
    bg    = "var(--agent-warning-bg)";
  } else {
    arrow = "·";
    label = `no change`;
    color = "var(--agent-text-muted)";
    bg    = "rgba(0,0,0,0.04)";
  }

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10, fontWeight: 600,
      padding: "2px 7px", borderRadius: 99,
      color, background: bg,
      marginTop: 4, whiteSpace: "nowrap",
    }}>
      {arrow} {label}
    </span>
  );
}

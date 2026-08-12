import { GlassCard } from "@/components/glass/GlassCard";

// Headed summary tiles replacing the old floating "N files · £X · £Y" sentence.
// Presentational + server-renderable. Accent colours the money that matters.
export function CompletionStats({ tiles }: { tiles: { label: string; value: string; accent?: boolean }[] }) {
  return (
    <GlassCard glassId="completions-stats" label="Completions · Summary" defaultVariant="v05" style={{ padding: "16px 20px", borderRadius: "var(--agent-radius-xl)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.label}>
            <p className="agent-eyebrow" style={{ margin: 0, marginBottom: 2 }}>{t.label}</p>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, color: t.accent ? "var(--agent-coral, #c2410c)" : "var(--agent-text-primary)" }}>
              {t.value}
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

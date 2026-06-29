// /dev/gallery/pill — Pill primitive showcase.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/Pill";

const TONES = ["default", "muted", "info", "success", "warning", "danger"] as const;
const SIZES = ["sm", "md"] as const;

export default function PillGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ minHeight: "100vh", padding: "48px 32px" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        <header>
          <Link href="/dev/gallery" style={{
            fontSize: 13,
            color: "var(--agent-text-muted)",
            textDecoration: "none",
          }}>
            ← All primitives
          </Link>
          <h1 style={{
            margin: "8px 0 0",
            fontSize: 32,
            fontWeight: 700,
            color: "var(--agent-text-primary)",
            letterSpacing: "var(--agent-tracking-tight)",
          }}>
            Pill
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Generic pill / chip shape with tone variants. The 4 existing bespoke pills (DeltaPill, LastContactedPill, StatPill, RoundChip) stay as domain-specific composers that wrap this primitive.
          </p>
        </header>

        <Section title="Tone × size matrix" subtitle="all 6 tones in both sizes, default (tinted) style">
          <table style={{ borderCollapse: "separate", borderSpacing: "16px 16px" }}>
            <thead>
              <tr>
                <th></th>
                {SIZES.map((size) => (
                  <th key={size} style={Label}>
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TONES.map((tone) => (
                <tr key={tone}>
                  <td style={Label}>{tone}</td>
                  {SIZES.map((size) => (
                    <td key={size}>
                      <Pill tone={tone} size={size} data-testid={`pill-${tone}-${size}`}>
                        {tone}
                      </Pill>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Outline style" subtitle="border instead of tinted background — use for low-emphasis / 'empty' states">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {TONES.map((tone) => (
              <Pill key={tone} tone={tone} outline data-testid={`pill-outline-${tone}`}>
                {tone}
              </Pill>
            ))}
          </div>
        </Section>

        <Section title="With glyph (children compose)" subtitle="icons, arrows, dots — passed as children, no slot props">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Pill tone="success" data-testid="pill-with-arrow-up">
              <span aria-hidden>↑</span> 3 vs last week
            </Pill>
            <Pill tone="warning" data-testid="pill-with-arrow-down">
              <span aria-hidden>↓</span> 2 vs last week
            </Pill>
            <Pill tone="success" data-testid="pill-with-dot">
              <span aria-hidden style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "currentColor",
              }} />
              Active
            </Pill>
            <Pill tone="muted" outline data-testid="pill-not-contacted">
              Not contacted yet
            </Pill>
          </div>
        </Section>

        <Section title="Real-world examples" subtitle="how the 4 bespoke pills would compose using Pill">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <Label2 children="DeltaPill (analytics)" />
              <Pill tone="success" size="sm">
                <span aria-hidden>↑</span> 3 vs last week
              </Pill>
            </div>
            <div>
              <Label2 children="LastContactedPill (fresh)" />
              <Pill tone="success" size="sm">
                <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
                Contacted today
              </Pill>
            </div>
            <div>
              <Label2 children="LastContactedPill (never)" />
              <Pill tone="muted" size="sm" outline>
                Not contacted yet
              </Pill>
            </div>
            <div>
              <Label2 children="StatPill (hub)" />
              <Pill tone="warning">
                3 overdue
              </Pill>
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}

const Label: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--agent-text-muted)",
};

function Label2({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--agent-text-muted)" }}>{children}</p>;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p style={{
        margin: 0,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--agent-text-muted)",
      }}>
        {title}
      </p>
      <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--agent-text-secondary)" }}>
        {subtitle}
      </p>
      {children}
    </section>
  );
}

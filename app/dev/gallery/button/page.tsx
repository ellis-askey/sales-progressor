// /dev/gallery/button — Button primitive showcase.
//
// Renders Button in every variant × every size × every state. The matrix
// is the visual regression target.
//
// Blocked in production at the page level.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

const VARIANTS: Variant[] = ["primary", "secondary", "ghost", "danger"];
const SIZES: Size[] = ["xs", "sm", "md", "lg"];

export default function ButtonGallery() {
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
            Button
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Wraps the <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>agent-btn</code> class system. Replaces 54 inline button usages. <strong>Button element only</strong>; Link-shaped buttons stay grandfathered.
          </p>
        </header>

        <Section title="Variant × size matrix" subtitle="every combination, default state">
          <table style={{ borderCollapse: "separate", borderSpacing: "16px 16px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}></th>
                {SIZES.map((size) => (
                  <th key={size} style={{ textAlign: "left", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {VARIANTS.map((variant) => (
                <tr key={variant}>
                  <td style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)", paddingRight: 12 }}>
                    {variant}
                  </td>
                  {SIZES.map((size) => (
                    <td key={size}>
                      <Button variant={variant} size={size} data-testid={`button-${variant}-${size}`}>
                        Action
                      </Button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Disabled state" subtitle="disabled HTML attribute set; pointer-events:none and reduced opacity">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} disabled data-testid={`button-${variant}-disabled`}>
                Disabled
              </Button>
            ))}
          </div>
        </Section>

        <Section title="Loading state" subtitle="spinner replaces children; button auto-disables; width preserved to avoid layout shift">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant} loading data-testid={`button-${variant}-loading`}>
                Saving sale
              </Button>
            ))}
          </div>
        </Section>

        <Section title="With icon (children)" subtitle="icons rendered as children — primitive doesn't slot them; consumers compose">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button variant="primary" data-testid="button-with-icon">
              <PlusGlyph /> New sale
            </Button>
            <Button variant="secondary" data-testid="button-with-icon-trailing">
              View file <ArrowGlyph />
            </Button>
          </div>
        </Section>

        <Section title="Focus state" subtitle="tab to focus — coral focus ring per agent-system.css">
          <Button variant="primary" data-testid="button-focusable">
            Tab to me
          </Button>
        </Section>
      </div>
    </main>
  );
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

function PlusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ArrowGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// /dev/gallery/card — Card primitive showcase.
//
// Renders Card in every variant, padding, and state. The gallery is the
// canonical "first consumer" of the primitive (proof that the API works)
// AND the visual regression target.
//
// Blocked in production at the page level.

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";

export default function CardGallery() {
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
            Card
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Glass or solid surface wrapper. Replaces 56 inline <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>{`<div className="glass-card">`}</code> usages.
          </p>
        </header>

        <Section title="Variants" subtitle="glass (default) vs solid">
          <div className="grid grid-cols-2 gap-4">
            <Card data-testid="card-glass">
              <CardContent label="variant=glass" />
            </Card>
            <Card variant="solid" data-testid="card-solid">
              <CardContent label="variant=solid" />
            </Card>
          </div>
        </Section>

        <Section title="Padding" subtitle="none / sm / md / lg">
          <div className="grid grid-cols-4 gap-4">
            <Card padding="none" data-testid="card-padding-none">
              <CardContent label="padding=none" />
            </Card>
            <Card padding="sm" data-testid="card-padding-sm">
              <CardContent label="padding=sm" />
            </Card>
            <Card padding="md" data-testid="card-padding-md">
              <CardContent label="padding=md" />
            </Card>
            <Card padding="lg" data-testid="card-padding-lg">
              <CardContent label="padding=lg" />
            </Card>
          </div>
        </Section>

        <Section
          title="Interactive"
          subtitle="cursor + hover shadow + focus-within ring (tab to focus)"
        >
          <Card interactive data-testid="card-interactive">
            <CardContent label="interactive=true" />
            <button
              type="button"
              className="mt-3 px-3 py-1 bg-slate-900 text-white rounded text-sm"
            >
              Focusable child
            </button>
          </Card>
        </Section>

        <Section title="Loading" subtitle="skeleton overlay, content stays visible">
          <Card loading data-testid="card-loading">
            <CardContent label="loading=true" />
          </Card>
        </Section>

        <Section
          title="className passthrough"
          subtitle="additional Tailwind utilities composed onto the primitive"
        >
          <Card className="mb-6 max-w-md mx-auto" data-testid="card-classname">
            <CardContent label='className="mb-6 max-w-md mx-auto"' />
          </Card>
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

function CardContent({ label }: { label: string }) {
  return (
    <div>
      <p style={{
        margin: 0,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--agent-text-primary)",
      }}>
        {label}
      </p>
      <p style={{
        margin: "4px 0 0",
        fontSize: 12,
        color: "var(--agent-text-secondary)",
        lineHeight: 1.5,
      }}>
        Card surface with sample content. The body of a real consumer would contain a heading, body text, and optional actions.
      </p>
    </div>
  );
}

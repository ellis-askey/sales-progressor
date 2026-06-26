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
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <Link href="/dev/gallery" className="text-sm text-slate-500 hover:text-slate-700">
            ← All primitives
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Card</h1>
          <p className="mt-2 text-base text-slate-600">
            Glass or solid surface wrapper. Replaces 56 inline{" "}
            <code className="text-sm bg-slate-200 px-1 rounded">
              {`<div className="glass-card">`}
            </code>{" "}
            usages.
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
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
        {title}
      </p>
      <p className="text-sm text-slate-600 mb-3">{subtitle}</p>
      {children}
    </section>
  );
}

function CardContent({ label }: { label: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-600 mt-1">
        Card surface with sample content. The body of a real consumer would
        contain a heading, body text, and optional actions.
      </p>
    </div>
  );
}

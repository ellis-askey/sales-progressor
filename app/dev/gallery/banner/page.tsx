// /dev/gallery/banner — Banner primitive showcase.
//
// Renders Banner in every kind × content shape. Captures the visual
// regression target.
//
// "use client" because Banner accepts onClick / onDismiss handler props
// (the action and dismissible slots). Server components can't pass
// function props across the boundary.
//
// Blocked in production at the page level.
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Info, Warning, XCircle, CheckCircle } from "@phosphor-icons/react";

export default function BannerGallery() {
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
            Banner
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Horizontal alert / info card. Re-exported as <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>Banner</code> from the existing <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>AgentBanner</code>. 8 of 12 banner files in the codebase already use this; new code uses Banner.
          </p>
        </header>

        <Section title="Kinds" subtitle="info / warning / danger / success — semantic meaning carried by border + icon + heading colour, never by a tinted background">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div data-testid="banner-info">
              <Banner
                kind="info"
                icon={<Info size={18} weight="fill" />}
                title="Your management pack has been requested."
                body="These typically arrive in 4 to 8 weeks. We'll let you know when it's in."
              />
            </div>
            <div data-testid="banner-warning">
              <Banner
                kind="warning"
                icon={<Warning size={18} weight="fill" />}
                title="This file is on hold."
                body="All automation is frozen: no client emails, no agent reminders. Reactivate the file to resume."
              />
            </div>
            <div data-testid="banner-danger">
              <Banner
                kind="danger"
                icon={<XCircle size={18} weight="fill" />}
                title="Payment failed."
                body="We couldn't take payment on your account. Update your card to avoid losing access."
              />
            </div>
            <div data-testid="banner-success">
              <Banner
                kind="success"
                icon={<CheckCircle size={18} weight="fill" />}
                title="Sale completed."
                body="Funds transferred, keys handed over. The file is now closed."
              />
            </div>
          </div>
        </Section>

        <Section title="With action button" subtitle="caller-supplied label + click handler — coloured to match the kind">
          <div data-testid="banner-with-action">
            <Banner
              kind="warning"
              icon={<Warning size={18} weight="fill" />}
              title="This sale fell through."
              body="When you find a new buyer, relist the sale. The new buyer's steps start fresh."
              action={{ label: "Relist sale", onClick: () => {} }}
            />
          </div>
        </Section>

        <Section title="Dismissible" subtitle="X button in the top-right; the consumer owns dismissal state">
          <div data-testid="banner-dismissible">
            <Banner
              kind="info"
              icon={<Info size={18} weight="fill" />}
              title="New feature: per-sale dashboards."
              body="Click any sale chip to see its full history."
              dismissible={{ onDismiss: () => {} }}
            />
          </div>
        </Section>

        <Section title="With action AND dismissible" subtitle="both slots can be filled simultaneously">
          <div data-testid="banner-action-dismissible">
            <Banner
              kind="warning"
              icon={<Warning size={18} weight="fill" />}
              title="Three reminders due today."
              body="Two for VM5 (property forms), one for PM8 (searches ordered)."
              action={{ label: "View all", onClick: () => {} }}
              dismissible={{ onDismiss: () => {} }}
            />
          </div>
        </Section>

        <Section title="Title only (no body)" subtitle="compact form when the title is enough">
          <div data-testid="banner-title-only">
            <Banner
              kind="success"
              icon={<CheckCircle size={18} weight="fill" />}
              title="VM19 confirmed: contracts exchanged."
            />
          </div>
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

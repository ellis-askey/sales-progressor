// /dev/gallery/accordion — Accordion primitive showcase.
//
// "use client" because Accordion uses useState for uncontrolled mode and
// useId for ARIA wiring.
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Accordion } from "@/components/ui/Accordion";

export default function AccordionGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main style={{ minHeight: "100vh", padding: "48px 32px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
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
            Accordion
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Collapsible section disclosure. Wraps the existing <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>agent-acc-*</code> CSS classes. 15 files use these classes raw today.
          </p>
        </header>

        <Section title="Uncontrolled" subtitle="defaultOpen — component manages its own state">
          <div className="glass-card overflow-hidden rounded-[12px]" data-testid="acc-uncontrolled-closed">
            <Accordion defaultOpen={false}>
              <Accordion.Header>
                <span className="agent-acc-title">Pending now</span>
                <span className="agent-acc-summary" style={{ marginLeft: "auto" }}>0</span>
              </Accordion.Header>
              <Accordion.Body>
                <div style={{ padding: "16px 18px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                    Nothing queued right now.
                  </p>
                </div>
              </Accordion.Body>
            </Accordion>
          </div>

          <div className="glass-card overflow-hidden rounded-[12px]" style={{ marginTop: 12 }} data-testid="acc-uncontrolled-open">
            <Accordion defaultOpen={true}>
              <Accordion.Header>
                <span className="agent-acc-title">Sent today</span>
                <span className="agent-acc-summary" style={{ marginLeft: "auto" }}>3</span>
              </Accordion.Header>
              <Accordion.Body>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <Row label="VM3 confirmed" trailing="09:14" />
                  <Row label="PM5 confirmed" trailing="11:02" />
                  <Row label="VM7 chase sent" trailing="14:38" />
                </div>
              </Accordion.Body>
            </Accordion>
          </div>
        </Section>

        <Section title="Controlled" subtitle="open + onOpenChange — parent owns the state, opens both panels in sync">
          <ControlledExample />
        </Section>

        <Section title="No chevron" subtitle="showChevron={false} — for headers that bring their own visual indicator">
          <div className="glass-card overflow-hidden rounded-[12px]" data-testid="acc-no-chevron">
            <Accordion defaultOpen={true}>
              <Accordion.Header showChevron={false}>
                <span style={{ fontSize: 18 }}>📨</span>
                <span className="agent-acc-title">Custom header</span>
                <span className="agent-acc-summary" style={{ marginLeft: "auto" }}>caret hidden</span>
              </Accordion.Header>
              <Accordion.Body>
                <div style={{ padding: "16px 18px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                    Body content. The header brings its own visual treatment instead of relying on the chevron.
                  </p>
                </div>
              </Accordion.Body>
            </Accordion>
          </div>
        </Section>

        <Section title="Keyboard support" subtitle="Tab to focus the header, Enter or Space to toggle. ARIA: role=button, aria-expanded, aria-controls.">
          <div className="glass-card overflow-hidden rounded-[12px]" data-testid="acc-keyboard">
            <Accordion defaultOpen={false}>
              <Accordion.Header>
                <span className="agent-acc-title">Tab to me, then press Enter</span>
              </Accordion.Header>
              <Accordion.Body>
                <div style={{ padding: "16px 18px" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                    Body revealed via keyboard.
                  </p>
                </div>
              </Accordion.Body>
            </Accordion>
          </div>
        </Section>
      </div>
    </main>
  );
}

function ControlledExample() {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="acc-controlled-group">
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-text-muted)" }}>
        Both accordions reflect the same `open` state, set by their parent.
      </p>
      <div className="glass-card overflow-hidden rounded-[12px]">
        <Accordion open={open} onOpenChange={setOpen}>
          <Accordion.Header>
            <span className="agent-acc-title">Section A</span>
          </Accordion.Header>
          <Accordion.Body>
            <div style={{ padding: "16px 18px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                Section A body.
              </p>
            </div>
          </Accordion.Body>
        </Accordion>
      </div>
      <div className="glass-card overflow-hidden rounded-[12px]" style={{ marginTop: 12 }}>
        <Accordion open={open} onOpenChange={setOpen}>
          <Accordion.Header>
            <span className="agent-acc-title">Section B (mirrors A)</span>
          </Accordion.Header>
          <Accordion.Body>
            <div style={{ padding: "16px 18px" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>
                Section B body — same state as A.
              </p>
            </div>
          </Accordion.Body>
        </Accordion>
      </div>
    </div>
  );
}

function Row({ label, trailing }: { label: string; trailing: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
      <span style={{ color: "var(--agent-text-primary)" }}>{label}</span>
      <span style={{ color: "var(--agent-text-muted)", fontSize: 11 }}>{trailing}</span>
    </div>
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

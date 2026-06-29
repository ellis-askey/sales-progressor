// /dev/gallery/drawer — Drawer primitive showcase.
//
// "use client" because Drawer opens are stateful.
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";

export default function DrawerGallery() {
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
            Drawer
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Right-anchored full-height panel. Shares Modal&apos;s chrome contract (portal, backdrop, accent line, focus management, scroll lock) but slides in from the right. 6 bespoke drawer files to migrate.
          </p>
        </header>

        <Section title="Sizes" subtitle="sm 440px / md 460px / lg 480px / xl 560px">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <DrawerDemo label="Open sm" size="sm" testid="drawer-trigger-sm" />
            <DrawerDemo label="Open md" size="md" testid="drawer-trigger-md" />
            <DrawerDemo label="Open lg" size="lg" testid="drawer-trigger-lg" />
            <DrawerDemo label="Open xl" size="xl" testid="drawer-trigger-xl" />
          </div>
        </Section>

        <Section title="Dismiss controls" subtitle="dismissOnBackdrop and showCloseButton — for required-action flows">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <DrawerDemo
              label="No backdrop dismiss"
              size="md"
              dismissOnBackdrop={false}
              testid="drawer-trigger-no-backdrop"
            />
            <DrawerDemo
              label="No close button"
              size="md"
              showCloseButton={false}
              testid="drawer-trigger-no-close"
            />
          </div>
        </Section>

        <Section title="Stacked drawers" subtitle="isTopmost rule — bottom drawer drops its accent line so two accents don't visually collide">
          <StackedDrawerDemo />
        </Section>

        <Section title="Long content scroll" subtitle="header + footer stay sticky; body scrolls">
          <DrawerDemo label="Open with long content" size="md" longContent testid="drawer-trigger-long" />
        </Section>
      </div>
    </main>
  );
}

type DemoProps = {
  label: string;
  size?: "sm" | "md" | "lg" | "xl";
  dismissOnBackdrop?: boolean;
  showCloseButton?: boolean;
  longContent?: boolean;
  testid: string;
};

function DrawerDemo({
  label,
  size = "md",
  dismissOnBackdrop = true,
  showCloseButton = true,
  longContent = false,
  testid,
}: DemoProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} data-testid={testid}>
        {label}
      </Button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Demo drawer"
        size={size}
        dismissOnBackdrop={dismissOnBackdrop}
        showCloseButton={showCloseButton}
      >
        <Drawer.Header>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            Demo drawer title
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>
            size={size}
          </p>
        </Drawer.Header>
        <Drawer.Body data-testid={`${testid}-body`}>
          {longContent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <p key={i} style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                  Paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                </p>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
              Body content. The primitive provides the chrome (right-anchored panel, glass surface, accent line, close button, focus management). Consumers compose the content via Drawer.Header / Drawer.Body / Drawer.Footer.
            </p>
          )}
        </Drawer.Body>
        <Drawer.Footer>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setOpen(false)}>Save</Button>
        </Drawer.Footer>
      </Drawer>
    </>
  );
}

function StackedDrawerDemo() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOuter(true)} data-testid="drawer-trigger-stacked-outer">
        Open outer drawer
      </Button>
      <Drawer
        open={outer}
        onClose={() => setOuter(false)}
        ariaLabel="Outer drawer"
        size="md"
        // When the inner drawer opens, this one becomes the back drawer and
        // drops its accent line per the spec §1.1 rule.
        isTopmost={!inner}
      >
        <Drawer.Header>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Outer drawer</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
            isTopmost={inner ? "false (accent suppressed)" : "true"}
          </p>
        </Drawer.Header>
        <Drawer.Body>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--agent-text-secondary)" }}>
            Open the inner drawer below. When it opens, this outer drawer drops its accent line so the two coral lines don&apos;t stack visually.
          </p>
          <Button variant="primary" onClick={() => setInner(true)} data-testid="drawer-trigger-stacked-inner">
            Open inner drawer
          </Button>
        </Drawer.Body>
      </Drawer>
      <Drawer
        open={inner}
        onClose={() => setInner(false)}
        ariaLabel="Inner drawer"
        size="sm"
        zLayer="escalated"
      >
        <Drawer.Header>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Inner drawer</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>
            zLayer=&quot;escalated&quot; · isTopmost=true
          </p>
        </Drawer.Header>
        <Drawer.Body>
          <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)" }}>
            Sits at z-index 1500, above the outer drawer. Keeps its own accent line; the outer drops its line while this is open.
          </p>
        </Drawer.Body>
      </Drawer>
    </>
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

// /dev/gallery/modal — Modal primitive showcase.
//
// Renders Modal in every size × surface combination + dismiss controls
// + nested-modal (z-layer) example. Each opens via a trigger button so
// the gallery is fully interactive — Playwright tests click each
// trigger to render the modal for screenshot capture.
//
// "use client" because Modal opens are stateful (useState + onClick).
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export default function ModalGallery() {
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
            Modal
          </h1>
          <p style={{
            margin: "8px 0 0",
            fontSize: 15,
            color: "var(--agent-text-secondary)",
            lineHeight: 1.6,
          }}>
            Centred card overlay. Portal-rendered, with backdrop click + Escape key + body scroll lock + focus restoration. 18 bespoke modal files to migrate.
          </p>
        </header>

        <Section title="Sizes" subtitle="sm / md / lg with the same content">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ModalDemo label="Open sm" size="sm" testid="modal-trigger-sm" />
            <ModalDemo label="Open md" size="md" testid="modal-trigger-md" />
            <ModalDemo label="Open lg" size="lg" testid="modal-trigger-lg" />
          </div>
        </Section>

        <Section title="Surfaces" subtitle="solid (workflow modals) vs glass (in-shell modals)">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ModalDemo label="Solid surface" size="md" surface="solid" testid="modal-trigger-solid" />
            <ModalDemo label="Glass surface" size="md" surface="glass" testid="modal-trigger-glass" />
          </div>
        </Section>

        <Section title="Dismiss controls" subtitle="dismissOnBackdrop and showCloseButton — for required-action flows">
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <ModalDemo
              label="No backdrop dismiss"
              size="md"
              dismissOnBackdrop={false}
              testid="modal-trigger-no-backdrop"
            />
            <ModalDemo
              label="No close button"
              size="md"
              showCloseButton={false}
              testid="modal-trigger-no-close"
            />
          </div>
        </Section>

        <Section title="Z-layer (nested modal)" subtitle="default (50) → escalated (1500) → deep (2000)">
          <NestedModalDemo />
        </Section>

        <Section title="Long content scroll" subtitle="max-height 88vh, body scrolls, header + footer stay sticky">
          <ModalDemo label="Open with long content" size="md" longContent testid="modal-trigger-long" />
        </Section>
      </div>
    </main>
  );
}

type DemoProps = {
  label: string;
  size?: "sm" | "md" | "lg";
  surface?: "solid" | "glass";
  dismissOnBackdrop?: boolean;
  showCloseButton?: boolean;
  longContent?: boolean;
  testid: string;
};

function ModalDemo({
  label,
  size = "md",
  surface = "solid",
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
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        ariaLabel="Demo modal"
        size={size}
        surface={surface}
        dismissOnBackdrop={dismissOnBackdrop}
        showCloseButton={showCloseButton}
      >
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            Demo modal title
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>
            size={size} · surface={surface}
          </p>
        </Modal.Header>
        <Modal.Body data-testid={`${testid}-body`}>
          {longContent ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Array.from({ length: 20 }).map((_, i) => (
                <p key={i} style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                  Paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
              Body content. The primitive provides the chrome (backdrop, accent line, close button, focus management). Consumers compose the content via Modal.Header / Modal.Body / Modal.Footer.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => setOpen(false)}>Confirm</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function NestedModalDemo() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOuter(true)} data-testid="modal-trigger-nested-outer">
        Open outer modal
      </Button>
      <Modal open={outer} onClose={() => setOuter(false)} ariaLabel="Outer" size="md">
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Outer (zLayer=default)</h2>
        </Modal.Header>
        <Modal.Body>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--agent-text-secondary)" }}>
            Click below to open a second modal on top of this one. The second modal uses zLayer=&quot;escalated&quot; so it renders above this card.
          </p>
          <Button variant="primary" onClick={() => setInner(true)} data-testid="modal-trigger-nested-inner">
            Open inner modal
          </Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setOuter(false)}>Close outer</Button>
        </Modal.Footer>
      </Modal>
      <Modal open={inner} onClose={() => setInner(false)} ariaLabel="Inner" size="sm" zLayer="escalated">
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Inner (zLayer=escalated)</h2>
        </Modal.Header>
        <Modal.Body>
          <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)" }}>
            This modal sits on top of the outer modal via zLayer=&quot;escalated&quot; (z-index 1500).
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setInner(false)}>Close inner</Button>
        </Modal.Footer>
      </Modal>
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

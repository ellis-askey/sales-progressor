// /dev/gallery/toast — Toast primitive showcase.
//
// "use client" because Toast triggers and the useToast hook are
// runtime-only. The agent layout already mounts ToastProvider for the
// real app; for the gallery we mount it here scoped to this page.
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

export default function ToastGallery() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <ToastProvider>
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
              Toast
            </h1>
            <p style={{
              margin: "8px 0 0",
              fontSize: 15,
              color: "var(--agent-text-secondary)",
              lineHeight: 1.6,
            }}>
              Brief, transient notifications. Re-exports <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>AgentToaster</code> + <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>useAgentToast</code> under the <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>Toast</code> namespace. Provider mounts at <code style={{ fontSize: 13, background: "rgba(15,23,42,0.06)", padding: "1px 6px", borderRadius: 4 }}>app/agent/layout.tsx</code> in production.
            </p>
          </header>

          <Demos />
        </div>
      </main>
    </ToastProvider>
  );
}

function Demos() {
  const { toast } = useToast();

  return (
    <>
      <Section title="Types" subtitle="success / info / warning / error — each carries default duration + colour treatment">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            onClick={() => toast.success("Sale saved")}
            data-testid="toast-trigger-success"
          >
            Trigger success
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.info("Chase reminder queued for tomorrow")}
            data-testid="toast-trigger-info"
          >
            Trigger info
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.warning("Solicitor hasn't responded in 5 days")}
            data-testid="toast-trigger-warning"
          >
            Trigger warning
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast.error("Could not save: try again", { description: "Network error or session expired." })}
            data-testid="toast-trigger-error"
          >
            Trigger error
          </Button>
        </div>
      </Section>

      <Section title="With description" subtitle="optional second line — useful for context after the headline">
        <Button
          variant="secondary"
          onClick={() => toast.success("Chase sent to Mr Smith", { description: "He'll get an email about VM5 within the next 5 minutes." })}
          data-testid="toast-trigger-description"
        >
          Trigger with description
        </Button>
      </Section>

      <Section title="With action" subtitle="caller-supplied label + click — typical use: Undo">
        <Button
          variant="secondary"
          onClick={() => toast.info("Reminder dismissed", {
            description: "Want it back?",
            action: { label: "Undo", onClick: () => toast.success("Reminder restored") },
          })}
          data-testid="toast-trigger-action"
        >
          Trigger with Undo action
        </Button>
      </Section>

      <Section title="Persistent (no auto-dismiss)" subtitle="duration: 0 keeps the toast on screen until the user closes it">
        <Button
          variant="secondary"
          onClick={() => toast.warning("This toast stays until you dismiss it", { duration: 0 })}
          data-testid="toast-trigger-persistent"
        >
          Trigger persistent
        </Button>
      </Section>

      <Section title="Replace by id" subtitle="passing an id replaces an existing toast with the same id instead of stacking">
        <Button
          variant="secondary"
          onClick={() => {
            toast.info("Syncing...", { id: "sync", duration: 0 });
            setTimeout(() => toast.success("Synced", { id: "sync" }), 1200);
          }}
          data-testid="toast-trigger-replace"
        >
          Trigger replace-by-id
        </Button>
      </Section>

      <Section title="Stacking" subtitle="triggering multiple toasts in succession — they stack visually">
        <Button
          variant="secondary"
          onClick={() => {
            toast.success("First");
            setTimeout(() => toast.info("Second"), 200);
            setTimeout(() => toast.warning("Third"), 400);
          }}
          data-testid="toast-trigger-stack"
        >
          Trigger 3 in a row
        </Button>
      </Section>
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

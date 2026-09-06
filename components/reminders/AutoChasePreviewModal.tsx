"use client";

// "View" preview for an autopilot row: shows the real email the pending
// auto-chase will send (composed by the same functions the crons use), in a
// sandboxed frame. Labelled a preview — the live send is composed fresh at
// send time, the warm subject variant rotates, and agency copy edits aren't
// applied here.

import { useState, useEffect } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { getAutoChasePreview, type AutoChasePreview } from "@/app/actions/auto-chase-preview";

export function AutoChasePreviewModal({
  open,
  onClose,
  logId,
  pipeline,
  transactionId,
  sendLabel,
}: {
  open: boolean;
  onClose: () => void;
  logId: string;
  pipeline: "client" | "solicitor";
  transactionId: string;
  sendLabel: string; // e.g. "tomorrow at 10:30am"
}) {
  const [state, setState] = useState<{ status: "loading" } | { status: "done"; data: AutoChasePreview }>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    let live = true;
    setState({ status: "loading" });
    getAutoChasePreview(logId, pipeline)
      .then((data) => { if (live) setState({ status: "done", data }); })
      .catch(() => { if (live) setState({ status: "done", data: { ok: false, error: "Couldn't build the preview." } }); });
    return () => { live = false; };
  }, [open, logId, pipeline]);

  const label = { fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase" as const, letterSpacing: "0.04em" };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Auto-chase email preview" size="lg">
      <div style={{ padding: "20px 22px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>
            What we&apos;ll send
          </h2>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-success)", background: "var(--agent-success-bg)", border: "0.5px solid var(--agent-success-border-strong)", borderRadius: 20, padding: "2px 9px" }}>
            Preview
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)" }}>
          Auto-chase {sendLabel}. We compose it fresh when it sends, so the exact wording can vary slightly.
        </p>
      </div>

      {state.status === "loading" && (
        <div style={{ padding: "40px 22px", textAlign: "center", color: "var(--agent-text-muted)", fontSize: 13 }}>
          Building preview…
        </div>
      )}

      {state.status === "done" && !state.data.ok && (
        <div style={{ padding: "32px 22px", textAlign: "center", color: "var(--agent-text-muted)", fontSize: 13 }}>
          {state.data.error}
        </div>
      )}

      {state.status === "done" && state.data.ok && (
        <div style={{ padding: "8px 22px 4px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", borderRadius: 10, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ ...label, width: 52, flexShrink: 0, paddingTop: 1 }}>To</span>
              <span style={{ fontSize: 13, color: "var(--agent-text-primary)", fontWeight: 600 }}>
                {state.data.recipientName} <span style={{ fontWeight: 500, color: "var(--agent-text-muted)" }}>· {state.data.recipientRole}</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span style={{ ...label, width: 52, flexShrink: 0, paddingTop: 1 }}>Subject</span>
              <span style={{ fontSize: 13, color: "var(--agent-text-primary)" }}>{state.data.subject}</span>
            </div>
          </div>

          {/* The real email HTML, sandboxed (no scripts, no navigation). */}
          <iframe
            srcDoc={state.data.html}
            sandbox=""
            title="Email preview"
            style={{ width: "100%", height: 460, border: "0.5px solid var(--agent-border-subtle)", borderRadius: 10, background: "#ffffff", display: "block" }}
          />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 22px 18px", gap: 12 }}>
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)" }}>Want to change it? Open the file to chase manually or adjust.</span>
        <Link href={`/agent/transactions/${transactionId}`} className="agent-link" style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>
          Open in file <LinkArrow />
        </Link>
      </div>
    </Modal>
  );
}

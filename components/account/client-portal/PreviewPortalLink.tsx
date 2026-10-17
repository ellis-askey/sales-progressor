"use client";

// "Preview the client portal" controls, shown at the bottom of the Inviting
// clients card (Account -> Client portal, director; and the SP business variant).
// Open the full example seller portal in a new tab, or copy a shareable link to
// send someone. The example is a sealed-off demo file (no real data, no emails);
// see app/actions/portal-preview.ts + docs/active/portal-preview/SPEC.md. Built
// on first use and reused after (one per agency). Regenerate sits on the right.

import { useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getOrCreatePreviewPortalUrl, regeneratePreviewLink } from "@/app/actions/portal-preview";

type Busy = null | "open" | "copy" | "regen";

export function PreviewPortalLink() {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState<Busy>(null);

  async function open() {
    setBusy("open");
    const res = await getOrCreatePreviewPortalUrl();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    setBusy("copy");
    const res = await getOrCreatePreviewPortalUrl();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    try {
      await navigator.clipboard.writeText(res.url);
      toast.success("Example portal link copied");
    } catch {
      toast.error("We couldn't copy automatically. Open the example and copy the address instead.");
    }
  }

  async function regen() {
    setBusy("regen");
    const res = await regeneratePreviewLink();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    try {
      await navigator.clipboard.writeText(res.url);
      toast.success("New link generated and copied");
    } catch {
      toast.success("New link generated");
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginTop: 16, paddingTop: 16 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
        Preview the client portal
      </p>
      <p style={{ margin: "4px 0 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
        Explore the full example portal to see what your buyers and sellers see, or copy the link to share a preview with someone else.
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" disabled={busy !== null} onClick={open}>
            {busy === "open" ? "Opening…" : "Open the example"}
          </button>
          <button type="button" className="agent-btn agent-btn-neutral agent-btn-sm" disabled={busy !== null} onClick={copy}>
            {busy === "copy" ? "Preparing…" : "Copy a link to share"}
          </button>
        </div>
        <button type="button" className="agent-link" style={{ fontSize: 12 }} disabled={busy !== null} onClick={regen}>
          {busy === "regen" ? "Working…" : "Regenerate link"}
        </button>
      </div>
    </div>
  );
}

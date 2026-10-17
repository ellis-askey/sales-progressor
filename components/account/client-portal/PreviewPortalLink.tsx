"use client";

// "Preview the client portal" controls (Account -> Client portal, director).
// Open the full example seller portal in a new tab, or copy a shareable link to
// send someone. The example is a sealed-off demo file (no real data, no emails);
// see app/actions/portal-preview.ts + docs/active/portal-preview/SPEC.md. The
// link/example is built on first use and reused after (one per agency).

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
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
      <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" disabled={busy !== null} onClick={open}>
        {busy === "open" ? "Opening…" : "Open the example"}
      </button>
      <button type="button" className="agent-btn agent-btn-neutral agent-btn-sm" disabled={busy !== null} onClick={copy}>
        {busy === "copy" ? "Preparing…" : "Copy a link to share"}
      </button>
      <button type="button" className="agent-link" style={{ fontSize: 12 }} disabled={busy !== null} onClick={regen}>
        {busy === "regen" ? "Working…" : "Regenerate link"}
      </button>
    </div>
  );
}

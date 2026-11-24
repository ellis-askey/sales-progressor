"use client";

// "Show an agent the experience" controls, for a progression-business owner.
// Open or copy a link to send a prospective agent. The link is stable; each
// agent who opens it gets their own fresh, sealed-off demo file (no real data,
// no emails) — see app/actions/agent-demo.ts + docs/active/agent-demo/SPEC.md.

import { useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getBusinessAgentDemoUrl } from "@/app/actions/agent-demo";

type Busy = null | "open" | "copy";

export function AgentDemoLink() {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState<Busy>(null);

  async function open() {
    setBusy("open");
    const res = await getBusinessAgentDemoUrl();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    setBusy("copy");
    const res = await getBusinessAgentDemoUrl();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    try {
      await navigator.clipboard.writeText(res.url);
      toast.success("Agent demo link copied");
    } catch {
      toast.error("We couldn't copy automatically. Open the demo and copy the address instead.");
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--agent-border-subtle)", marginTop: 16, paddingTop: 16 }}>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>
        Show an agent the experience
      </p>
      <p style={{ margin: "4px 0 12px", fontSize: 12.5, lineHeight: 1.5, color: "var(--agent-text-muted)" }}>
        Send a prospective agent a live, interactive example of the file they&rsquo;ll work. Every visitor gets their own sealed-off demo, so nothing they do touches real data.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="agent-btn agent-btn-primary agent-btn-sm" disabled={busy !== null} onClick={open}>
          {busy === "open" ? "Opening…" : "Open the demo"}
        </button>
        <button type="button" className="agent-btn agent-btn-neutral agent-btn-sm" disabled={busy !== null} onClick={copy}>
          {busy === "copy" ? "Preparing…" : "Copy a link to share"}
        </button>
      </div>
    </div>
  );
}

"use client";

// "Preview the client portal" controls, shown at the bottom of the Inviting
// clients card (Account -> Client portal, director; and the SP business variant).
// Open the full example seller portal in a new tab, or copy a shareable link to
// send someone. The example is a sealed-off demo file (no real data, no emails);
// see app/actions/portal-preview.ts + docs/active/portal-preview/SPEC.md. Built
// on first use and reused after (one per agency). Regenerate sits on the right.

import { useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { Button } from "@/components/arc/button/button";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;
import {
  getOrCreatePreviewPortalUrl,
  regeneratePreviewLink,
  getOrCreateBusinessPreviewPortalUrl,
  regenerateBusinessPreviewLink,
} from "@/app/actions/portal-preview";

type Busy = null | "open" | "copy" | "regen";

// variant "agency" (director) vs "business" (progression-company owner) picks
// which server action builds/owns the example, so "Your team" shows the right person.
export function PreviewPortalLink({ variant = "agency" }: { variant?: "agency" | "business" }) {
  const { toast } = useAgentToast();
  const [busy, setBusy] = useState<Busy>(null);
  const getUrl = variant === "business" ? getOrCreateBusinessPreviewPortalUrl : getOrCreatePreviewPortalUrl;
  const regenUrl = variant === "business" ? regenerateBusinessPreviewLink : regeneratePreviewLink;

  async function open() {
    setBusy("open");
    const res = await getUrl();
    setBusy(null);
    if (!res.ok) return toast.error(res.error);
    window.open(res.url, "_blank", "noopener,noreferrer");
  }

  async function copy() {
    setBusy("copy");
    const res = await getUrl();
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
    const res = await regenUrl();
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
          <Button variant="primary" size="sm" style={coralVars} loading={busy === "open"} disabled={busy !== null && busy !== "open"} onClick={open}>
            Open the example
          </Button>
          <Button variant="secondary" size="sm" loading={busy === "copy"} disabled={busy !== null && busy !== "copy"} onClick={copy}>
            Copy a link to share
          </Button>
        </div>
        {/* Canonical coral text link (login style): colour-shift on hover, no underline. */}
        <button
          type="button"
          style={{ background: "none", border: "none", padding: 0, cursor: busy !== null ? "default" : "pointer", fontSize: 12, fontWeight: 600, color: "#FF6B4A", textDecoration: "none", transition: "color 0.12s ease", opacity: busy !== null ? 0.6 : 1 }}
          onMouseEnter={(e) => { if (busy === null) e.currentTarget.style.color = "#E55B3D"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#FF6B4A"; }}
          disabled={busy !== null}
          onClick={regen}
        >
          {busy === "regen" ? "Working…" : "Regenerate link"}
        </button>
      </div>
    </div>
  );
}

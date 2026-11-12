"use client";

// /dev/log-update-live — the REAL Log-an-update components (not a mock), mounted
// with sample data so the shipped UI can be eyeballed in isolation, light + dark.
// Context hooks (toast / founder / glass) all no-op safely off their defaults;
// server actions (save / search / AI draft) only fire on click, so nothing hits
// the backend on load. Use this to review the mic "i" + label changes (critiques
// #284 / #285). The older /dev/log-update-v2 is a hand-built mock, not this.

import { useEffect, useState } from "react";
import { LogUpdateModal } from "@/components/activity/LogUpdateModal";
import { AddNoteModal } from "@/components/activity/AddNoteModal";

const CONTACTS = [
  { id: "s1", name: "Mary Parsons",    roleType: "vendor",    phone: "07700 900001" },
  { id: "s2", name: "Nick Parsons",    roleType: "vendor",    phone: null },
  { id: "b1", name: "Oliver Fradgley", roleType: "purchaser", phone: "07700 900002" },
  { id: "b2", name: "Candice Fradgley", roleType: "purchaser", phone: null },
];
const SOLICITORS = [
  { id: "vs1", name: "Harrison & Co", role: "Vendor solicitor",    phone: null },
  { id: "bs1", name: "Latimer Legal", role: "Purchaser solicitor", phone: null },
];

export default function Page() {
  const [dark, setDark] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Flip the theme on the shell root the modals portal into, so the sheet (not
  // just this page) switches light/dark.
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".agent-shell-root").forEach((el) => {
      el.dataset.theme = dark ? "dark" : "custom";
    });
  }, [dark]);

  const toggleBtn = (label: string, on: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${on ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
        background: on ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-elevated)",
        color: on ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", padding: "28px 20px 120px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: "0 0 4px" }}>Log an update — live component</h1>
        <p style={{ fontSize: 13, color: "var(--agent-text-muted)", margin: "0 0 18px", lineHeight: 1.55 }}>
          The real <code>LogUpdateModal</code> and <code>AddNoteModal</code> with sample contacts — exactly what ships.
          Open each below. The mic &ldquo;i&rdquo; is in the &ldquo;What happened?&rdquo; box; <b>Draft client updates</b> opens the draft panel;
          <b> Share with clients &rarr; Pick specific people</b> shows the Seller/Buyer tags; <b>Add a note</b> shows the property-search step.
          Saving, searching and AI drafting need the live backend, so they won&rsquo;t do anything here.
        </p>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)", marginRight: 4 }}>Theme</span>
          {toggleBtn("Light", !dark, () => setDark(false))}
          {toggleBtn("Dark", dark, () => setDark(true))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <LogUpdateModal transactionId="dev-preview" contacts={CONTACTS} solicitors={SOLICITORS} canPasteChat canMarkPrivate />
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, font: "inherit", fontSize: 14, fontWeight: 600,
              cursor: "pointer", padding: "11px 18px", borderRadius: 12,
              border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)",
              color: "var(--agent-text-primary)",
            }}
          >
            Open &ldquo;Add a note&rdquo; (property search)
          </button>
        </div>
      </div>

      <AddNoteModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

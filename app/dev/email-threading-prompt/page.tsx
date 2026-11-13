"use client";

// /dev/email-threading-prompt — the REAL ComposeEmailModal, seeded with mock
// recipients + a mock "continue" candidate, so the chosen treatment-A whisper
// shows inside the actual composer chrome. Dev-only.

import { useState } from "react";
import { ComposeEmailModal, type Token } from "@/components/compose/ComposeEmailModal";
import type { ComposeContextWithPhoto } from "@/app/actions/compose";
import type { ComposeRecipient } from "@/lib/services/compose-recipients";
import type { ContinuableThread } from "@/lib/email/thread-continue";

function sol(id: string, name: string, email: string, side: "vendor" | "purchaser"): ComposeRecipient {
  return { id, name, email, roleLabel: "Buyer's solicitor", kind: "solicitor", side, group: "sale", avatarUrl: null, secondaryEmail: null };
}

const TO: Token[] = [
  { email: "p.hart@smithco.co.uk", name: "Smith & Co", rec: sol("1", "Smith & Co", "p.hart@smithco.co.uk", "purchaser") },
  { email: "conv@jonesllp.co.uk", name: "Jones LLP", rec: sol("2", "Jones LLP", "conv@jonesllp.co.uk", "vendor") },
  { email: "legal@hartley.co.uk", name: "Hartley Legal", rec: sol("3", "Hartley Legal", "legal@hartley.co.uk", "purchaser") },
];

const CTX: ComposeContextWithPhoto = {
  sale: { id: "dev", address: "12 Oak Lane, Bristol BS6 5DH", line1: "12 Oak Lane", location: "Bristol BS6 5DH", photoPath: null },
  recipients: TO.map((t) => t.rec!).filter(Boolean),
  fromEmail: "Sarah Agent <sarah@acme-estates.co.uk>",
  photoUrl: null,
};

const BODY = `<p>Morning all,</p><p>A quick update on 12 Oak Lane ahead of exchange&hellip;</p><p><br></p><div data-cem-sig="1"><p>Kind regards,</p><p>Sarah</p></div>`;

// A mock prior conversation to this same group, so the whisper appears.
const CANDIDATE: ContinuableThread = {
  inReplyTo: "<sp-prev@thesalesprogressor.co.uk>",
  references: "<sp-prev@thesalesprogressor.co.uk>",
  subject: "Chain enquiries: 12 Oak Lane",
  sentAt: "2026-11-11T09:00:00.000Z",
};

const SEED = { ctx: CTX, to: TO, subject: "Chain enquiries: 12 Oak Lane", bodyHtml: BODY, candidate: CANDIDATE };

export default function Page() {
  const [dark, setDark] = useState(false);

  function setTheme(d: boolean) {
    setDark(d);
    const v = d ? "dark" : "custom";
    document.documentElement.dataset.theme = v;
    document.querySelectorAll<HTMLElement>("[data-theme]").forEach((el) => { el.dataset.theme = v; });
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{
        position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 99999,
        display: "flex", gap: 6, alignItems: "center",
        padding: "7px 10px", borderRadius: 12, background: "var(--agent-surface-elevated)",
        border: "1px solid var(--agent-border-default)", boxShadow: "0 8px 24px rgba(20,12,6,.18)",
      }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)" }}>Treatment A (the chosen one)</span>
        <span style={{ width: 1, height: 20, background: "var(--agent-border-default)", margin: "0 2px" }} />
        <button type="button" onClick={() => setTheme(false)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${!dark ? "var(--agent-coral)" : "var(--agent-border-default)"}`, background: "transparent", color: "var(--agent-text-secondary)" }}>Light</button>
        <button type="button" onClick={() => setTheme(true)} style={{ padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${dark ? "var(--agent-coral)" : "var(--agent-border-default)"}`, background: "transparent", color: "var(--agent-text-secondary)" }}>Dark</button>
      </div>

      <ComposeEmailModal open onClose={() => {}} frame="modal" devSeed={SEED} />
    </div>
  );
}

"use client";

// /dev/orphan-compose — DELETION-CONFIRM PREVIEW.
//
// Renders the OLD compose component (components/verified-emails/ComposeEmail.tsx)
// so it can be eyeballed before deletion. Evidence it's dead code: it is not
// imported anywhere in app/, components/ or lib/ — the live composer you actually
// use is components/compose/ComposeEmailModal.tsx. This page exists only to
// confirm "yes, that's the old one, delete it"; delete this /dev page too once done.
//
// Rendered with dummy props inside the toast provider it needs. Its on-mount
// fetches (signature preview, verified emails) fail gracefully with a fake id, so
// you see the old empty-state UI. Nothing is sent or written.

import { ComposeEmail } from "@/components/verified-emails/ComposeEmail";
import { AgentToaster } from "@/components/agent/AgentToaster";

export default function OrphanComposePreview() {
  return (
    <div style={{ minHeight: "100vh", background: "#f6f3ef", padding: 32 }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            marginBottom: 20,
            borderRadius: 14,
            border: "1px solid #fca5a5",
            background: "linear-gradient(180deg,#fff1f0,#ffffff)",
            padding: "16px 18px",
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#991b1b" }}>
            Orphaned file — confirm deletion
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.55, color: "#374151" }}>
            This is <b>components/verified-emails/ComposeEmail.tsx</b>, the old compose component.
            It is <b>not imported anywhere</b> in live code. The composer you actually use today is{" "}
            <b>components/compose/ComposeEmailModal.tsx</b>. If the UI below looks like the old,
            replaced composer, it&rsquo;s safe to delete this file (and this /dev page).
          </p>
        </div>

        <AgentToaster>
          <ComposeEmail
            transactionId="dev-preview-orphan"
            senderIdentity={{ name: "Sarah Owner", email: "sarah@sarahprogression.co.uk" }}
          />
        </AgentToaster>
      </div>
    </div>
  );
}

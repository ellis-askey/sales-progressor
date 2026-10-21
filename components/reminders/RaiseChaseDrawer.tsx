"use client";

// The chase drawer behind the escalated "enquiries raised" reminder (founder
// plan 2026-10-21). Opens with the EXACT email the autopilot would send to the
// buyer's solicitor — editable subject + body — plus the shared nudge history,
// the recipient (and the per-agency CC when one applies), and Send. Sending
// stamps the same ledger the autopilot reads (one honest count, clock reset)
// and re-arms the reminder three working days out. No solicitor email on file
// → the add-the-email seam instead of a dead Send (Law 13).

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from "@/components/ui/Drawer";
import { getRaiseChaseDraftAction, sendRaiseChaseAction } from "@/app/actions/enquiries";

type Draft = Awaited<ReturnType<typeof getRaiseChaseDraftAction>>;

export function RaiseChaseDrawer({
  transactionId,
  propertyAddress,
  onClose,
  onSent,
}: {
  transactionId: string;
  propertyAddress: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    getRaiseChaseDraftAction({ transactionId }).then((d) => {
      if (!alive) return;
      setDraft(d);
      if (d.ok) {
        setSubject(d.subject);
        setBody(d.bodyText);
      }
    });
    return () => { alive = false; };
  }, [transactionId]);

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await sendRaiseChaseAction({ transactionId, subject, bodyText: body });
      if (res.ok) onSent();
      else setError("The chase didn't send. Check the solicitor's email on the file and try again.");
    });
  }

  const label: React.CSSProperties = {
    margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em",
    textTransform: "uppercase", color: "var(--agent-text-muted)",
  };
  const input: React.CSSProperties = {
    width: "100%", fontSize: 13, color: "var(--agent-text-primary)",
    background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-default)",
    borderRadius: 10, padding: "9px 11px", fontFamily: "inherit",
  };

  return (
    <Drawer open onClose={onClose} ariaLabel="Chase the buyer's solicitor to raise enquiries" size="md">
      <DrawerHeader>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
          Chase the buyer&rsquo;s solicitor
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>{propertyAddress}</p>
      </DrawerHeader>
      <DrawerBody>
        {!draft ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>Preparing the email&hellip;</p>
        ) : !draft.ok ? (
          draft.reason === "no_solicitor_email" ? (
            <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--agent-text-secondary)" }}>
              <p style={{ margin: 0, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                No email on file for the buyer&rsquo;s solicitor.
              </p>
              <p style={{ margin: "6px 0 0" }}>
                Add their email on the file and the chase is ready to go.
              </p>
              <Link
                href={`/agent/transactions/${transactionId}`}
                className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                style={{ display: "inline-flex", marginTop: 12, textDecoration: "none" }}
              >
                Open the file
              </Link>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)" }}>
              This file&rsquo;s chase isn&rsquo;t available any more. Close this and refresh.
            </p>
          )
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Shared history: the same ledger the automated nudges write. */}
            <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
              ↻ {draft.nudgeCount} nudge{draft.nudgeCount === 1 ? "" : "s"} sent so far
              {draft.lastNudgedAt
                ? ` · last ${new Date(draft.lastNudgedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
                : ""}
              {" "}· no reply yet. This send joins the same count and resets the automatic cadence.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <p style={label}>To</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)" }}>
                <strong style={{ fontWeight: 600 }}>{draft.recipientName ?? draft.firmName ?? "The buyer's solicitor"}</strong>
                {draft.firmName && draft.recipientName ? ` · ${draft.firmName}` : ""}
                <span style={{ color: "var(--agent-text-muted)" }}> &lt;{draft.recipientEmail}&gt;</span>
              </p>
              {draft.cc.length > 0 && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>
                  CC (your agency setting): {draft.cc.join(", ")}
                </p>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <p style={label}>Subject</p>
              <input style={input} value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <p style={label}>Message</p>
              <textarea
                style={{ ...input, minHeight: 260, resize: "vertical", lineHeight: 1.55 }}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>

            {error && <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-danger, #C73E3E)" }}>{error}</p>}
          </div>
        )}
      </DrawerBody>
      {draft?.ok && (
        <DrawerFooter>
          <button type="button" className="agent-btn agent-btn-ghost-bordered" onClick={onClose} disabled={sending}>
            Cancel
          </button>
          <button
            type="button"
            className="agent-btn agent-btn-primary"
            onClick={send}
            disabled={sending || !subject.trim() || !body.trim()}
          >
            {sending ? "Sending…" : "Send chase"}
          </button>
        </DrawerFooter>
      )}
    </Drawer>
  );
}

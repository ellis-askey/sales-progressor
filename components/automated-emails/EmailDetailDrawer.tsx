"use client";

// Right-side detail drawer for one automated email. Composes the canonical
// ui/Drawer (ARIA, Escape, focus, scroll-lock, mobile full-width all free) and
// ports the old EmailPreviewModal's load/view/edit flow into it, adding "why is
// this being sent", the automation context, and recent activity on the file.
//
// Queue rows (source "queue") load their full payload lazily via
// getEmailForPreview and can be edited when permitted. Solicitor rows (source
// "message") have no queue payload — the drawer shows their metadata and links
// to the file, where the full message lives on the timeline.

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Drawer } from "@/components/ui/Drawer";
import { Pill } from "@/components/ui/Pill";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getEmailForPreview, updateEmailPayload } from "@/app/actions/automation";
import { getFileEmailTimeline, cancelPendingEmail, sendPendingEmailNow, type FileEmailActivityItem } from "@/app/actions/automated-emails";
import { deliveryStatusMeta } from "./deliveryStatus";
import type { EmailRow } from "@/lib/services/automated-emails-list";

type PreviewData = {
  id: string; emailType: string; subject: string; text: string; html: string;
  recipientName: string; recipientEmail: string; recipientRole: string;
  scheduledFor: Date; sentAt: Date | null; errorAt: Date | null;
  editedAt: Date | null; editedByName: string | null;
  canEdit: boolean; transactionId: string;
};

const dtFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
const fmtDT = (d: Date | null | undefined) => (d ? dtFmt.format(new Date(d)) : "");

const primaryBtn: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
};

function whyText(row: EmailRow): string {
  switch (row.emailType) {
    case "CLIENT_CHASE": return "A step has stayed outstanding, so we're nudging the client to move it along.";
    case "SOLICITOR_CHASE": return "A step the solicitor owns has stayed outstanding, so we're chasing their office.";
    case "MILESTONE_CONFIRMATION": return "A step was confirmed, so we're letting the client know where things stand.";
    case "EXCHANGE": return "Contracts have exchanged, so we're confirming it to everyone on the file.";
    case "COMPLETION": return "The sale has completed, so we're confirming it to everyone on the file.";
    case "CELEBRATION": return "Every sale in the chain has completed, so we're sharing the good news.";
    default: return "An automated update was triggered on this file.";
  }
}

function automationLabel(row: EmailRow): string {
  switch (row.emailType) {
    case "CLIENT_CHASE": return "Client chase";
    case "SOLICITOR_CHASE": return "Solicitor chase";
    case "MILESTONE_CONFIRMATION": return "Milestone update";
    case "EXCHANGE": return "Exchange confirmation";
    case "COMPLETION": return "Completion confirmation";
    case "CELEBRATION": return "Chain celebration";
    default: return row.emailType;
  }
}

function timingLine(row: EmailRow): string {
  if (row.status === "pending") return `Sends ${fmtDT(row.scheduledFor)}`;
  if (row.status === "sent") return `Sent ${fmtDT(row.sentAt)}`;
  if (row.status === "errored") return `Failed ${fmtDT(row.errorAt)}`;
  return `Predicted ${fmtDT(row.scheduledFor)}`;
}

export function EmailDetailDrawer({ row, onClose, onChanged }: { row: EmailRow | null; onClose: () => void; onChanged?: () => void }) {
  const { toast } = useAgentToast();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<FileEmailActivityItem[] | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [acting, startActing] = useTransition();

  const emailId = row?.id ?? null;
  const isQueue = row?.source === "queue" && row.status !== "upcoming";
  const isPending = row?.status === "pending" && row.source === "queue";
  const txId = row?.transactionId ?? "";

  function doSendNow() {
    if (!emailId) return;
    startActing(async () => {
      const res = await sendPendingEmailNow(emailId);
      if (res.ok) { toast.success(res.message); onChanged?.(); onClose(); }
      else { toast.error(res.error); onChanged?.(); }
    });
  }
  function doCancel() {
    if (!emailId) return;
    startActing(async () => {
      const res = await cancelPendingEmail(emailId);
      if (res.ok) { toast.success(res.message); onChanged?.(); onClose(); }
      else { toast.error(res.error); onChanged?.(); }
    });
  }

  // Load the payload (queue rows only) + the file's recent activity on open.
  useEffect(() => {
    if (!row) return;
    setPreview(null); setLoadError(null); setMode("view"); setSaveError(null); setActivity(null);
    if (isQueue && emailId) {
      setLoading(true);
      getEmailForPreview(emailId)
        .then((res) => {
          if (res.ok) { setPreview(res.data as PreviewData); setSubject(res.data.subject); setText(res.data.text); }
          else setLoadError(res.error);
        })
        .catch(() => setLoadError("Couldn't load this email."))
        .finally(() => setLoading(false));
    }
    if (txId) getFileEmailTimeline(txId).then(setActivity).catch(() => setActivity([]));
  }, [row, emailId, isQueue, txId]);

  function handleSave() {
    if (!emailId) return;
    setSaveError(null);
    startSaving(async () => {
      const res = await updateEmailPayload(emailId, { subject, text });
      if (res.ok) { toast.success("Email updated"); setMode("view"); onChanged?.(); }
      else { setSaveError(res.error ?? "Couldn't update email."); }
    });
  }

  if (!row) return null;
  const statusMeta = deliveryStatusMeta(row.deliveryStatus);
  const role = asRole(row.recipientRole);
  const canEdit = preview?.canEdit ?? false;

  return (
    <Drawer open={!!row} onClose={onClose} ariaLabel={`Email detail: ${row.subject}`} size="lg">
      <Drawer.Header>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="agent-eyebrow">{row.category === "chase" ? "Chase" : "Notification"}</span>
          <Pill glass tone={statusMeta.tone} size="sm">{statusMeta.label}</Pill>
        </div>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>{row.subject}</h2>
      </Drawer.Header>

      <Drawer.Body>
        {/* Recipient + file */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {role && <RoleIcon role={role} size={13} />}
            {row.recipientName}
            {role && <span style={{ color: "var(--agent-text-muted)", fontWeight: 400 }}>· {roleLabel(role)}</span>}
          </span>
          {preview?.recipientEmail && <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>{preview.recipientEmail}</span>}
          <Link href={`/agent/transactions/${txId}`} className="agent-link" style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>
            {row.transactionAddress}
          </Link>
        </div>

        <Section label={row.status === "pending" ? "Sends" : row.status === "errored" ? "Failed" : "Sent"}>
          {timingLine(row)}
        </Section>

        <Section label="Why is this being sent?">{whyText(row)}</Section>

        <Section label="Automation">
          {automationLabel(row)}
          {row.chaseNumber ? ` · chase ${row.chaseNumber} of 2` : ""}
        </Section>

        {row.status === "errored" && row.errorMessage && (
          <Section label="Error">
            <span style={{ color: "var(--agent-danger)" }}>{row.errorMessage}</span>
          </Section>
        )}

        {/* Email preview / edit (queue rows only) */}
        {isQueue && (
          <div style={{ marginTop: 6, marginBottom: 14 }}>
            <p className="agent-eyebrow" style={{ marginBottom: 6 }}>Email preview</p>
            {loading && <p style={{ fontSize: 13, color: "var(--agent-text-muted)", fontStyle: "italic" }}>Loading…</p>}
            {loadError && <p style={{ fontSize: 13, color: "var(--agent-danger)" }}>{loadError}</p>}
            {preview && mode === "view" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>Subject</p>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-primary)" }}>{preview.subject}</p>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>Body</p>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13, color: "var(--agent-text-secondary)" }}>{preview.text}</pre>
                </div>
                {preview.editedAt && (
                  <p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-muted)" }}>Edited {fmtDT(preview.editedAt)}{preview.editedByName ? ` by ${preview.editedByName}` : ""}</p>
                )}
              </div>
            )}
            {preview && mode === "edit" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input className="agent-input agent-input-sm" value={subject} onChange={(e) => setSubject(e.target.value)} disabled={saving} aria-label="Subject" />
                <textarea className="agent-input" rows={10} value={text} onChange={(e) => setText(e.target.value)} disabled={saving} aria-label="Body" style={{ resize: "vertical" }} />
                {saveError && <p style={{ margin: 0, fontSize: 12, color: "var(--agent-danger)" }}>{saveError}</p>}
              </div>
            )}
          </div>
        )}

        {!isQueue && row.source === "message" && (
          <Section label="Message">
            The full message is on the file timeline. Open the file to read it.
          </Section>
        )}

        {/* Activity on this transaction */}
        {activity && activity.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <p className="agent-eyebrow" style={{ marginBottom: 6 }}>Activity on this transaction</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {activity.map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--agent-text-secondary)" }}>{fmtDT(a.at)} · {a.label}</span>
                  <span style={{ color: "var(--agent-text-muted)" }}>{a.deliveryStatus}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer.Body>

      <Drawer.Footer>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
          <Link href={`/agent/transactions/${txId}`} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>
            View file →
          </Link>
          {mode === "view" && (
            <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
              {isQueue && canEdit && (
                <button onClick={() => setMode("edit")} className="agent-link" style={{ fontSize: 12, fontWeight: 600 }} disabled={acting}>Edit</button>
              )}
              {isPending && (
                <button onClick={doCancel} className="agent-link" style={{ fontSize: 12, color: "var(--agent-danger)" }} disabled={acting}>Cancel</button>
              )}
              {isPending && (
                <button onClick={doSendNow} className="agent-btn-color-primary" style={primaryBtn} disabled={acting}>{acting ? "Sending…" : "Send now"}</button>
              )}
            </span>
          )}
          {isQueue && mode === "edit" && (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => { setMode("view"); setSubject(preview?.subject ?? ""); setText(preview?.text ?? ""); setSaveError(null); }} className="agent-link" style={{ fontSize: 12 }} disabled={saving}>Cancel</button>
              <button onClick={handleSave} className="agent-btn-color-primary" style={primaryBtn} disabled={saving || !subject.trim() || !text.trim()}>{saving ? "Saving…" : "Save"}</button>
            </span>
          )}
        </div>
      </Drawer.Footer>
    </Drawer>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p className="agent-eyebrow" style={{ marginBottom: 3 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>{children}</p>
    </div>
  );
}

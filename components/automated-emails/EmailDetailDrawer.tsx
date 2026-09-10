"use client";

// Right-side detail drawer for one automated email. Composes the canonical
// ui/Drawer (ARIA, Escape, focus, scroll-lock, mobile full-width, dark mode all
// free) and lays it out to the 2026-09 mock: a coral band with the automation
// title + a live status dot, a recipient block with the side-tinted contact
// avatar, an automation-details block (why + when), and a true-to-inbox email
// preview rendered from the email's own HTML in a sandboxed iframe.
//
// Queue rows (source "queue") load their full payload lazily via
// getEmailForPreview and can be edited/sent/cancelled when permitted. Solicitor
// rows (source "message") have no queue payload — the drawer shows their
// metadata and points to the file, where the full message lives on the timeline.

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  PaperPlaneTilt,
  FileMagnifyingGlass,
  CalendarBlank,
  Clock,
  House,
  ArrowSquareOut,
  DotsThree,
  PencilSimple,
} from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/Drawer";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { Pill } from "@/components/ui/Pill";
import { ContactAvatar } from "@/components/ui/Avatar";
import { asRole, roleLabel } from "@/components/ui/RoleIcon";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { getEmailForPreview, updateEmailPayload } from "@/app/actions/automation";
import { cancelPendingEmail, sendPendingEmailNow, getMessageForPreview } from "@/app/actions/automated-emails";
import { deliveryStatusMeta } from "./deliveryStatus";
import type { EmailRow } from "@/lib/services/automated-emails-list";

export type PreviewData = {
  id: string; emailType: string; subject: string; text: string; html: string;
  recipientName: string; recipientEmail: string; recipientRole: string;
  scheduledFor: Date; sentAt: Date | null; errorAt: Date | null;
  editedAt: Date | null; editedByName: string | null;
  canEdit: boolean; transactionId: string;
  contextLabel: string | null; chaseNumber: number | null;
  canOpenInNewWindow: boolean;
};

// "5 Sept 2026 at 10:30" — date and time formatted separately so we can join
// them with "at" (Intl joins with a comma).
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
const fmtWhen = (d: Date | null | undefined) => (d ? `${dateFmt.format(new Date(d))} at ${timeFmt.format(new Date(d))}` : "");

// "In 2 days" / "Tomorrow" / "Today" / "Yesterday" / "3 days ago".
function relativeWhen(d: Date | null | undefined): string {
  if (!d) return "";
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

// Status-dot colour that reads on the coral band. Colour is never the only
// signal — the word ("Pending") always sits beside it.
const DOT_COLOR: Record<string, string> = {
  success: "#7EE0A6",
  info: "#B7D4FA",
  muted: "#F5C451",
  warning: "#F5C451",
  danger: "#FFC0B4",
};

const primaryBtn: React.CSSProperties = {
  padding: "9px 15px", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: 7,
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

// The human title on the coral band — the automation, framed by its state.
function headerTitle(row: EmailRow): string {
  const label = automationLabel(row);
  if (row.status === "pending" || row.status === "upcoming") return `Scheduled ${label.toLowerCase()}`;
  return label;
}

// The word beside the "Sends" / "Sent" / "Failed" timing line.
function whenLabel(row: EmailRow): string {
  if (row.status === "sent") return "Sent";
  if (row.status === "errored") return "Failed";
  return "Sends";
}
function whenDate(row: EmailRow): Date | null {
  if (row.status === "sent") return row.sentAt;
  if (row.status === "errored") return row.errorAt;
  return row.scheduledFor;
}

export function EmailDetailDrawer({ row, onClose, onChanged, seedPreview = null }: { row: EmailRow | null; onClose: () => void; onChanged?: () => void; seedPreview?: PreviewData | null }) {
  const { toast } = useAgentToast();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  // Open the email's own HTML in a new tab, exactly as the inbox renders it.
  function openInNewWindow() {
    if (!preview?.html) return;
    const blob = new Blob([preview.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  // Load the payload on open. Queue rows → getEmailForPreview; solicitor
  // (message) rows → getMessageForPreview. Both return the same PreviewData
  // shape, so the preview card renders identically for either source.
  useEffect(() => {
    if (!row) return;
    setPreview(null); setLoadError(null); setMode("view"); setSaveError(null);
    // Seeded (e.g. /dev/sheets): render from injected data, skip the server.
    if (seedPreview) {
      setPreview(seedPreview); setSubject(seedPreview.subject); setText(seedPreview.text);
      return;
    }
    if (!emailId) return;
    const loader = isQueue
      ? getEmailForPreview(emailId)
      : row.source === "message"
        ? getMessageForPreview(emailId)
        : null;
    if (!loader) return;
    setLoading(true);
    loader
      .then((res) => {
        if (res.ok) { setPreview(res.data as PreviewData); setSubject(res.data.subject); setText(res.data.text); }
        else setLoadError(res.error);
      })
      .catch(() => setLoadError("Couldn't load this email."))
      .finally(() => setLoading(false));
  }, [row, emailId, isQueue, seedPreview]);

  function handleSave() {
    if (!emailId) return;
    setSaveError(null);
    startSaving(async () => {
      const res = await updateEmailPayload(emailId, { subject, text });
      if (!res.ok) { setSaveError(res.error ?? "Couldn't update email."); return; }
      toast.success("Email updated");
      // Reflect the saved edit in the preview right away so what's on screen
      // matches what will send. Optimistic subject/text first, then re-fetch to
      // pick up the rebuilt HTML the server generated from the edited body.
      setPreview((prev) => (prev ? { ...prev, subject, text } : prev));
      const fresh = await getEmailForPreview(emailId);
      if (fresh.ok) { setPreview(fresh.data as PreviewData); setSubject(fresh.data.subject); setText(fresh.data.text); }
      setMode("view");
      onChanged?.();
    });
  }

  if (!row) return null;
  const statusMeta = deliveryStatusMeta(row.deliveryStatus);
  const role = asRole(row.recipientRole);
  const canEdit = preview?.canEdit ?? false;
  const email = preview?.recipientEmail ?? "";

  return (
    <Drawer open={!!row} onClose={onClose} ariaLabel={`Email detail: ${row.subject}`} size="xl" closeTone="onDark">
      <Drawer.Header style={SHEET_BAND_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <PaperPlaneTilt size={26} weight="regular" style={{ flexShrink: 0, color: "var(--agent-text-on-coral, #fff)" }} aria-hidden />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sheet-band-kicker, rgba(255,255,255,0.78))" }}>
              Auto email
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700, color: "var(--agent-text-on-coral, #fff)", lineHeight: 1.25 }}>
              {headerTitle(row)}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.9)", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: DOT_COLOR[statusMeta.tone] ?? "#F5C451", flexShrink: 0 }} aria-hidden />
              {statusMeta.label}
            </p>
          </div>
        </div>
      </Drawer.Header>

      <Drawer.Body>
        {/* Recipient */}
        <Eyebrow>Recipient</Eyebrow>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <ContactAvatar contact={{ name: row.recipientName, roleType: row.recipientRole }} size={44} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{row.recipientName}</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>
              {role ? roleLabel(role) : ""}{role && email ? " · " : ""}{email}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <House size={15} weight="regular" style={{ flexShrink: 0, color: "var(--agent-text-muted)" }} aria-hidden />
              {row.transactionAddress}
            </p>
          </div>
        </div>

        <Divider />

        {/* Automation details */}
        <Eyebrow>Automation details</Eyebrow>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
          <FileMagnifyingGlass size={32} weight="regular" style={{ flexShrink: 0, marginTop: 1, color: "var(--agent-text-secondary)" }} aria-hidden />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{preview?.contextLabel ?? automationLabel(row)}</span>
              {(row.chaseNumber ?? preview?.chaseNumber) ? <Pill tone="default" size="md">Chase {row.chaseNumber ?? preview?.chaseNumber} of 2</Pill> : null}
            </div>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{whyText(row)}</p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 12 }}>
              <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                <CalendarBlank size={16} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} aria-hidden />
                {whenLabel(row)} {fmtWhen(whenDate(row))}
              </span>
              {relativeWhen(whenDate(row)) && (
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Clock size={16} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} aria-hidden />
                  {relativeWhen(whenDate(row))}
                </span>
              )}
            </div>
            {row.status === "errored" && row.errorMessage && (
              <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--agent-danger)" }}>{row.errorMessage}</p>
            )}
          </div>
        </div>

        <Divider />

        {/* Email preview / edit — same card for queue (client) + message
            (solicitor) rows. Falls back to a timeline pointer only when a
            message genuinely has no recorded body to show. */}
        {(preview || loading || (loadError && row.source !== "message")) ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <Eyebrow noMargin>Email preview</Eyebrow>
              {mode === "view" && preview?.canOpenInNewWindow && preview?.html && (
                <button
                  type="button"
                  onClick={openInNewWindow}
                  className="agent-link"
                  style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  Preview in new window <ArrowSquareOut size={14} weight="bold" />
                </button>
              )}
            </div>

            {loading && <p style={{ fontSize: 13, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>Loading…</p>}
            {loadError && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{loadError}</p>}

            {preview && (
              /* One white card, To/Subject chrome on top, the email (or its
                 editable body) below. Same card in view + edit so editing never
                 collapses the layout — only the fields swap. Text is explicit
                 hex, not agent tokens, because the card is always white in both
                 themes (an email is white) so tokens would vanish in dark mode. */
              <div style={{ border: "1px solid var(--agent-border-strong)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
                  <MetaRow label="To">
                    <span style={{ color: "#1f2937" }}>{preview.recipientName} &lt;{preview.recipientEmail}&gt;</span>
                  </MetaRow>
                  <MetaRow label="Subject">
                    {mode === "edit" ? (
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={saving}
                        aria-label="Subject"
                        className="email-detail-subject-input"
                        style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "#111827", background: "#fff", border: "1px solid #d1d5db", borderRadius: 7, padding: "6px 9px", fontFamily: "inherit" }}
                      />
                    ) : (
                      <span style={{ color: "#111827", fontWeight: 700 }}>{preview.subject}</span>
                    )}
                  </MetaRow>
                </div>
                <div style={{ height: 1, background: "#e5e7eb" }} aria-hidden />
                {mode === "view" ? (
                  <iframe
                    title="Email preview"
                    srcDoc={previewSrcDoc(preview.html)}
                    sandbox=""
                    style={{ width: "100%", minHeight: 380, border: "none", background: "#fff", display: "block" }}
                  />
                ) : (
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    disabled={saving}
                    aria-label="Body"
                    style={{ width: "100%", minHeight: 380, border: "none", outline: "none", background: "#fff", color: "#1f2937", fontSize: 15, lineHeight: 1.65, fontFamily: "inherit", padding: "20px", resize: "vertical", boxSizing: "border-box" }}
                  />
                )}
                {mode === "edit" && saveError && (
                  <p style={{ margin: 0, padding: "0 20px 14px", fontSize: 12, color: "var(--agent-danger)" }}>{saveError}</p>
                )}
              </div>
            )}

            {preview?.editedAt && mode === "view" && (
              <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
                Edited {fmtWhen(preview.editedAt)}{preview.editedByName ? ` by ${preview.editedByName}` : ""}
              </p>
            )}
          </>
        ) : row.source === "message" ? (
          <>
            <Eyebrow>Message</Eyebrow>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
              The full message is on the file timeline. Open the file to read it.
            </p>
          </>
        ) : null}
      </Drawer.Body>

      <Drawer.Footer>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%" }}>
          <Link href={`/agent/transactions/${txId}`} className="agent-link agent-link-muted" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
            View file <LinkArrow />
          </Link>

          {mode === "view" && (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              {isPending && (
                <UpwardMenu
                  items={[{ label: "Cancel send", danger: true, onClick: doCancel, disabled: acting }]}
                />
              )}
              {isQueue && canEdit && (
                <button
                  onClick={() => setMode("edit")}
                  disabled={acting}
                  className="email-detail-outline-btn"
                  style={{ ...primaryBtn, background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)", border: "0.5px solid var(--agent-border-strong)" }}
                >
                  <PencilSimple size={14} weight="bold" /> Edit email
                </button>
              )}
              {isPending && (
                <button onClick={doSendNow} className="agent-btn-color-primary" style={primaryBtn} disabled={acting}>
                  <PaperPlaneTilt size={14} weight="fill" /> {acting ? "Sending…" : "Send now"}
                </button>
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

      <style>{`
        .email-detail-outline-btn:hover:not(:disabled) { background: var(--agent-surface-glass) !important; border-color: var(--agent-text-muted) !important; }
        .email-detail-outline-btn:disabled { opacity: 0.55; cursor: default; }
      `}</style>
    </Drawer>
  );
}

// Small overflow menu that opens UPWARD (it lives in the drawer footer). Theme
// aware via agent tokens; click-outside + Escape dismiss.
function UpwardMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  if (items.length === 0) return null;
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="email-detail-menu-btn"
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 38, height: 38, borderRadius: 10,
          background: open ? "var(--agent-surface-glass)" : "var(--agent-surface-elevated)",
          border: "0.5px solid var(--agent-border-strong)", color: "var(--agent-text-secondary)", cursor: "pointer",
          transition: "background 120ms, border-color 120ms",
        }}
      >
        <DotsThree size={20} weight="bold" />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute", right: 0, bottom: "calc(100% + 6px)", minWidth: 168,
            background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-strong)",
            borderRadius: 12, boxShadow: "0 12px 30px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
            padding: 6, zIndex: 30, animation: "email-detail-menu-in 130ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.onClick(); }}
              className={`email-detail-menu-item${it.danger ? " is-danger" : ""}`}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "8px 10px",
                border: "none", background: "none", borderRadius: 8, cursor: it.disabled ? "default" : "pointer",
                fontSize: 13, fontWeight: 500, opacity: it.disabled ? 0.5 : 1,
                color: it.danger ? "var(--agent-danger)" : "var(--agent-text-primary)",
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
      <style>{`
        .email-detail-menu-btn:hover { background: var(--agent-surface-glass); border-color: var(--agent-text-muted); }
        .email-detail-menu-item:hover:not(:disabled) { background: var(--agent-surface-glass); }
        @keyframes email-detail-menu-in { from { opacity: 0; transform: translateY(3px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
}

function Eyebrow({ children, noMargin = false }: { children: React.ReactNode; noMargin?: boolean }) {
  return <p className="agent-eyebrow" style={{ margin: noMargin ? 0 : "0 0 10px" }}>{children}</p>;
}

function Divider() {
  return <div style={{ height: 1, background: "var(--agent-border-strong)", margin: "18px 0" }} aria-hidden />;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ width: 58, flexShrink: 0, color: "#6b7280" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word" }}>{children}</span>
    </div>
  );
}

// Restyle the email HTML for on-screen preview only: white page + the fixed
// 560px inbox card made fluid, so it fills the drawer instead of sitting thin.
// The real send is untouched — this only affects what renders in the iframe.
// Our templates wrap the body in <table width="560"> on a grey page, so
// overriding those two things is all it takes. Injected into <head> to win.
function previewSrcDoc(html: string): string {
  const css = '<style>html,body{background:#ffffff!important;margin:0!important;}table[width="560"]{width:100%!important;}</style>';
  return html.includes("</head>") ? html.replace("</head>", css + "</head>") : css + html;
}

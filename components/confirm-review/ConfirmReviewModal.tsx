"use client";

// Review modal — opened from the ConfirmReviewTray pill. Groups queued
// milestone-confirmation emails by recipient, lets the agent edit each
// body inline, cancel per recipient (or all), or send now.
//
// One tab per recipient (usually vendor + purchaser). Each tab shows
// the composed subject + body that will land in that inbox. Editing
// calls updateEmailPayload from app/actions/automation.ts (which was
// widened in commit A to accept MILESTONE_CONFIRMATION).
//
// Send now → drainMilestoneDigestsForFile flushes the whole batch
// immediately (digest-assembles per-recipient when N>=2).
// Cancel all → cancelPendingConfirmEmails deletes queued rows silently.

import { useEffect, useMemo, useState, useTransition } from "react";
import { X, PaperPlaneTilt, Trash, PencilSimple, Check } from "@phosphor-icons/react/dist/ssr";
import {
  cancelPendingConfirmEmails,
  sendPendingConfirmEmailsNow,
  type PendingQueueItem,
} from "@/app/actions/confirm-review-queue";
import { updateEmailPayload } from "@/app/actions/automation";

type Props = {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  items: PendingQueueItem[];
  loading: boolean;
  /** Called after any mutation so the tray + list refresh. */
  onChange: () => void;
};

type RecipientGroup = {
  contactId: string;
  name: string;
  role: string; // "vendor" | "purchaser"
  email: string;
  items: PendingQueueItem[];
};

function groupByRecipient(items: PendingQueueItem[]): RecipientGroup[] {
  const map = new Map<string, RecipientGroup>();
  for (const it of items) {
    let g = map.get(it.recipientContactId);
    if (!g) {
      g = {
        contactId: it.recipientContactId,
        name: it.recipientName ?? it.recipientEmail,
        role: it.recipientRole ?? "recipient",
        email: it.recipientEmail,
        items: [],
      };
      map.set(it.recipientContactId, g);
    }
    g.items.push(it);
  }
  // Vendor first, then purchaser, then others.
  return Array.from(map.values()).sort((a, b) => {
    const rank = (r: string) => (r === "vendor" ? 0 : r === "purchaser" ? 1 : 2);
    return rank(a.role) - rank(b.role);
  });
}

export function ConfirmReviewModal({ open, onClose, transactionId, items, loading, onChange }: Props) {
  const groups = useMemo(() => groupByRecipient(items), [items]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<"all" | string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Reset the tab if the active recipient's items all get removed while open.
  useEffect(() => {
    if (activeIdx >= groups.length) setActiveIdx(Math.max(0, groups.length - 1));
  }, [groups.length, activeIdx]);

  const activeGroup = groups[activeIdx];

  function handleSendNow() {
    setError(null);
    startTransition(async () => {
      const res = await sendPendingConfirmEmailsNow({ transactionId });
      if (res.ok) {
        onChange();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  function handleCancelAll() {
    setError(null);
    startTransition(async () => {
      const res = await cancelPendingConfirmEmails({ transactionId });
      if (res.ok) {
        onChange();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  function handleCancelRecipient(group: RecipientGroup) {
    setError(null);
    const ids = group.items.map((i) => i.id);
    startTransition(async () => {
      const res = await cancelPendingConfirmEmails({ transactionId, emailIds: ids });
      if (res.ok) {
        onChange();
        setConfirmingCancel(null);
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 60,
          background: "rgba(15, 23, 42, 0.35)",
        }}
      />
      <div
        role="dialog"
        aria-label="Review outgoing client updates"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 61,
          width: "min(720px, calc(100vw - 32px))",
          maxHeight: "calc(100vh - 64px)",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.20)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <header style={{
          padding: "16px 20px",
          borderBottom: "0.5px solid rgba(15, 23, 42, 0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Client updates
            </p>
            <h2 style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              Review before send
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 32, height: 32, borderRadius: 10,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "0.5px solid rgba(15, 23, 42, 0.10)",
              background: "#fff", color: "#64748b", cursor: "pointer",
            }}
          >
            <X size={14} weight="bold" />
          </button>
        </header>

        {/* Recipient tabs */}
        {groups.length > 1 && (
          <div style={{
            display: "flex",
            padding: "0 20px",
            borderBottom: "0.5px solid rgba(15, 23, 42, 0.08)",
            gap: 4,
          }}>
            {groups.map((g, i) => (
              <button
                key={g.contactId}
                type="button"
                onClick={() => setActiveIdx(i)}
                style={{
                  padding: "10px 14px",
                  background: "transparent",
                  border: "none",
                  borderBottom: i === activeIdx ? "2px solid #5b8cff" : "2px solid transparent",
                  fontSize: 13,
                  fontWeight: 600,
                  color: i === activeIdx ? "#0f172a" : "#64748b",
                  cursor: "pointer",
                  transition: "color 120ms ease",
                  marginBottom: -1,
                }}
              >
                {g.name}
                <span style={{
                  marginLeft: 6,
                  fontSize: 10,
                  padding: "2px 6px",
                  borderRadius: 999,
                  background: i === activeIdx ? "rgba(91,140,255,0.14)" : "rgba(15,23,42,0.06)",
                  color: i === activeIdx ? "#5b8cff" : "#64748b",
                  fontWeight: 700,
                }}>
                  {g.items.length}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>
          {loading && items.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "40px 0" }}>Loading…</p>
          ) : items.length === 0 ? (
            <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "40px 0" }}>
              Nothing queued right now.
            </p>
          ) : activeGroup ? (
            <RecipientBody
              key={activeGroup.contactId}
              group={activeGroup}
              onEdited={onChange}
              onCancelRecipient={() => setConfirmingCancel(activeGroup.contactId)}
            />
          ) : null}

          {error && (
            <p style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: 12 }}>
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <footer style={{
          padding: "12px 20px",
          borderTop: "0.5px solid rgba(15, 23, 42, 0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          background: "#fbfbfc",
        }}>
          <button
            type="button"
            onClick={() => setConfirmingCancel("all")}
            disabled={busy || items.length === 0}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 10,
              border: "0.5px solid rgba(15, 23, 42, 0.10)",
              background: "#fff",
              color: "#991b1b",
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              opacity: items.length === 0 ? 0.5 : 1,
              display: "inline-flex", alignItems: "center", gap: 6,
            }}
          >
            <Trash size={12} weight="regular" />
            Cancel this batch
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 10,
                border: "0.5px solid rgba(15, 23, 42, 0.10)",
                background: "#fff",
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              Keep queued
            </button>
            <button
              type="button"
              onClick={handleSendNow}
              disabled={busy || items.length === 0}
              style={{
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 10,
                border: "none",
                background: "#5b8cff",
                color: "#fff",
                cursor: busy || items.length === 0 ? "wait" : "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
                opacity: items.length === 0 ? 0.5 : 1,
              }}
            >
              <PaperPlaneTilt size={12} weight="regular" />
              {busy ? "Sending…" : "Send now"}
            </button>
          </div>
        </footer>
      </div>

      {/* Cancel confirmations */}
      {confirmingCancel !== null && (
        <ConfirmCancelDialog
          scope={confirmingCancel === "all" ? "all" : "recipient"}
          recipientName={
            confirmingCancel !== "all"
              ? groups.find((g) => g.contactId === confirmingCancel)?.name ?? ""
              : ""
          }
          busy={busy}
          onCancel={() => setConfirmingCancel(null)}
          onConfirm={() => {
            if (confirmingCancel === "all") handleCancelAll();
            else {
              const g = groups.find((gg) => gg.contactId === confirmingCancel);
              if (g) handleCancelRecipient(g);
            }
          }}
        />
      )}
    </>
  );
}

// ─── Per-recipient body (editable subject + text) ────────────────────
function RecipientBody({
  group, onEdited, onCancelRecipient,
}: {
  group: RecipientGroup;
  onEdited: () => void;
  onCancelRecipient: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        padding: "10px 12px",
        borderRadius: 10,
        background: "#f8fafc",
        border: "0.5px solid rgba(15, 23, 42, 0.06)",
        fontSize: 11,
        color: "#64748b",
      }}>
        Will go to <strong style={{ color: "#0f172a" }}>{group.email}</strong>
        {group.items.length > 1 && (
          <> — combined into one digest email covering {group.items.length} confirmations.</>
        )}
      </div>

      {group.items.map((item) => (
        <EditableEmailCard key={item.id} item={item} onEdited={onEdited} />
      ))}

      <button
        type="button"
        onClick={onCancelRecipient}
        style={{
          alignSelf: "flex-start",
          padding: "6px 12px",
          fontSize: 11,
          fontWeight: 500,
          borderRadius: 999,
          border: "0.5px solid rgba(15, 23, 42, 0.10)",
          background: "#fff",
          color: "#991b1b",
          cursor: "pointer",
        }}
      >
        Don&apos;t send to {group.name}
      </button>
    </div>
  );
}

// ─── Single email — subject + text with inline edit ─────────────────
function EditableEmailCard({
  item, onEdited,
}: {
  item: PendingQueueItem;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(item.subject);
  const [text, setText]       = useState(item.bodyText);
  const [busy, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setSubject(item.subject);
      setText(item.bodyText);
    }
  }, [editing, item]);

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await updateEmailPayload(item.id, { subject, text });
      if (res.ok) {
        setEditing(false);
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
        onEdited();
      } else {
        setErr(res.error ?? "Couldn't save");
      }
    });
  }

  return (
    <article style={{
      border: "0.5px solid rgba(15, 23, 42, 0.10)",
      borderRadius: 12,
      background: "#fff",
      overflow: "hidden",
    }}>
      <header style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: "0.5px solid rgba(15, 23, 42, 0.06)",
        background: "#f8fafc",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {item.milestoneCode}
          {item.editedAt && <span style={{ marginLeft: 6, color: "#64748b", fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>· edited</span>}
        </span>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 999,
              border: "0.5px solid rgba(15, 23, 42, 0.12)",
              background: "#fff",
              color: "#5b8cff",
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            <PencilSimple size={10} weight="bold" />
            Edit
          </button>
        ) : (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={busy}
              style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 500,
                borderRadius: 999, border: "0.5px solid rgba(15,23,42,0.12)",
                background: "#fff", color: "#64748b", cursor: "pointer",
              }}
            >Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={busy || !subject.trim() || !text.trim()}
              style={{
                padding: "4px 10px", fontSize: 11, fontWeight: 600,
                borderRadius: 999, border: "none",
                background: "#5b8cff", color: "#fff", cursor: "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >{busy ? "Saving…" : "Save"}</button>
          </span>
        )}
        {saved && !editing && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#047857", marginLeft: 8 }}>
            <Check size={11} weight="bold" /> Saved
          </span>
        )}
      </header>

      <div style={{ padding: "12px 14px" }}>
        {editing ? (
          <>
            <label style={{ display: "block", marginBottom: 8 }}>
              <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{
                  width: "100%", padding: "8px 10px", fontSize: 13,
                  borderRadius: 8, border: "0.5px solid rgba(15,23,42,0.15)",
                  background: "#fff", outline: "none",
                }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748b", marginBottom: 3 }}>Body</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                style={{
                  width: "100%", padding: "8px 10px", fontSize: 13,
                  borderRadius: 8, border: "0.5px solid rgba(15,23,42,0.15)",
                  background: "#fff", outline: "none", resize: "vertical",
                  fontFamily: "inherit", lineHeight: 1.5,
                }}
              />
            </label>
            {err && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#991b1b" }}>{err}</p>}
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{item.subject}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{item.bodyText}</p>
          </>
        )}
      </div>
    </article>
  );
}

// ─── Cancel confirm dialog ──────────────────────────────────────────
function ConfirmCancelDialog({
  scope, recipientName, busy, onCancel, onConfirm,
}: {
  scope: "all" | "recipient";
  recipientName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 70,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 14,
          maxWidth: 400, width: "100%",
          padding: "18px 20px 16px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
          {scope === "all" ? "Cancel all queued client updates?" : `Don't send to ${recipientName}?`}
        </h3>
        <p style={{ margin: "6px 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          The milestone confirmations stay on the file. Only the client email{scope === "all" ? "s" : ""} will not go out.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: "8px 14px", fontSize: 12, fontWeight: 500,
              borderRadius: 10, border: "0.5px solid rgba(15,23,42,0.12)",
              background: "#fff", color: "#0f172a", cursor: "pointer",
            }}
          >Keep queued</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: "8px 14px", fontSize: 12, fontWeight: 600,
              borderRadius: 10, border: "none",
              background: "#991b1b", color: "#fff", cursor: "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >{busy ? "…" : (scope === "all" ? "Cancel batch" : "Don't send")}</button>
        </div>
      </div>
    </div>
  );
}

"use client";

// Review modal — opened from the ConfirmReviewTray pill. Groups queued
// milestone-confirmation emails by recipient, one tab per recipient.
//
// What each tab shows is what will ACTUALLY land in that inbox
// (2026-08-11):
//   • 1 pending row  → the single email, editable inline
//     (updateEmailPayload).
//   • 2+ pending rows → the MERGED digest email the drain will send,
//     with per-bullet remove (cancels just that update's rows) and
//     whole-body edit (updateDigestForRecipient). The old view showed
//     each queued row as if it were a separate email, which misled
//     agents about both what sends and what "Don't send" removes.
//
// Send now → drainMilestoneDigestsForFile flushes the whole batch
// immediately (digest-assembles per-recipient when N>=2).
// Cancel all → cancelPendingConfirmEmails deletes queued rows silently.

import { useEffect, useMemo, useState, useTransition } from "react";
import { X, PaperPlaneTilt, Trash, PencilSimple, Check } from "@phosphor-icons/react/dist/ssr";
import {
  cancelPendingConfirmEmails,
  sendPendingConfirmEmailsNow,
  updateDigestForRecipient,
  type PendingQueueItem,
  type RecipientDigest,
} from "@/app/actions/confirm-review-queue";
import { updateEmailPayload } from "@/app/actions/automation";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";

type Props = {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  items: PendingQueueItem[];
  /** Merged-email previews for recipients with 2+ queued rows. Optional
   *  so mock consumers (dev gallery) keep working; without it those
   *  recipients fall back to per-row cards. */
  digests?: RecipientDigest[];
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

export function ConfirmReviewModal({ open, onClose, transactionId, items, digests, loading, onChange }: Props) {
  const { theme, isNight } = usePortalTheme();
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
          // Above the sticky agent topbar (z:101). Previously zIndex:60,
          // which meant the topbar covered the modal header. Fixed 2026-08-09.
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(15, 23, 42, 0.35)",
        }}
      />
      <div
        role="dialog"
        aria-label="Review outgoing client updates"
        data-theme={theme} data-night={isNight ? "" : undefined}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1001,
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
        {/* Header — Ribbon coral band */}
        <header style={{
          ...SHEET_BAND_STYLE,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <SheetBandHeader kicker="Client updates" title="Review before send" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 32, height: 32, borderRadius: 10,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "none",
              background: "transparent", color: "rgba(255,255,255,0.85)", cursor: "pointer",
              transition: "background 150ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.18)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
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
              digest={digests?.find((d) => d.recipientContactId === activeGroup.contactId) ?? null}
              transactionId={transactionId}
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
          updateCount={
            confirmingCancel === "all"
              ? items.length
              : groups.find((g) => g.contactId === confirmingCancel)?.items.length ?? 0
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

// ─── Per-recipient body ──────────────────────────────────────────────
// 2+ queued rows sends as ONE merged email, so that's what we preview
// (DigestEmailCard). A single queued row previews + edits the single
// email as before. Fallback: if the merged preview couldn't be
// assembled server-side, show the per-row cards with a note.
function RecipientBody({
  group, digest, transactionId, onEdited, onCancelRecipient,
}: {
  group: RecipientGroup;
  digest: RecipientDigest | null;
  transactionId: string;
  onEdited: () => void;
  onCancelRecipient: () => void;
}) {
  const merged = group.items.length > 1 && digest !== null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {merged ? (
        <DigestEmailCard
          digest={digest}
          recipientEmail={group.email}
          updateCount={group.items.length}
          transactionId={transactionId}
          onEdited={onEdited}
        />
      ) : (
        <>
          {group.items.length > 1 && (
            <div style={{
              padding: "8px 12px",
              borderRadius: 10,
              background: "#f8fafc",
              border: "0.5px solid rgba(15, 23, 42, 0.06)",
              fontSize: 11,
              color: "#64748b",
            }}>
              These will be combined into one email covering {group.items.length} updates.
            </div>
          )}
          {group.items.map((item) => (
            <EditableEmailCard key={item.id} item={item} onEdited={onEdited} />
          ))}
        </>
      )}

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

// ─── Merged email — the ONE digest email a 2+-row recipient receives ─
// View mode renders subject + section bullets, each bullet with a
// two-step Remove (cancels the queue rows behind that bullet; a
// collapsed pair's bullet removes both rows). Edit mode edits the whole
// merged body; the saved version sends exactly as written. Removing a
// bullet after an edit reverts to the auto-composed version (the server
// clears the edit so it can't mention a removed update).
function DigestEmailCard({
  digest, recipientEmail, updateCount, transactionId, onEdited,
}: {
  digest: RecipientDigest;
  recipientEmail: string;
  updateCount: number;
  transactionId: string;
  onEdited: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(digest.subject);
  const [text, setText]       = useState(digest.bodyText);
  const [busy, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Two-step remove: first click arms the bullet, second confirms.
  const [armedRemove, setArmedRemove] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) {
      setSubject(digest.subject);
      setText(digest.bodyText);
    }
  }, [editing, digest]);

  function save() {
    setErr(null);
    startTransition(async () => {
      const res = await updateDigestForRecipient({
        transactionId,
        recipientContactId: digest.recipientContactId,
        subject,
        bodyText: text,
      });
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

  function removeBullet(emailIds: string[]) {
    setErr(null);
    startTransition(async () => {
      const res = await cancelPendingConfirmEmails({ transactionId, emailIds });
      if (res.ok) {
        setArmedRemove(null);
        onEdited();
      } else {
        setErr(res.error);
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
        gap: 8,
      }}>
        <span style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {recipientEmail}
            {digest.overridden && <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b", fontWeight: 500 }}>· edited</span>}
          </span>
          <span style={{ fontSize: 10, color: "#64748b" }}>
            Sends as one email covering {updateCount} updates
          </span>
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
              flexShrink: 0,
            }}
          >
            <PencilSimple size={10} weight="bold" />
            Edit
          </button>
        ) : (
          <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "#047857", flexShrink: 0 }}>
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
                rows={10}
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
        ) : digest.overridden ? (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{digest.subject}</p>
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "#334155", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{digest.bodyText}</p>
            <p style={{ margin: "10px 0 0", fontSize: 11, color: "#64748b" }}>
              Edited version. Sends exactly as written.
            </p>
            {err && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#991b1b" }}>{err}</p>}
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{digest.subject}</p>
            {digest.sections.map((section) => (
              <div key={section.heading} style={{ marginTop: 10 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "#334155" }}>{section.heading}</p>
                <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                  {section.bullets.map((bullet) => {
                    const key = bullet.emailIds.join(",");
                    const armed = armedRemove === key;
                    return (
                      <li
                        key={key}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                          padding: "6px 10px", borderRadius: 8,
                          background: armed ? "#fef2f2" : "#f8fafc",
                          border: `0.5px solid ${armed ? "rgba(153,27,27,0.25)" : "rgba(15,23,42,0.06)"}`,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "#334155", lineHeight: 1.5 }}>{bullet.line}</span>
                        {armed ? (
                          <span style={{ display: "inline-flex", gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => setArmedRemove(null)}
                              disabled={busy}
                              style={{
                                padding: "3px 9px", fontSize: 11, fontWeight: 500,
                                borderRadius: 999, border: "0.5px solid rgba(15,23,42,0.12)",
                                background: "#fff", color: "#64748b", cursor: "pointer",
                              }}
                            >Keep</button>
                            <button
                              type="button"
                              onClick={() => removeBullet(bullet.emailIds)}
                              disabled={busy}
                              style={{
                                padding: "3px 9px", fontSize: 11, fontWeight: 600,
                                borderRadius: 999, border: "none",
                                background: "#991b1b", color: "#fff", cursor: "pointer",
                                opacity: busy ? 0.6 : 1,
                              }}
                            >{busy ? "…" : "Remove"}</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setArmedRemove(key)}
                            aria-label={`Remove this update: ${bullet.line}`}
                            style={{
                              padding: "3px 9px", fontSize: 11, fontWeight: 500,
                              borderRadius: 999, border: "0.5px solid rgba(15,23,42,0.10)",
                              background: "#fff", color: "#991b1b", cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >Remove</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {err && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#991b1b" }}>{err}</p>}
          </>
        )}
      </div>
    </article>
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
        <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {item.recipientEmail}
          {item.editedAt && <span style={{ marginLeft: 6, fontSize: 11, color: "#64748b", fontWeight: 500 }}>· edited</span>}
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
  scope, recipientName, updateCount, busy, onCancel, onConfirm,
}: {
  scope: "all" | "recipient";
  recipientName: string;
  updateCount: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { theme, isNight } = usePortalTheme();
  return (
    <div
      onClick={onCancel}
      data-theme={theme} data-night={isNight ? "" : undefined}
      style={{
        // Nested confirm above the review modal (1001). 2026-08-09.
        position: "fixed", inset: 0, zIndex: 1010,
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
          overflow: "hidden",
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header — Ribbon coral band */}
        <div style={{ ...SHEET_BAND_STYLE }}>
          <SheetBandHeader
            kicker="Cancel updates"
            title={scope === "all" ? "Cancel all queued client updates?" : `Don't send to ${recipientName}?`}
          />
        </div>
        <div style={{ padding: "16px 20px" }}>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
          {scope === "all"
            ? `This stops all ${updateCount} queued update${updateCount === 1 ? "" : "s"} across every recipient.`
            : `This stops ${updateCount === 1 ? "the 1 update" : `all ${updateCount} updates`} queued for ${recipientName}.`}
          {" "}The milestone confirmations stay on the file.
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
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { formatDate, formatTimestamp } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";
import { deleteCommAction, editCommAction } from "@/app/actions/comms";
import { extractFirstName } from "@/lib/contacts/displayName";
import { getCommBadge, AuthorPill } from "@/lib/agent/comms-display";
import { stripCommsLinksForAgent } from "@/lib/utils/strip-comms-links";
import { GlassCard } from "@/components/glass/GlassCard";

type Props = {
  entries: ActivityEntry[];
  transactionId: string;
  mosDocUrl?: string | null;
  beforeEntries?: React.ReactNode;
  currentUserId?: string;
  // Contact list for the inline edit form's contact picker. Optional —
  // when omitted (e.g. global comms surfaces that don't pass contacts),
  // edit is disabled.
  contacts?: { id: string; name: string }[];
  // Solicitor contacts that can ALSO be attached to a comm. CommsEntry
  // (the create form) lets the agent toggle solicitors as a second pill
  // row; the edit form needs the same surface so an existing comm can
  // add/remove solicitors after the fact. When omitted, the edit form
  // only renders the contacts row (matches the pre-fix behaviour).
  solicitors?: { id: string; name: string; role: string }[];
};

const MOS_CODES = new Set(["VM2", "PM2"]);

type FilterKind = "all" | "milestones" | "comms" | "automated" | "notes";

const FILTERS: { value: FilterKind; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "milestones", label: "Steps" },
  { value: "comms",      label: "Comms" },
  { value: "automated",  label: "Automated" },
  { value: "notes",      label: "Notes" },
];

function isPortalView(entry: { kind: string; content?: string }) {
  return entry.kind === "comm" && typeof entry.content === "string" && entry.content.includes("viewed their client portal");
}

function dotColor(entry: ActivityEntry): string {
  if (entry.kind === "milestone") {
    return entry.isNotRequired ? "rgba(30,45,74,0.22)" : "#10b981";
  }
  if (entry.isAutomated) return "#6366f1";
  const map: Record<string, string> = {
    internal_note: "#d97706",
    outbound: "var(--agent-coral)",
    inbound: "#10b981",
  };
  return map[entry.type] ?? "rgba(30,45,74,0.22)";
}

// `getCommBadge` and `AuthorPill` live in lib/agent/comms-display.tsx so the
// ArchivedRoundDrawer can reuse the same channel-badge + author-pill rendering.

// ─── Contact pill ─────────────────────────────────────────────────────────────

function ContactPill({ name }: { name: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 500, padding: "1px 7px", borderRadius: 10,
      background: "rgba(15,23,42,0.06)", color: "var(--agent-text-muted)",
    }}>
      {extractFirstName(name)}
    </span>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function ActivityTimeline({ entries, transactionId, mosDocUrl, beforeEntries, currentUserId, contacts, solicitors }: Props) {
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exitingId, setExitingId]   = useState<string | null>(null);
  // Inline edit state. editingId names the entry being edited; editDraft
  // holds the form values. Optimistic local overrides keep edits visible
  // before the server revalidate lands.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ content: string; contactIds: string[]; visibleToClient: boolean } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, { content: string; contactIds: string[]; visibleToClient: boolean; wasEdited: true }>>({});
  // Optimistic delete: after the fade-out animation, drop the entry from
  // the rendered list immediately rather than waiting for the server-side
  // revalidate to bring fresh entries back. Reset when the prop entries
  // refresh (server data caught up).
  const [locallyRemovedIds, setLocallyRemovedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setLocallyRemovedIds(new Set());
    // Drop optimistic edits once the server-side revalidate has caught up.
    setLocalEdits({});
  }, [entries]);
  // Auto-animate the entry list — siblings collapse smoothly when an
  // entry is removed (delete) or when filter/search shrinks the set.
  const [listRef] = useAutoAnimate<HTMLDivElement>();
  const [showAll, setShowAll]       = useState(false);
  const [filter, setFilter]         = useState<FilterKind>("all");
  const [search, setSearch]         = useState("");
  const [showPortalVisits, setShowPortalVisits] = useState(false);
  const [entriesKey, setEntriesKey] = useState(0);

  const portalViewCount = entries.filter(isPortalView).length;

  function handleFilter(f: FilterKind) {
    setFilter(f); setShowAll(false); setEntriesKey((k) => k + 1);
  }
  function handleSearch(q: string) {
    setSearch(q); setShowAll(false); setEntriesKey((k) => k + 1);
  }

  const filtered = entries.filter((entry) => {
    // Skip entries the user just deleted (server roundtrip in flight).
    if (locallyRemovedIds.has(entry.id)) return false;
    if (!showPortalVisits && isPortalView(entry)) return false;
    if (filter === "milestones" && entry.kind !== "milestone") return false;
    if (filter === "comms"      && (entry.kind !== "comm" || entry.type === "internal_note" || entry.isAutomated)) return false;
    if (filter === "automated"  && (entry.kind !== "comm" || !entry.isAutomated)) return false;
    if (filter === "notes"      && (entry.kind !== "comm" || entry.type !== "internal_note")) return false;

    if (search) {
      const q = search.toLowerCase();
      if (entry.kind === "milestone") {
        return entry.milestoneName?.toLowerCase().includes(q) || (entry.summaryText?.toLowerCase().includes(q) ?? false);
      }
      return entry.content?.toLowerCase().includes(q) || entry.contactNames?.some((n) => n.toLowerCase().includes(q));
    }
    return true;
  });

  const visible = showAll ? filtered : filtered.slice(0, 10);
  const hasMore = filtered.length > 10;

  function startEdit(entry: Extract<ActivityEntry, { kind: "comm" }>) {
    const override = localEdits[entry.id];
    setEditingId(entry.id);
    setEditDraft({
      content: override?.content ?? entry.content,
      contactIds: override?.contactIds ?? entry.contactIds,
      visibleToClient: override?.visibleToClient ?? entry.visibleToClient,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function saveEdit(id: string) {
    if (!editDraft) return;
    const trimmed = editDraft.content.trim();
    if (!trimmed) return;
    const payload = { content: trimmed, contactIds: editDraft.contactIds, visibleToClient: editDraft.visibleToClient };
    // Optimistic — render the new content immediately, clear when revalidate lands.
    setLocalEdits((prev) => ({ ...prev, [id]: { ...payload, wasEdited: true } }));
    setEditingId(null);
    setEditDraft(null);
    setSavingId(id);
    startTransition(async () => {
      try {
        await editCommAction({ id, transactionId, ...payload });
      } catch {
        // Roll back the optimistic edit on failure.
        setLocalEdits((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } finally {
        setSavingId((cur) => (cur === id ? null : cur));
      }
    });
  }

  function toggleEditContact(contactId: string) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const has = prev.contactIds.includes(contactId);
      return {
        ...prev,
        contactIds: has ? prev.contactIds.filter((cid) => cid !== contactId) : [...prev.contactIds, contactId],
      };
    });
  }

  function deleteComm(id: string) {
    setExitingId(id);
    setTimeout(() => {
      // Remove from local view immediately so the entry disappears even
      // before the server-side revalidate brings fresh entries back.
      // auto-animate on the list container handles the collapse.
      setLocallyRemovedIds((prev) => new Set([...prev, id]));
      setDeletingId(id);
      startTransition(async () => {
        try { await deleteCommAction(id, transactionId); }
        finally { setDeletingId(null); setExitingId(null); }
      });
    }, 150);
  }

  if (entries.length === 0) {
    return (
      <div>
        {beforeEntries && <div className="mb-3">{beforeEntries}</div>}
        <div className="text-center py-8 agent-empty-card" style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
          No activity yet — milestone confirmations and communications will appear here.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilter(f.value)}
            className={`agent-segment-pill agent-segment-pill-sm${filter === f.value ? " on" : ""}`}
          >
            {f.label}
          </button>
        ))}
        {portalViewCount > 0 && (
          <button
            onClick={() => { setShowPortalVisits((v) => !v); setShowAll(false); setEntriesKey((k) => k + 1); }}
            className={`agent-segment-pill agent-segment-pill-sm${showPortalVisits ? " on" : ""}`}
          >
            Portal visits {showPortalVisits ? "" : `(${portalViewCount} hidden)`}
          </button>
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search…"
          className="glass-input agent-focus ml-auto px-3 py-1.5 rounded-lg text-slate-900/70 flex-1 min-w-[140px]"
          style={{ fontSize: 12 }}
        />
      </div>

      {beforeEntries && <div className="mb-3">{beforeEntries}</div>}

      {filtered.length === 0 ? (
        <div className="text-center py-8" style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
          No entries match.
        </div>
      ) : (
        <div key={entriesKey} className="relative agent-reveal-in">
          {/* Vertical line */}
          <div className="absolute top-2 bottom-2 w-px" style={{ left: 3, background: "var(--agent-border-default)" }} />

          <div ref={listRef} className="space-y-2">
            {visible.map((entry, idx) => (
              <div
                key={entry.id}
                className={`relative flex gap-3 ${exitingId === entry.id ? "agent-row-exit" : ""} ${showAll && idx >= 10 ? "agent-reveal-in" : ""}`}
              >
                {/* Coloured dot */}
                <div className="flex-shrink-0 z-10 mt-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: dotColor(entry) }} />
                </div>

                {/* Card */}
                <div className="flex-1 min-w-0">
                  {entry.kind === "milestone" ? (
                    // ── Milestone card ──────────────────────────────────────
                    // Design Lab: `activity-timeline-entry` (shared with comm
                    // rows below so one pick styles the whole timeline).
                    // Default v05 per Ellis, 2026-08-09. Surface (bg/border)
                    // comes from the variant; padding/radius stay inline.
                    <GlassCard glassId="activity-timeline-entry" label="Activity · Timeline entries" defaultVariant="v05" style={{ padding: "10px 14px", borderRadius: 10 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div className="min-w-0">
                          <div style={{ marginBottom: 4 }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                              background: entry.isNotRequired ? "var(--agent-surface-glass)" : "rgba(16,185,129,0.1)",
                              color: entry.isNotRequired ? "var(--agent-text-muted)" : "#059669",
                            }}>
                              {entry.isNotRequired ? "Skipped" : entry.confirmedByClient ? "Confirmed by client" : "Step confirmed"}
                            </span>
                          </div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>
                            {entry.summaryText ?? entry.milestoneName}
                          </p>
                          <p style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 4 }}>
                            {entry.confirmedByClient && entry.confirmerName
                              ? `${entry.confirmerName} via portal · ${formatDate(entry.at)}`
                              : entry.confirmedByClient
                              ? `Client via portal · ${formatDate(entry.at)}`
                              : `${entry.completedByName ? extractFirstName(entry.completedByName) : "Auto-confirmed"} · ${formatDate(entry.at)}`}
                          </p>
                        </div>
                        {mosDocUrl && MOS_CODES.has(entry.milestoneCode) && !entry.isNotRequired && (
                          <a
                            href={mosDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1 transition-colors whitespace-nowrap"
                            style={{ fontSize: 11, fontWeight: 500, color: "#3b82f6" }}
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Memo
                          </a>
                        )}
                      </div>
                    </GlassCard>
                  ) : (
                    // ── Comm card ───────────────────────────────────────────
                    (() => {
                      const badge = getCommBadge(entry);
                      // Apply any optimistic local edit so the row reflects
                      // the save immediately even before the revalidate.
                      const override = localEdits[entry.id];
                      const displayContent = override?.content ?? entry.content;
                      const displayContactIds = override?.contactIds ?? entry.contactIds;
                      const displayContactNames = override
                        ? (displayContactIds
                            .map((cid) => contacts?.find((c) => c.id === cid)?.name)
                            .filter(Boolean) as string[])
                        : entry.contactNames;
                      const isEdited = override?.wasEdited || entry.wasEdited;
                      const isEditing = editingId === entry.id;
                      // Edit is available to anyone in scope (server
                      // enforces) but only for manual entries — automated
                      // emails go through the queue's pre-send edit modal,
                      // not this surface. Optimistic entries (id starts
                      // "optimistic-") aren't editable until they get a
                      // real id from the server.
                      const canEdit = !entry.isAutomated
                        && !entry.id.startsWith("optimistic-")
                        && contacts !== undefined;
                      return (
                        // Design Lab: `activity-timeline-entry` (shared with
                        // milestone rows above). Default v05, 2026-08-09.
                        <GlassCard
                          glassId="activity-timeline-entry"
                          label="Activity · Timeline entries"
                          defaultVariant="v05"
                          className="relative group"
                          style={{ padding: "10px 14px", borderRadius: 10 }}
                        >
                          {/* Top row: badge + contact pills */}
                          <div style={{ display: "flex", gap: 5, marginBottom: 5, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
                              background: badge.bg, color: badge.color,
                              display: "inline-flex", alignItems: "center", gap: 4,
                            }}>
                              <span>{badge.icon}</span>
                              {badge.label}
                            </span>
                            {!isEditing && displayContactNames.map((name) => (
                              <ContactPill key={name} name={name} />
                            ))}
                          </div>

                          {/* Content — either static paragraph or editable form */}
                          {isEditing && editDraft && contacts ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <textarea
                                value={editDraft.content}
                                onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })}
                                rows={Math.max(3, Math.min(10, editDraft.content.split("\n").length + 1))}
                                className="glass-input w-full px-3 py-2.5 text-sm resize-none"
                                autoFocus
                              />
                              {/* Bottom row — pills + visibility on the left, Cancel/Save on the right */}
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  {/* Contact + solicitor pickers — mirror the CommsEntry
                                    * create form so existing comms can have either kind
                                    * added or removed after the fact. contactIds carries
                                    * both vendor/purchaser IDs and solicitor IDs; the
                                    * picker toggles either by ID using the same handler. */}
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {contacts.map((c) => {
                                      const on = editDraft.contactIds.includes(c.id);
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => toggleEditContact(c.id)}
                                          style={{
                                            fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 10,
                                            background: on ? "rgba(255,107,74,0.15)" : "rgba(15,23,42,0.04)",
                                            color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                                            border: on ? "0.5px solid var(--agent-coral)" : "0.5px solid transparent",
                                            cursor: "pointer",
                                          }}
                                        >
                                          {extractFirstName(c.name)}
                                        </button>
                                      );
                                    })}
                                    {(solicitors ?? []).map((s) => {
                                      const on = editDraft.contactIds.includes(s.id);
                                      return (
                                        <button
                                          key={s.id}
                                          type="button"
                                          onClick={() => toggleEditContact(s.id)}
                                          title={s.role}
                                          style={{
                                            fontSize: 10, fontWeight: 500, padding: "2px 8px", borderRadius: 10,
                                            background: on ? "rgba(255,107,74,0.15)" : "rgba(15,23,42,0.04)",
                                            color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                                            border: on ? "0.5px solid var(--agent-coral)" : "0.5px solid transparent",
                                            cursor: "pointer",
                                          }}
                                        >
                                          {s.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {/* Visibility checkbox — same minimal styling as the create form's label */}
                                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--agent-text-muted)", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={editDraft.visibleToClient}
                                      onChange={(e) => setEditDraft({ ...editDraft, visibleToClient: e.target.checked })}
                                    />
                                    Visible in client portal
                                  </label>
                                </div>
                                {/* Cancel left of Save; both on the right edge */}
                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="agent-btn agent-btn-sm agent-btn-secondary"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(entry.id)}
                                    disabled={!editDraft.content.trim() || savingId === entry.id}
                                    className="agent-btn agent-btn-sm agent-btn-primary"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (() => {
                            // Automated system emails have portal deep-links + an
                            // unsubscribe URL baked into their content. Hide the
                            // raw URLs; surface the portal deep-link as a small
                            // clickable pill so the agent can still open the
                            // client's response page in a new tab.
                            const stripped = entry.isAutomated
                              ? stripCommsLinksForAgent(displayContent)
                              : { text: displayContent, portalLinks: [] };
                            return (
                              <>
                                <p style={{ fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                                  {stripped.text}
                                </p>
                                {stripped.portalLinks.length > 0 && (
                                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {stripped.portalLinks.map((url) => (
                                      <a
                                        key={url}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: "var(--agent-coral-deep)",
                                          padding: "3px 8px",
                                          borderRadius: 6,
                                          border: "0.5px solid var(--agent-border-default)",
                                          background: "var(--agent-surface-glass)",
                                          textDecoration: "none",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: 4,
                                        }}
                                      >
                                        → Open response page
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* Footer: author pill + timestamp + edited indicator */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                            <AuthorPill name={entry.createdByName} role={entry.createdByRole} />
                            <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
                              {formatTimestamp(entry.at)}
                            </span>
                            {isEdited && (
                              <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
                                (edited)
                              </span>
                            )}
                          </div>

                          {/* Action buttons — hidden during edit to keep the form clean */}
                          {!isEditing && (
                            <div
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 2 }}
                            >
                              {canEdit && (
                                <button
                                  onClick={() => startEdit(entry)}
                                  disabled={isPending || savingId === entry.id}
                                  className="agent-icon-btn agent-icon-btn-sm"
                                  aria-label="Edit"
                                  title="Edit"
                                >
                                  ✎
                                </button>
                              )}
                              {(!currentUserId || entry.createdById === currentUserId) && (
                                <button
                                  onClick={() => deleteComm(entry.id)}
                                  disabled={deletingId === entry.id || isPending || exitingId === entry.id}
                                  className="agent-icon-btn agent-icon-btn-sm"
                                  aria-label="Delete"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          )}
                        </GlassCard>
                      );
                    })()
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="pl-5 mt-2">
              <button
                onClick={() => setShowAll(!showAll)}
                className="agent-link agent-link-muted"
                style={{ fontSize: 11 }}
              >
                {showAll ? "Show less" : `Show ${filtered.length - 10} earlier updates…`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useTransition } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { formatTimestamp } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/services/comms";
import { deleteCommAction, editCommAction } from "@/app/actions/comms";
import { extractFirstName } from "@/lib/contacts/displayName";
import { getCommBadge } from "@/lib/agent/comms-display";
import { ActorAvatar, type ActorRole } from "@/components/ui/Avatar";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { stripCommsLinksForAgent } from "@/lib/utils/strip-comms-links";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";

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

// Automated/system rows carry the Sales Progressor brand mark instead of a
// person avatar. The asset is already a circle.
function SystemAvatar({ size = 22 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-icon.png"
      alt="The Sales Progressor"
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size, borderRadius: "50%", flexShrink: 0 }}
    />
  );
}

// Shared row footer: who it's from (photo/initials + name + optional role
// sub-label) on the left, timestamp bottom-right. Used by comm + milestone rows.
function ActorFooter({
  role, name, image, sublabel, at, isEdited, placement = "bottom",
}: { role: ActorRole; name: string; image: string | null; sublabel?: string | null; at: Date | null; isEdited?: boolean; placement?: "top" | "bottom" }) {
  // System rows read as "TSP" (The Sales Progressor), not the internal "System".
  const displayName = role === "system" ? "TSP" : name;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: placement === "bottom" ? 8 : 0, marginBottom: placement === "top" ? 8 : 0, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {role === "system" ? <SystemAvatar /> : <ActorAvatar name={name} role={role} image={image} size={22} />}
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {displayName}
        </span>
        {sublabel && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>· {sublabel}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {isEdited && <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic" }}>(edited)</span>}
        <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{at ? formatTimestamp(at) : ""}</span>
      </div>
    </div>
  );
}

// Renders a WhatsApp attachment inline. url is a short-lived signed URL.
function MediaAttachment({ url, type }: { url: string; type: string | null }) {
  const t = (type ?? "").toLowerCase();
  if (t === "image" || t === "sticker") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="WhatsApp attachment" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 8, border: "0.5px solid var(--agent-border-default)" }} />
      </a>
    );
  }
  if (t === "video") {
    return <video src={url} controls style={{ maxWidth: 260, marginTop: 6, borderRadius: 8, display: "block" }} />;
  }
  if (t === "voice" || t === "audio") {
    return <audio src={url} controls style={{ marginTop: 6, maxWidth: 260, display: "block" }} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
        color: "var(--agent-coral-deep)", padding: "3px 8px", borderRadius: 6,
        border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-glass)", textDecoration: "none",
      }}
    >
      📎 Open attachment
    </a>
  );
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
  // Full name on activity records (Ellis, 2026-09-10) — a recipient pill reads
  // "Hannah Whitfield", not "Hannah". The compact contact PICKER in edit mode
  // still uses first names (extractFirstName) to stay tidy.
  return (
    <Pill glass tone="default" size="sm">
      {name}
    </Pill>
  );
}

// Automated emails lead with a "Subject: …" line. Surface the subject as a bold
// heading (without the "Subject:" prefix) with the body below; leave any other
// content untouched.
function splitSubject(text: string): { subject: string | null; body: string } {
  const nl = text.indexOf("\n");
  const firstLine = (nl === -1 ? text : text.slice(0, nl)).trim();
  const m = firstLine.match(/^subject:\s*(.+)$/i);
  if (!m) return { subject: null, body: text };
  const body = (nl === -1 ? "" : text.slice(nl + 1)).replace(/^\s+/, "");
  return { subject: m[1].trim(), body };
}

// ─── Email threading (Phase C) ─────────────────────────────────────────────────
// Group a synced-email back-and-forth (same conversationId, 2+ messages) into one
// collapsible thread row, so a conversation reads as one item instead of N rows.
// Grouping happens after filtering, so search/filter still work per message.

type CommEntry = Extract<ActivityEntry, { kind: "comm" }>;
type ThreadRow = {
  threadKind: "email-thread";
  id: string;
  at: Date;
  subject: string | null;
  messages: CommEntry[]; // newest first (input list is already time-desc)
};
type Row = ActivityEntry | ThreadRow;

function groupThreads(list: ActivityEntry[]): Row[] {
  const count = new Map<string, number>();
  for (const e of list) {
    if (e.kind === "comm" && e.type === "inbound" && e.conversationId) {
      count.set(e.conversationId, (count.get(e.conversationId) ?? 0) + 1);
    }
  }
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const e of list) {
    const cid = e.kind === "comm" && e.type === "inbound" ? e.conversationId : null;
    if (cid && (count.get(cid) ?? 0) >= 2) {
      if (seen.has(cid)) continue; // already emitted this thread at its latest message
      seen.add(cid);
      const messages = list.filter(
        (x): x is CommEntry => x.kind === "comm" && x.type === "inbound" && x.conversationId === cid,
      );
      rows.push({ threadKind: "email-thread", id: `thread-${cid}`, at: messages[0].at, subject: messages[0].subject, messages });
    } else {
      rows.push(e);
    }
  }
  return rows;
}

function firstLine(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > 100 ? t.slice(0, 100).trimEnd() + "…" : t;
}

const THREAD_LINK_BTN = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)",
} as const;

function EmailThreadCard({
  thread, open, onToggle, expandedBodies, openOriginals, onToggleBody, onToggleOriginal,
}: {
  thread: ThreadRow;
  open: boolean;
  onToggle: () => void;
  expandedBodies: Set<string>;
  openOriginals: Set<string>;
  onToggleBody: (id: string) => void;
  onToggleOriginal: (id: string) => void;
}) {
  const latest = thread.messages[0];
  return (
    <GlassCard glassId="activity-timeline-entry" label="Activity · Timeline entries" defaultVariant="v05" style={{ padding: "10px 14px", borderRadius: 10 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", display: "flex", gap: 8, alignItems: "flex-start" }}
      >
        <ActorAvatar name={latest.actorName} role={latest.actorRole} image={latest.actorImage} size={22} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {thread.subject && (
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>{thread.subject}</p>
          )}
          {!open && (
            <p style={{ fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.45, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {latest.actorName}: {firstLine(splitSubject(latest.content).body)}
            </p>
          )}
        </div>
        <time style={{ flexShrink: 0, fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>{formatTimestamp(latest.at)}</time>
      </button>

      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Pill glass tone="default" size="sm"><span aria-hidden>✉</span> Email</Pill>
        <button type="button" style={THREAD_LINK_BTN} onClick={onToggle}>
          {open ? "Hide thread" : `${thread.messages.length} messages`}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {thread.messages.map((m) => {
            const { body } = splitSubject(m.content);
            const hasOriginal = !!m.rawOriginal;
            const showingOriginal = hasOriginal && openOriginals.has(m.id);
            const shownBody = showingOriginal ? m.rawOriginal! : body;
            const COLLAPSE_AT = 700;
            const isLong = shownBody.length > COLLAPSE_AT;
            const isExpanded = expandedBodies.has(m.id);
            const displayBody = isLong && !isExpanded ? shownBody.slice(0, COLLAPSE_AT).trimEnd() + "…" : shownBody;
            return (
              <div key={m.id} style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <ActorAvatar name={m.actorName} role={m.actorRole} image={m.actorImage} size={18} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{m.actorName}</span>
                  <time style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--agent-text-muted)" }}>{formatTimestamp(m.at)}</time>
                </div>
                <p style={{ fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-line" }}>{displayBody}</p>
                {(isLong || hasOriginal) && (
                  <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {isLong && (
                      <button type="button" style={THREAD_LINK_BTN} onClick={() => onToggleBody(m.id)}>
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                    {hasOriginal && (
                      <button type="button" style={THREAD_LINK_BTN} onClick={() => onToggleOriginal(m.id)}>
                        {showingOriginal ? "Show cleaned" : "Show original"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
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

  // Phase B — per-entry "show more" (long bodies) and "show original" (synced
  // inbound emails: reveal the full untrimmed original vs the cleaned body).
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());
  const [openOriginals, setOpenOriginals] = useState<Set<string>>(new Set());
  // Phase C — which email threads are expanded.
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const onToggleBody = (id: string) => toggleInSet(setExpandedBodies, id);
  const onToggleOriginal = (id: string) => toggleInSet(setOpenOriginals, id);

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

  // Group synced-email conversations into thread rows (Phase C), then cap.
  const rows = groupThreads(filtered);
  const visible = showAll ? rows : rows.slice(0, 10);
  const hasMore = rows.length > 10;

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
                  <div className="w-2 h-2 rounded-full" style={{ background: "threadKind" in entry ? "var(--agent-coral)" : dotColor(entry) }} />
                </div>

                {/* Card */}
                <div className="flex-1 min-w-0">
                  {"threadKind" in entry ? (
                    <EmailThreadCard
                      thread={entry}
                      open={openThreads.has(entry.id)}
                      onToggle={() => toggleInSet(setOpenThreads, entry.id)}
                      expandedBodies={expandedBodies}
                      openOriginals={openOriginals}
                      onToggleBody={onToggleBody}
                      onToggleOriginal={onToggleOriginal}
                    />
                  ) : entry.kind === "milestone" ? (
                    // ── Milestone card ──────────────────────────────────────
                    // Design Lab: `activity-timeline-entry` (shared with comm
                    // rows below so one pick styles the whole timeline).
                    // Default v05 per Ellis, 2026-08-09. Surface (bg/border)
                    // comes from the variant; padding/radius stay inline.
                    <GlassCard glassId="activity-timeline-entry" label="Activity · Timeline entries" defaultVariant="v05" style={{ padding: "10px 14px", borderRadius: 10 }}>
                      {/* One line: avatar + the full "{who} confirmed {clause}"
                          sentence (who = agent/progressor full name, client
                          name(s), or solicitor firm). The name is inside the
                          sentence, so no separate footer. */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                        {entry.isNotRequired || (!entry.byName && !entry.byImage) ? (
                          <SystemAvatar />
                        ) : (
                          <ActorAvatar name={entry.byName ?? entry.actorName} role={entry.actorRole} image={entry.byImage} size={22} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.45 }}>
                            {entry.sentence}
                          </p>
                          {entry.subtext && (
                            <p style={{ marginTop: 3, fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>
                              {entry.subtext}
                            </p>
                          )}
                        </div>
                        {entry.at && (
                          <time style={{ flexShrink: 0, fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap", marginTop: 3 }}>
                            {formatTimestamp(entry.at)}
                          </time>
                        )}
                      </div>
                      {/* Status pill at the foot of the card + memo link (if any). */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        <Pill glass tone={entry.isNotRequired ? "default" : "success"} size="sm">
                          {entry.isNotRequired ? "Skipped" : entry.confirmedByClient ? "Confirmed by client" : "Step confirmed"}
                        </Pill>
                        {mosDocUrl && MOS_CODES.has(entry.milestoneCode) && !entry.isNotRequired && (
                          <a
                            href={mosDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 transition-colors whitespace-nowrap"
                            style={{ fontSize: 11, fontWeight: 500, color: "#3b82f6", marginLeft: "auto" }}
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
                          {/* Who did it — the actor sits at the top of the card
                              (swapped above the channel badge, 2026-09-01). */}
                          <ActorFooter
                            role={entry.actorRole}
                            name={entry.actorName}
                            image={entry.actorImage}
                            sublabel={entry.actorSubLabel}
                            at={entry.at}
                            isEdited={isEdited}
                            placement="top"
                          />

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
                            const { subject, body } = splitSubject(stripped.text);
                            // A synced inbound email keeps its full untrimmed
                            // original; offer "show original" and collapse long bodies.
                            const hasOriginal = entry.kind === "comm" && !!entry.rawOriginal;
                            const showingOriginal = hasOriginal && openOriginals.has(entry.id);
                            const shownBody = showingOriginal ? entry.rawOriginal! : body;
                            const COLLAPSE_AT = 700;
                            const isLong = shownBody.length > COLLAPSE_AT;
                            const isExpanded = expandedBodies.has(entry.id);
                            const displayBody = isLong && !isExpanded
                              ? shownBody.slice(0, COLLAPSE_AT).trimEnd() + "…"
                              : shownBody;
                            const linkBtn = {
                              background: "none", border: "none", padding: 0, cursor: "pointer",
                              fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)",
                            } as const;
                            return (
                              <>
                                {subject && (
                                  <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.4, marginBottom: 4 }}>
                                    {subject}
                                  </p>
                                )}
                                <p style={{ fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-line" }}>
                                  {displayBody}
                                </p>
                                {(isLong || hasOriginal) && (
                                  <div style={{ marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                                    {isLong && (
                                      <button type="button" style={linkBtn} onClick={() => toggleInSet(setExpandedBodies, entry.id)}>
                                        {isExpanded ? "Show less" : "Show more"}
                                      </button>
                                    )}
                                    {hasOriginal && (
                                      <button type="button" style={linkBtn} onClick={() => toggleInSet(setOpenOriginals, entry.id)}>
                                        {showingOriginal ? "Show cleaned" : "Show original"}
                                      </button>
                                    )}
                                  </div>
                                )}
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
                                        <LinkArrow leading />Open response page
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </>
                            );
                          })()}

                          {/* WhatsApp media attachment (image / video / voice / doc) */}
                          {entry.kind === "comm" && entry.mediaUrl && (
                            <MediaAttachment url={entry.mediaUrl} type={entry.mediaType} />
                          )}

                          {/* Type + who-to — the channel badge and contact pills
                              now sit at the foot of the card (swapped below the
                              actor, 2026-09-01). */}
                          <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <Pill glass tone={badge.tone} size="sm">
                              <span aria-hidden>{badge.icon}</span>
                              {badge.label}
                            </Pill>
                            {!isEditing && displayContactNames.map((name) => (
                              <ContactPill key={name} name={name} />
                            ))}
                            {/* Recipient who isn't a file Contact (e.g. the agency
                                agent on a booking system-email) — named by full name. */}
                            {!isEditing && entry.recipientName && !displayContactNames.includes(entry.recipientName) && (
                              <ContactPill name={entry.recipientName} />
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

"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { EnvelopeSimple, DotsThree, MagnifyingGlass, FunnelSimple, Eye, EyeSlash } from "@phosphor-icons/react";
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
import { Drawer } from "@/components/ui/Drawer";
import { EmailAiSuggestions } from "@/components/activity/EmailAiSuggestions";
import { EmailContactSuggestion } from "@/components/activity/EmailContactSuggestion";

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

type CommEntry = Extract<ActivityEntry, { kind: "comm" }>;

function isPortalView(entry: { kind: string; content?: string }) {
  return entry.kind === "comm" && typeof entry.content === "string" && entry.content.includes("viewed their client portal");
}

// An email-medium comm row. The timeline marker + declutter rules key off this:
// email rows get a restrained envelope marker (not a dot) and drop the repeated
// "Email" channel pill, since the medium is already obvious. (Email redesign P1.)
function isEmailComm(e: ActivityEntry): boolean {
  return e.kind === "comm" && (e.type === "inbound" || e.method === "email");
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
  role, name, image, sublabel, at, isEdited, placement = "bottom", hideDate = false,
}: { role: ActorRole; name: string; image: string | null; sublabel?: string | null; at: Date | null; isEdited?: boolean; placement?: "top" | "bottom"; hideDate?: boolean }) {
  // System rows read as "TSP" (The Sales Progressor), not the internal "System".
  const displayName = role === "system" ? "TSP" : name;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: placement === "bottom" ? 8 : 0, marginBottom: placement === "top" ? 8 : 0, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {role === "system" ? <SystemAvatar /> : <ActorAvatar name={name} role={role} image={image} size={22} />}
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {displayName}
        </span>
        {sublabel && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {sublabel}</span>}
      </div>
      {/* Date can be suppressed here (moved to the foot row) so it doesn't collide
          with the hover edit/delete controls pinned top-right. */}
      {!hideDate && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isEdited && <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic" }}>(edited)</span>}
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{at ? formatTimestamp(at) : ""}</span>
        </div>
      )}
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

const LINK_BTN = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  fontSize: 11, fontWeight: 600, color: "var(--agent-coral-deep)",
} as const;

const COLLAPSE_AT = 700;

// ─── Date grouping (Email redesign Phase 1) ─────────────────────────────────────
// Restrained date headers group the mixed timeline by calendar day so a long
// chronology is scannable. Applies to every entry type, not just email.

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function formatDateHeader(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function DateHeader({ label }: { label: string }) {
  return (
    <div style={{ paddingLeft: 20, paddingTop: 8, paddingBottom: 2 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Email body controls (Email redesign Phase 1) ───────────────────────────────
// "Show more" stays visible when a body is long. "View original" is demoted into a
// quiet ⋯ overflow so the normal timeline doesn't repeat it on every email.

function EmailBodyControls({
  isLong, isExpanded, onToggleExpand, hasOriginal, showingOriginal, onToggleOriginal,
}: {
  isLong: boolean; isExpanded: boolean; onToggleExpand: () => void;
  hasOriginal: boolean; showingOriginal: boolean; onToggleOriginal: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  if (!isLong && !hasOriginal) return null;
  return (
    <div style={{ marginTop: 4, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {isLong && (
        <button type="button" style={LINK_BTN} onClick={onToggleExpand}>
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
      {hasOriginal && (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            aria-label="More options"
            title="More"
            onClick={() => setMenuOpen((o) => !o)}
            className="agent-icon-btn agent-icon-btn-sm"
            style={{ opacity: 0.65 }}
          >
            <DotsThree size={16} weight="bold" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 20,
                minWidth: 170, padding: 4, borderRadius: 8,
                background: "var(--agent-menu-surface, #ffffff)",
                border: "0.5px solid var(--agent-border-default)",
                boxShadow: "0 8px 24px rgba(15,23,42,0.14)",
              }}
            >
              <button
                type="button"
                onClick={() => { onToggleOriginal(); setMenuOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, color: "var(--agent-text-primary)", padding: "6px 8px", borderRadius: 6,
                }}
              >
                {showingOriginal ? "View cleaned email" : "View original email"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Conversation drawer (Email redesign Phase 1) ───────────────────────────────
// Individual emails stay individual chronological events in the timeline. A quiet
// "View conversation (N)" opens the full back-and-forth here instead of expanding
// N messages inline. Thread metadata (conversationId) is retained, not destroyed.

function ConversationMessage({ m }: { m: CommEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [showOrig, setShowOrig] = useState(false);
  const { subject, body } = splitSubject(m.content);
  const hasOriginal = !!m.rawOriginal;
  const shownBody = showOrig && hasOriginal ? m.rawOriginal! : body;
  const isLong = shownBody.length > COLLAPSE_AT;
  const displayBody = isLong && !expanded ? shownBody.slice(0, COLLAPSE_AT).trimEnd() + "…" : shownBody;
  return (
    <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12 }}>
      <ActorFooter role={m.actorRole} name={m.actorName} image={m.actorImage} sublabel={m.actorSubLabel} at={m.at} placement="top" />
      {subject && (
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.4, marginBottom: 4 }}>{subject}</p>
      )}
      <p style={{ fontSize: 12.5, color: "var(--agent-text-primary)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{displayBody}</p>
      <EmailBodyControls
        isLong={isLong}
        isExpanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
        hasOriginal={hasOriginal}
        showingOriginal={showOrig}
        onToggleOriginal={() => setShowOrig((s) => !s)}
      />
    </div>
  );
}

function EmailConversationDrawer({
  open, onClose, subject, messages,
}: { open: boolean; onClose: () => void; subject: string | null; messages: CommEntry[] }) {
  return (
    <Drawer open={open} onClose={onClose} ariaLabel="Email conversation" size="lg">
      <Drawer.Header>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", paddingRight: 28, lineHeight: 1.35 }}>
          {subject || "Conversation"}
        </h2>
        <p style={{ fontSize: 12, color: "var(--agent-text-muted)", marginTop: 2 }}>
          {messages.length} message{messages.length === 1 ? "" : "s"}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m) => (
            <ConversationMessage key={m.id} m={m} />
          ))}
        </div>
      </Drawer.Body>
    </Drawer>
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
  // Scope dropdown (the view filter, now a menu inside the search bar).
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!scopeOpen) return;
    const h = (e: MouseEvent) => { if (scopeRef.current && !scopeRef.current.contains(e.target as Node)) setScopeOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [scopeOpen]);

  // Per-entry "show more" (long bodies) and "show original" (synced inbound
  // emails: reveal the full untrimmed original vs the cleaned body).
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());
  const [openOriginals, setOpenOriginals] = useState<Set<string>>(new Set());
  // Which email conversation is open in the drawer (by conversationId).
  const [convCid, setConvCid] = useState<string | null>(null);
  const toggleInSet = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const portalViewCount = entries.filter(isPortalView).length;

  // Conversation metadata is retained (not destroyed): count messages per
  // conversationId across the WHOLE feed so an email can offer "View
  // conversation (N)". The drawer reads the full conversation regardless of
  // the current filter/cap.
  const convCounts = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === "comm" && e.conversationId) {
      convCounts.set(e.conversationId, (convCounts.get(e.conversationId) ?? 0) + 1);
    }
  }
  const conversationMessages = (cid: string): CommEntry[] =>
    entries
      .filter((e): e is CommEntry => e.kind === "comm" && e.conversationId === cid)
      .slice()
      .reverse(); // entries are newest-first → oldest-first for reading
  const convMsgs = convCid ? conversationMessages(convCid) : [];
  const convSubject = convMsgs.length ? (convMsgs[0].subject ?? splitSubject(convMsgs[0].content).subject) : null;

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

  // Individual entries stay individual, chronological events (no giant inline
  // thread expansion). Cap to the latest 10 unless expanded.
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

  // Render one timeline row (milestone or comm). Kept as a function so the map
  // below can interleave date-group headers between rows.
  function renderRow(entry: ActivityEntry, idx: number) {
    return (
      <div
        key={entry.id}
        className={`relative flex gap-3 ${exitingId === entry.id ? "agent-row-exit" : ""} ${showAll && idx >= 10 ? "agent-reveal-in" : ""}`}
      >
        {/* Timeline marker — a restrained envelope for email rows, a coloured
            dot for everything else. */}
        <div className="flex-shrink-0 z-10 mt-3">
          {isEmailComm(entry) ? (
            <EnvelopeSimple size={13} weight="fill" style={{ color: dotColor(entry), display: "block" }} />
          ) : (
            <div className="w-2 h-2 rounded-full" style={{ background: dotColor(entry) }} />
          )}
        </div>

        {/* Card */}
        <div className="flex-1 min-w-0">
          {entry.kind === "milestone" ? (
            // ── Milestone card ──────────────────────────────────────
            <GlassCard glassId="activity-timeline-entry" label="Activity · Timeline entries" defaultVariant="v05" style={{ padding: "10px 14px", borderRadius: 10 }}>
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
              // Apply any optimistic local edit so the row reflects the save
              // immediately even before the revalidate.
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
              // You can only ever touch a NOTE you typed yourself. Everything that
              // was sent or received (emails, calls, messages), anything the system
              // sent automatically, and anything another user — including TSP —
              // entered stays view-only. (Ellis, 2026-09-26.)
              const isOwnNote = entry.type === "internal_note"
                && !entry.isAutomated
                && (!currentUserId || entry.createdById === currentUserId);
              const canEdit = isOwnNote
                && !entry.id.startsWith("optimistic-")
                && contacts !== undefined;
              const email = isEmailComm(entry);
              const convCount = entry.conversationId ? (convCounts.get(entry.conversationId) ?? 0) : 0;
              // Foot chips: hide the repeated "Email" channel pill on email rows
              // (the envelope marker already signals the medium). Keep it for
              // notes / calls / whatsapp.
              const showBadge = !email;
              const showRecipientPill =
                !isEditing && entry.type !== "inbound" && !!entry.recipientName && !displayContactNames.includes(entry.recipientName);
              // Internal notes name the person in their own text (e.g. a
              // "viewed portal" row), so the contact-name pill is pure noise on
              // them. Email/message rows keep it — there it says who it went to.
              const showContactPills = !isEditing && entry.type !== "internal_note" && displayContactNames.length > 0;
              return (
                <GlassCard
                  glassId="activity-timeline-entry"
                  label="Activity · Timeline entries"
                  defaultVariant="v05"
                  className="relative group"
                  style={{ padding: "10px 14px", borderRadius: 10 }}
                >
                  {/* Who did it — actor at the top of the card. */}
                  <ActorFooter
                    role={entry.actorRole}
                    name={entry.actorName}
                    image={entry.actorImage}
                    sublabel={entry.actorSubLabel}
                    at={entry.at}
                    isEdited={isEdited}
                    placement="top"
                    hideDate
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
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--agent-text-muted)", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={editDraft.visibleToClient}
                              onChange={(e) => setEditDraft({ ...editDraft, visibleToClient: e.target.checked })}
                            />
                            Visible in client portal
                          </label>
                        </div>
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
                    // unsubscribe URL baked into their content. Hide the raw URLs;
                    // surface the portal deep-link as a small clickable pill.
                    const stripped = entry.isAutomated
                      ? stripCommsLinksForAgent(displayContent)
                      : { text: displayContent, portalLinks: [] };
                    const { subject, body } = splitSubject(stripped.text);
                    // A synced inbound email keeps its full untrimmed original;
                    // "view original" is available via the ⋯ overflow.
                    const hasOriginal = !!entry.rawOriginal;
                    const showingOriginal = hasOriginal && openOriginals.has(entry.id);
                    const shownBody = showingOriginal ? entry.rawOriginal! : body;
                    const isLong = shownBody.length > COLLAPSE_AT;
                    const isExpanded = expandedBodies.has(entry.id);
                    const displayBody = isLong && !isExpanded
                      ? shownBody.slice(0, COLLAPSE_AT).trimEnd() + "…"
                      : shownBody;
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
                        <EmailBodyControls
                          isLong={isLong}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleInSet(setExpandedBodies, entry.id)}
                          hasOriginal={hasOriginal}
                          showingOriginal={showingOriginal}
                          onToggleOriginal={() => toggleInSet(setOpenOriginals, entry.id)}
                        />
                        {convCount >= 2 && entry.conversationId && (
                          <button
                            type="button"
                            onClick={() => setConvCid(entry.conversationId)}
                            style={{ ...LINK_BTN, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            View conversation ({convCount}) <LinkArrow />
                          </button>
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

                  {/* AI read: summary + suggested confirms / to-dos (Phase D3) */}
                  {entry.kind === "comm" && entry.aiRead && (
                    <EmailAiSuggestions transactionId={transactionId} messageId={entry.id} aiRead={entry.aiRead} />
                  )}

                  {/* Signature → contact phone suggestion (Phase F2) */}
                  {entry.kind === "comm" && entry.contactSuggestion && (
                    <EmailContactSuggestion transactionId={transactionId} messageId={entry.id} suggestion={entry.contactSuggestion} />
                  )}

                  {/* Foot row — channel badge / contact pills on the left, and the
                      date on the right (moved off the top row so it can't collide
                      with the hover edit/delete controls). Always rendered (outside
                      the edit form) so the date has a consistent home. */}
                  {!isEditing && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", minWidth: 0 }}>
                        {showBadge && (
                          <Pill glass tone={badge.tone} size="sm">
                            <span aria-hidden>{badge.icon}</span>
                            {badge.label}
                          </Pill>
                        )}
                        {showContactPills && displayContactNames.map((name) => (
                          <ContactPill key={name} name={name} />
                        ))}
                        {showRecipientPill && entry.recipientName && (
                          <ContactPill name={entry.recipientName} />
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {isEdited && <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic" }}>(edited)</span>}
                        <span style={{ fontSize: 10, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}>{entry.at ? formatTimestamp(entry.at) : ""}</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons — hidden during edit to keep the form clean */}
                  {!isEditing && (
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity act-row-actions"
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
                      {isOwnNote && (
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
    );
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

  // Interleave restrained date-group headers between rows.
  const listNodes: React.ReactNode[] = [];
  let lastDateKey = "";
  visible.forEach((entry, idx) => {
    if (entry.at) {
      const k = localDateKey(entry.at);
      if (k !== lastDateKey) {
        listNodes.push(<DateHeader key={`date-${k}-${entry.id}`} label={formatDateHeader(entry.at)} />);
        lastDateKey = k;
      }
    }
    listNodes.push(renderRow(entry, idx));
  });

  return (
    <div>
      {/* Filter bar — one full-width search that also holds the view scope
          (left) and the portal-visits toggle (right). */}
      <style>{`
        /* Touch devices (no hover): reveal the per-row edit/delete controls
           permanently (there's no hover to trigger them), and never paint the
           icon-button circle background — on mobile/tablet it just reads as a
           stray blob behind the ✎ / ×. */
        @media (hover: none) {
          .act-row-actions { opacity: 1 !important; }
          .act-row-actions .agent-icon-btn,
          .act-row-actions .agent-icon-btn:hover,
          .act-row-actions .agent-icon-btn:active { background: none !important; box-shadow: none !important; }
        }
        /* z-index must beat the compose card below it (activity-comms-entry sits
           at z-index:30 as a later sibling), or the open scope menu renders
           behind it. */
        .act-filterbar { display:flex; align-items:center; gap:10px; margin-bottom:12px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:12px; padding:8px 12px; position:relative; z-index:50; }
        .act-filterbar:focus-within { border-color:var(--agent-coral-deep); }
        .act-scope { position:relative; flex-shrink:0; }
        .act-scope-btn { display:inline-flex; align-items:center; gap:6px; font-family:inherit; font-size:13px; font-weight:600; color:var(--agent-text-primary); background:none; border:none; border-right:1px solid var(--agent-border-default); padding:2px 12px 2px 2px; cursor:pointer; }
        .act-scope-btn svg { color:var(--agent-text-muted); flex-shrink:0; }
        .act-caret { font-size:9px; color:var(--agent-text-muted); transition:transform .22s cubic-bezier(.4,0,.2,1); }
        .act-scope-btn[data-open="true"] .act-caret { transform:rotate(180deg); }
        .act-search-ico { color:var(--agent-text-muted); flex-shrink:0; }
        .act-search-input { flex:1; min-width:60px; border:none; background:none; outline:none; font-family:inherit; font-size:14px; color:var(--agent-text-primary); }
        .act-search-input::placeholder { color:var(--agent-text-muted); }
        .act-eye { display:inline-flex; align-items:center; gap:6px; flex-shrink:0; font-family:inherit; font-size:12px; font-weight:600; color:var(--agent-text-muted); background:none; border:1px solid var(--agent-border-default); border-radius:999px; padding:5px 11px; cursor:pointer; transition:border-color .14s ease, color .14s ease; }
        .act-eye:hover { border-color:var(--agent-coral); color:var(--agent-text-primary); }
        .act-eye[data-on="true"] { border-color:var(--agent-coral-deep); color:var(--agent-coral-deep); }
        .act-eye-short { display:none; }
        @media (max-width: 560px) {
          .act-eye-full { display:none; }
          .act-eye-short { display:inline; }
        }
        .act-scope-menu { position:absolute; top:calc(100% + 8px); left:0; z-index:60; min-width:196px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:12px; box-shadow:0 12px 32px rgba(30,45,74,0.16); padding:7px; }
        .act-mi { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:8px 9px; border-radius:9px; border:none; background:none; font-family:inherit; font-size:13.5px; font-weight:500; color:var(--agent-text-primary); cursor:pointer; transition:background-color .14s ease, box-shadow .14s ease; }
        .act-mi:hover { background-color:var(--agent-hover-tint); box-shadow:var(--agent-hover-lift); }
        .act-radio { width:15px; height:15px; border-radius:50%; border:1.5px solid var(--agent-border-strong); flex-shrink:0; position:relative; transition:border-color .15s ease; }
        .act-mi[data-on="true"] .act-radio { border-color:var(--agent-coral); }
        .act-mi[data-on="true"] .act-radio::after { content:""; position:absolute; inset:3px; border-radius:50%; background:var(--agent-coral); }
      `}</style>
      <div className="act-filterbar">
        <div className="act-scope" ref={scopeRef}>
          <button className="act-scope-btn" data-open={scopeOpen} onClick={() => setScopeOpen((v) => !v)} aria-haspopup="menu" aria-expanded={scopeOpen}>
            <FunnelSimple size={14} weight="regular" />
            {FILTERS.find((f) => f.value === filter)?.label ?? "All"}
            <span className="act-caret">▼</span>
          </button>
          {scopeOpen && (
            <div className="act-scope-menu agent-dropdown-in" role="menu">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  role="menuitemradio"
                  aria-checked={filter === f.value}
                  className="act-mi"
                  data-on={filter === f.value}
                  onClick={() => { handleFilter(f.value); setScopeOpen(false); }}
                >
                  <span className="act-radio" />{f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <MagnifyingGlass size={15} weight="regular" className="act-search-ico" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search this file's activity…"
          className="act-search-input"
          aria-label="Search activity"
        />
        {portalViewCount > 0 && (
          <button
            className="act-eye"
            data-on={showPortalVisits}
            onClick={() => { setShowPortalVisits((v) => !v); setShowAll(false); setEntriesKey((k) => k + 1); }}
            aria-pressed={showPortalVisits}
          >
            {showPortalVisits ? <Eye size={14} weight="regular" /> : <EyeSlash size={14} weight="regular" />}
            {/* Short labels on narrow screens free up the search bar. */}
            <span className="act-eye-full">Portal visits</span>
            <span className="act-eye-short">{showPortalVisits ? "Portal" : "Visits"}</span>
            {showPortalVisits ? "" : ` · ${portalViewCount}`}
          </button>
        )}
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
            {listNodes}
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

      {/* Conversation drawer — the full back-and-forth, opened on demand. */}
      <EmailConversationDrawer
        open={!!convCid}
        onClose={() => setConvCid(null)}
        subject={convSubject}
        messages={convMsgs}
      />
    </div>
  );
}

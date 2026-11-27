"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { EnvelopeSimple, DotsThree, MagnifyingGlass, FunnelSimple, Eye, EyeSlash, CaretRight, ArrowBendDownRight, Check, NotePencil, Phone, ChatText, Minus, Megaphone, Globe, WhatsappLogo } from "@phosphor-icons/react";
import { formatTimestamp, ordinal, relativeDate } from "@/lib/utils";
import type { ActivityEntry, NoteReply } from "@/lib/services/comms";
import { deleteCommAction, editCommAction, replyToNoteAction } from "@/app/actions/comms";
import { extractFirstName } from "@/lib/contacts/displayName";
import { ActorAvatar, UserAvatar, type ActorRole } from "@/components/ui/Avatar";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { stripCommsLinksForAgent } from "@/lib/utils/strip-comms-links";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";
import { Button } from "@/components/arc/button/button";
import { SuccessButton } from "@/components/ui/SuccessButton";
import { Drawer } from "@/components/ui/Drawer";
import { EmailAiSuggestions } from "@/components/activity/EmailAiSuggestions";
import { EmailContactSuggestion } from "@/components/activity/EmailContactSuggestion";
import { SentEmailModal, type OpenEmail } from "@/components/transaction/SentEmailModal";

type Props = {
  entries: ActivityEntry[];
  transactionId: string;
  mosDocUrl?: string | null;
  beforeEntries?: React.ReactNode;
  currentUserId?: string;
  // Author identity for optimistic reply rows (mirrors ActivityTab's optimistic
  // note adds). Lets a just-posted reply render with the right avatar + name
  // before the server-returned reply swaps in. Optional — surfaces that don't
  // pass them fall back to a neutral "You".
  currentUserName?: string;
  currentUserImage?: string | null;
  currentUserRole?: string;
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
  // ── Catalogue/preview hooks (the /dev timeline catalogue) ──────────────────
  // All optional + backward-compatible. hideChrome drops the filter/search bar
  // so a single kind can be shown bare; initialShowPortalVisits seeds the
  // portal-visit toggle on (those rows are otherwise filtered out by default);
  // initialLimit raises the first page so every seeded variant shows at once.
  hideChrome?: boolean;
  initialShowPortalVisits?: boolean;
  initialLimit?: number;
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
  role, name, image, sublabel, at, isEdited, editedAt, placement = "bottom", hideDate = false, hideAvatar = false, toLabel = null,
}: { role: ActorRole; name: string; image: string | null; sublabel?: string | null; at: Date | null; isEdited?: boolean; editedAt?: Date | null; placement?: "top" | "bottom"; hideDate?: boolean; hideAvatar?: boolean; toLabel?: string | null }) {
  // System rows read as "TSP" (The Sales Progressor), not the internal "System".
  const displayName = role === "system" ? "TSP" : name;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: placement === "bottom" ? 8 : 0, marginBottom: placement === "top" ? 8 : 0, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {/* Avatar hidden when it already sits on the timeline rail as the node. */}
        {!hideAvatar && (role === "system" ? <SystemAvatar /> : <ActorAvatar name={name} role={role} image={image} size={22} />)}
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", flexShrink: 0 }}>
          {displayName}
        </span>
        {/* Outbound comms read "sender → recipient" inline, instead of a pill. */}
        {toLabel && (
          <>
            <span aria-hidden style={{ color: "var(--agent-text-tertiary)", flexShrink: 0, fontSize: 12 }}>→</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
              {toLabel}
            </span>
          </>
        )}
        {sublabel && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>· {sublabel}</span>}
      </div>
      {/* Date can be suppressed here (moved to the foot row) so it doesn't collide
          with the hover edit/delete controls pinned top-right. */}
      {!hideDate && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isEdited && <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic" }}>{editedAt ? `edited ${relativeDate(editedAt)}` : "edited"}</span>}
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

// Delivery-status dot for outbound email cards (top-right). sent = grey (no
// confirmation yet / mailbox-routed), delivered = green (reached the inbox
// server), bounced = red (never arrived; hover shows the reason). Driven by the
// SendGrid webhook via entry.delivery (lib/services/comms.ts).
function DeliveryDot({ delivery }: { delivery: { state: "sent" | "delivered" | "bounced"; reason: string | null } }) {
  const cfg = {
    sent: { dot: "#9aa3b2", label: "Sent", text: "var(--agent-text-muted)" },
    delivered: { dot: "#15b371", label: "Delivered", text: "var(--agent-text-muted)" },
    bounced: { dot: "#e5484d", label: "Bounced", text: "#e5484d" },
  }[delivery.state];
  const hasReason = delivery.state === "bounced" && !!delivery.reason;
  return (
    <span
      title={hasReason ? `Bounced: ${delivery.reason}` : undefined}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        fontSize: 10, fontWeight: 600, letterSpacing: "0.01em", color: cfg.text,
        cursor: hasReason ? "help" : "default",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: cfg.dot, boxShadow: `0 0 0 3px ${cfg.dot}1f` }} />
      {cfg.label}
    </span>
  );
}

// `getCommBadge` and `AuthorPill` live in lib/agent/comms-display.tsx so the
// ArchivedRoundDrawer can reuse the same channel-badge + author-pill rendering.

// ─── Timeline node (the actor avatar sits ON the rail) ──────────────────────────
// The person who did it threads the rail; the KIND rides as a small crafted badge
// on the avatar's corner — this is now the single kind indicator (the old
// "Step confirmed" / "Outbound call" pills are gone). One distinct glyph + colour
// per kind; the badge is the agreed vocabulary, so keep this list canonical.
//
//   ✓ Check (green)     confirmed step        ✉ Envelope  email (coral=out,
//   – Minus  (grey)     skipped / not needed              indigo=automated,
//   ✎ NotePencil (amber) internal note                    green=inbound)
//   📣 Megaphone (blue) solicitor "update"    ☎ Phone     call / voicemail
//   🌐 Globe (blue)     portal update (in-app) 💬 ChatText SMS
//   👁 Eye (grey)       portal visit          🟢 WhatsApp  WhatsApp
const BADGE = {
  green: "#10b981", grey: "#9aa3b2", amber: "#d97706", blue: "#2563eb",
  indigo: "#6366f1", coral: "var(--agent-coral)", whatsapp: "#12A969",
} as const;

function entryBadge(entry: ActivityEntry): { icon: React.ReactNode; color: string } {
  const s = 9;
  if (entry.kind === "milestone") {
    return entry.isNotRequired
      ? { icon: <Minus size={s} weight="bold" />, color: BADGE.grey }
      : { icon: <Check size={s} weight="bold" />, color: BADGE.green };
  }
  if (isPortalView(entry)) return { icon: <Eye size={s} weight="fill" />, color: BADGE.grey };
  if (entry.isAutomated && entry.channel === "in_app") return { icon: <Globe size={s} weight="fill" />, color: BADGE.blue };
  if (isEmailComm(entry)) {
    const color = entry.isAutomated ? BADGE.indigo : entry.type === "inbound" ? BADGE.green : BADGE.coral;
    return { icon: <EnvelopeSimple size={s} weight="fill" />, color };
  }
  if (entry.type === "internal_note") {
    // A solicitor-left "update" (senderLabel) is not a hand-typed note — give it
    // its own glyph so the two never read the same.
    return entry.senderLabel
      ? { icon: <Megaphone size={s} weight="fill" />, color: BADGE.blue }
      : { icon: <NotePencil size={s} weight="fill" />, color: BADGE.amber };
  }
  if (entry.method === "phone" || entry.method === "voicemail") return { icon: <Phone size={s} weight="fill" />, color: entry.type === "inbound" ? BADGE.green : BADGE.coral };
  if (entry.method === "sms") return { icon: <ChatText size={s} weight="fill" />, color: entry.type === "inbound" ? BADGE.green : BADGE.coral };
  if (entry.method === "whatsapp") return { icon: <WhatsappLogo size={s} weight="fill" />, color: BADGE.whatsapp };
  return { icon: <ChatText size={s} weight="fill" />, color: BADGE.grey };
}

function EntryNode({ entry }: { entry: ActivityEntry }) {
  const { icon, color } = entryBadge(entry);
  const avatar =
    entry.kind === "milestone" ? (
      entry.isNotRequired || (!entry.byName && !entry.byImage) ? (
        <SystemAvatar size={32} />
      ) : (
        <ActorAvatar name={entry.byName ?? entry.actorName} role={entry.actorRole} image={entry.byImage} size={32} />
      )
    ) : entry.actorRole === "system" ? (
      <SystemAvatar size={32} />
    ) : (
      <ActorAvatar name={entry.actorName} role={entry.actorRole} image={entry.actorImage} size={32} />
    );
  return (
    <div className="act-node">
      {avatar}
      <span className="act-node-badge" style={{ background: color }} aria-hidden>
        {icon}
      </span>
    </div>
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

// Quiet inline text action (reply "Edit" / "Remove"), arc-style: muted by
// default, brightens to primary text on hover/focus. Brightening is applied via
// inline mouse/focus handlers (NoteThread has no scoped <style> block).
const INLINE_ACTION = {
  background: "none", border: "none", padding: 0, cursor: "pointer",
  fontFamily: "inherit", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)",
} as const;

const COLLAPSE_AT = 700;

// How many feed entries show before "load more". On mobile the old single
// "Show earlier updates" button sat behind the fixed quick-action dock, so the
// feed now auto-loads the next page as you scroll near the bottom (critique
// #294); the button stays as an explicit shortcut.
const PAGE_SIZE = 10;

// ─── Date grouping (Email redesign Phase 1) ─────────────────────────────────────
// Restrained date headers group the mixed timeline by calendar day so a long
// chronology is scannable. Applies to every entry type, not just email.

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function formatDateHeader(d: Date): string {
  const day = Number(d.toLocaleDateString("en-GB", { day: "numeric" }));
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.toLocaleDateString("en-GB", { year: "numeric" });
  return `${ordinal(day)} ${month} ${year}`;
}
function DateHeader({ label }: { label: string }) {
  return (
    <div style={{ paddingLeft: 20, paddingTop: 8, paddingBottom: 2 }}>
      <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.01em", color: "var(--agent-text-muted)" }}>
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
  if (!isLong && !hasOriginal) return null;
  return (
    <div style={{ marginTop: 4, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      {isLong && (
        <button type="button" style={LINK_BTN} onClick={onToggleExpand}>
          {isExpanded ? "Show less" : "Show more"}
        </button>
      )}
      {hasOriginal && (
        <Popover
          preset="menu"
          placement="bottom-start"
          trigger={
            <button
              type="button"
              aria-label="More options"
              title="More"
              className="agent-icon-btn agent-icon-btn-sm"
              style={{ opacity: 0.65 }}
            >
              <DotsThree size={16} weight="bold" />
            </button>
          }
        >
          {(close) => (
            <PopoverMenuItem onClick={() => { onToggleOriginal(); close(); }}>
              {showingOriginal ? "View cleaned email" : "View original email"}
            </PopoverMenuItem>
          )}
        </Popover>
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
    <Drawer open={open} onClose={onClose} ariaLabel="Email conversation" size="lg" zLayer="escalated">
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

// ─── Note replies (threaded notes, Phase 2) ─────────────────────────────────────
// A note's replies render as indented rows beneath it, with a collapse toggle and
// an inline composer. A reply IS an internal_note (parentNoteId → the note), so
// its own-only edit / remove reuse editCommAction / deleteCommAction by id. Lives
// native to the Activity tab: same avatars, buttons and optimistic feel as the
// feed, not the arc comment-thread component.

function pluralReplies(n: number): string {
  return `${n} ${n === 1 ? "reply" : "replies"}`;
}

// Session role → activity avatar tint for an optimistic reply (mirrors the
// service's userRoleToActor so the placeholder matches the server-resolved reply).
function roleToActorRole(role?: string): ActorRole {
  if (role === "sales_progressor" || role === "admin" || role === "superadmin") return "progressor";
  return "agent";
}

function NoteThread({
  note, transactionId, currentUserId, currentUserName, currentUserImage, currentUserRole,
}: {
  note: Extract<ActivityEntry, { kind: "comm" }>;
  transactionId: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserImage?: string | null;
  currentUserRole?: string;
}) {
  const [, startThreadTransition] = useTransition();
  // Optimistic replies appended locally (temp id until the server-returned reply
  // swaps in), reply edits (content override + "edited" time), and removed ids —
  // all cleared when the server replies refresh (revalidate has caught up).
  const [localReplies, setLocalReplies] = useState<NoteReply[]>([]);
  const [removedReplyIds, setRemovedReplyIds] = useState<Set<string>>(new Set());
  const [replyEdits, setReplyEdits] = useState<Record<string, { content: string; editedAt: Date }>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  // Optional "Let {author} know" opt-in. Off by default; local to the open
  // composer and reset whenever it closes or sends.
  const [notifyAuthor, setNotifyAuthor] = useState(false);
  // Only offer the toggle when the note has a known author who isn't the replier.
  const notifyAuthorFirstName = note.createdByName ? extractFirstName(note.createdByName) : null;
  const canNotifyAuthor = !!note.createdById && note.createdById !== currentUserId && !!notifyAuthorFirstName;
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  useEffect(() => {
    setLocalReplies([]);
    setRemovedReplyIds(new Set());
    setReplyEdits({});
    setNotifyAuthor(false);
  }, [note.replies]);

  // Dedupe by id so the paint between revalidate landing and the reconcile effect
  // never renders a reply twice (same key) — the server copy wins.
  const serverIds = new Set(note.replies.map((r) => r.id));
  const replies = [...note.replies, ...localReplies.filter((r) => !serverIds.has(r.id))]
    .filter((r) => !removedReplyIds.has(r.id));
  const lastReply = replies[replies.length - 1];

  // Own-only, same rule as a note: a persisted reply the current user authored.
  // Optimistic (not-yet-saved) rows can't be edited by id.
  function canTouchReply(r: NoteReply): boolean {
    return (
      !r.id.startsWith("optimistic-")
      && r.editableByAuthor
      && r.createdById != null
      && (!currentUserId || r.createdById === currentUserId)
    );
  }

  // The reply "Send" is the canonical SuccessButton: it awaits and returns
  // success so the button can show Sending… → Sent. We still add the reply
  // optimistically (it appears at once); on success the composer closes after
  // the tick, on failure the optimistic row is pulled and the button shows
  // "Try again" with the draft intact.
  async function runSendReply(): Promise<boolean> {
    const content = draft.trim();
    if (!content) return false;
    const tempId = `optimistic-reply-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const placeholder: NoteReply = {
      id: tempId,
      content,
      at: new Date(),
      createdById: currentUserId ?? null,
      createdByName: currentUserName ?? "You",
      createdByImage: currentUserImage ?? null,
      createdByRole: currentUserRole ?? null,
      actorRole: roleToActorRole(currentUserRole),
      actorName: currentUserName ?? "You",
      actorImage: currentUserImage ?? null,
      wasEdited: false,
      editedAt: null,
      editableByAuthor: true,
    };
    const notify = canNotifyAuthor && notifyAuthor;
    setLocalReplies((prev) => [...prev, placeholder]);
    setCollapsed(false);
    try {
      const created = await replyToNoteAction({ transactionId, parentNoteId: note.id, content, notify });
      // Swap the placeholder for the real resolved reply (correct id + identity).
      setLocalReplies((prev) => prev.map((r) => (r.id === tempId ? created : r)));
      window.setTimeout(() => { setDraft(""); setNotifyAuthor(false); setComposerOpen(false); }, 850);
      return true;
    } catch {
      setLocalReplies((prev) => prev.filter((r) => r.id !== tempId));
      return false;
    }
  }

  function startReplyEdit(r: NoteReply) {
    setEditingReplyId(r.id);
    setEditDraft(replyEdits[r.id]?.content ?? r.content);
  }
  function cancelReplyEdit() {
    setEditingReplyId(null);
    setEditDraft("");
  }
  async function runSaveReplyEdit(id: string): Promise<boolean> {
    const trimmed = editDraft.trim();
    if (!trimmed) return false;
    // Apply the edit optimistically, then confirm with the server.
    setReplyEdits((prev) => ({ ...prev, [id]: { content: trimmed, editedAt: new Date() } }));
    try {
      // A reply is an internal-only note — no contacts, never client-visible.
      await editCommAction({ id, transactionId, content: trimmed, contactIds: [], visibleToClient: false });
      window.setTimeout(() => { setEditingReplyId((cur) => (cur === id ? null : cur)); setEditDraft(""); }, 850);
      return true;
    } catch {
      setReplyEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return false;
    }
  }
  function removeReply(id: string) {
    setRemovedReplyIds((prev) => new Set([...prev, id]));
    startThreadTransition(async () => {
      try {
        await deleteCommAction(id, transactionId);
      } catch {
        setRemovedReplyIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function renderReply(r: NoteReply) {
    const override = replyEdits[r.id];
    const content = override?.content ?? r.content;
    const edited = override ? true : r.wasEdited;
    const editedAt = override?.editedAt ?? r.editedAt;
    const isEditingThis = editingReplyId === r.id;
    const canTouch = canTouchReply(r);
    const optimistic = r.id.startsWith("optimistic-");
    return (
      <div key={r.id} style={{ display: "flex", gap: 8, opacity: optimistic ? 0.65 : 1 }}>
        <div style={{ flexShrink: 0, marginTop: 1 }}>
          <ActorAvatar name={r.actorName} role={r.actorRole} image={r.actorImage} size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>{r.actorName}</span>
            <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>{formatTimestamp(r.at)}</span>
            {edited && (
              <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontStyle: "italic" }}>
                {editedAt ? `edited ${relativeDate(editedAt)}` : "edited"}
              </span>
            )}
          </div>
          {isEditingThis ? (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }} onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={Math.max(2, Math.min(8, editDraft.split("\n").length + 1))}
                className="glass-input w-full px-3 py-2.5 text-sm resize-none"
                autoFocus
              />
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); cancelReplyEdit(); }}>Cancel</Button>
                <SuccessButton variant="primary" size="sm" disabled={!editDraft.trim()} run={() => runSaveReplyEdit(r.id)}>Save</SuccessButton>
              </div>
            </div>
          ) : (
            <>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                {content}
              </p>
              {/* Own reply: a tidy, always-visible inline action row (arc-style),
                  replacing the old hover pencil/×. Others' replies show none. */}
              {canTouch && (
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 5 }}>
                  <button
                    type="button"
                    style={INLINE_ACTION}
                    onClick={(e) => { e.stopPropagation(); startReplyEdit(r); }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--agent-text-primary)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
                    onFocus={(e) => (e.currentTarget.style.color = "var(--agent-text-primary)")}
                    onBlur={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
                    aria-label="Edit reply"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    style={INLINE_ACTION}
                    onClick={(e) => { e.stopPropagation(); removeReply(r.id); }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--agent-text-primary)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
                    onFocus={(e) => (e.currentTarget.style.color = "var(--agent-text-primary)")}
                    onBlur={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
                    aria-label="Remove reply"
                  >
                    Remove
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
      {/* Toggle + Reply affordance. Replies expand by default; collapsed shows the
          count and a last-reply hint. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        {replies.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCollapsed((c) => !c); }}
            aria-expanded={!collapsed}
            style={{ ...LINK_BTN, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--agent-text-muted)" }}
          >
            <CaretRight size={11} weight="bold" style={{ transform: collapsed ? "none" : "rotate(90deg)", transition: "transform .18s cubic-bezier(.4,0,.2,1)" }} />
            {collapsed ? `Show ${pluralReplies(replies.length)}` : "Hide replies"}
          </button>
        )}
        {collapsed && replies.length > 0 && lastReply && (
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)" }}>
            last reply {relativeDate(lastReply.editedAt ?? lastReply.at)}
          </span>
        )}
        {!composerOpen && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setComposerOpen(true); }}
            style={{ ...LINK_BTN, display: "inline-flex", alignItems: "center", gap: 4 }}
            aria-label="Reply to note"
          >
            <ArrowBendDownRight size={13} weight="bold" />
            Reply
          </button>
        )}
      </div>

      {replies.length > 0 && !collapsed && (
        <div style={{ marginTop: 10, marginLeft: 4, paddingLeft: 12, borderLeft: "1.5px solid var(--agent-border-default)", display: "flex", flexDirection: "column", gap: 12 }}>
          {replies.map(renderReply)}
        </div>
      )}

      {composerOpen && (
        <div className="agent-reveal-in" style={{ marginTop: 10, marginLeft: 4, paddingLeft: 12, borderLeft: "1.5px solid var(--agent-border-default)", display: "flex", gap: 8 }} onClick={(e) => e.stopPropagation()}>
          {/* Leading avatar (the current user), like the arc composer. UserAvatar
              shimmers while a photo loads, then the photo (or branded art). */}
          <div style={{ flexShrink: 0, marginTop: 1 }}>
            <UserAvatar user={{ name: currentUserName ?? "You", image: currentUserImage ?? null }} size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(2, Math.min(8, draft.split("\n").length + 1))}
            placeholder="Write a reply…"
            className="glass-input w-full px-3 py-2.5 text-sm resize-none"
            aria-label="Write a reply"
            autoFocus
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
            {canNotifyAuthor && (
              <label
                onClick={(e) => e.stopPropagation()}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: "auto", fontSize: 11.5, color: "var(--agent-text-muted)", cursor: "pointer", userSelect: "none" }}
              >
                <input
                  type="checkbox"
                  checked={notifyAuthor}
                  onChange={(e) => { e.stopPropagation(); setNotifyAuthor(e.target.checked); }}
                  aria-label={`Let ${notifyAuthorFirstName} know about this reply`}
                  style={{ width: 13, height: 13, accentColor: "var(--agent-coral, #FF6B4A)", cursor: "pointer" }}
                />
                Let {notifyAuthorFirstName} know
              </label>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setComposerOpen(false); setDraft(""); setNotifyAuthor(false); }}>Cancel</Button>
            <SuccessButton variant="primary" size="sm" disabled={!draft.trim()} run={runSendReply} savingLabel="Sending…" successLabel="Sent">Send</SuccessButton>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export function ActivityTimeline({ entries, transactionId, mosDocUrl, beforeEntries, currentUserId, currentUserName, currentUserImage, currentUserRole, contacts, solicitors, hideChrome = false, initialShowPortalVisits = false, initialLimit }: Props) {
  const searchTag = useGlassTag("activity-searchbar", "Activity · search bar", { light: "cs-b7c9ec28", dark: "cs-053799eb" });
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exitingId, setExitingId]   = useState<string | null>(null);
  // Inline edit state. editingId names the entry being edited; editDraft
  // holds the form values. Optimistic local overrides keep edits visible
  // before the server revalidate lands.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ content: string; contactIds: string[]; visibleToClient: boolean } | null>(null);
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
  const [limit, setLimit]           = useState(initialLimit ?? PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [filter, setFilter]         = useState<FilterKind>("all");
  const [search, setSearch]         = useState("");
  const [showPortalVisits, setShowPortalVisits] = useState(initialShowPortalVisits);
  const [entriesKey, setEntriesKey] = useState(0);
  // Narrow-screen flag: shortens the search placeholder so it fits the mobile
  // search bar rather than truncating mid-word (critique #243).
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Per-entry "show more" (long bodies) and "show original" (synced inbound
  // emails: reveal the full untrimmed original vs the cleaned body).
  const [expandedBodies, setExpandedBodies] = useState<Set<string>>(new Set());
  const [openOriginals, setOpenOriginals] = useState<Set<string>>(new Set());
  // Which email conversation is open in the drawer (by conversationId).
  const [convCid, setConvCid] = useState<string | null>(null);
  // Byte-for-byte "view the exact email we sent" — opens SentEmailModal, which
  // fetches the stored sentEmailHtml by OutboundMessage id. Covers the portal
  // invite and every other agent/automated email on the timeline.
  const [openEmail, setOpenEmail] = useState<OpenEmail | null>(null);
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
    setFilter(f); setLimit(PAGE_SIZE); setEntriesKey((k) => k + 1);
  }
  function handleSearch(q: string) {
    setSearch(q); setLimit(PAGE_SIZE); setEntriesKey((k) => k + 1);
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
  // thread expansion). Show a page at a time, growing as the reader scrolls.
  const visible = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  // Auto-load the next page when the sentinel nears the viewport. rootMargin
  // pre-triggers well before the bottom, so the next batch is already in place
  // before the fixed quick-action dock could cover the manual button (#294).
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (obsEntries) => {
        if (obsEntries.some((e) => e.isIntersecting)) {
          setLimit((l) => Math.min(l + PAGE_SIZE, filtered.length));
        }
      },
      { rootMargin: "240px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length, limit]);

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

  // Canonical save: awaits + returns success so the SuccessButton can show
  // Saving… → Saved. The new content renders optimistically at once; the form
  // closes after the tick on success, or rolls back + shows "Try again" on error.
  async function runSaveEdit(id: string): Promise<boolean> {
    if (!editDraft) return false;
    const trimmed = editDraft.content.trim();
    if (!trimmed) return false;
    const payload = { content: trimmed, contactIds: editDraft.contactIds, visibleToClient: editDraft.visibleToClient };
    setLocalEdits((prev) => ({ ...prev, [id]: { ...payload, wasEdited: true } }));
    try {
      await editCommAction({ id, transactionId, ...payload });
      // Close after the "Saved" tick. editDraft isn't cleared here — it's only
      // read while editingId is set, and startEdit refreshes it on the next open.
      window.setTimeout(() => setEditingId((cur) => (cur === id ? null : cur)), 850);
      return true;
    } catch {
      // Roll back the optimistic edit on failure.
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return false;
    }
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
        // Cascade blur-in on load (the canonical agent-bloom: blurred + dropped →
        // sharpens and rises). Staggered by index for the first handful so the
        // feed cascades; later rows (incl. "show more") bloom with the capped
        // delay. A row that's exiting runs the exit animation instead.
        className={`relative flex gap-3 ${exitingId === entry.id ? "agent-row-exit" : "agent-bloom"}`}
        style={exitingId === entry.id ? undefined : { animationDelay: `${Math.min(idx, 7) * 45}ms` }}
      >
        {/* Timeline node — the actor's avatar sits on the rail, with a small
            channel badge on its corner (Direction B). */}
        <EntryNode entry={entry} />

        {/* Card */}
        <div className="flex-1 min-w-0">
          {entry.kind === "milestone" ? (
            // ── Milestone card ──────────────────────────────────────
            <div className="act-card">
              {/* Meta cluster floats top-right, aligned with the first line: the
                  memo reference link (where relevant) then the date. The sentence
                  wraps beneath it (avatar + who live on the rail). */}
              <div style={{ float: "right", marginLeft: 12, display: "inline-flex", alignItems: "center", gap: 10 }}>
                {mosDocUrl && MOS_CODES.has(entry.milestoneCode) && !entry.isNotRequired && (
                  <a
                    href={mosDocUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 transition-colors whitespace-nowrap"
                    style={{ fontSize: 11, fontWeight: 500, color: "#3b82f6" }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View Memo
                  </a>
                )}
                {entry.at && <time className="act-meta-date">{formatTimestamp(entry.at)}</time>}
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.45 }}>
                {entry.sentence}
              </p>
              {entry.subtext && (
                <p style={{ marginTop: 3, fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.4 }}>
                  {entry.subtext}
                </p>
              )}
            </div>
          ) : (
            // ── Comm card ───────────────────────────────────────────
            (() => {
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
              // An optimistic local edit just happened → "edited" now; otherwise
              // the row's real last-edit time (updatedAt, surfaced as editedAt).
              const editedAt = override?.wasEdited ? new Date() : entry.editedAt;
              const isEditing = editingId === entry.id;
              // Removing stays NOTE-only — a note you typed yourself (and only
              // once its replies are gone). Everything sent/received, automated,
              // or another user's row stays un-removable. (Ellis, 2026-09-26.)
              const isOwnNote = entry.type === "internal_note"
                && !entry.isAutomated
                && (!currentUserId || entry.createdById === currentUserId);
              // Editing the TEXT is broader: any update you LOGGED yourself — a
              // note OR a manually-logged call / SMS / email — can be edited.
              // editableByAuthor carries the manual-log rule from the service
              // (never a real send / automated / inbound); here we add own-only +
              // not-optimistic + has-contacts. A note opens the full edit form
              // (contact picker + client-visible toggle); any other logged comm
              // edits its text only. (Author-edit broadening, 2026-11.)
              const canEdit = entry.editableByAuthor
                && (!currentUserId || entry.createdById === currentUserId)
                && !entry.id.startsWith("optimistic-")
                && contacts !== undefined;
              const email = isEmailComm(entry);
              const convCount = entry.conversationId ? (convCounts.get(entry.conversationId) ?? 0) : 0;
              // Outbound comms read "sender → recipient(s)" inline in the header
              // (instead of a recipient pill). Collect who it went to: the client
              // contacts plus any non-contact recipient (e.g. an agency user).
              const toNames: string[] = [];
              if (entry.type === "outbound") {
                for (const n of displayContactNames) if (!toNames.includes(n)) toNames.push(n);
                if (entry.recipientName && !toNames.includes(entry.recipientName)) toNames.push(entry.recipientName);
              }
              const toLabel = toNames.length > 0 ? toNames.join(", ") : null;
              const hasHoverActions = canEdit || (isOwnNote && entry.replies.length === 0);
              return (
                <div className={`act-card relative group ${hasHoverActions ? "is-editable" : ""}`}>
                  {/* Top-right meta cluster — delivery + "View" (outbound emails
                      only) and the date, aligned with the name. "View" opens the
                      exact email that was sent, byte-for-byte. The date lives here
                      so it never needs a row of its own. */}
                  {!isEditing && (
                    <div style={{ position: "absolute", top: 10, right: 12, zIndex: 1, display: "flex", alignItems: "center", gap: 10 }}>
                      {email && entry.type === "outbound" && entry.delivery && <DeliveryDot delivery={entry.delivery} />}
                      {email && entry.type === "outbound" && (
                        <button
                          type="button"
                          style={LINK_BTN}
                          onClick={() => setOpenEmail({ id: entry.id, label: entry.subject || "Sent email" })}
                        >
                          View
                        </button>
                      )}
                      {isEdited && (
                        <span className="act-meta-date" style={{ fontStyle: "italic" }}>
                          {editedAt ? `edited ${relativeDate(editedAt)}` : "edited"}
                        </span>
                      )}
                      {entry.at && <time className="act-meta-date">{formatTimestamp(entry.at)}</time>}
                    </div>
                  )}

                  {/* Who did it (and, for outbound, who to) — at the top. */}
                  <ActorFooter
                    role={entry.actorRole}
                    name={entry.actorName}
                    image={entry.actorImage}
                    sublabel={entry.actorSubLabel}
                    at={entry.at}
                    isEdited={isEdited}
                    editedAt={editedAt}
                    placement="top"
                    hideAvatar
                    hideDate
                    toLabel={toLabel}
                  />

                  {/* Content — static paragraph, the full note edit form (contact
                      picker + client-visible), or a content-only editor for any
                      other logged comm (call / SMS / logged email). */}
                  {isEditing && editDraft ? (
                    entry.type === "internal_note" && contacts ? (
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
                          <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                          <SuccessButton variant="primary" size="sm" disabled={!editDraft.content.trim()} run={() => runSaveEdit(entry.id)}>Save</SuccessButton>
                        </div>
                      </div>
                    </div>
                    ) : (
                    // Content-only editor for a logged call / SMS / email (not a
                    // note): just the text. The row's existing contactIds +
                    // visibleToClient flow through runSaveEdit unchanged.
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        value={editDraft.content}
                        onChange={(e) => setEditDraft({ ...editDraft, content: e.target.value })}
                        rows={Math.max(3, Math.min(10, editDraft.content.split("\n").length + 1))}
                        className="glass-input w-full px-3 py-2.5 text-sm resize-none"
                        autoFocus
                      />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                        <SuccessButton variant="primary" size="sm" disabled={!editDraft.content.trim()} run={() => runSaveEdit(entry.id)}>Save</SuccessButton>
                      </div>
                    </div>
                    )
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

                  {/* Email attachments filed to Documents (inbound + agent-sent).
                      A marker only — the files live on the Documents tab. */}
                  {entry.kind === "comm" && entry.attachments && entry.attachments.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {entry.attachments.map((a, i) => (
                        <span
                          key={`${a.filename}-${i}`}
                          title={a.filename}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            maxWidth: 240,
                            fontSize: 11,
                            fontWeight: 600,
                            color: "var(--agent-text-secondary)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            border: "0.5px solid var(--agent-border-default)",
                            background: "var(--agent-surface-glass)",
                          }}
                        >
                          <span aria-hidden>📎</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.filename}</span>
                        </span>
                      ))}
                    </div>
                  )}

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

                  {/* Action buttons — hidden during edit to keep the form clean */}
                  {!isEditing && (
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity act-row-actions"
                      style={{ position: "absolute", top: 8, right: 10, display: "flex", gap: 2 }}
                    >
                      {canEdit && (
                        <button
                          onClick={() => startEdit(entry)}
                          disabled={isPending}
                          className="agent-icon-btn agent-icon-btn-sm"
                          aria-label="Edit"
                          title="Edit"
                        >
                          ✎
                        </button>
                      )}
                      {/* A note that still has replies can't be removed (the
                          server orphans guard throws) — hide the control so the
                          user never hits that error. Remove the replies first. */}
                      {isOwnNote && entry.replies.length === 0 && (
                        <button
                          onClick={() => deleteComm(entry.id)}
                          disabled={deletingId === entry.id || isPending || exitingId === entry.id}
                          className="agent-icon-btn agent-icon-btn-sm"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}

                  {/* Threaded replies + inline reply composer (notes only). */}
                  {entry.type === "internal_note" && !entry.isAutomated && (
                    <NoteThread
                      note={entry}
                      transactionId={transactionId}
                      currentUserId={currentUserId}
                      currentUserName={currentUserName}
                      currentUserImage={currentUserImage}
                      currentUserRole={currentUserRole}
                    />
                  )}
                </div>
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
        /* z-index sits above the compose card below it (activity-comms-entry at
           z-index:30, a later sibling) so the open scope menu clears it, but
           stays BELOW the app-wide quick-action dock (fixed, z-index:40) so the
           dock keeps floating on top as the list scrolls past it (critique #298).
           Hence 35: above 30, below 40. */
        /* Search bar + "Log an update" share a wrapping row: the button sits to
           the right of the search when there's room, and drops onto its own line
           once the search would fall below its comfortable min width (so it never
           gets bunched). Pure flex-wrap, so it responds to real width / zoom. */
        /* Flat, clean card for every timeline entry — a solid elevated surface
           (white in light, dark-slate at night), a hairline border and a single
           soft shadow. Deliberately NOT the glass treatment. */
        .act-card { position: relative; display: flow-root; background: var(--agent-surface-elevated); border: 0.5px solid var(--agent-border-subtle); border-radius: 12px; padding: 10px 14px; box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb), 0.04), 0 1px 2px rgba(var(--agent-shadow-rgb), 0.05); }
        /* Timestamp — lives top-right, aligned with the first line (floated on
           milestone cards, in the absolute meta cluster on comm cards). Never a
           row of its own. */
        .act-meta-date { font-size: 10px; color: var(--agent-text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; transition: opacity .12s ease; }
        /* On an editable row the hover edit/remove icons share the top-right with
           the date — fade the date out on hover so the two never overlap. */
        .act-card.is-editable:hover .act-meta-date { opacity: 0; }
        /* Direction B — the actor avatar IS the timeline node, sitting on the rail
           (z-index above it, opaque so it covers the line behind it); a small
           channel badge rides the bottom-right corner. */
        .act-node { position: relative; z-index: 10; flex-shrink: 0; width: 32px; height: 32px; margin-top: 2px; }
        .act-node-badge { position: absolute; right: -2px; bottom: -2px; width: 15px; height: 15px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; color: #fff; border: 1.5px solid var(--agent-surface-elevated); box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb), 0.18); }
        .act-topbar { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:12px; }
        .act-topbar-action { flex:0 0 auto; }
        .act-filterbar { display:flex; align-items:center; gap:10px; flex:1 1 460px; min-width:0; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:12px; padding:8px 12px; position:relative; z-index:35; }
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
      {!hideChrome && (
      <div className="act-topbar">
      <div className={`act-filterbar ${searchTag.className}`} {...searchTag.props} data-bloom>
        <div className="act-scope">
          <Popover
            preset="menu"
            placement="bottom-start"
            trigger={
              <button className="act-scope-btn" aria-haspopup="menu">
                <FunnelSimple size={14} weight="regular" />
                {FILTERS.find((f) => f.value === filter)?.label ?? "All"}
                <span className="act-caret">▼</span>
              </button>
            }
          >
            {(close) => FILTERS.map((f) => (
              <button
                key={f.value}
                role="menuitemradio"
                aria-checked={filter === f.value}
                className="act-mi"
                data-on={filter === f.value}
                onClick={() => { handleFilter(f.value); close(); }}
              >
                <span className="act-radio" />{f.label}
              </button>
            ))}
          </Popover>
        </div>
        <MagnifyingGlass size={15} weight="regular" className="act-search-ico" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={isNarrow ? "Search" : "Search this file's activity…"}
          className="act-search-input"
          aria-label="Search activity"
        />
        {portalViewCount > 0 && (
          <button
            className="act-eye"
            data-on={showPortalVisits}
            onClick={() => { setShowPortalVisits((v) => !v); setLimit(PAGE_SIZE); setEntriesKey((k) => k + 1); }}
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
        {beforeEntries && <div className="act-topbar-action" data-bloom>{beforeEntries}</div>}
      </div>
      )}


      {filtered.length === 0 ? (
        <div className="text-center py-8" data-bloom style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
          No entries match.
        </div>
      ) : (
        <div data-bloom>
        <div key={entriesKey} className="relative agent-reveal-in">
          {/* Vertical line */}
          {/* Rail — threads through the avatar nodes (centre of the 32px node). */}
          <div className="absolute top-2 bottom-2 w-px" style={{ left: 15, background: "var(--agent-border-default)" }} />

          <div ref={listRef} className="space-y-2">
            {listNodes}
          </div>

          {/* Auto-load sentinel — the feed grows a page at a time as this nears
              the viewport, so the reader never has to reach a button the dock
              might cover on mobile (#294). The button is an explicit shortcut. */}
          {hasMore && (
            <>
              <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
              <div className="pl-5 mt-2">
                <button
                  onClick={() => setLimit(filtered.length)}
                  className="agent-link agent-link-muted"
                  style={{ fontSize: 11 }}
                >
                  {`Show ${filtered.length - limit} earlier updates…`}
                </button>
              </div>
            </>
          )}
          {!hasMore && limit > PAGE_SIZE && (
            <div className="pl-5 mt-2">
              <button
                onClick={() => setLimit(PAGE_SIZE)}
                className="agent-link agent-link-muted"
                style={{ fontSize: 11 }}
              >
                Show less
              </button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Conversation drawer — the full back-and-forth, opened on demand. */}
      <EmailConversationDrawer
        open={!!convCid}
        onClose={() => setConvCid(null)}
        subject={convSubject}
        messages={convMsgs}
      />

      {/* Byte-for-byte sent-email viewer (the "View" link on outbound emails). */}
      <SentEmailModal email={openEmail} onClose={() => setOpenEmail(null)} />
    </div>
  );
}

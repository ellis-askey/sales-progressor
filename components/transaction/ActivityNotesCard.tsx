"use client";

// Merged "Activity & notes" card for the Overview tab (2026-08-12).
// Notes ARE activity, so they live in one place. A segmented All / Notes filter
// focuses the view; note rows are deletable inline; "View all" goes to the full
// Activity tab.
//
// Critique #6 (2026-09-29): the composer is now the SAME <CommsEntry> used on
// the Activity tab — draft for everyone, log a call (who to), note, and the
// "More" set — rendered with the identical optimistic wiring ActivityTab uses,
// so the two surfaces are pixel-identical and share one code path. The old
// note-only textarea is gone; CommsEntry's Note channel covers it.

import { useState, useEffect } from "react";
import { useTabContext } from "./TabContext";
import {
  CheckCircle, MinusCircle, NoteBlank, EnvelopeSimple, Phone, ChatCircleText, Circle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { ActivityEntry } from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";
import { GlassCard } from "@/components/glass/GlassCard";
import { CommsEntry } from "@/components/activity/CommsEntry";
import { deleteCommAction } from "@/app/actions/comms";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { relativeDate } from "@/lib/utils";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { UserAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";

// Client contacts + solicitors feed the CommsEntry composer's who-it-was-with
// pills and Draft-for-everyone panel. Same shapes ActivityPanel passes.
type ComposerContact = { id: string; name: string; roleType: string; phone?: string | null };
type ComposerSolicitor = { id: string; name: string; role: string; phone?: string | null };

type Props = {
  transactionId: string;
  entries: ActivityEntry[];
  currentUserName: string;
  currentUserImage?: string | null;
  currentUserRole?: string;
  contacts?: ComposerContact[];
  solicitors?: ComposerSolicitor[];
  canPasteChat?: boolean;
  emailConnected?: boolean;
};

const FEED_PREVIEW = 4;
const NOTES_PREVIEW = 5;

function isOptimistic(id: string): boolean {
  return id.startsWith("optimistic-");
}

function bandFor(when: Date): { key: string; label: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfEvent.getTime()) / 86400000);
  if (diffDays <= 0) return { key: "today", label: "Today" };
  if (diffDays === 1) return { key: "yesterday", label: "Yesterday" };
  if (diffDays < 7) return { key: `d${diffDays}`, label: `${diffDays} days ago` };
  if (diffDays < 14) return { key: "last-week", label: "Last week" };
  if (diffDays < 30) return { key: `w${Math.floor(diffDays / 7)}`, label: `${Math.floor(diffDays / 7)} weeks ago` };
  return { key: "older", label: "Older" };
}

function iconFor(entry: ActivityEntry): { Icon: Icon; color: string; bg: string } {
  if (entry.kind === "milestone") {
    if (entry.isNotRequired) return { Icon: MinusCircle, color: "#475569", bg: "rgba(100, 116, 139, 0.10)" };
    return { Icon: CheckCircle, color: "#047857", bg: "rgba(16, 185, 129, 0.10)" };
  }
  if (entry.type === "internal_note") return { Icon: NoteBlank, color: "#1d4ed8", bg: "rgba(59, 130, 246, 0.10)" };
  const inbound = entry.type === "inbound";
  const baseColor = inbound ? "#047857" : "var(--agent-coral-deep)";
  const baseBg = inbound ? "rgba(16, 185, 129, 0.10)" : "rgba(var(--agent-coral-rgb), 0.10)";
  if (entry.method === "email") return { Icon: EnvelopeSimple, color: baseColor, bg: baseBg };
  if (entry.method === "phone" || entry.method === "voicemail") return { Icon: Phone, color: baseColor, bg: baseBg };
  if (entry.method === "sms" || entry.method === "whatsapp") return { Icon: ChatCircleText, color: baseColor, bg: baseBg };
  return { Icon: Circle, color: baseColor, bg: baseBg };
}

function titleFor(entry: ActivityEntry): string {
  if (entry.kind === "milestone") return entry.isNotRequired ? "Step marked not required" : "Step confirmed";
  if (entry.type === "internal_note") return "Note";
  const direction = entry.type === "outbound" ? "Sent" : "Received";
  const method = entry.method === "email" ? "email" : entry.method === "phone" ? "call" : entry.method === "voicemail" ? "voicemail" : entry.method === "sms" ? "SMS" : entry.method === "whatsapp" ? "WhatsApp" : entry.method === "post" ? "post" : "message";
  return `${direction} ${method}`;
}

function subtitleFor(entry: ActivityEntry): string {
  if (entry.kind === "milestone") return entry.milestoneName;
  return entry.content;
}

function isNote(e: ActivityEntry): boolean {
  return e.kind === "comm" && e.type === "internal_note";
}

// Setup notes come from the new-sale form's notes box (2026-08-19) and pin
// to the top of the card so file context is never buried under newer
// activity. Marked by subject at write time.
function isSetupNote(e: ActivityEntry): boolean {
  return isNote(e) && e.kind === "comm" && e.subject === "Setup note";
}

export function ActivityNotesCard({
  transactionId,
  entries,
  currentUserName,
  currentUserImage = null,
  currentUserRole = "",
  contacts = [],
  solicitors = [],
  canPasteChat = false,
  emailConnected = false,
}: Props) {
  const { setActiveTab } = useTabContext();
  const { toast } = useAgentToast();
  const [filter, setFilter] = useState<"all" | "notes">("all");
  // Optimistic entries added via CommsEntry, merged on top of the server feed
  // so a logged row appears instantly. Cleared when the server entries refresh
  // (real data has caught up). Mirrors ActivityTab exactly.
  const [optimistic, setOptimistic] = useState<ActivityEntry[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOptimistic([]);
    setRemovedIds((prev) => {
      const stillPresent = new Set(entries.map((e) => e.id));
      const next = new Set([...prev].filter((id) => stillPresent.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  // Newest first: optimistic rows (at = now) lead, server entries follow.
  const merged: ActivityEntry[] = [...optimistic, ...entries];
  const noteCount = merged.filter((e) => isNote(e) && !removedIds.has(e.id)).length;

  // Build an optimistic ActivityEntry from a CommsEntry add — identical to
  // ActivityTab.handleOptimisticAdd so the row matches what the timeline
  // service returns once the server revalidate lands.
  function handleOptimisticAdd(type: CommType, method: CommMethod | null, content: string, contactIds: string[]): void {
    const contactNames = contactIds
      .map((id) => contacts.find((c) => c.id === id)?.name ?? solicitors.find((s) => s.id === id)?.name)
      .filter((n): n is string => !!n);
    setOptimistic((prev) => [
      {
        kind: "comm",
        id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date(),
        type,
        method,
        content,
        createdById: null,
        createdByName: currentUserName,
        createdByImage: currentUserImage,
        createdByRole: currentUserRole,
        contactNames,
        contactIds,
        recipientName: null,
        visibleToClient: false,
        wasEdited: false,
        wasAiGenerated: false,
        isAutomated: false,
        tone: null,
        subject: null,
        rawOriginal: null,
        conversationId: null,
        aiRead: null,
        contactSuggestion: null,
        senderLabel: null,
        mediaUrl: null,
        mediaType: null,
        actorRole: "progressor",
        actorName: "You",
        actorImage: currentUserImage,
        actorSubLabel: null,
      } as ActivityEntry,
      ...prev,
    ]);
  }

  async function handleDelete(id: string) {
    if (deletingIds.has(id)) return;
    setRemovedIds((prev) => new Set([...prev, id]));
    setDeletingIds((prev) => new Set([...prev, id]));
    try {
      await deleteCommAction(id, transactionId);
      toast.success("Note removed");
    } catch {
      toast.error("Couldn't remove note. Try again");
      setRemovedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } finally {
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  return (
    <GlassCard glassId="overview-activity-notes" label="Overview · Activity & notes" defaultVariant="v05" className="overflow-hidden" style={{ borderRadius: 14 }}>
      {/* Header: title + All/Notes filter + view all */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Activity &amp; notes</h3>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button className={`agent-segment-pill agent-segment-pill-sm${filter === "all" ? " on" : ""}`} onClick={() => setFilter("all")}>All</button>
            <button className={`agent-segment-pill agent-segment-pill-sm${filter === "notes" ? " on" : ""}`} onClick={() => setFilter("notes")}>
              Notes{noteCount > 0 ? ` ${noteCount}` : ""}
            </button>
          </div>
        </div>
        <button onClick={() => setActiveTab("activity")} className="agent-link" style={{ fontSize: 11, flexShrink: 0 }}>View all <LinkArrow /></button>
      </div>

      {/* Composer — the exact Activity-tab component (critique #6) */}
      <div style={{ padding: "0 16px 12px" }}>
        <CommsEntry
          transactionId={transactionId}
          contacts={contacts}
          solicitors={solicitors}
          canPasteChat={canPasteChat}
          emailConnected={emailConnected}
          onOptimisticAdd={handleOptimisticAdd}
        />
      </div>

      {/* Pinned setup note(s) — always above the feed, in both filters,
          and excluded from the lists below so they never render twice. */}
      {merged.filter((e) => isSetupNote(e) && !removedIds.has(e.id)).map((e) => (
        <NoteRow
          key={e.id}
          content={subtitleFor(e)}
          author={e.kind === "comm" ? e.createdByName : null}
          authorImage={e.kind === "comm" ? e.createdByImage : null}
          actorRole={e.actorRole}
          actorName={e.actorName}
          actorImage={e.actorImage}
          time={fmtTime(e)}
          tag="Setup note"
          onDelete={deletingIds.has(e.id) ? undefined : () => handleDelete(e.id)}
          deleting={deletingIds.has(e.id)}
        />
      ))}

      {filter === "notes" ? (
        <NotesView entries={merged.filter((e) => !isSetupNote(e))} removedIds={removedIds} deletingIds={deletingIds} onDelete={handleDelete} />
      ) : (
        <FeedView entries={merged.filter((e) => !isSetupNote(e))} removedIds={removedIds} deletingIds={deletingIds} onDelete={handleDelete} />
      )}
    </GlassCard>
  );
}

// ── All: banded activity feed, with optimistic rows already merged in on top ──
function FeedView({ entries, removedIds, deletingIds, onDelete }: {
  entries: ActivityEntry[]; removedIds: Set<string>; deletingIds: Set<string>; onDelete: (id: string) => void;
}) {
  const visible = entries.filter((e) => !removedIds.has(e.id)).slice(0, FEED_PREVIEW);
  if (visible.length === 0) {
    return <Empty label="No activity yet" />;
  }
  const bands: Array<{ key: string; label: string; items: ActivityEntry[] }> = [];
  for (const e of visible) {
    const when = e.kind === "milestone" ? (e.at ? new Date(e.at) : new Date()) : new Date(e.at);
    const b = bandFor(when);
    const last = bands[bands.length - 1];
    if (last && last.key === b.key) last.items.push(e);
    else bands.push({ key: b.key, label: b.label, items: [e] });
  }
  return (
    <div>
      {bands.map((band) => (
        <div key={band.key}>
          <BandLabel label={band.label} />
          {band.items.map((entry) => {
            const opt = isOptimistic(entry.id);
            return isNote(entry)
              ? <NoteRow key={entry.id} content={subtitleFor(entry)} author={entry.kind === "comm" ? entry.createdByName : null} authorImage={entry.kind === "comm" ? entry.createdByImage : null} actorRole={entry.actorRole} actorName={entry.actorName} actorImage={entry.actorImage} time={opt ? "just now" : fmtTime(entry)} optimistic={opt} onDelete={opt || deletingIds.has(entry.id) ? undefined : () => onDelete(entry.id)} deleting={deletingIds.has(entry.id)} />
              : <ActivityRow key={entry.id} entry={entry} optimistic={opt} />;
          })}
        </div>
      ))}
    </div>
  );
}

// ── Notes: flat notes list, paginated ──
function NotesView({ entries, removedIds, deletingIds, onDelete }: {
  entries: ActivityEntry[]; removedIds: Set<string>; deletingIds: Set<string>; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const notes = entries.filter((e) => isNote(e) && !removedIds.has(e.id));
  if (notes.length === 0) return <Empty label="No notes yet. Add the first one above." />;

  const rows = notes.map((e) => ({
    id: e.id,
    content: subtitleFor(e),
    author: e.kind === "comm" ? e.createdByName : null,
    authorImage: e.kind === "comm" ? e.createdByImage : null,
    actorRole: e.actorRole as ActorRole | undefined,
    actorName: e.actorName,
    actorImage: e.actorImage,
    optimistic: isOptimistic(e.id),
    time: isOptimistic(e.id) ? "just now" : fmtTime(e),
  }));
  const shown = expanded ? rows : rows.slice(0, NOTES_PREVIEW);
  const hidden = rows.length - NOTES_PREVIEW;

  return (
    <div>
      {shown.map((r) => (
        <NoteRow key={r.id} content={r.content} author={r.author} authorImage={r.authorImage} actorRole={r.actorRole} actorName={r.actorName} actorImage={r.actorImage} time={r.time} optimistic={r.optimistic}
          onDelete={r.optimistic || deletingIds.has(r.id) ? undefined : () => onDelete(r.id)} deleting={deletingIds.has(r.id)} />
      ))}
      {!expanded && hidden > 0 && (
        <button onClick={() => setExpanded(true)} className="agent-link-muted" style={{ fontSize: 11, padding: "8px 16px", display: "block" }}>
          Show {hidden} more note{hidden !== 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}

function fmtTime(entry: ActivityEntry): string {
  const when = entry.kind === "milestone" ? (entry.at ? new Date(entry.at) : new Date()) : new Date(entry.at);
  return relativeDate(when);
}

function BandLabel({ label }: { label: string }) {
  return <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>;
}

function Empty({ label }: { label: string }) {
  return <div style={{ padding: 16, textAlign: "center" }}><p style={{ fontSize: 12, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>{label}</p></div>;
}

function ActivityRow({ entry, optimistic }: { entry: ActivityEntry; optimistic?: boolean }) {
  const { Icon: EntryIcon, color } = iconFor(entry);
  return (
    <div className={`agent-hover-row${optimistic ? " agent-reveal-in" : ""}`} style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", gap: 10, opacity: optimistic ? 0.65 : 1 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color, flexShrink: 0 }}>
        <EntryIcon size={22} weight="regular" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{titleFor(entry)}</span>
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>{optimistic ? "just now" : fmtTime(entry)}</span>
        </div>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {subtitleFor(entry)}
        </p>
      </div>
    </div>
  );
}

// The leveled-up note row: the note text leads, author + time beneath, a quiet
// delete that reveals on hover.
function NoteRow({ content, author, authorImage, time, optimistic, onDelete, deleting, tag, actorRole, actorName, actorImage }: {
  content: string; author: string | null; authorImage?: string | null; time: string; optimistic?: boolean; onDelete?: () => void; deleting?: boolean;
  // Small pill rendered before the author line (e.g. "Setup note" on the
  // pinned note from the new-sale form).
  tag?: string;
  // Who the row REPRESENTS (not always who logged it) — e.g. a "viewed portal"
  // row is the client, though it's logged under the progressor. When set, the
  // avatar + byline use this actor (photo / side-tinted person). Falls back to
  // author (the logger) for optimistic notes.
  actorRole?: ActorRole; actorName?: string | null; actorImage?: string | null;
}) {
  const who = actorName ?? author;
  // Drop the byline name when the text already leads with it (system lines like
  // "Mr Pete Stevens viewed…" / "Ellis Askey confirmed…") — pure duplication.
  // A manually typed note ("Chase the solicitor") doesn't start with the name,
  // so it keeps "{who} · " as its only attribution.
  const nameLeadsContent = !!who && content.trimStart().startsWith(who);
  const showByName = !!who && !nameLeadsContent;
  return (
    <div className={`agent-hover-row${optimistic ? " agent-reveal-in" : ""}`} style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "flex-start", gap: 10, opacity: optimistic ? 0.65 : 1, position: "relative" }}>
      {actorRole ? (
        <ActorAvatar name={actorName || author || "?"} role={actorRole} image={actorImage ?? null} size={28} />
      ) : author ? (
        <UserAvatar user={{ name: author, image: authorImage }} size={28} />
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color: "#1d4ed8", flexShrink: 0 }}>
          <NoteBlank size={17} weight="regular" />
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-wrap", paddingRight: onDelete ? 20 : 0 }}>{content}</p>
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--agent-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          {tag && (
            <span style={{
              fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
              color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb), 0.10)",
              padding: "1px 6px", borderRadius: 6, flexShrink: 0,
            }}>{tag}</span>
          )}
          <span>{showByName ? `${who} · ` : ""}{time}</span>
        </p>
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="agent-icon-btn agent-icon-btn-sm"
          style={{ position: "absolute", top: 6, right: 8, opacity: 0.3 }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "0.3")}
          onFocus={(e) => (e.currentTarget.style.opacity = "1")}
          onBlur={(e) => (e.currentTarget.style.opacity = "0.3")}
          aria-label="Remove note"
        >
          {deleting ? "…" : "×"}
        </button>
      )}
    </div>
  );
}

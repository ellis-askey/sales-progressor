"use client";

// Merged "Activity & notes" card for the Overview tab (2026-08-12).
// Replaces the separate Recent-activity and Notes cards — notes ARE activity,
// so they live in one place. A segmented All / Notes filter focuses the view;
// an always-present composer makes jotting a note frictionless; note rows are
// deletable inline. "View all" goes to the full Activity tab.

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTabContext } from "./TabContext";
import {
  CheckCircle, MinusCircle, NoteBlank, EnvelopeSimple, Phone, ChatCircleText, Circle, Plus,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { ActivityEntry } from "@/lib/services/comms";
import { GlassCard } from "@/components/glass/GlassCard";
import { addNoteAction, deleteCommAction } from "@/app/actions/comms";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { relativeDate } from "@/lib/utils";
import { SavingPulse } from "@/components/ui/SavingPulse";
import { UserAvatar, ActorAvatar, type ActorRole } from "@/components/ui/Avatar";

type Props = { transactionId: string; entries: ActivityEntry[]; currentUserName: string; currentUserImage?: string | null };

type OptimisticNote = { id: string; content: string; createdByName: string | null; createdByImage: string | null; at: Date };

const FEED_PREVIEW = 4;
const NOTES_PREVIEW = 5;

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

export function ActivityNotesCard({ transactionId, entries, currentUserName, currentUserImage = null }: Props) {
  const { setActiveTab } = useTabContext();
  const router = useRouter();
  const { toast } = useAgentToast();
  const [filter, setFilter] = useState<"all" | "notes">("all");
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<OptimisticNote[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<string | null>(null);

  // A fresh server render (after add/delete) resets the optimistic layer.
  useEffect(() => { setOptimistic([]); setRemovedIds(new Set()); }, [entries]);

  const noteCount = entries.filter((e) => isNote(e) && !removedIds.has(e.id)).length + optimistic.length;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    const tempId = `temp-${Date.now()}`;
    startTransition(async () => {
      setOptimistic((prev) => [{ id: tempId, content, createdByName: currentUserName, createdByImage: currentUserImage, at: new Date() }, ...prev]);
      try {
        await addNoteAction(transactionId, content);
        toast.success("Note added");
        router.refresh();
      } catch {
        toast.error("Couldn't save note. Try again");
        setOptimistic((prev) => prev.filter((n) => n.id !== tempId));
      }
    });
  }

  function handleDelete(id: string) {
    setRemovedIds((prev) => new Set([...prev, id]));
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteCommAction(id, transactionId);
        toast.success("Note removed");
        router.refresh();
      } catch {
        toast.error("Couldn't remove note. Try again");
        setRemovedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      } finally {
        setDeleting(null);
      }
    });
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
        <button onClick={() => setActiveTab("activity")} className="agent-link" style={{ fontSize: 11, flexShrink: 0 }}>View all →</button>
      </div>

      {/* Composer — always present so a note is one click away */}
      <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, padding: "0 16px 12px" }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(e); }}
          placeholder="Add a note…  (Cmd/Ctrl + Enter to save)"
          className="agent-textarea"
          style={{ flex: 1, minHeight: 44, resize: "none", fontSize: 13 }}
        />
        <button type="submit" disabled={isPending || !draft.trim()} className="agent-btn agent-btn-sm agent-btn-primary" style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 6 }}>
          {isPending ? <SavingPulse label="Saving…" /> : <><Plus size={13} weight="bold" /> Add note</>}
        </button>
      </form>

      {/* Pinned setup note(s) — always above the feed, in both filters,
          and excluded from the lists below so they never render twice. */}
      {entries.filter((e) => isSetupNote(e) && !removedIds.has(e.id)).map((e) => (
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
          onDelete={deleting || isPending ? undefined : () => handleDelete(e.id)}
          deleting={deleting === e.id}
        />
      ))}

      {filter === "notes" ? (
        <NotesView optimistic={optimistic} entries={entries.filter((e) => !isSetupNote(e))} removedIds={removedIds} deleting={deleting} isPending={isPending} onDelete={handleDelete} />
      ) : (
        <FeedView optimistic={optimistic} entries={entries.filter((e) => !isSetupNote(e))} removedIds={removedIds} deleting={deleting} isPending={isPending} onDelete={handleDelete} />
      )}
    </GlassCard>
  );
}

// ── All: banded activity feed (real entries), with optimistic notes on top ──
function FeedView({ optimistic, entries, removedIds, deleting, isPending, onDelete }: {
  optimistic: OptimisticNote[]; entries: ActivityEntry[]; removedIds: Set<string>; deleting: string | null; isPending: boolean; onDelete: (id: string) => void;
}) {
  const visible = entries.filter((e) => !removedIds.has(e.id)).slice(0, FEED_PREVIEW);
  if (optimistic.length === 0 && visible.length === 0) {
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
      {optimistic.map((n) => (
        <NoteRow key={n.id} content={n.content} author={n.createdByName} authorImage={n.createdByImage} time="just now" optimistic />
      ))}
      {bands.map((band) => (
        <div key={band.key}>
          <BandLabel label={band.label} />
          {band.items.map((entry) =>
            isNote(entry)
              ? <NoteRow key={entry.id} content={subtitleFor(entry)} author={entry.kind === "comm" ? entry.createdByName : null} authorImage={entry.kind === "comm" ? entry.createdByImage : null} actorRole={entry.actorRole} actorName={entry.actorName} actorImage={entry.actorImage} time={fmtTime(entry)} onDelete={deleting || isPending ? undefined : () => onDelete(entry.id)} deleting={deleting === entry.id} />
              : <ActivityRow key={entry.id} entry={entry} />,
          )}
        </div>
      ))}
    </div>
  );
}

// ── Notes: flat notes list (optimistic + real), paginated ──
function NotesView({ optimistic, entries, removedIds, deleting, isPending, onDelete }: {
  optimistic: OptimisticNote[]; entries: ActivityEntry[]; removedIds: Set<string>; deleting: string | null; isPending: boolean; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const realNotes = entries.filter((e) => isNote(e) && !removedIds.has(e.id));
  const total = optimistic.length + realNotes.length;
  if (total === 0) return <Empty label="No notes yet. Add the first one above." />;

  const optRows = optimistic.map((n) => ({ id: n.id, content: n.content, author: n.createdByName, authorImage: n.createdByImage, actorRole: undefined as ActorRole | undefined, actorName: null as string | null, actorImage: null as string | null, time: "just now", optimistic: true as const }));
  const realRows = realNotes.map((e) => ({ id: e.id, content: subtitleFor(e), author: e.kind === "comm" ? e.createdByName : null, authorImage: e.kind === "comm" ? e.createdByImage : null, actorRole: e.actorRole as ActorRole | undefined, actorName: e.actorName, actorImage: e.actorImage, time: fmtTime(e), optimistic: false as const }));
  const all = [...optRows, ...realRows];
  const shown = expanded ? all : all.slice(0, NOTES_PREVIEW);
  const hidden = all.length - NOTES_PREVIEW;

  return (
    <div>
      {shown.map((r) => (
        <NoteRow key={r.id} content={r.content} author={r.author} authorImage={r.authorImage} actorRole={r.actorRole} actorName={r.actorName} actorImage={r.actorImage} time={r.time} optimistic={r.optimistic}
          onDelete={r.optimistic || deleting || isPending ? undefined : () => onDelete(r.id)} deleting={deleting === r.id} />
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

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { Icon: EntryIcon, color } = iconFor(entry);
  return (
    <div className="agent-hover-row" style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color, flexShrink: 0 }}>
        <EntryIcon size={17} weight="regular" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{titleFor(entry)}</span>
          <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>{fmtTime(entry)}</span>
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
          <span>{who ? `${who} · ` : ""}{time}</span>
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

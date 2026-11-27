"use client";

// Merged "Activity & notes" card for the Overview tab (2026-08-12).
// Notes ARE activity, so they live in one place. A segmented All / Notes filter
// focuses the view; note rows are deletable inline; "View all" goes to the full
// Activity tab.
//
// Critique #238 (2026-10-13): the composer here is now the SAME single
// "Log an update" button + modal (<LogUpdateModal>) used on the Activity tab,
// replacing the old always-open CommsEntry strip (draft-for-everyone, note,
// "More" buttons). One trigger, one shared code path, same optimistic wiring.
// (Supersedes critique #6, which had made this the inline CommsEntry.)

import { useState, useEffect } from "react";
import { useTabContext } from "./TabContext";
import {
  CheckCircle, MinusCircle, NoteBlank, EnvelopeSimple, Phone, ChatCircleText, Circle, PencilSimple,
} from "@/components/icons/ph";
import type { Icon } from "@/components/icons/ph";
import type { ActivityEntry } from "@/lib/services/comms";
import type { CommType, CommMethod } from "@prisma/client";
import { GlassCard } from "@/components/glass/GlassCard";
import { deleteCommAction, editCommAction } from "@/app/actions/comms";
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
  // The signed-in user's id — gates the inline edit affordance to your OWN
  // notes, mirroring the Activity tab's isOwnNote rule.
  currentUserId: string;
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

// Inline-edit wiring threaded down to each NoteRow. Lets a row render the
// pencil (when the note is the user's own), swap its text for a textarea in
// edit mode, and optimistically reflect a save. Mirrors ActivityTimeline.
type EditController = {
  localEdits: Record<string, { content: string; editedAt: Date }>;
  editingId: string | null;
  editDraft: string;
  savingId: string | null;
  canEditEntry: (e: ActivityEntry) => boolean;
  onStart: (e: ActivityEntry) => void;
  onChange: (v: string) => void;
  onSave: (id: string) => void;
  onCancel: () => void;
};

// The content + edited-time + edit callbacks a NoteRow needs for one entry,
// derived from the controller. Applies any optimistic local edit on top.
function noteRowEdit(entry: ActivityEntry, edit: EditController) {
  const override = edit.localEdits[entry.id];
  const content = override?.content ?? (entry.kind === "comm" ? entry.content : "");
  const editedAt = override?.editedAt
    ?? (entry.kind === "comm" && entry.wasEdited ? entry.editedAt : null);
  const editing = edit.editingId === entry.id;
  const canEdit = edit.canEditEntry(entry);
  return {
    content,
    editedAt,
    editing,
    onEdit: canEdit && !editing ? () => edit.onStart(entry) : undefined,
    editDraft: edit.editDraft,
    onEditChange: edit.onChange,
    onEditSave: () => edit.onSave(entry.id),
    onEditCancel: edit.onCancel,
    saving: edit.savingId === entry.id,
  };
}

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
  currentUserId,
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
  // Inline note editing — mirrors the Activity tab. editingId names the row in
  // edit mode; editDraft holds the live textarea value; savingId tracks the
  // in-flight save; localEdits optimistically overrides content + marks the row
  // edited until the server revalidate brings the fresh entry back.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, { content: string; editedAt: Date }>>({});

  useEffect(() => {
    setOptimistic([]);
    setRemovedIds((prev) => {
      const stillPresent = new Set(entries.map((e) => e.id));
      const next = new Set([...prev].filter((id) => stillPresent.has(id)));
      return next.size === prev.size ? prev : next;
    });
    // Fresh entries have landed from the revalidate, so the server now carries
    // the saved content + real edited time — drop the optimistic overrides.
    setLocalEdits((prev) => (Object.keys(prev).length ? {} : prev));
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
        editedAt: null,
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
        replies: [],
        editableByAuthor: true,
        reactions: [],
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

  // You can edit any update you LOGGED yourself — a note OR a manually-logged
  // call / SMS / email — same rule as the Activity tab (editableByAuthor carries
  // the manual-log rule from the service: never a real send / automated /
  // inbound; own-only kept here). Deleting stays notes-only (see handleDelete's
  // callers). Excludes optimistic (not-yet-persisted) rows. (Ellis, 2026-09-26;
  // broadened 2026-11.)
  function canEditEntry(e: ActivityEntry): boolean {
    return (
      e.kind === "comm"
      && e.editableByAuthor
      && (!currentUserId || e.createdById === currentUserId)
      && !isOptimistic(e.id)
    );
  }

  function startEdit(e: ActivityEntry) {
    if (e.kind !== "comm") return;
    setEditingId(e.id);
    setEditDraft(localEdits[e.id]?.content ?? e.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
  }

  async function saveEdit(id: string) {
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    const entry = merged.find((e) => e.id === id);
    if (!entry || entry.kind !== "comm") return;
    // Optimistic: show the new text + "edited" immediately, roll back on failure.
    setLocalEdits((prev) => ({ ...prev, [id]: { content: trimmed, editedAt: new Date() } }));
    setEditingId(null);
    setEditDraft("");
    setSavingId(id);
    try {
      await editCommAction({
        id,
        transactionId,
        content: trimmed,
        contactIds: entry.contactIds,
        visibleToClient: entry.visibleToClient,
      });
      toast.success("Update saved");
    } catch {
      toast.error("Couldn't save your update. Try again");
      setLocalEdits((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } finally {
      setSavingId((cur) => (cur === id ? null : cur));
    }
  }

  const editController: EditController = {
    localEdits,
    editingId,
    editDraft,
    savingId,
    canEditEntry,
    onStart: startEdit,
    onChange: setEditDraft,
    onSave: saveEdit,
    onCancel: cancelEdit,
  };

  return (
    <GlassCard glassId="overview-activity-notes" label="Overview · Activity & notes" defaultVariant="v05" className="overflow-hidden" style={{ borderRadius: 14 }}>
      {/* Header: title + All/Notes filter + Log an update + view all. The compact
          trigger sits on this row next to the pills (critique #295); flex-wrap
          drops it to its own line when the card runs out of width. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, rowGap: 6, padding: "12px 16px 10px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, rowGap: 6, minWidth: 0, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Activity &amp; notes</h3>
          <div style={{ display: "inline-flex", gap: 4 }}>
            <button className={`agent-segment-pill agent-segment-pill-sm${filter === "all" ? " on" : ""}`} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setFilter("all")}>All</button>
            <button className={`agent-segment-pill agent-segment-pill-sm${filter === "notes" ? " on" : ""}`} style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setFilter("notes")}>
              Notes{noteCount > 0 ? ` ${noteCount}` : ""}
            </button>
          </div>
        </div>
        <button onClick={() => setActiveTab("activity")} className="agent-link" style={{ fontSize: 11, flexShrink: 0 }}>View all <LinkArrow /></button>
      </div>

      {/* Pinned setup note(s) — always above the feed, in both filters,
          and excluded from the lists below so they never render twice. */}
      {merged.filter((e) => isSetupNote(e) && !removedIds.has(e.id)).map((e) => {
        const re = noteRowEdit(e, editController);
        return (
          <NoteRow
            key={e.id}
            content={re.content}
            author={e.kind === "comm" ? e.createdByName : null}
            authorImage={e.kind === "comm" ? e.createdByImage : null}
            actorRole={e.actorRole}
            actorName={e.actorName}
            actorImage={e.actorImage}
            time={fmtTime(e)}
            editedAt={re.editedAt}
            tag="Setup note"
            onOpen={() => setActiveTab("activity")}
            onDelete={deletingIds.has(e.id) ? undefined : () => handleDelete(e.id)}
            deleting={deletingIds.has(e.id)}
            onEdit={re.onEdit}
            editing={re.editing}
            editDraft={re.editDraft}
            onEditChange={re.onEditChange}
            onEditSave={re.onEditSave}
            onEditCancel={re.onEditCancel}
            saving={re.saving}
            replyCount={e.kind === "comm" ? e.replies.length : 0}
          />
        );
      })}

      {filter === "notes" ? (
        <NotesView entries={merged.filter((e) => !isSetupNote(e))} removedIds={removedIds} deletingIds={deletingIds} onDelete={handleDelete} onOpen={() => setActiveTab("activity")} edit={editController} />
      ) : (
        <FeedView entries={merged.filter((e) => !isSetupNote(e))} removedIds={removedIds} deletingIds={deletingIds} onDelete={handleDelete} onOpen={() => setActiveTab("activity")} edit={editController} />
      )}
    </GlassCard>
  );
}

// ── All: banded activity feed, with optimistic rows already merged in on top ──
function FeedView({ entries, removedIds, deletingIds, onDelete, onOpen, edit }: {
  entries: ActivityEntry[]; removedIds: Set<string>; deletingIds: Set<string>; onDelete: (id: string) => void; onOpen: () => void; edit: EditController;
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
            if (!isNote(entry)) return <ActivityRow key={entry.id} entry={entry} optimistic={opt} onOpen={onOpen} edit={edit} />;
            const re = noteRowEdit(entry, edit);
            return <NoteRow key={entry.id} content={re.content} author={entry.kind === "comm" ? entry.createdByName : null} authorImage={entry.kind === "comm" ? entry.createdByImage : null} actorRole={entry.actorRole} actorName={entry.actorName} actorImage={entry.actorImage} time={opt ? "just now" : fmtTime(entry)} editedAt={re.editedAt} optimistic={opt} onOpen={onOpen} onDelete={opt || deletingIds.has(entry.id) ? undefined : () => onDelete(entry.id)} deleting={deletingIds.has(entry.id)} onEdit={re.onEdit} editing={re.editing} editDraft={re.editDraft} onEditChange={re.onEditChange} onEditSave={re.onEditSave} onEditCancel={re.onEditCancel} saving={re.saving} replyCount={entry.kind === "comm" ? entry.replies.length : 0} />;
          })}
        </div>
      ))}
    </div>
  );
}

// ── Notes: flat notes list, paginated ──
function NotesView({ entries, removedIds, deletingIds, onDelete, onOpen, edit }: {
  entries: ActivityEntry[]; removedIds: Set<string>; deletingIds: Set<string>; onDelete: (id: string) => void; onOpen: () => void; edit: EditController;
}) {
  const [expanded, setExpanded] = useState(false);
  const notes = entries.filter((e) => isNote(e) && !removedIds.has(e.id));
  if (notes.length === 0) return <Empty label="No notes yet. Add the first one above." />;

  const rows = notes.map((e) => ({
    entry: e,
    id: e.id,
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
      {shown.map((r) => {
        const re = noteRowEdit(r.entry, edit);
        return (
        <NoteRow key={r.id} content={re.content} author={r.author} authorImage={r.authorImage} actorRole={r.actorRole} actorName={r.actorName} actorImage={r.actorImage} time={r.time} editedAt={re.editedAt} optimistic={r.optimistic} onOpen={onOpen}
          onDelete={r.optimistic || deletingIds.has(r.id) ? undefined : () => onDelete(r.id)} deleting={deletingIds.has(r.id)}
          onEdit={re.onEdit} editing={re.editing} editDraft={re.editDraft} onEditChange={re.onEditChange} onEditSave={re.onEditSave} onEditCancel={re.onEditCancel} saving={re.saving} replyCount={r.entry.kind === "comm" ? r.entry.replies.length : 0} />
        );
      })}
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

function ActivityRow({ entry, optimistic, onOpen, edit }: { entry: ActivityEntry; optimistic?: boolean; onOpen?: () => void; edit?: EditController }) {
  const { Icon: EntryIcon, color } = iconFor(entry);
  // Non-note comms the author logged (call / SMS / logged email) are now
  // text-editable here too, same rule + optimistic wiring as the note rows.
  // Milestone rows and others' rows get no edit (canEditEntry gates it).
  const re = edit ? noteRowEdit(entry, edit) : null;
  const editing = !!re?.editing;
  const canEdit = !!re?.onEdit;
  const editedAt = re?.editedAt ?? null;
  const content = entry.kind === "comm" ? (re?.content ?? entry.content) : subtitleFor(entry);
  // Suppress whole-row navigation while editing so a background click can't
  // discard the in-progress edit.
  const rowOpen = editing ? undefined : onOpen;
  return (
    <div
      className={`agent-hover-row${optimistic ? " agent-reveal-in" : ""}`}
      role={rowOpen ? "button" : undefined}
      tabIndex={rowOpen ? 0 : undefined}
      onClick={rowOpen}
      onKeyDown={rowOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rowOpen(); } } : undefined}
      style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: editing ? "flex-start" : "center", gap: 10, opacity: optimistic ? 0.65 : 1, position: "relative", cursor: rowOpen ? "pointer" : undefined }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color, flexShrink: 0 }}>
        <EntryIcon size={22} weight="regular" />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <textarea
              value={re?.editDraft ?? ""}
              onChange={(e) => re?.onEditChange(e.target.value)}
              rows={Math.max(2, Math.min(8, (re?.editDraft ?? "").split("\n").length + 1))}
              className="glass-input w-full px-3 py-2.5 text-sm resize-none"
              autoFocus
            />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); re?.onEditCancel(); }} className="agent-btn agent-btn-sm agent-btn-secondary">Cancel</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); re?.onEditSave(); }} disabled={!(re?.editDraft ?? "").trim() || re?.saving} className="agent-btn agent-btn-sm agent-btn-primary">Save</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>{titleFor(entry)}</span>
              <span style={{ fontSize: 10, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                {optimistic ? "just now" : editedAt ? `edited ${relativeDate(editedAt)}` : fmtTime(entry)}
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", paddingRight: canEdit ? 22 : 0 }}>
              {content}
            </p>
          </>
        )}
      </div>
      {!editing && canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); re?.onEdit?.(); }}
          className="agent-icon-btn agent-icon-btn-sm"
          style={{ position: "absolute", top: 6, right: 8, opacity: 0.3 }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "0.3")}
          onFocus={(e) => (e.currentTarget.style.opacity = "1")}
          onBlur={(e) => (e.currentTarget.style.opacity = "0.3")}
          aria-label="Edit update"
        >
          <PencilSimple size={13} weight="regular" />
        </button>
      )}
    </div>
  );
}

// The leveled-up note row: the note text leads, author + time beneath, a quiet
// delete that reveals on hover.
function NoteRow({ content, author, authorImage, time, editedAt, optimistic, onDelete, deleting, tag, actorRole, actorName, actorImage, onOpen, onEdit, editing, editDraft, onEditChange, onEditSave, onEditCancel, saving, replyCount = 0 }: {
  content: string; author: string | null; authorImage?: string | null; time: string; optimistic?: boolean; onDelete?: () => void; deleting?: boolean;
  // Number of threaded replies on this note. Shown as a quiet "{n} repl{y/ies}"
  // indicator in the byline; the full thread lives on the Activity tab.
  replyCount?: number;
  // Real last-edit time. When set the byline reads "edited {time}" in place of
  // the created time; null/omitted for a note that's never been edited.
  editedAt?: Date | null;
  // Whole-row click → the full Activity tab (critique #296).
  onOpen?: () => void;
  // Small pill rendered before the author line (e.g. "Setup note" on the
  // pinned note from the new-sale form).
  tag?: string;
  // Who the row REPRESENTS (not always who logged it) — e.g. a "viewed portal"
  // row is the client, though it's logged under the progressor. When set, the
  // avatar + byline use this actor (photo / side-tinted person). Falls back to
  // author (the logger) for optimistic notes.
  actorRole?: ActorRole; actorName?: string | null; actorImage?: string | null;
  // Inline edit — shown only for the user's own manually-typed notes. onEdit
  // enters edit mode; editing swaps the text for a textarea with Save/Cancel.
  onEdit?: () => void; editing?: boolean; editDraft?: string;
  onEditChange?: (v: string) => void; onEditSave?: () => void; onEditCancel?: () => void; saving?: boolean;
}) {
  const who = actorName ?? author;
  // Drop the byline name when the text already leads with it (system lines like
  // "Mr Pete Stevens viewed…" / "Ellis Askey confirmed…") — pure duplication.
  // A manually typed note ("Chase the solicitor") doesn't start with the name,
  // so it keeps "{who} · " as its only attribution.
  const nameLeadsContent = !!who && content.trimStart().startsWith(who);
  const showByName = !!who && !nameLeadsContent;
  // Whole-row navigation is suppressed while editing so a background click can't
  // throw away the in-progress edit.
  const rowOpen = editing ? undefined : onOpen;
  // Room on the right for the hover controls (pencil + delete).
  const actionPad = (onEdit && onDelete) ? 44 : (onEdit || onDelete) ? 22 : 0;
  return (
    <div
      className={`agent-hover-row${optimistic ? " agent-reveal-in" : ""}`}
      role={rowOpen ? "button" : undefined}
      tabIndex={rowOpen ? 0 : undefined}
      onClick={rowOpen}
      onKeyDown={rowOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); rowOpen(); } } : undefined}
      style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "flex-start", gap: 10, opacity: optimistic ? 0.65 : 1, position: "relative", cursor: rowOpen ? "pointer" : undefined }}>
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
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} onClick={(e) => e.stopPropagation()}>
            <textarea
              value={editDraft ?? ""}
              onChange={(e) => onEditChange?.(e.target.value)}
              rows={Math.max(2, Math.min(8, (editDraft ?? "").split("\n").length + 1))}
              className="glass-input w-full px-3 py-2.5 text-sm resize-none"
              autoFocus
            />
            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); onEditCancel?.(); }} className="agent-btn agent-btn-sm agent-btn-secondary">Cancel</button>
              <button type="button" onClick={(e) => { e.stopPropagation(); onEditSave?.(); }} disabled={!(editDraft ?? "").trim() || saving} className="agent-btn agent-btn-sm agent-btn-primary">Save</button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-primary)", lineHeight: 1.45, whiteSpace: "pre-wrap", paddingRight: actionPad }}>{content}</p>
            <p style={{ margin: "3px 0 0", fontSize: 10, color: "var(--agent-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              {tag && (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  color: "var(--agent-coral-deep)", background: "rgba(var(--agent-coral-rgb), 0.10)",
                  padding: "1px 6px", borderRadius: 6, flexShrink: 0,
                }}>{tag}</span>
              )}
              <span>{showByName ? `${who} · ` : ""}{editedAt ? `edited ${relativeDate(editedAt)}` : time}</span>
              {replyCount > 0 && (
                <span style={{ color: "var(--agent-text-muted)" }}>· {replyCount} {replyCount === 1 ? "reply" : "replies"}</span>
              )}
            </p>
          </>
        )}
      </div>
      {!editing && onEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="agent-icon-btn agent-icon-btn-sm"
          style={{ position: "absolute", top: 6, right: onDelete ? 30 : 8, opacity: 0.3 }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "0.3")}
          onFocus={(e) => (e.currentTarget.style.opacity = "1")}
          onBlur={(e) => (e.currentTarget.style.opacity = "0.3")}
          aria-label="Edit note"
        >
          <PencilSimple size={13} weight="regular" />
        </button>
      )}
      {!editing && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
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

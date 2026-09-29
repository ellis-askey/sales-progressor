"use client";

// Merged "Activity & notes" card for the Overview tab (2026-08-12).
// Replaces the separate Recent-activity and Notes cards — notes ARE activity,
// so they live in one place. A segmented All / Notes filter focuses the view;
// an always-present composer makes jotting a note frictionless; note rows are
// deletable inline. "View all" goes to the full Activity tab.

import { useState, useEffect, useRef } from "react";
import { useTabContext } from "./TabContext";
import {
  CheckCircle, MinusCircle, NoteBlank, EnvelopeSimple, Phone, ChatCircleText, Circle, Plus,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import type { ActivityEntry } from "@/lib/services/comms";
import { GlassCard } from "@/components/glass/GlassCard";
import { addNoteAction, deleteCommAction, logCommAction } from "@/app/actions/comms";
import { DraftForEveryonePanel } from "@/components/activity/DraftForEveryonePanel";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { relativeDate } from "@/lib/utils";
import { extractFirstName } from "@/lib/contacts/displayName";
import { SavingPulse } from "@/components/ui/SavingPulse";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { UserAvatar, ActorAvatar, ContactAvatar, type ActorRole } from "@/components/ui/Avatar";

// Client contacts + solicitors are only needed for the "Log a call" and
// "Update everyone" quick-record actions (critique #6). Same shapes the
// Activity-tab composer (CommsEntry) uses, so the two stay in step.
type ComposerContact = { id: string; name: string; roleType: string; phone?: string | null };
type ComposerSolicitor = { id: string; name: string; role: string; phone?: string | null };

type Props = {
  transactionId: string;
  entries: ActivityEntry[];
  currentUserName: string;
  currentUserImage?: string | null;
  contacts?: ComposerContact[];
  solicitors?: ComposerSolicitor[];
};

// Quick-record mode for the compact toolbar. "note" is the default so a note
// stays one click away (the box is shown straight off, as before).
type RecordMode = "note" | "call" | "draft";

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

export function ActivityNotesCard({ transactionId, entries, currentUserName, currentUserImage = null, contacts = [], solicitors = [] }: Props) {
  const { setActiveTab } = useTabContext();
  const { toast } = useAgentToast();
  const [filter, setFilter] = useState<"all" | "notes">("all");
  const [draft, setDraft] = useState("");

  // Quick-record toolbar (critique #6). "note" default keeps the note box up
  // front. "call" swaps in the compact log-a-call form; "draft" drops in the
  // shared Draft-for-everyone panel. Call-form state is held across mode
  // switches (only cleared on a successful save) so an accidental tab away
  // never loses what was typed.
  const [mode, setMode] = useState<RecordMode>("note");
  const [callDirection, setCallDirection] = useState<"outbound" | "inbound">("outbound");
  const [callSelected, setCallSelected] = useState<string[]>([]);
  const [callContent, setCallContent] = useState("");
  const [callVisible, setCallVisible] = useState(false);
  const [callSaving, setCallSaving] = useState(false);
  // Phase 2 (2026-09-17): pending is ack-scoped and per-row. `saving` covers
  // the composer only and clears when the server acknowledges the write, not
  // when the follow-up refresh lands. `deletingIds` is a Set so one delete
  // in flight no longer hides the delete affordance on every other note.
  const [saving, setSaving] = useState(false);
  const [optimistic, setOptimistic] = useState<OptimisticNote[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Temp ids of adds whose server write hasn't acknowledged yet. A ref, not
  // state — only the reconcile effect reads it, at effect time.
  const pendingAddIds = useRef<Set<string>>(new Set());

  // Phase 5 (2026-09-18): reconcile the optimistic layer against fresh
  // canonical entries instead of resetting it wholesale. The wholesale reset
  // meant a payload from action A landing while delete/add B was still in
  // flight would briefly resurrect B's deleted note (or hide B's pending
  // one) until B's own payload arrived.
  //   - optimistic adds: keep rows whose write is still pending; drop rows
  //     whose write acknowledged (their canonical twin is in this payload
  //     or the next — the pending set is cleared at ack, in `finally`).
  //   - removedIds: keep hiding ids the payload still contains (the delete
  //     is in flight or its payload hasn't landed); drop ids the server no
  //     longer sends (canonically gone). A FAILED delete is unaffected —
  //     its catch removes the id explicitly, restoring the row.
  useEffect(() => {
    setOptimistic((prev) => prev.filter((n) => pendingAddIds.current.has(n.id)));
    setRemovedIds((prev) => {
      const stillPresent = new Set(entries.map((e) => e.id));
      const next = new Set([...prev].filter((id) => stillPresent.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [entries]);

  const noteCount = entries.filter((e) => isNote(e) && !removedIds.has(e.id)).length + optimistic.length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || saving) return;
    setSaving(true);
    setDraft("");
    const tempId = `temp-${Date.now()}`;
    pendingAddIds.current.add(tempId);
    setOptimistic((prev) => [{ id: tempId, content, createdByName: currentUserName, createdByImage: currentUserImage, at: new Date() }, ...prev]);
    try {
      await addNoteAction(transactionId, content);
      toast.success("Note added");
      // Phase 4 (2026-09-18, PERF-03): no client refresh - addNoteAction
      // revalidates the file page, so its response already carries the
      // canonical note; the optimistic row reconciles from that.
    } catch {
      toast.error("Couldn't save note. Try again");
      setOptimistic((prev) => prev.filter((n) => n.id !== tempId));
      // Put the text back so the agent can retry without retyping.
      setDraft((current) => (current.trim() ? current : content));
    } finally {
      pendingAddIds.current.delete(tempId);
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingIds.has(id)) return;
    setRemovedIds((prev) => new Set([...prev, id]));
    setDeletingIds((prev) => new Set([...prev, id]));
    try {
      await deleteCommAction(id, transactionId);
      toast.success("Note removed");
      // Phase 4: no client refresh - deleteCommAction revalidates the file page.
    } catch {
      toast.error("Couldn't remove note. Try again");
      setRemovedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    } finally {
      setDeletingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  function toggleCallContact(id: string) {
    setCallSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Log a phone call through the SAME action the Activity-tab composer uses, so
  // it lands in the feed/timeline identically. No optimistic row: logCommAction
  // revalidates the file page, so the new entry streams into the feed on ack.
  async function handleLogCall() {
    const content = callContent.trim();
    if (!content || callSaving) return;
    setCallSaving(true);
    try {
      await logCommAction({
        transactionId,
        type: callDirection === "outbound" ? "outbound" : "inbound",
        method: "phone",
        contactIds: callSelected,
        content,
        visibleToClient: callVisible,
      });
      toast.success("Call logged");
      setCallContent("");
      setCallSelected([]);
      setCallVisible(false);
      setCallDirection("outbound");
      setMode("note");
    } catch {
      toast.error("Couldn't log the call. Try again");
    } finally {
      setCallSaving(false);
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

      {/* Quick-record toolbar (critique #6) — always visible. Mirrors the
          Activity-tab composer's channels, minus the "More" set, in a compact
          row. Selecting one swaps the body below. */}
      <div style={{ display: "flex", gap: 6, padding: "0 16px 10px", flexWrap: "wrap" }}>
        <RecordTab active={mode === "draft"} primary onClick={() => setMode("draft")}>✨ Update everyone</RecordTab>
        <RecordTab active={mode === "call"} onClick={() => setMode("call")}>📞 Log a call</RecordTab>
        <RecordTab active={mode === "note"} onClick={() => setMode("note")}>📝 Note</RecordTab>
      </div>

      {/* Note — the default body, so a note stays one click away as before */}
      {mode === "note" && (
        <form onSubmit={handleAdd} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "0 16px 12px" }}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd(e); }}
            placeholder="Add a note…  (Cmd/Ctrl + Enter to save)"
            className="agent-textarea"
            rows={1}
            style={{ flex: 1, minHeight: 38, resize: "vertical", fontSize: 13 }}
          />
          <button type="submit" disabled={saving || !draft.trim()} className="agent-btn agent-btn-sm agent-btn-primary" style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {saving ? <SavingPulse label="Saving…" /> : <><Plus size={13} weight="bold" /> Add note</>}
          </button>
        </form>
      )}

      {/* Log a call — compact version of the Activity-tab call form. Same
          direction + who-it-was-with + share-with-client, calling logCommAction. */}
      {mode === "call" && (
        <div className="agent-reveal-in" style={{ padding: "0 16px 12px" }}>
          {/* Direction */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>Direction:</span>
            <button
              onClick={() => setCallDirection("outbound")}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: callDirection === "outbound" ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                color: callDirection === "outbound" ? "var(--agent-coral)" : "var(--agent-text-muted)",
                transition: "background 100ms, color 100ms",
              }}
            >
              Outbound (made)
            </button>
            <button
              onClick={() => setCallDirection("inbound")}
              style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                background: callDirection === "inbound" ? "rgba(16,185,129,0.12)" : "var(--agent-surface-glass)",
                color: callDirection === "inbound" ? "#059669" : "var(--agent-text-muted)",
                transition: "background 100ms, color 100ms",
              }}
            >
              Inbound (took)
            </button>
          </div>

          {/* Who the call was with — clients then solicitors */}
          {(contacts.length > 0 || solicitors.length > 0) && (
            <div style={{ marginBottom: 10 }}>
              {solicitors.length > 0 && contacts.length > 0 && (
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Clients</p>
              )}
              {contacts.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {contacts.map((c) => {
                    const on = callSelected.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCallContact(c.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                          fontSize: 12, fontWeight: 500,
                          background: on ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                          color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                          transition: "background 80ms, color 80ms",
                        }}
                      >
                        <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={16} />
                        {extractFirstName(c.name)}
                      </button>
                    );
                  })}
                </div>
              )}
              {solicitors.length > 0 && (
                <>
                  {contacts.length > 0 && (
                    <p style={{ fontSize: 10, fontWeight: 600, color: "var(--agent-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "8px 0 6px" }}>Solicitors</p>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {solicitors.map((s) => {
                      const on = callSelected.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleCallContact(s.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                            fontSize: 12, fontWeight: 500,
                            background: on ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                            color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                            transition: "background 80ms, color 80ms",
                          }}
                        >
                          <ContactAvatar contact={{ name: s.name, roleType: s.role === "Vendor solicitor" ? "vendor" : "purchaser" }} size={16} />
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* What was said */}
          <textarea
            value={callContent}
            onChange={(e) => setCallContent(e.target.value)}
            placeholder="What was discussed on the call?"
            rows={3}
            className="glass-input w-full px-3 py-2.5 text-sm resize-none"
          />

          {/* Save + share-with-client */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
            <button onClick={handleLogCall} disabled={!callContent.trim() || callSaving} className="agent-btn agent-btn-sm agent-btn-primary">
              {callSaving ? <SavingPulse label="Saving…" /> : "Log call"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
              <div
                onClick={() => setCallVisible((v) => !v)}
                style={{
                  position: "relative", width: 36, height: 20, borderRadius: 10, flexShrink: 0, cursor: "pointer",
                  background: callVisible ? "#3b82f6" : "rgba(15,23,42,0.15)", transition: "background 150ms",
                }}
              >
                <span style={{ position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transform: callVisible ? "translateX(16px)" : "translateX(0)", transition: "transform 150ms", display: "block" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: callVisible ? "#3b82f6" : "var(--agent-text-muted)", transition: "color 150ms" }}>
                {callVisible ? "Visible in client portal" : "Share with client"}
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Update everyone — the shared Draft-for-everyone panel, dropped in */}
      {mode === "draft" && (
        <div className="agent-reveal-in" style={{ padding: "0 16px 4px" }}>
          <DraftForEveryonePanel
            transactionId={transactionId}
            contacts={contacts.map((c) => ({ id: c.id, name: c.name, roleType: c.roleType }))}
            onClose={() => setMode("note")}
          />
        </div>
      )}

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
          onDelete={deletingIds.has(e.id) ? undefined : () => handleDelete(e.id)}
          deleting={deletingIds.has(e.id)}
        />
      ))}

      {filter === "notes" ? (
        <NotesView optimistic={optimistic} entries={entries.filter((e) => !isSetupNote(e))} removedIds={removedIds} deletingIds={deletingIds} onDelete={handleDelete} />
      ) : (
        <FeedView optimistic={optimistic} entries={entries.filter((e) => !isSetupNote(e))} removedIds={removedIds} deletingIds={deletingIds} onDelete={handleDelete} />
      )}
    </GlassCard>
  );
}

// ── All: banded activity feed (real entries), with optimistic notes on top ──
function FeedView({ optimistic, entries, removedIds, deletingIds, onDelete }: {
  optimistic: OptimisticNote[]; entries: ActivityEntry[]; removedIds: Set<string>; deletingIds: Set<string>; onDelete: (id: string) => void;
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
              ? <NoteRow key={entry.id} content={subtitleFor(entry)} author={entry.kind === "comm" ? entry.createdByName : null} authorImage={entry.kind === "comm" ? entry.createdByImage : null} actorRole={entry.actorRole} actorName={entry.actorName} actorImage={entry.actorImage} time={fmtTime(entry)} onDelete={deletingIds.has(entry.id) ? undefined : () => onDelete(entry.id)} deleting={deletingIds.has(entry.id)} />
              : <ActivityRow key={entry.id} entry={entry} />,
          )}
        </div>
      ))}
    </div>
  );
}

// ── Notes: flat notes list (optimistic + real), paginated ──
function NotesView({ optimistic, entries, removedIds, deletingIds, onDelete }: {
  optimistic: OptimisticNote[]; entries: ActivityEntry[]; removedIds: Set<string>; deletingIds: Set<string>; onDelete: (id: string) => void;
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

// Compact toolbar button for the quick-record row (critique #6). `primary` is
// the coral "Update everyone" CTA; the others are ghost pills that turn coral
// when active.
function RecordTab({ active, primary, onClick, children }: { active: boolean; primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
          padding: "5px 11px", borderRadius: 8, border: "1px solid transparent", cursor: "pointer",
          color: "#fff",
          background: "linear-gradient(180deg, var(--agent-coral) 0%, var(--agent-coral-deep) 100%)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 4px rgba(224,78,44,0.24)",
          transition: "filter 120ms ease",
        }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
        padding: "5px 11px", borderRadius: 8, cursor: "pointer",
        background: active ? "rgba(var(--agent-coral-rgb),0.10)" : "var(--agent-surface-glass)",
        border: active ? "1px solid var(--agent-coral-deep)" : "1px solid var(--agent-border-default)",
        color: active ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
        transition: "background 120ms, border-color 120ms, color 120ms",
      }}
    >
      {children}
    </button>
  );
}

function ActivityRow({ entry }: { entry: ActivityEntry }) {
  const { Icon: EntryIcon, color } = iconFor(entry);
  return (
    <div className="agent-hover-row" style={{ padding: "8px 16px", borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, color, flexShrink: 0 }}>
        <EntryIcon size={22} weight="regular" />
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

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { usePickForCard } from "@/lib/glass/context";
import { classFor } from "@/lib/glass/variants";
import { DateField } from "@/components/ui/DateField";

export function AddManualTaskForm({
  transactionId,
  transactionAddress,
  attachableFiles,
  showOwnership = false,
  internalMode = false,
  allowReview = false,
  onAdd,
}: {
  transactionId?: string;
  transactionAddress?: string;
  // Files this user can attach a to-do to (id + address). Enables the property
  // picker on the To-Do page, where the to-do isn't already tied to a file.
  attachableFiles?: { id: string; propertyAddress: string }[];
  showOwnership?: boolean;
  // Internal-staff variant — hides the ownership toggle, relabels the
  // primary button, and the caller is responsible for setting
  // isInternalSelfAssigned on the POST.
  internalMode?: boolean;
  // When true, offers a "Mark as a review" toggle (only meaningful when a file
  // is linked). A review lands in the "Reviews due" section on /agent/to-do.
  allowReview?: boolean;
  onAdd: (task: {
    title: string;
    notes?: string;
    dueDate?: string;
    transactionId?: string;
    isAgentRequest?: boolean;
    isReview?: boolean;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [owner, setOwner] = useState<"mine" | "progressor">("mine");
  const [isReview, setIsReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateError, setDateError] = useState("");
  // Property attachment (To-Do page only — pre-set transactionId skips this).
  const [pickedTx, setPickedTx] = useState<{ id: string; propertyAddress: string } | null>(null);
  const [propSearch, setPropSearch] = useState("");
  const showPicker = !transactionId && !!attachableFiles && attachableFiles.length > 0;
  const propMatches = showPicker && propSearch.trim()
    ? attachableFiles!.filter((f) => f.propertyAddress.toLowerCase().includes(propSearch.trim().toLowerCase())).slice(0, 8)
    : [];
  // A review only makes sense on a linked file with a date to come back on.
  const canReview = allowReview && !!transactionId;
  // Design Lab: `todo-add-form`. The composer is a <form> (can't be a
  // GlassCard div), so it's tagged in place — variant class + data
  // attributes computed from the current pick (default v03). 2026-08-09.
  const formVariant = usePickForCard("todo-add-form") ?? "v03";

  function localDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function todayStr() {
    return localDateStr(new Date());
  }

  function handleOpen() {
    const now = new Date();
    if (now.getHours() >= 15) {
      const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      setDueDate(localDateStr(tomorrow));
    } else {
      setDueDate(todayStr());
    }
    setDateError("");
    setOpen(true);
  }

  function handleCancel() {
    setOpen(false);
    setTitle("");
    setNotes("");
    setDueDate("");
    setOwner("mine");
    setIsReview(false);
    setDateError("");
    setPickedTx(null);
    setPropSearch("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    // Client-side past-date guard (min attr handles it for most browsers, this is the fallback)
    if (dueDate && dueDate < todayStr()) {
      setDateError("Due date cannot be in the past.");
      return;
    }
    // A review needs a date to come back on.
    if (canReview && isReview && !dueDate) {
      setDateError("Pick a date for the review.");
      return;
    }
    setDateError("");

    setSaving(true);
    await onAdd({
      title: title.trim(),
      notes: notes.trim() || undefined,
      dueDate: dueDate || undefined,
      transactionId: transactionId ?? pickedTx?.id,
      isAgentRequest: showOwnership && owner === "progressor",
      isReview: canReview && isReview,
    });
    setTitle(""); setNotes(""); setDueDate(""); setOwner("mine"); setIsReview(false); setPickedTx(null); setPropSearch("");
    setSaving(false);
    setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={handleOpen} className="agent-btn agent-btn-sm agent-btn-ghost-bordered">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {internalMode ? "Add internal to-do" : "Add to-do"}
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`${classFor(formVariant)} p-4 space-y-3 agent-reveal-in rounded-[12px] overflow-hidden`}
      data-glass-id="todo-add-form"
      data-glass-label="To-Do · Add task form"
      data-glass-variant={formVariant}
    >
      {transactionAddress && (
        <p className="text-xs text-blue-500 font-medium truncate">{transactionAddress}</p>
      )}
      <input
        autoFocus
        type="text"
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        className="w-full text-base text-slate-900/80 placeholder:text-slate-900/30 border-0 outline-none bg-transparent font-medium"
      />
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        className="w-full text-base text-slate-900/50 placeholder:text-slate-900/30 border-0 outline-none bg-transparent resize-none"
      />
      {/* Attach to a property (To-Do page). A pre-set transactionId hides this. */}
      {showPicker && (
        <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 10 }}>
          {pickedTx ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, flexWrap: "wrap" }}>
              <span style={{ color: "var(--agent-text-muted)" }}>Attached to</span>
              <span style={{ fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{pickedTx.propertyAddress}</span>
              <button type="button" onClick={() => { setPickedTx(null); setPropSearch(""); }} className="agent-link" style={{ fontSize: 11 }}>Change</button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Attach to a property (optional)"
                value={propSearch}
                onChange={(e) => setPropSearch(e.target.value)}
                className="w-full text-sm text-slate-900/70 placeholder:text-slate-900/30 border-0 outline-none bg-transparent"
              />
              {propMatches.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4, maxHeight: 168, overflowY: "auto" }}>
                  {propMatches.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="agent-hover-row"
                      style={{ textAlign: "left", padding: "7px 10px", borderRadius: 8, fontSize: 12.5, color: "var(--agent-text-primary)", background: "none", border: "none", cursor: "pointer", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      onClick={() => { setPickedTx(f); setPropSearch(""); }}
                    >
                      {f.propertyAddress}
                    </button>
                  ))}
                </div>
              )}
              {propSearch.trim() && propMatches.length === 0 && (
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>No matching files.</p>
              )}
            </>
          )}
        </div>
      )}
      {showOwnership && (
        <div>
          <p className="text-xs text-slate-900/40 mb-1.5">Who&apos;s responsible?</p>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={() => setOwner("mine")}
              className={`agent-segment-pill agent-segment-pill-sm${owner === "mine" ? " on" : ""}`}
            >
              Mine
            </button>
            <button
              type="button"
              onClick={() => setOwner("progressor")}
              className={`agent-segment-pill agent-segment-pill-sm${owner === "progressor" ? " on" : ""}`}
            >
              Your progressor
            </button>
          </div>
        </div>
      )}
      {canReview && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isReview}
            onChange={(e) => setIsReview(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: "var(--agent-coral-base, #FF6B4A)", cursor: "pointer" }}
          />
          <span className="text-xs text-slate-900/60">Mark as a review. We&apos;ll bring this file back on the date below.</span>
        </label>
      )}
      <div className="flex items-center gap-3 pt-1" style={{ borderTop: "0.5px solid var(--agent-border-subtle)" }}>
        <div>
          <DateField
            value={dueDate}
            min={todayStr()}
            onChange={(e) => { setDueDate(e.target.value); setDateError(""); }}
            className="text-base text-slate-900/50 border-0 outline-none bg-transparent"
            wrapperStyle={{ display: "inline-block" }}
          />
          {dateError && <p className="text-xs text-red-500 mt-0.5">{dateError}</p>}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={handleCancel} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
          Cancel
        </button>
        <Button type="submit" size="sm" disabled={saving || !title.trim()}>
          {saving ? "Saving…" : "Add"}
        </Button>
      </div>
    </form>
  );
}

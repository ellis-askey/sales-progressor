"use client";

// Shared welcome-call script surface — a read view (the coral numbered timeline
// from the intro-call drawer) with a neat pencil to edit, and an inline editor
// (add / remove / reorder / save / reset). Used by the director's team-script
// settings page and by each member's personal override in the drawer, so both
// look and behave identically. Motion via auto-animate; TSP tokens throughout.

import { useState, useTransition, type CSSProperties } from "react";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { PencilSimple, Plus, X, CaretUp, CaretDown, Check, ArrowCounterClockwise } from "@/components/icons/ph";
import { type WelcomeCallPoint, MAX_WELCOME_CALL_POINTS } from "@/lib/intro-call/script";

type SaveResult = { ok: true } | { ok: false; error: string };

const circleStyle: CSSProperties = {
  width: 30, height: 30, borderRadius: 99, flexShrink: 0,
  background: "radial-gradient(circle at 50% 32%, #ffffff 0%, var(--agent-coral-bg-tint) 100%)",
  border: "1px solid rgba(var(--agent-coral-rgb), 0.30)",
  boxShadow: "0 1px 3px rgba(var(--agent-coral-rgb), 0.22), inset 0 1px 0 rgba(255,255,255,0.85)",
  color: "var(--agent-coral-deep)", fontSize: 12.5, fontWeight: 800,
  display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const connectorStyle: CSSProperties = { flex: 1, width: 1.5, minHeight: 10, marginTop: 6, borderRadius: 2, background: "rgba(var(--agent-coral-rgb), 0.18)" };
const fieldStyle: CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13, color: "var(--agent-text-primary)",
  background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-default)",
  borderRadius: 8, outline: "none", fontFamily: "inherit", lineHeight: 1.5,
};

function IconBtn({ onClick, disabled, title, children }: { onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      className="agent-hover-ctl wcs-iconbtn"
      style={{
        width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: "none", background: "transparent", borderRadius: 6, cursor: disabled ? "default" : "pointer",
        color: "var(--agent-text-muted)", opacity: disabled ? 0.35 : 1, transition: "color 140ms, background 140ms, opacity 140ms",
      }}>
      {children}
    </button>
  );
}

export function WelcomeCallScriptEditor({
  initialPoints, defaultPoints, resetLabel, onSave, onReset, headerTitle, headerSubtitle, startEditing = false,
}: {
  initialPoints: WelcomeCallPoint[];
  // The fallback the view snaps to after a reset (the team default for a personal
  // editor; the platform default for the agency editor).
  defaultPoints: WelcomeCallPoint[];
  // e.g. "Reset to team default" (personal) or "Reset to our default" (agency).
  resetLabel: string;
  onSave: (points: WelcomeCallPoint[]) => Promise<SaveResult>;
  onReset: () => Promise<SaveResult>;
  headerTitle?: string;
  headerSubtitle?: string;
  startEditing?: boolean;
}) {
  const [points, setPoints] = useState<WelcomeCallPoint[]>(initialPoints);
  const [draft, setDraft] = useState<WelcomeCallPoint[]>(initialPoints);
  const [editing, setEditing] = useState(startEditing);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  function begin() { setDraft(points.map((p) => ({ ...p }))); setError(null); setEditing(true); }
  function cancel() { setEditing(false); setError(null); }
  function patch(i: number, key: keyof WelcomeCallPoint, value: string) {
    setDraft((d) => d.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir; if (j < 0 || j >= draft.length) return;
    setDraft((d) => { const next = d.slice(); [next[i], next[j]] = [next[j], next[i]]; return next; });
  }
  function remove(i: number) { setDraft((d) => d.filter((_, j) => j !== i)); }
  function add() {
    if (draft.length >= MAX_WELCOME_CALL_POINTS) return;
    setDraft((d) => [...d, { title: "", body: "", note: "" }]);
  }

  function save() {
    const cleaned = draft
      .map((p) => ({ title: p.title.trim(), body: p.body.trim(), note: p.note.trim() }))
      .filter((p) => p.title || p.body);
    if (cleaned.length === 0) { setError("Add at least one talking point."); return; }
    startSave(async () => {
      const res = await onSave(cleaned);
      if (res.ok) { setPoints(cleaned); setEditing(false); setError(null); }
      else setError(res.error);
    });
  }
  function reset() {
    startSave(async () => {
      const res = await onReset();
      if (!res.ok) { setError(res.error); return; }
      // Override cleared → snap the view to the fallback default.
      setPoints(defaultPoints); setDraft(defaultPoints.map((p) => ({ ...p })));
      setEditing(false); setError(null);
    });
  }

  // ── Read view ───────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {headerTitle && <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{headerTitle}</p>}
            {headerSubtitle && <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{headerSubtitle}</p>}
          </div>
          <button type="button" onClick={begin} title="Edit script" aria-label="Edit script"
            className="agent-hover-ctl"
            style={{
              flexShrink: 0, width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
              border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", borderRadius: 8,
              color: "var(--agent-text-secondary)", cursor: "pointer", transition: "color 140ms, border-color 140ms, background 140ms",
            }}>
            <PencilSimple size={15} weight="bold" />
          </button>
        </div>
        <div>
          {points.map((s, i) => {
            const last = i === points.length - 1;
            return (
              <div key={i} style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span style={circleStyle}>{i + 1}</span>
                  {!last && <span aria-hidden style={connectorStyle} />}
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingTop: 4, paddingBottom: last ? 2 : 18, borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)" }}>
                  {s.title && <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)" }}>{s.title}</p>}
                  {s.body && <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{s.body}</p>}
                  {s.note && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>{s.note}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Edit view ─────────────────────────────────────────────────────────────
  return (
    <div>
      {(headerTitle || headerSubtitle) && (
        <div style={{ marginBottom: 14 }}>
          {headerTitle && <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>{headerTitle}</p>}
          {headerSubtitle && <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{headerSubtitle}</p>}
        </div>
      )}
      <div ref={listRef}>
        {draft.map((p, i) => {
          const last = i === draft.length - 1;
          return (
            <div key={i} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <span style={circleStyle}>{i + 1}</span>
                {!last && <span aria-hidden style={connectorStyle} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: last ? 2 : 16, borderBottom: last ? "none" : "1px solid var(--agent-border-subtle)", display: "flex", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input value={p.title} onChange={(e) => patch(i, "title", e.target.value)} placeholder="Title" className="agent-field"
                    style={{ ...fieldStyle, fontWeight: 600 }} />
                  <textarea value={p.body} onChange={(e) => patch(i, "body", e.target.value)} placeholder="What to say" rows={2} className="agent-field"
                    style={{ ...fieldStyle, resize: "vertical" }} />
                  <textarea value={p.note} onChange={(e) => patch(i, "note", e.target.value)} placeholder="A softer closing note (optional)" rows={2} className="agent-field"
                    style={{ ...fieldStyle, resize: "vertical", color: "var(--agent-text-muted)" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
                  <IconBtn onClick={() => move(i, -1)} disabled={i === 0} title="Move up"><CaretUp size={13} weight="bold" /></IconBtn>
                  <IconBtn onClick={() => move(i, 1)} disabled={i === draft.length - 1} title="Move down"><CaretDown size={13} weight="bold" /></IconBtn>
                  <IconBtn onClick={() => remove(i)} title="Remove point"><X size={13} weight="bold" /></IconBtn>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {draft.length < MAX_WELCOME_CALL_POINTS && (
        <button type="button" onClick={add} className="agent-hover-row wcs-add"
          style={{
            marginTop: 12, marginLeft: 44, display: "inline-flex", alignItems: "center", gap: 7,
            padding: "7px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--agent-coral-deep)",
            background: "rgba(var(--agent-coral-rgb),0.07)", border: "0.5px dashed rgba(var(--agent-coral-rgb),0.40)",
            borderRadius: 9, cursor: "pointer", transition: "background 140ms, border-color 140ms",
          }}>
          <Plus size={13} weight="bold" /> Add a point
        </button>
      )}

      {error && <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--agent-danger)" }}>{error}</p>}

      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" onClick={save} disabled={saving} className="agent-btn-color-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
          <Check size={14} weight="bold" /> {saving ? "Saving…" : "Save script"}
        </button>
        <button type="button" onClick={cancel} disabled={saving} className="agent-hover-ctl"
          style={{ padding: "9px 14px", fontSize: 13, fontWeight: 500, color: "var(--agent-text-secondary)", background: "transparent", border: "none", borderRadius: 8, cursor: "pointer" }}>
          Cancel
        </button>
        <button type="button" onClick={reset} disabled={saving} className="agent-link wcs-reset"
          style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 4px", fontSize: 12, fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", color: "var(--agent-text-muted)" }}>
          <ArrowCounterClockwise size={13} weight="bold" /> {resetLabel}
        </button>
      </div>
    </div>
  );
}

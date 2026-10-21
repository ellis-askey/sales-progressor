"use client";

// /dev/sticky-notes — sandbox for the property-file sticky-note feature.
// Always-on floating layer of post-its over a mock file. Drag to move, corner to
// resize, colour swatch, collapse, bring-to-front, X to remove (undo toast).
// Local state + localStorage only — the real feature swaps that for a scoped
// StickyNote model + debounced API. Dev-only; blocks in production.

import { notFound } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Plus, ArrowCounterClockwise } from "@phosphor-icons/react";
import { StickyNote, PALETTE_ORDER, type StickyNoteData } from "@/components/sticky/StickyNote";
import "@/components/sticky/sticky.css";

const LS_KEY = "dev-sticky-notes-v1";

export default function StickyNotesSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [removed, setRemoved] = useState<StickyNoteData | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load / persist (sandbox persistence — the real feature uses the DB).
  useEffect(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) setNotes(JSON.parse(raw)); } catch { /* noop */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (loaded) try { localStorage.setItem(LS_KEY, JSON.stringify(notes)); } catch { /* noop */ } }, [notes, loaded]);

  const maxZ = notes.reduce((m, n) => Math.max(m, n.z), 0);

  const addNote = useCallback(() => {
    setNotes((prev) => {
      const n = prev.length;
      const note: StickyNoteData = {
        id: crypto.randomUUID(),
        x: 44 + (n % 6) * 28, y: 44 + (n % 6) * 24,
        w: 224, h: 200,
        colour: PALETTE_ORDER[n % PALETTE_ORDER.length],
        text: "", collapsed: false,
        z: prev.reduce((m, x) => Math.max(m, x.z), 0) + 1,
        author: "Ellis", createdAt: Date.now(),
      };
      return [...prev, note];
    });
  }, []);

  const patchNote = useCallback((id: string, patch: Partial<StickyNoteData>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  const bringToFront = useCallback((id: string) => {
    setNotes((prev) => {
      const top = prev.reduce((m, x) => Math.max(m, x.z), 0);
      const cur = prev.find((n) => n.id === id);
      if (cur && cur.z === top) return prev; // already on top
      return prev.map((n) => (n.id === id ? { ...n, z: top + 1 } : n));
    });
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes((prev) => {
      const gone = prev.find((n) => n.id === id) ?? null;
      setRemoved(gone);
      return prev.filter((n) => n.id !== id);
    });
  }, []);

  // Auto-dismiss the undo snackbar.
  useEffect(() => { if (!removed) return; const t = setTimeout(() => setRemoved(null), 6000); return () => clearTimeout(t); }, [removed]);
  const undoRemove = useCallback(() => { setRemoved((r) => { if (r) setNotes((prev) => [...prev, r]); return null; }); }, []);

  return (
    <div className="snpage">
      <style>{CSS}</style>

      <header className="sn-intro">
        <div className="kick">Property file · sticky notes</div>
        <h1>Sticky notes sandbox</h1>
        <p>Freeform post-its that float over the file. <b>+ Add</b> one, then drag the top strip to move it, the corner to resize, the dot to recolour, the chevron to fold it, and ✕ to remove (with undo). Everything saves locally here; the real thing saves to the file.</p>
      </header>

      <div className="sn-tools">
        <button type="button" className="sn-add" onClick={addNote}><Plus size={15} weight="bold" /> Add note</button>
        <span className="sn-count">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
        {notes.length > 0 && <button type="button" className="sn-clear" onClick={() => { setRemoved(null); setNotes([]); }}>Clear all</button>}
      </div>

      {/* The board = the floating layer over a mock property file. */}
      <div className="sn-board">
        <div className="sn-file" aria-hidden>
          <div className="sn-file-head">
            <span className="sn-file-thumb" />
            <span><span className="sn-file-addr">14 Hazel Wynd</span><span className="sn-file-loc">Leatherhead, KT22 8HH</span></span>
            <span className="sn-file-pill">Exchanged</span>
          </div>
          <div className="sn-file-row"><span style={{ width: "40%" }} /><span style={{ width: "22%" }} /></div>
          <div className="sn-file-card" />
          <div className="sn-file-card short" />
          <div className="sn-file-row"><span style={{ width: "30%" }} /><span style={{ width: "48%" }} /></div>
          <div className="sn-file-card" />
        </div>

        {notes.map((n) => (
          <StickyNote
            key={n.id}
            note={n}
            onChange={(patch) => patchNote(n.id, patch)}
            onRemove={() => removeNote(n.id)}
            onFocusNote={() => bringToFront(n.id)}
          />
        ))}

        {notes.length === 0 && (
          <div className="sn-empty">The file's clear. Hit <b>+ Add note</b> to stick one on.</div>
        )}
      </div>

      {removed && (
        <div className="sn-snack">
          <span>Note removed</span>
          <button type="button" onClick={undoRemove}><ArrowCounterClockwise size={13} weight="bold" /> Undo</button>
        </div>
      )}
    </div>
  );
}

const CSS = `
.snpage { max-width: 1120px; margin: 0 auto; padding: 30px 24px 100px; }
.sn-intro .kick { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--agent-coral-deep); }
.sn-intro h1 { font-size: 23px; font-weight: 800; letter-spacing: -.02em; margin: 8px 0 7px; color: var(--agent-text-primary); }
.sn-intro p { margin: 0; font-size: 13.5px; color: var(--agent-text-secondary); max-width: 74ch; }
.sn-intro p b { color: var(--agent-text-primary); font-weight: 650; }

.sn-tools { display: flex; align-items: center; gap: 14px; margin: 20px 0 12px; }
.sn-add { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 15px; border: none; border-radius: 10px; background: linear-gradient(135deg, var(--agent-coral), var(--agent-coral-deep)); color: #fff; font-family: inherit; font-size: 13px; font-weight: 650; cursor: pointer; box-shadow: 0 2px 8px rgba(var(--agent-coral-rgb), .3); transition: filter .14s, box-shadow .14s; }
.sn-add:hover { filter: brightness(1.05); box-shadow: 0 4px 14px rgba(var(--agent-coral-rgb), .4); }
.sn-count { font-size: 12.5px; color: var(--agent-text-muted); font-variant-numeric: tabular-nums; }
.sn-clear { margin-left: auto; border: none; background: none; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--agent-text-muted); cursor: pointer; }
.sn-clear:hover { color: var(--agent-danger); }

.sn-board { position: relative; min-height: 660px; border-radius: 18px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-elevated); box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 8px 30px rgba(45,24,16,.05); overflow: hidden; touch-action: none; }

/* mock property file behind the notes */
.sn-file { position: absolute; inset: 0; padding: 20px 22px; opacity: .55; pointer-events: none; }
.sn-file-head { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
.sn-file-thumb { width: 46px; height: 46px; border-radius: 11px; background: linear-gradient(140deg,#d8c3b0,#b89a82); }
.sn-file-addr { display: block; font-size: 16px; font-weight: 750; color: var(--agent-text-primary); }
.sn-file-loc { display: block; font-size: 12px; color: var(--agent-text-muted); margin-top: 2px; }
.sn-file-pill { margin-left: auto; font-size: 11px; font-weight: 650; color: var(--agent-success); border: 1px solid var(--agent-success); border-radius: 99px; padding: 3px 10px; }
.sn-file-row { display: flex; gap: 12px; margin: 14px 0; }
.sn-file-row span { height: 12px; border-radius: 6px; background: var(--agent-surface-subtle); }
.sn-file-card { height: 92px; border-radius: 14px; background: var(--agent-surface-subtle); margin: 12px 0; }
.sn-file-card.short { height: 56px; }

.sn-empty { position: absolute; top: 46%; left: 50%; transform: translate(-50%,-50%); font-size: 13.5px; color: var(--agent-text-muted); }
.sn-empty b { color: var(--agent-coral-deep); }

/* note styles are shared via components/sticky/sticky.css */
.sn-snack { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 16px; border-radius: 12px; background: #2a2320; color: #fff; font-size: 13px; box-shadow: 0 10px 30px rgba(0,0,0,.3); z-index: 100; animation: sn-snack-in .2s ease; }
.sn-snack button { display: inline-flex; align-items: center; gap: 5px; border: none; background: rgba(255,255,255,.14); color: #fff; font-family: inherit; font-size: 12.5px; font-weight: 650; padding: 5px 11px; border-radius: 8px; cursor: pointer; }
.sn-snack button:hover { background: rgba(255,255,255,.24); }
@keyframes sn-snack-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }

@media (prefers-reduced-motion: reduce) { .sn, .sn-snack { animation: none !important; } }
`;

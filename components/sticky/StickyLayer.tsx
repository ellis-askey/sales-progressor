"use client";

// The floating sticky-note layer on a property file. Sits absolute inside the
// file's relative content host, so notes scroll WITH the file and stay in the
// content column. Optimistic + debounced auto-save (coalesced per note), delete
// with a 5s Undo window (nothing hits the DB until it fires), and it spawns a new
// note when the hero's post-it button dispatches a `sticky-add` event for this
// file. Pointer-events pass through empty areas so the file stays clickable.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { StickyNote, type StickyNoteData, type StickyColour } from "@/components/sticky/StickyNote";
import { createStickyNote, updateStickyNote, deleteStickyNote } from "@/app/actions/sticky-notes";
import type { StickyNoteDTO } from "@/lib/services/sticky-notes";
import "@/components/sticky/sticky.css";

const PALETTE_KEYS: StickyColour[] = ["butter", "coral", "sage", "sky", "lilac", "slate"];

function dtoToNote(d: StickyNoteDTO): StickyNoteData {
  return { id: d.id, x: d.x, y: d.y, w: d.width, h: d.height, z: d.z, colour: d.colour as StickyColour, text: d.text, collapsed: d.collapsed, author: d.author, createdAt: d.createdAt };
}

export function StickyLayer({ transactionId, initialNotes, author }: { transactionId: string; initialNotes: StickyNoteDTO[]; author: string }) {
  const { toast } = useAgentToast();
  const [notes, setNotes] = useState<StickyNoteData[]>(() => initialNotes.map(dtoToNote));
  const notesRef = useRef(notes); notesRef.current = notes;
  const layerRef = useRef<HTMLDivElement>(null);
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pending = useRef<Map<string, Partial<StickyNoteData>>>(new Map());
  const delTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Write a note's accumulated patch now, cancelling any pending debounce. Used
  // by the debounce timer AND flushed on unmount / tab-hide so an edit made in
  // the last moment before leaving the file is never lost.
  const flushSave = useCallback((id: string) => {
    const t = saveTimers.current.get(id); if (t) clearTimeout(t);
    saveTimers.current.delete(id);
    const p = pending.current.get(id); pending.current.delete(id);
    if (!p) return;
    updateStickyNote(id, transactionId, {
      x: p.x, y: p.y, width: p.w, height: p.h, z: p.z, colour: p.colour, text: p.text, collapsed: p.collapsed,
    }).catch(() => {});
  }, [transactionId]);

  const flushAllSaves = useCallback(() => {
    for (const id of Array.from(pending.current.keys())) flushSave(id);
  }, [flushSave]);

  // Flush any still-pending edit before the layer goes away (route change) or the
  // tab is hidden/closed, rather than dropping the timers unwritten.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") flushAllSaves(); };
    window.addEventListener("pagehide", flushAllSaves);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      flushAllSaves();
      delTimers.current.forEach(clearTimeout);
      window.removeEventListener("pagehide", flushAllSaves);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushAllSaves]);

  // Debounced, coalesced save — accumulates every changed field for a note and
  // writes them together once edits go quiet.
  const scheduleSave = useCallback((id: string, patch: Partial<StickyNoteData>) => {
    pending.current.set(id, { ...(pending.current.get(id) ?? {}), ...patch });
    const prev = saveTimers.current.get(id); if (prev) clearTimeout(prev);
    saveTimers.current.set(id, setTimeout(() => flushSave(id), 550));
  }, [flushSave]);

  const patchNote = useCallback((id: string, patch: Partial<StickyNoteData>) => {
    let p = patch;
    if (p.x != null && layerRef.current) { const maxX = Math.max(0, layerRef.current.clientWidth - 48); p = { ...p, x: Math.min(p.x, maxX) }; }
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, ...p } : n)));
    scheduleSave(id, p);
  }, [scheduleSave]);

  const bringToFront = useCallback((id: string) => {
    const prev = notesRef.current;
    const top = prev.reduce((m, x) => Math.max(m, x.z), 0);
    const cur = prev.find((n) => n.id === id);
    if (!cur || cur.z === top) return;
    const z = top + 1;
    setNotes((ns) => ns.map((n) => (n.id === id ? { ...n, z } : n)));
    scheduleSave(id, { z });
  }, [scheduleSave]);

  const addNote = useCallback(() => {
    const prev = notesRef.current;
    const n = prev.length;
    const id = crypto.randomUUID();
    const z = prev.reduce((m, x) => Math.max(m, x.z), 0) + 1;
    const colour = PALETTE_KEYS[n % PALETTE_KEYS.length];
    const note: StickyNoteData = { id, x: 36 + (n % 6) * 28, y: 22 + (n % 6) * 24, w: 224, h: 200, colour, text: "", collapsed: false, z, author, createdAt: Date.now() };
    setNotes((p) => [...p, note]);
    createStickyNote({ id, transactionId, x: note.x, y: note.y, width: note.w, height: note.h, z, colour }).catch(() => {});
  }, [transactionId, author]);

  const removeNote = useCallback((id: string) => {
    const gone = notesRef.current.find((n) => n.id === id) ?? null;
    setNotes((p) => p.filter((n) => n.id !== id));
    const t = setTimeout(() => { delTimers.current.delete(id); deleteStickyNote(id, transactionId).catch(() => {}); }, 5000);
    delTimers.current.set(id, t);
    toast.success("Note removed", {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          const tt = delTimers.current.get(id);
          if (!tt) return; // already deleted
          clearTimeout(tt); delTimers.current.delete(id);
          if (gone) setNotes((p) => (p.some((n) => n.id === id) ? p : [...p, gone]));
        },
      },
    });
  }, [transactionId, toast]);

  // Spawn on the hero button's event (scoped to this file).
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail?.transactionId === transactionId) addNote(); };
    window.addEventListener("sticky-add", h);
    return () => window.removeEventListener("sticky-add", h);
  }, [transactionId, addNote]);

  return (
    <div className="sticky-layer" ref={layerRef}>
      {notes.map((n) => (
        <StickyNote
          key={n.id}
          note={n}
          onChange={(patch) => patchNote(n.id, patch)}
          onRemove={() => removeNote(n.id)}
          onFocusNote={() => bringToFront(n.id)}
        />
      ))}
    </div>
  );
}

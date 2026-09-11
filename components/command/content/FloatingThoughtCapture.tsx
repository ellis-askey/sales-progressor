"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { Lightbulb, Check } from "@phosphor-icons/react";
import { captureThoughtAction } from "@/app/actions/ellis-thoughts";

// Global thought capture (docs/active/content-brand/SPEC.md). A floating button
// on every page of the app so Ellis can save a thought without going to the
// Command Centre. Rendered gated to him; the capture action is superadmin-only
// regardless. Feeds "Things you think".

export function FloatingThoughtCapture() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) areaRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function save() {
    const t = body.trim();
    if (!t) return;
    const fd = new FormData();
    fd.set("body", t);
    fd.set("source", "global_capture");
    startTransition(async () => {
      const r = await captureThoughtAction(fd);
      if (r.ok) {
        setBody("");
        setSaved(true);
        setTimeout(() => setSaved(false), 2200);
        setOpen(false);
      }
    });
  }

  return (
    <div
      ref={wrapRef}
      style={{ position: "fixed", right: 24, bottom: 24, zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}
    >
      {open && (
        <div
          style={{
            width: 300,
            background: "var(--agent-surface-elevated, #ffffff)",
            border: "0.5px solid var(--agent-border-default, #e5e5e5)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
            padding: 12,
            animation: "agent-dropdown-in 160ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <textarea
            ref={areaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
            }}
            rows={4}
            placeholder="A quick thought…"
            style={{
              width: "100%",
              resize: "none",
              border: "0.5px solid var(--agent-border-default, #e5e5e5)",
              borderRadius: 10,
              background: "var(--agent-surface, #fafafa)",
              color: "var(--agent-text-primary, #1a1a1a)",
              padding: "8px 10px",
              fontSize: 13,
              outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted, #999999)" }}>⌘↵ to save</span>
            <button
              onClick={save}
              disabled={pending || !body.trim()}
              style={{
                background: "var(--agent-coral, #FF6B4A)",
                color: "#fff",
                border: "none",
                borderRadius: 9,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: pending || !body.trim() ? "not-allowed" : "pointer",
                opacity: pending || !body.trim() ? 0.5 : 1,
              }}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title="Capture a thought"
        aria-label="Capture a thought"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: saved ? "var(--agent-success, #16a34a)" : "var(--agent-coral, #FF6B4A)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "10px 16px",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          cursor: "pointer",
        }}
      >
        {saved ? <Check size={18} weight="bold" /> : <Lightbulb size={18} weight="fill" />}
        {saved ? "Saved" : "Thought"}
      </button>
    </div>
  );
}

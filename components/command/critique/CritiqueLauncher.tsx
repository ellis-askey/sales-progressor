"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, X } from "lucide-react";

// Founder "Critique" launcher. A floating Report button, superadmin-only (gated
// by the caller in the root layout — it isn't rendered for anyone else). Wiring
// mirrors the thought-popup (FloatingThoughtCapture): a small box + a fire-and-
// forget save. Extra vs the thought popup: it auto-screenshots the current view
// and posts to /api/command/critique (its OWN table + bucket, never real
// feedback, never an email).
//
// Mounted at the app ROOT and rendered through a portal to document.body at the
// max z-index (2147483000) so it sits above onboarding, modals, drawers and any
// full-screen overlay — a normal in-tree z-index isn't enough.
const Z = 2147483000;

type Phase = "idle" | "capturing" | "sending" | "saved" | "error";

export function CritiqueLauncher() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) areaRef.current?.focus(); }, [open]);

  // Next paint as a promise — lets the launcher fully unmount from the DOM
  // before we capture, so the report box is never in the shot.
  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const submit = useCallback(async () => {
    const note = body.trim();
    if (!note || phase === "capturing" || phase === "sending") return;

    // Hide the whole launcher, wait a frame, THEN capture — otherwise the box
    // ends up in the screenshot.
    setPhase("capturing");
    await nextFrame();

    let screenshotBase64: string | null = null;
    try {
      const { domToPng } = await import("modern-screenshot");
      // scale:1 keeps a full-page PNG within the upload ceiling; the app is
      // readable at CSS resolution.
      const dataUrl = await domToPng(document.body, { scale: 1 });
      screenshotBase64 = dataUrl.split(",")[1] ?? null;
    } catch {
      screenshotBase64 = null; // a failed capture must never lose the note
    }

    setPhase("sending");
    const filename = `critique-${Date.now()}.png`;
    const payload = {
      body: note,
      pageUrl: window.location.href,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      screenshotBase64,
      screenshotFilename: screenshotBase64 ? filename : null,
    };

    async function post(withShot: boolean) {
      return fetch("/api/command/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(withShot ? payload : { ...payload, screenshotBase64: null, screenshotFilename: null }),
      });
    }

    try {
      let res = await post(true);
      // If the shot was too big, still save the note without it.
      if (res.status === 413 && screenshotBase64) res = await post(false);
      if (!res.ok) throw new Error(String(res.status));
      setBody("");
      setOpen(false);
      setPhase("saved");
      setTimeout(() => setPhase("idle"), 2200);
    } catch {
      setPhase("error");
      setTimeout(() => setPhase("idle"), 3000);
    }
  }, [body, phase]);

  if (!mounted) return null;

  // While capturing, render nothing so the launcher is absent from the shot.
  if (phase === "capturing") return null;

  const busy = phase === "sending";

  return createPortal(
    <div style={{ position: "fixed", left: 20, bottom: 20, zIndex: Z, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10 }}>
      {open && (
        <div
          style={{
            width: 320,
            background: "#141414",
            border: "0.5px solid #2e2e2e",
            borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
            padding: 14,
            color: "#fafafa",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.02em", color: "#e5e5e5" }}>Critique note</span>
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#737373", cursor: "pointer", display: "inline-flex" }}>
              <X size={15} />
            </button>
          </div>
          <textarea
            ref={areaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
            rows={5}
            placeholder="What's wrong / what to change on this screen…"
            style={{
              width: "100%", resize: "vertical", minHeight: 90,
              border: "0.5px solid #2e2e2e", borderRadius: 10, background: "#0d0d0d",
              color: "#fafafa", padding: "9px 11px", fontSize: 13, lineHeight: 1.5, outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "#737373" }}>Grabs a screenshot of this screen · ⌘↵</span>
            <button
              onClick={submit}
              disabled={busy || !body.trim()}
              style={{
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 9,
                padding: "7px 15px", fontSize: 12, fontWeight: 600,
                cursor: busy || !body.trim() ? "not-allowed" : "pointer",
                opacity: busy || !body.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title="Fire a critique note"
        aria-label="Fire a critique note"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: phase === "saved" ? "#16a34a" : phase === "error" ? "#b91c1c" : "#141414",
          color: "#fff", border: "0.5px solid rgba(255,255,255,0.14)", borderRadius: 999,
          padding: "9px 15px", fontSize: 12.5, fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: "pointer",
        }}
      >
        {phase === "saved" ? <Check size={16} /> : <Camera size={16} />}
        {phase === "saved" ? "Saved" : phase === "error" ? "Failed — retry" : "Report"}
      </button>
    </div>,
    document.body,
  );
}

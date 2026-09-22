"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, X } from "lucide-react";

// Founder "Critique" launcher. Superadmin-only (gated by the caller in the root
// layout). Mounted at the app ROOT via a portal to document.body at the max
// z-index so it sits above onboarding, modals, drawers and full-screen overlays.
//
// Flow (robust for our desktop-sized screenshots):
//   1. hide self → next frame → capture the screen as a PNG Blob
//   2. save the NOTE first (tiny POST — a note is never lost)
//   3. PUT the Blob straight to storage via a signed URL (past the ~4.5 MB
//      serverless body limit that used to drop big shots)
//   4. attach the stored path to the note
// The bucket is auto-created server-side, so uploads can't silently fail for a
// missing bucket. Outcomes are surfaced precisely — no more silent 10%.
const Z = 2147483000;

type Phase = "idle" | "capturing" | "sending" | "saved" | "partial" | "error";

export function CritiqueLauncher() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => { if (open) areaRef.current?.focus(); }, [open]);

  const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const flash = (p: Phase, m: string, ms = 2600) => {
    setPhase(p);
    setMsg(m);
    setTimeout(() => { setPhase("idle"); setMsg(""); }, ms);
  };

  const submit = useCallback(async () => {
    const note = body.trim();
    if (!note || phase === "capturing" || phase === "sending") return;

    // 1. Hide the whole launcher, wait a frame, then capture — so the report box
    //    is never in the shot.
    setPhase("capturing");
    await nextFrame();
    let blob: Blob | null = null;
    try {
      const { domToBlob } = await import("modern-screenshot");
      blob = await domToBlob(document.body, { scale: 1, type: "image/png" });
    } catch {
      blob = null; // capture failure must never lose the note
    }

    setPhase("sending");
    try {
      // 2. Save the note first (never lost), and ask for an upload URL if we have
      //    a screenshot to attach.
      const createRes = await fetch("/api/command/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: note,
          pageUrl: window.location.href,
          viewportSize: `${window.innerWidth}x${window.innerHeight}`,
          wantsScreenshot: !!blob,
        }),
      });
      if (!createRes.ok) throw new Error(`save ${createRes.status}`);
      const { id, uploadUrl, path } = (await createRes.json()) as { id: string; uploadUrl: string | null; path: string | null };

      setBody("");
      setOpen(false);

      // No screenshot captured, or storage couldn't hand us an upload URL — the
      // note is safely stored either way.
      if (!blob) { flash("saved", "Saved (no screenshot)"); return; }
      if (!uploadUrl || !path) { flash("partial", "Saved, screenshot skipped"); return; }

      // 3. PUT the image straight to storage.
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "image/png", "x-upsert": "false" },
        body: blob,
      });
      if (!put.ok) { flash("partial", "Saved, screenshot upload failed"); return; }

      // 4. Attach the stored path to the note.
      const attach = await fetch("/api/command/critique", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, path }),
      });
      if (!attach.ok) { flash("partial", "Saved, screenshot not linked"); return; }

      flash("saved", "Saved with screenshot");
    } catch {
      flash("error", "Couldn't send that one. Try again", 3200);
    }
  }, [body, phase]);

  if (!mounted) return null;
  if (phase === "capturing") return null; // absent from the shot

  const busy = phase === "sending";
  const btnBg = phase === "saved" ? "#16a34a" : phase === "partial" ? "#b45309" : phase === "error" ? "#b91c1c" : "#141414";
  const btnLabel = phase === "saved" ? "Saved" : phase === "partial" ? "Saved ⚠" : phase === "error" ? "Failed, retry" : "Report";

  return createPortal(
    <div style={{ position: "fixed", left: 20, bottom: 20, zIndex: Z, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      {open && (
        <div
          style={{
            width: 320, background: "#141414", border: "0.5px solid #2e2e2e", borderRadius: 14,
            boxShadow: "0 16px 48px rgba(0,0,0,0.5)", padding: 14, color: "#fafafa",
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
              width: "100%", resize: "vertical", minHeight: 90, border: "0.5px solid #2e2e2e", borderRadius: 10,
              background: "#0d0d0d", color: "#fafafa", padding: "9px 11px", fontSize: 13, lineHeight: 1.5, outline: "none",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "#737373" }}>Grabs a screenshot of this screen · ⌘↵</span>
            <button
              onClick={submit}
              disabled={busy || !body.trim()}
              style={{
                background: "#2563eb", color: "#fff", border: "none", borderRadius: 9, padding: "7px 15px",
                fontSize: 12, fontWeight: 600, cursor: busy || !body.trim() ? "not-allowed" : "pointer", opacity: busy || !body.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}

      {msg && !open && (
        <span style={{ fontSize: 11, fontWeight: 600, color: "#e5e5e5", background: "#141414", border: "0.5px solid #2e2e2e", borderRadius: 8, padding: "4px 9px", boxShadow: "0 6px 20px rgba(0,0,0,0.4)" }}>
          {msg}
        </span>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        title="Fire a critique note"
        aria-label="Fire a critique note"
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, background: btnBg, color: "#fff",
          border: "0.5px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "9px 15px",
          fontSize: 12.5, fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", cursor: "pointer",
        }}
      >
        {phase === "saved" ? <Check size={16} /> : <Camera size={16} />}
        {btnLabel}
      </button>
    </div>,
    document.body,
  );
}

"use client";

// /dev/portal-immerse — MOTION PROTOTYPE for the client-portal full-screen
// transition (property file → Client portal tab, mobile "Full screen").
//
// The shipped version (components/transaction/ClientPortalPreview.tsx) FLIPs the
// whole phone bezel and animates only `transform`, so the rounded corners, notch
// and backdrop snap on/off at the ends — that snap is the glitch, worst on exit.
//
// This proves the proposed fix: the portal SCREEN itself (one iframe, mounted
// once, never reparented) grows out of the phone to fill the viewport and shrinks
// precisely back into it, as one continuous spring-driven motion. Geometry
// (top/left/width/height/radius) is interpolated by a single progress spring, so
// the portal reflows as it grows instead of scaling/distorting, and nothing is
// left to snap. Backdrop + close fade both ways off the same progress.
//
// Nothing here touches the real component. Tune the spring, then we port it.

import { useEffect, useRef, useState } from "react";
import { createSpring, stepSpring, createFrameLoop, motionReduced } from "@/components/liquid/lib/spring";

type Rect = { top: number; left: number; width: number; height: number };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const FRAMED_RADIUS = 40;

export default function PortalImmersePrototype() {
  // Spring tuning (live).
  const [response, setResponse] = useState(0.5);
  const [bounce, setBounce] = useState(0.12);

  // Source: mock screen (instant, reflows cheaply) or a real /portal/<token> iframe.
  const [useLive, setUseLive] = useState(false);
  const [token, setToken] = useState("");

  // Motion state.
  const [p, setP] = useState(0);            // render progress 0 (framed) → 1 (full screen)
  const [fixed, setFixed] = useState(false); // is the screen lifted to a fixed layer?
  const spring = useRef(createSpring(0.5, 0.12, 0));
  const frame = useRef<ReturnType<typeof createFrameLoop> | null>(null);
  const startRect = useRef<Rect>({ top: 0, left: 0, width: 0, height: 0 });
  const endRect = useRef<Rect>({ top: 0, left: 0, width: 0, height: 0 });

  const slotRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // One rAF loop, driven by the progress spring. Settling back at 0 drops the
  // screen out of the fixed layer and back into the phone.
  useEffect(() => {
    frame.current = createFrameLoop((dt) => {
      const moving = stepSpring(spring.current, dt, false);
      setP(spring.current.value);
      if (!moving && spring.current.target === 0) setFixed(false);
      return moving;
    });
    return () => frame.current?.stop();
  }, []);

  function enter() {
    const slot = slotRef.current;
    if (!slot) return;
    const r = slot.getBoundingClientRect();
    startRect.current = { top: r.top, left: r.left, width: r.width, height: r.height };
    endRect.current = { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
    spring.current.stiffness = ((2 * Math.PI) / response) ** 2;
    spring.current.damping = (4 * Math.PI * (1 - bounce)) / response;
    setFixed(true);
    if (motionReduced()) { spring.current.value = 1; spring.current.target = 1; setP(1); return; }
    spring.current.target = 1;
    frame.current?.start();
  }

  function exit() {
    if (motionReduced()) { spring.current.value = 0; spring.current.target = 0; setP(0); setFixed(false); return; }
    spring.current.stiffness = ((2 * Math.PI) / response) ** 2;
    spring.current.damping = (4 * Math.PI * (1 - bounce)) / response;
    spring.current.target = 0;
    frame.current?.start();
  }

  // Escape exits.
  useEffect(() => {
    if (!fixed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") exit(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixed]);

  // Interpolated geometry for the lifted screen.
  const s = startRect.current, e = endRect.current;
  const liveRect: Rect = {
    top: lerp(s.top, e.top, p),
    left: lerp(s.left, e.left, p),
    width: lerp(s.width, e.width, p),
    height: lerp(s.height, e.height, p),
  };
  const radius = lerp(FRAMED_RADIUS, 0, p);

  const screenInner = (
    useLive && token ? (
      <iframe
        src={token.startsWith("/") ? token : `/portal/${token}`}
        title="Portal preview"
        style={{ display: "block", width: "100%", height: "100%", border: 0 }}
      />
    ) : (
      <MockPortalScreen />
    )
  );

  return (
    <div style={{ minHeight: "100vh", background: "#eef0f4", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "#1f2430" }}>Portal full-screen — motion prototype</h1>
        <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "#555b68", margin: "6px 0 0", maxWidth: 620 }}>
          Tap <b>Full screen</b> to watch the portal grow out of the phone, and the close button (or Escape) to watch
          it shrink back in. Tune the spring until the enter <i>and</i> exit feel right.
        </p>

        {/* tuning controls */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", margin: "20px 0 26px", padding: "14px 16px", borderRadius: 14, border: "1px solid #dde0e7", background: "#fff" }}>
          <label style={ctl}>
            <span style={ctlLabel}>Response <b>{response.toFixed(2)}s</b></span>
            <input type="range" min={0.25} max={0.9} step={0.01} value={response} onChange={(ev) => setResponse(+ev.target.value)} />
          </label>
          <label style={ctl}>
            <span style={ctlLabel}>Bounce <b>{bounce.toFixed(2)}</b></span>
            <input type="range" min={0} max={0.5} step={0.01} value={bounce} onChange={(ev) => setBounce(+ev.target.value)} />
          </label>
          <label style={{ ...ctl, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={useLive} onChange={(ev) => setUseLive(ev.target.checked)} />
            <span style={ctlLabel}>Live portal iframe</span>
          </label>
          {useLive && (
            <input
              value={token}
              onChange={(ev) => setToken(ev.target.value)}
              placeholder="portal token or /portal/<token>"
              style={{ flex: "1 1 240px", padding: "8px 10px", borderRadius: 9, border: "1px solid #ccd0d9", fontSize: 13 }}
            />
          )}
          <span style={{ fontSize: 11.5, color: "#8a909c" }}>
            {useLive ? "Real iframe reflows as it grows; watch for jank." : "Mock screen (reflows cheaply)."}
          </span>
        </div>

        {/* the phone */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ position: "relative", width: 390, maxWidth: "100%", padding: 12, borderRadius: 52, background: "linear-gradient(160deg,#16171b,#050506)", boxShadow: "0 28px 60px -20px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) inset" }}>
            {/* notch — fades as we immerse */}
            <div aria-hidden style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", width: 128, height: 26, borderRadius: 999, background: "#050506", zIndex: 3, opacity: 1 - p, pointerEvents: "none" }} />

            {/* screen slot — keeps the phone's height while the screen is lifted out */}
            <div ref={slotRef} style={{ position: "relative", borderRadius: FRAMED_RADIUS, overflow: "hidden", background: "#f6f8fc", height: "min(72vh, 760px)" }}>
              {/* dim the empty slot behind the backdrop while immersed */}
              {fixed && <div aria-hidden style={{ position: "absolute", inset: 0, background: "#0b0d12", opacity: 0.25 * p }} />}
              <div
                ref={screenRef}
                style={
                  fixed
                    ? { position: "fixed", top: liveRect.top, left: liveRect.left, width: liveRect.width, height: liveRect.height, borderRadius: radius, overflow: "hidden", background: "#f6f8fc", zIndex: 2147483000, boxShadow: `0 ${lerp(0, 40, p)}px ${lerp(0, 90, p)}px -20px rgba(0,0,0,${0.0 + 0.45 * p})` }
                    : { position: "absolute", inset: 0, borderRadius: FRAMED_RADIUS, overflow: "hidden", background: "#f6f8fc" }
                }
              >
                {screenInner}
              </div>
            </div>

            {/* Full screen button */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
              <button
                type="button"
                onClick={enter}
                style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.10)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>
                Full screen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* backdrop + close — fixed layer, fade with progress */}
      {fixed && (
        <>
          <div aria-hidden onClick={exit} style={{ position: "fixed", inset: 0, background: "rgba(5,6,8,0.62)", opacity: p, zIndex: 2147482999, pointerEvents: p > 0.4 ? "auto" : "none" }} />
          <button
            type="button"
            onClick={exit}
            aria-label="Exit full screen"
            style={{ position: "fixed", top: "max(14px, env(safe-area-inset-top, 14px))", right: "max(14px, env(safe-area-inset-right, 14px))", zIndex: 2147483001, width: 40, height: 40, borderRadius: 999, border: "none", background: "rgba(10,12,16,0.60)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", WebkitBackdropFilter: "blur(6px)", backdropFilter: "blur(6px)", opacity: p, pointerEvents: p > 0.4 ? "auto" : "none" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </>
      )}
    </div>
  );
}

const ctl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 5, minWidth: 150 };
const ctlLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#4a505c" };

// A cheap stand-in for a portal page — responsive content that reflows as the
// stage grows, so the motion reads honestly without needing a real token.
function MockPortalScreen() {
  return (
    <div style={{ height: "100%", overflow: "auto", background: "#f6f8fc", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#FF6B4A,#ff8a65)", color: "#fff", padding: "22px 18px 26px" }}>
        <p style={{ margin: 0, fontSize: 12, opacity: 0.85, fontWeight: 600 }}>Your sale</p>
        <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700 }}>12 Oakfield Road</p>
      </div>
      <div style={{ padding: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))" }}>
        {["Solicitor instructed", "Searches ordered", "Enquiries raised", "Mortgage offer", "Exchange", "Completion"].map((t, i) => (
          <div key={t} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e7eaf0", padding: 14 }}>
            <div style={{ width: 30, height: 30, borderRadius: 999, background: i < 3 ? "#FF6B4A" : "#e7eaf0", color: i < 3 ? "#fff" : "#9aa2b1", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{i + 1}</div>
            <p style={{ margin: "10px 0 2px", fontSize: 14, fontWeight: 600, color: "#1f2430" }}>{t}</p>
            <p style={{ margin: 0, fontSize: 12.5, color: "#8a909c" }}>{i < 3 ? "Done" : "Upcoming"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

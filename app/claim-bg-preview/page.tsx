"use client";

// /claim-bg-preview
// Twelve genuinely distinct background directions for the claim shell.
// Each one has its own motion character, not a variation on a theme.
// Live claim pages still on flat cream until a direction is picked.

import { useEffect, useState } from "react";
import { displayChainPosition } from "@/lib/chain/positions";
import "../claim/styles/claim-flow.css";

type Option =
  | "01" | "02" | "03" | "04" | "05" | "06"
  | "07" | "08" | "09" | "10" | "11" | "12";

const OPTIONS: { id: Option; name: string; note: string }[] = [
  { id: "01", name: "Mesh shift",         note: "Large gradient mesh — colors drift across the canvas" },
  { id: "02", name: "Floating particles", note: "Dust motes drifting upward, never the same frame twice" },
  { id: "03", name: "Aurora wave",        note: "Three soft cloud bodies scaling + drifting like an aurora" },
  { id: "04", name: "Pulsing rings",      note: "Coral rings expanding outward from centre, layered" },
  { id: "05", name: "Light beams",        note: "Diagonal warm beam sweeping slowly left to right" },
  { id: "06", name: "Conic spin",         note: "Slowly rotating conic gradient, faint" },
  { id: "07", name: "Iridescent shift",   note: "Hue rotates across a soft multi-tone wash" },
  { id: "08", name: "Diagonal rain",      note: "Slanted hairlines drifting in one direction" },
  { id: "09", name: "Twinkling stars",    note: "Thirty dots fading in and out at different rates" },
  { id: "10", name: "Morphing blobs",     note: "Lava-lamp blobs — shape changes, not just position" },
  { id: "11", name: "Cursor spotlight",   note: "Soft radial light follows your mouse" },
  { id: "12", name: "Wave bars",          note: "Horizontal stripes scrolling vertically" },
];

const SCOPED_CSS = `
  /* ─────────────────────────────────────────────────────────────────────────
   * 01 — Mesh shift
   * Multi-stop linear gradient over a 400% canvas, animated background-position.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-01 {
    background:
      linear-gradient(135deg,
        rgba(255,107,74,.40) 0%,
        rgba(255,180,77,.40) 25%,
        rgba(255,220,180,.30) 50%,
        rgba(255,140,100,.40) 75%,
        rgba(255,107,74,.40) 100%
      ),
      #FDF9F5;
    background-size: 400% 400%, auto;
    animation: bg-mesh-shift 18s ease-in-out infinite;
  }
  @keyframes bg-mesh-shift {
    0%   { background-position: 0% 0%, 0 0; }
    50%  { background-position: 100% 100%, 0 0; }
    100% { background-position: 0% 0%, 0 0; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 02 — Floating particles
   * 24 absolutely-positioned dots, each with a unique upward animation.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-02 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-02 > header,
  .claim-page.bg-02 > .claim-container { position: relative; z-index: 2; }
  .bg-particle {
    position: fixed;
    border-radius: 50%;
    background: rgba(255,107,74,.7);
    box-shadow: 0 0 8px rgba(255,107,74,.45);
    pointer-events: none;
    z-index: 1;
    animation-name: bg-particle-float;
    animation-timing-function: linear;
    animation-iteration-count: infinite;
  }
  @keyframes bg-particle-float {
    0%   { transform: translateY(110vh) translateX(0);    opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(-20vh) translateX(30px); opacity: 0; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 03 — Aurora wave
   * Three pseudo-element clouds. Each scales and drifts independently.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-03 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-03 > header,
  .claim-page.bg-03 > .claim-container { position: relative; z-index: 2; }
  .bg-aurora-cloud {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 1;
  }
  .bg-aurora-cloud--a {
    width: 800px; height: 550px;
    background: rgba(255,107,74,.55);
    top: 5%; left: -15%;
    animation: bg-aurora-a 14s ease-in-out infinite alternate;
  }
  .bg-aurora-cloud--b {
    width: 700px; height: 700px;
    background: rgba(255,180,77,.50);
    top: 30%; right: -15%;
    animation: bg-aurora-b 18s ease-in-out infinite alternate;
  }
  .bg-aurora-cloud--c {
    width: 750px; height: 500px;
    background: rgba(255,200,150,.45);
    bottom: -15%; left: 25%;
    animation: bg-aurora-c 22s ease-in-out infinite alternate;
  }
  @keyframes bg-aurora-a {
    0%   { transform: translate(0,0) scale(1); }
    100% { transform: translate(150px,80px) scale(1.3); }
  }
  @keyframes bg-aurora-b {
    0%   { transform: translate(0,0) scale(1); }
    100% { transform: translate(-120px,-60px) scale(0.85); }
  }
  @keyframes bg-aurora-c {
    0%   { transform: translate(0,0) scale(1); }
    100% { transform: translate(80px,-100px) scale(1.2); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 04 — Pulsing rings
   * Three concentric rings expanding outward, staggered animation-delay.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-04 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-04 > header,
  .claim-page.bg-04 > .claim-container { position: relative; z-index: 2; }
  .bg-ring {
    position: fixed; top: 50%; left: 50%;
    width: 300px; height: 300px;
    border: 3px solid rgba(255,107,74,.7);
    border-radius: 50%;
    transform: translate(-50%,-50%);
    pointer-events: none; z-index: 1;
    animation: bg-ring-pulse 4s ease-out infinite;
  }
  .bg-ring--2 { animation-delay: 1.33s; }
  .bg-ring--3 { animation-delay: 2.66s; }
  @keyframes bg-ring-pulse {
    0%   { transform: translate(-50%,-50%) scale(0.15); opacity: 1;   border-width: 4px; }
    100% { transform: translate(-50%,-50%) scale(5);    opacity: 0;   border-width: 1px; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 05 — Light beams
   * Single diagonal beam sweeping across the screen, slow.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-05 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-05 > header,
  .claim-page.bg-05 > .claim-container { position: relative; z-index: 2; }
  .claim-page.bg-05::before {
    content: "";
    position: fixed; top: -100%; left: -100%;
    width: 300%; height: 300%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      transparent 42%,
      rgba(255,180,77,.55) 48%,
      rgba(255,220,150,.65) 50%,
      rgba(255,180,77,.55) 52%,
      transparent 58%,
      transparent 100%
    );
    transform: rotate(20deg);
    animation: bg-beam-sweep 6s linear infinite;
    pointer-events: none; z-index: 1;
  }
  @keyframes bg-beam-sweep {
    0%   { transform: rotate(20deg) translateX(-50%); }
    100% { transform: rotate(20deg) translateX(50%); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 06 — Conic spin
   * Rotating conic gradient pseudo-element, very slow.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-06 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-06 > header,
  .claim-page.bg-06 > .claim-container { position: relative; z-index: 2; }
  .claim-page.bg-06::before {
    content: "";
    position: fixed; top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: conic-gradient(
      from 0deg at 50% 50%,
      rgba(255,107,74,.45) 0deg,
      rgba(255,180,77,.40) 90deg,
      rgba(255,235,200,.20) 180deg,
      rgba(255,140,100,.40) 270deg,
      rgba(255,107,74,.45) 360deg
    );
    animation: bg-conic-spin 30s linear infinite;
    pointer-events: none; z-index: 1;
  }
  @keyframes bg-conic-spin {
    to { transform: rotate(360deg); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 07 — Iridescent shift
   * Multi-tone radial wash with hue-rotate filter animating slowly.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-07 {
    background:
      radial-gradient(at 25% 25%, rgba(255,107,74,.45), transparent 55%),
      radial-gradient(at 75% 75%, rgba(255,200,100,.45), transparent 55%),
      radial-gradient(at 50% 50%, rgba(180,180,255,.30), transparent 55%),
      linear-gradient(45deg, #FDF9F5, #FFF1E5, #FDF9F5);
    animation: bg-iridescent 10s ease-in-out infinite;
  }
  @keyframes bg-iridescent {
    0%, 100% { filter: hue-rotate(0deg); }
    50%      { filter: hue-rotate(60deg); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 08 — Diagonal rain
   * Slanted hairlines drifting in one direction via background-position.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-08 {
    background:
      repeating-linear-gradient(
        105deg,
        transparent 0px,
        transparent 28px,
        rgba(255,107,74,.30) 28px,
        rgba(255,107,74,.30) 31px
      ),
      #FDF9F5;
    animation: bg-rain-drift 3s linear infinite;
  }
  @keyframes bg-rain-drift {
    from { background-position: 0 0, 0 0; }
    to   { background-position: -120px -360px, 0 0; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 09 — Twinkling stars
   * 30 dots, each fading in/out on its own cycle (delays randomized in JSX).
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-09 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-09 > header,
  .claim-page.bg-09 > .claim-container { position: relative; z-index: 2; }
  .bg-star {
    position: fixed;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: rgba(255,107,74,.9);
    box-shadow: 0 0 12px rgba(255,107,74,.6);
    pointer-events: none; z-index: 1;
    animation: bg-star-twinkle 2.5s ease-in-out infinite;
  }
  @keyframes bg-star-twinkle {
    0%, 100% { opacity: 0; transform: scale(0.4); }
    50%      { opacity: 1; transform: scale(1.3); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 10 — Morphing blobs
   * Lava-lamp: border-radius animates so shape mutates, plus translate.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-10 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-10 > header,
  .claim-page.bg-10 > .claim-container { position: relative; z-index: 2; }
  .bg-blob {
    position: fixed;
    filter: blur(50px);
    pointer-events: none; z-index: 1;
  }
  .bg-blob--a {
    top: 10%; left: 5%;
    width: 550px; height: 550px;
    background: rgba(255,107,74,.55);
    animation: bg-blob-a 10s ease-in-out infinite;
  }
  .bg-blob--b {
    bottom: 5%; right: 8%;
    width: 600px; height: 600px;
    background: rgba(255,180,77,.50);
    animation: bg-blob-b 14s ease-in-out infinite;
  }
  @keyframes bg-blob-a {
    0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: translate(0,0) scale(1); }
    33%      { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; transform: translate(60px,40px) scale(1.1); }
    66%      { border-radius: 50% 50% 60% 40% / 30% 70% 50% 60%; transform: translate(-40px,60px) scale(0.9); }
  }
  @keyframes bg-blob-b {
    0%, 100% { border-radius: 40% 60% 50% 50% / 50% 40% 60% 50%; transform: translate(0,0) scale(1); }
    50%      { border-radius: 60% 40% 30% 70% / 40% 60% 50% 50%; transform: translate(-80px,-60px) scale(1.2); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 11 — Cursor spotlight
   * Radial gradient with center driven by --mx / --my CSS variables (JS-fed).
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-11 {
    background:
      radial-gradient(circle 600px at var(--mx,50%) var(--my,50%),
        rgba(255,107,74,.55) 0%,
        rgba(255,180,77,.30) 30%,
        transparent 65%
      ),
      #FDF9F5;
    transition: background 80ms linear;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 12 — Wave bars
   * Horizontal stripes scrolling vertically via background-position.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-12 {
    background:
      repeating-linear-gradient(
        180deg,
        rgba(255,107,74,.28) 0px,
        rgba(255,107,74,.28) 10px,
        transparent 10px,
        transparent 48px
      ),
      #FDF9F5;
    animation: bg-wave-scroll 2.5s linear infinite;
  }
  @keyframes bg-wave-scroll {
    from { background-position: 0 0, 0 0; }
    to   { background-position: 0 -48px, 0 0; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * Picker panel
   * ───────────────────────────────────────────────────────────────────────── */
  .bg-picker {
    position: fixed; top: 16px; right: 16px;
    z-index: 1000;
    width: 280px;
    background: rgba(255,255,255,.96);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(0,0,0,.10);
    border-radius: 12px;
    padding: 8px;
    display: flex; flex-direction: column; gap: 2px;
    box-shadow: 0 6px 24px rgba(0,0,0,.12);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .bg-picker-title {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .08em;
    color: rgba(0,0,0,.4);
    padding: 6px 10px 8px;
    border-bottom: 1px solid rgba(0,0,0,.06);
    margin-bottom: 4px;
  }
  .bg-picker button {
    appearance: none; border: none; cursor: pointer;
    padding: 10px 12px;
    text-align: left;
    border-radius: 8px;
    background: transparent;
    color: rgba(0,0,0,.78);
    display: flex; flex-direction: column; gap: 3px;
    transition: background 120ms, color 120ms;
    font-family: inherit;
  }
  .bg-picker button:not(.on):hover {
    background: rgba(0,0,0,.04);
  }
  .bg-picker button.on {
    background: #FF6B4A;
    color: #fff;
  }
  .bg-picker-name {
    font-size: 13px; font-weight: 600;
    display: flex; align-items: center; gap: 8px;
  }
  .bg-picker-num {
    font-size: 10px; font-weight: 700;
    background: rgba(0,0,0,.08);
    padding: 1px 6px; border-radius: 4px;
    font-family: monospace;
  }
  .bg-picker button.on .bg-picker-num {
    background: rgba(255,255,255,.25);
  }
  .bg-picker-note {
    font-size: 11px; opacity: 0.7; line-height: 1.4;
  }
  .bg-toggle-row {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 12px 4px;
    border-top: 1px solid rgba(0,0,0,.06);
    margin-top: 4px;
  }
  .bg-toggle-row label {
    font-size: 12px; font-weight: 500;
    color: rgba(0,0,0,.7);
    cursor: pointer;
    display: flex; align-items: center; gap: 6px;
  }

  /* Hide-hero mode: dim the content so the background is fully readable */
  .claim-page.solo .claim-container,
  .claim-page.solo header {
    opacity: 0.08;
    pointer-events: none;
  }

  /* Shrink the hero so the picker doesn't overlap it on standard screens */
  .claim-page .claim-container { max-width: min(640px, calc(100vw - 340px)); }
  @media (max-width: 900px) {
    .claim-page .claim-container { max-width: 100%; }
    .bg-picker { width: 240px; }
  }
`;

const SAMPLE = {
  originatorName: "Jane Smith",
  originatorAgency: "Foster & Co",
  stubPropertyAddress: "47 Oak Road, Bristol, BS6 7TH",
  invitedDate: "21 May 2026",
  links: [
    { id: "1",    position: 0, transactionId: "tx1", stubPropertyAddress: null,         transaction: { propertyAddress: "12 Pine Lane, Bristol" }, claimedBy: { firmName: "Whitfield & Sons" } },
    { id: "2",    position: 1, transactionId: "tx2", stubPropertyAddress: null,         transaction: { propertyAddress: "47 Oak Road, Bristol" }, claimedBy: { firmName: "Foster & Co" } },
    { id: "stub", position: 2, transactionId: null,  stubPropertyAddress: "Your sale",  transaction: null, claimedBy: null },
    { id: "3",    position: 3, transactionId: null,  stubPropertyAddress: null,         transaction: null, claimedBy: null },
  ],
};

// Deterministic pseudo-random so SSR + client match (avoid hydration mismatch).
function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const PARTICLES = (() => {
  const rng = seededRand(1);
  return Array.from({ length: 24 }, () => ({
    left: rng() * 100,
    size: 3 + rng() * 5,
    duration: 14 + rng() * 14,
    delay: -rng() * 28,
  }));
})();

const STARS = (() => {
  const rng = seededRand(2);
  return Array.from({ length: 30 }, () => ({
    left: rng() * 100,
    top: rng() * 100,
    delay: -rng() * 3,
    duration: 2 + rng() * 3,
  }));
})();

export default function ClaimBgPreviewPage() {
  const [option, setOption] = useState<Option>("01");
  const [solo, setSolo] = useState(false);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (option !== "11") return;
    function onMove(e: MouseEvent) {
      setMouse({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [option]);

  const total = SAMPLE.links.length;
  const pageStyle =
    option === "11" && mouse
      ? ({ ["--mx" as string]: `${mouse.x}%`, ["--my" as string]: `${mouse.y}%` } as React.CSSProperties)
      : undefined;

  return (
    <>
      <style>{SCOPED_CSS}</style>

      <aside className="bg-picker">
        <div className="bg-picker-title">Background · 12 directions</div>
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={option === opt.id ? "on" : ""}
            onClick={() => setOption(opt.id)}
          >
            <span className="bg-picker-name">
              <span className="bg-picker-num">{opt.id}</span>
              {opt.name}
            </span>
            <span className="bg-picker-note">{opt.note}</span>
          </button>
        ))}
        <div className="bg-toggle-row">
          <label>
            <input type="checkbox" checked={solo} onChange={(e) => setSolo(e.target.checked)} />
            Hide hero (see background only)
          </label>
        </div>
      </aside>

      <div className={`claim-page bg-${option}${solo ? " solo" : ""}`} style={pageStyle}>
        {/* Per-option fixed-position children */}
        {option === "02" && PARTICLES.map((p, i) => (
          <span
            key={i}
            className="bg-particle"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
        {option === "03" && (
          <>
            <span className="bg-aurora-cloud bg-aurora-cloud--a" />
            <span className="bg-aurora-cloud bg-aurora-cloud--b" />
            <span className="bg-aurora-cloud bg-aurora-cloud--c" />
          </>
        )}
        {option === "04" && (
          <>
            <span className="bg-ring" />
            <span className="bg-ring bg-ring--2" />
            <span className="bg-ring bg-ring--3" />
          </>
        )}
        {option === "09" && STARS.map((s, i) => (
          <span
            key={i}
            className="bg-star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
        {option === "10" && (
          <>
            <span className="bg-blob bg-blob--a" />
            <span className="bg-blob bg-blob--b" />
          </>
        )}

        <header className="claim-header">
          <a
            href="https://www.thesalesprogressor.co.uk"
            target="_blank"
            rel="noopener"
            className="claim-wordmark"
          >
            The Sales Progressor
          </a>
        </header>

        <div className="claim-container">
          <div className="claim-hero">
            <p className="claim-hero-eyebrow">
              {SAMPLE.originatorName.toUpperCase()} · {SAMPLE.originatorAgency.toUpperCase()}
            </p>
            <h1 className="claim-hero-h1">Your sale is part of a live chain.</h1>
            <p className="claim-hero-sub">
              {SAMPLE.originatorName} at {SAMPLE.originatorAgency} has linked{" "}
              {SAMPLE.stubPropertyAddress} to their file. Join to see where the chain stands.
            </p>
            <div className="claim-hero-rule" />

            <div className="claim-chain">
              {SAMPLE.links.map((cl, i) => {
                const isYours = cl.id === "stub";
                const isClaimed = cl.transactionId !== null;
                const address = isClaimed
                  ? (cl.transaction?.propertyAddress ?? "")
                  : isYours
                  ? (cl.stubPropertyAddress ?? "")
                  : "";
                const agency = cl.claimedBy?.firmName ?? null;

                return (
                  <div key={cl.id}>
                    {i > 0 && (
                      <div className="claim-chain-connector">
                        <div className="claim-chain-connector-dot" />
                        <div className="claim-chain-connector-line" />
                        <div className="claim-chain-connector-dot" />
                      </div>
                    )}
                    <div className="claim-chain-row">
                      <div className="claim-chain-gutter">
                        <span className="claim-chain-num">
                          {String(displayChainPosition(cl.position, total)).padStart(2, "0")}
                        </span>
                      </div>
                      <div
                        className={`claim-chain-card ${
                          isYours
                            ? "claim-chain-card--yours"
                            : isClaimed
                            ? "claim-chain-card--claimed"
                            : "claim-chain-card--pending"
                        }`}
                      >
                        {isYours ? (
                          <>
                            <div className="claim-chain-head">
                              <span className="claim-chain-address">{address || "Your sale"}</span>
                              <span className="claim-chain-status">YOU</span>
                            </div>
                            <div className="claim-chain-inner">
                              <span className="claim-chain-inner-text">
                                Your sale · Claim to join
                              </span>
                              <span className="claim-chain-inner-arrow">→</span>
                            </div>
                          </>
                        ) : isClaimed ? (
                          <>
                            <div className="claim-chain-head">
                              <span className="claim-chain-address">{address}</span>
                              <span className="claim-chain-status">✓ Joined</span>
                            </div>
                            {agency && <div className="claim-chain-agency">{agency}</div>}
                          </>
                        ) : (
                          <div className="claim-chain-head">
                            <span
                              className="claim-chain-address"
                              style={{
                                color: "rgba(255,255,255,.5)",
                                fontStyle: "italic",
                                fontWeight: 400,
                              }}
                            >
                              Invite pending
                            </span>
                            <span className="claim-chain-status">Invite sent</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,.15)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.60)" }}>
                Invited by:{" "}
                <strong style={{ color: "rgba(255,255,255,.85)" }}>{SAMPLE.originatorName}</strong>
                {", "}
                {SAMPLE.originatorAgency}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,.50)" }}>
                Invited on: {SAMPLE.invitedDate}
              </span>
            </div>
          </div>

          <div className="claim-cta" style={{ marginTop: 20 }}>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="claim-btn"
            >
              Claim this sale
            </a>
            <p className="claim-microcopy">Free to use · Takes 30 seconds</p>
            <a
              href="#"
              onClick={(e) => e.preventDefault()}
              className="claim-decline-link"
            >
              This isn&apos;t mine. Decline invite
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

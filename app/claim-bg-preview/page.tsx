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
  | "07" | "08" | "09" | "10" | "11" | "12"
  | "13" | "14" | "15" | "16" | "17" | "18"
  | "19" | "20" | "21" | "22" | "23" | "24";

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
  { id: "13", name: "Bokeh field",        note: "Eight large soft-focus circles drifting at different speeds" },
  { id: "14", name: "Ripple pond",        note: "Concentric ripples spawning at random points like rain on water" },
  { id: "15", name: "Sunbeam fan",        note: "Sun-rays fanning from top-left, slowly rotating" },
  { id: "16", name: "Confetti drift",     note: "Small coloured shapes falling diagonally" },
  { id: "17", name: "Breathing gradient", note: "Whole canvas breathes — gentle pulse of scale + opacity" },
  { id: "18", name: "Marquee bar",        note: "Single coral band sliding horizontally across" },
  { id: "19", name: "Smoke wisps",        note: "Heavy blurred shapes drifting like smoke" },
  { id: "20", name: "Constellation",      note: "Dots connected by faint lines, network graph feel" },
  { id: "21", name: "Heartbeat ECG",      note: "Single waveform line scrolling left, like a monitor" },
  { id: "22", name: "Topo contours",      note: "Stacked elevation rings drifting outward" },
  { id: "23", name: "Hex flicker",        note: "Hex grid where individual tiles flicker on and off" },
  { id: "24", name: "Crystal facets",     note: "Geometric polygons rotating + morphing" },
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
   * 13 — Bokeh field
   * Eight large soft-focus circles, drifting at different speeds + sizes.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-13 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-13 > header,
  .claim-page.bg-13 > .claim-container { position: relative; z-index: 2; }
  .bg-bokeh {
    position: fixed; border-radius: 50%;
    filter: blur(40px); pointer-events: none; z-index: 1;
  }
  @keyframes bg-bokeh-a { 0%,100% { transform: translate(0,0); } 50% { transform: translate(80px, -60px); } }
  @keyframes bg-bokeh-b { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-90px, 70px); } }
  @keyframes bg-bokeh-c { 0%,100% { transform: translate(0,0); } 50% { transform: translate(60px, 80px); } }
  @keyframes bg-bokeh-d { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-70px, -50px); } }

  /* ─────────────────────────────────────────────────────────────────────────
   * 14 — Ripple pond
   * Multiple expanding rings spawning at random points like rain on water.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-14 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-14 > header,
  .claim-page.bg-14 > .claim-container { position: relative; z-index: 2; }
  .bg-ripple {
    position: fixed;
    width: 40px; height: 40px;
    border: 2px solid rgba(255,107,74,.7);
    border-radius: 50%;
    transform: translate(-50%,-50%) scale(0);
    pointer-events: none; z-index: 1;
    animation: bg-ripple-expand 4s ease-out infinite;
  }
  @keyframes bg-ripple-expand {
    0%   { transform: translate(-50%,-50%) scale(0);   opacity: 1;   border-width: 3px; }
    100% { transform: translate(-50%,-50%) scale(10);  opacity: 0;   border-width: 1px; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 15 — Sunbeam fan
   * Repeating conic rays rotating slowly from top-left.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-15 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-15 > header,
  .claim-page.bg-15 > .claim-container { position: relative; z-index: 2; }
  .claim-page.bg-15::before {
    content: "";
    position: fixed; top: -50%; left: -50%;
    width: 200%; height: 200%;
    background: repeating-conic-gradient(
      from 0deg at 10% 10%,
      rgba(255,180,77,.40) 0deg,
      rgba(255,180,77,.40) 8deg,
      transparent 8deg,
      transparent 24deg
    );
    animation: bg-fan-rotate 40s linear infinite;
    pointer-events: none; z-index: 1;
  }
  @keyframes bg-fan-rotate {
    to { transform: rotate(360deg); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 16 — Confetti drift
   * 24 small coloured rectangles falling diagonally, rotating.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-16 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-16 > header,
  .claim-page.bg-16 > .claim-container { position: relative; z-index: 2; }
  .bg-confetti {
    position: fixed;
    width: 10px; height: 4px;
    pointer-events: none; z-index: 1;
    animation: bg-confetti-fall linear infinite;
  }
  @keyframes bg-confetti-fall {
    0%   { transform: translateY(-10vh) translateX(0) rotate(0deg);    opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { transform: translateY(110vh) translateX(120px) rotate(720deg); opacity: 0; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 17 — Breathing gradient
   * Whole canvas gently pulses scale + opacity. Slow, alive, calm.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-17 {
    background:
      radial-gradient(circle at 50% 50%, rgba(255,107,74,.40) 0%, rgba(255,180,77,.20) 40%, transparent 70%),
      #FDF9F5;
    background-size: 100% 100%;
    animation: bg-breathe 6s ease-in-out infinite;
  }
  @keyframes bg-breathe {
    0%, 100% { background-size: 100% 100%; }
    50%      { background-size: 140% 140%; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 18 — Marquee bar
   * One thick coral band scrolling across horizontally, on loop.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-18 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-18 > header,
  .claim-page.bg-18 > .claim-container { position: relative; z-index: 2; }
  .claim-page.bg-18::before {
    content: "";
    position: fixed; top: 40%; left: -100%;
    width: 300%; height: 80px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255,107,74,.45) 30%,
      rgba(255,180,77,.45) 50%,
      rgba(255,107,74,.45) 70%,
      transparent 100%
    );
    filter: blur(8px);
    animation: bg-marquee-slide 8s linear infinite;
    pointer-events: none; z-index: 1;
  }
  @keyframes bg-marquee-slide {
    0%   { transform: translateX(0); }
    100% { transform: translateX(50%); }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 19 — Smoke wisps
   * Heavy blurred shapes drifting slowly like smoke. Different feel from
   * aurora (smaller, more, more chaotic, monochrome-ish coral).
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-19 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-19 > header,
  .claim-page.bg-19 > .claim-container { position: relative; z-index: 2; }
  .bg-smoke {
    position: fixed;
    width: 400px; height: 200px;
    border-radius: 50%;
    filter: blur(60px);
    background: rgba(255,107,74,.35);
    pointer-events: none; z-index: 1;
  }
  @keyframes bg-smoke-a { 0% { transform: translate(-30%, 0) scale(1); opacity: 0.3; } 50% { opacity: 0.7; } 100% { transform: translate(130%, -20%) scale(1.4); opacity: 0; } }
  @keyframes bg-smoke-b { 0% { transform: translate(130%, 0) scale(1); opacity: 0.3; } 50% { opacity: 0.7; } 100% { transform: translate(-30%, 20%) scale(1.4); opacity: 0; } }

  /* ─────────────────────────────────────────────────────────────────────────
   * 20 — Constellation
   * Dots connected by faint lines. Lines pulse (stroke-dashoffset).
   * Renders as inline SVG for sharp lines.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-20 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-20 > header,
  .claim-page.bg-20 > .claim-container { position: relative; z-index: 2; }
  .bg-constellation-svg {
    position: fixed; inset: 0;
    width: 100vw; height: 100vh;
    pointer-events: none; z-index: 1;
  }
  .bg-constellation-line {
    stroke: rgba(255,107,74,.55);
    stroke-width: 1;
    fill: none;
    stroke-dasharray: 6 6;
    animation: bg-constellation-flow 4s linear infinite;
  }
  @keyframes bg-constellation-flow {
    to { stroke-dashoffset: -24; }
  }
  .bg-constellation-dot {
    fill: rgba(255,107,74,.85);
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 21 — Heartbeat ECG
   * A single waveform line that scrolls horizontally like a heart monitor.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-21 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-21 > header,
  .claim-page.bg-21 > .claim-container { position: relative; z-index: 2; }
  .bg-ecg-svg {
    position: fixed; left: 0; top: 50%;
    width: 200vw; height: 200px;
    transform: translateY(-50%);
    pointer-events: none; z-index: 1;
    animation: bg-ecg-scroll 6s linear infinite;
  }
  @keyframes bg-ecg-scroll {
    from { transform: translate(0, -50%); }
    to   { transform: translate(-50%, -50%); }
  }
  .bg-ecg-path {
    stroke: rgba(255,107,74,.55);
    stroke-width: 2;
    fill: none;
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 22 — Topo contours
   * Stacked elevation rings, slowly drifting outward from centre.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-22 {
    background:
      repeating-radial-gradient(
        circle at 50% 50%,
        transparent 0px,
        transparent 38px,
        rgba(255,107,74,.30) 38px,
        rgba(255,107,74,.30) 40px
      ),
      #FDF9F5;
    background-size: 100% 100%;
    animation: bg-topo-drift 6s linear infinite;
  }
  @keyframes bg-topo-drift {
    from { background-size: 100% 100%; }
    to   { background-size: 140% 140%; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 23 — Hex flicker
   * Hex grid pattern as SVG bg. Individual cells flicker via overlay.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-23 {
    background:
      url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 52'%3E%3Cpath d='M30 0 L60 17 L60 35 L30 52 L0 35 L0 17 Z' fill='none' stroke='rgba(255,107,74,0.35)' stroke-width='1'/%3E%3C/svg%3E"),
      #FDF9F5;
    background-size: 60px 52px;
    position: relative;
    overflow: hidden;
  }
  .claim-page.bg-23 > header,
  .claim-page.bg-23 > .claim-container { position: relative; z-index: 2; }
  .bg-hex-cell {
    position: fixed;
    width: 60px; height: 52px;
    background: rgba(255,107,74,.40);
    clip-path: polygon(50% 0, 100% 33%, 100% 66%, 50% 100%, 0 66%, 0 33%);
    pointer-events: none; z-index: 1;
    animation: bg-hex-flicker 3s ease-in-out infinite;
  }
  @keyframes bg-hex-flicker {
    0%, 100% { opacity: 0; }
    50%      { opacity: 1; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * 24 — Crystal facets
   * Six big polygon shapes rotating + morphing position.
   * ───────────────────────────────────────────────────────────────────────── */
  .claim-page.bg-24 { background: #FDF9F5; position: relative; overflow: hidden; }
  .claim-page.bg-24 > header,
  .claim-page.bg-24 > .claim-container { position: relative; z-index: 2; }
  .bg-crystal {
    position: fixed;
    width: 320px; height: 320px;
    background: rgba(255,107,74,.30);
    pointer-events: none; z-index: 1;
    transform-origin: center;
  }
  @keyframes bg-crystal-a { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(60px,40px) rotate(180deg); } }
  @keyframes bg-crystal-b { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(-50px,60px) rotate(-180deg); } }
  @keyframes bg-crystal-c { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(40px,-50px) rotate(90deg); } }

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

const BOKEH = (() => {
  const rng = seededRand(3);
  const COLORS = [
    "rgba(255,107,74,.45)",
    "rgba(255,180,77,.40)",
    "rgba(255,200,150,.35)",
    "rgba(255,140,100,.40)",
  ];
  const ANIMS = ["bg-bokeh-a", "bg-bokeh-b", "bg-bokeh-c", "bg-bokeh-d"];
  return Array.from({ length: 8 }, (_, i) => ({
    left: rng() * 100,
    top: rng() * 100,
    size: 180 + rng() * 220,
    color: COLORS[i % COLORS.length],
    anim: ANIMS[i % ANIMS.length],
    duration: 8 + rng() * 8,
    delay: -rng() * 10,
  }));
})();

const RIPPLES = (() => {
  const rng = seededRand(4);
  return Array.from({ length: 7 }, () => ({
    left: 10 + rng() * 80,
    top: 10 + rng() * 80,
    delay: -rng() * 4,
  }));
})();

const CONFETTI = (() => {
  const rng = seededRand(5);
  const COLORS = ["#FF6B4A", "#FFB74D", "#FF9580", "#FFD966", "#FF7E5C"];
  return Array.from({ length: 24 }, () => ({
    left: rng() * 100,
    color: COLORS[Math.floor(rng() * COLORS.length)],
    width: 6 + rng() * 8,
    height: 3 + rng() * 4,
    duration: 6 + rng() * 6,
    delay: -rng() * 12,
  }));
})();

// Constellation: 18 dots, link each to its 2-3 nearest neighbours.
const CONSTELLATION = (() => {
  const rng = seededRand(6);
  const dots = Array.from({ length: 18 }, () => ({
    x: rng() * 100,
    y: rng() * 100,
  }));
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  dots.forEach((a, i) => {
    const distances = dots
      .map((b, j) => ({ j, d: Math.hypot(b.x - a.x, b.y - a.y) }))
      .filter(({ j }) => j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    distances.forEach(({ j }) => {
      if (j > i) lines.push({ x1: a.x, y1: a.y, x2: dots[j].x, y2: dots[j].y });
    });
  });
  return { dots, lines };
})();

// ECG path: a repeating heartbeat waveform across 200vw.
const ECG_PATH = (() => {
  // One heartbeat unit (260px wide). Repeat across the width.
  const beat = "l 40 0 l 8 -5 l 8 -15 l 8 40 l 8 -55 l 8 25 l 8 0 l 40 0 l 8 0";
  let d = "M 0 100";
  for (let i = 0; i < 24; i++) d += " " + beat;
  return d;
})();

const HEX_FLICKERS = (() => {
  const rng = seededRand(7);
  return Array.from({ length: 18 }, () => ({
    // Snap to hex grid roughly. 60×52 cells.
    col: Math.floor(rng() * 30),
    row: Math.floor(rng() * 20),
    delay: -rng() * 3,
  }));
})();

const CRYSTALS = (() => {
  const rng = seededRand(8);
  const SHAPES = [
    "polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)",  // pentagon
    "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",            // diamond
    "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)", // hexagon
  ];
  const ANIMS = ["bg-crystal-a", "bg-crystal-b", "bg-crystal-c"];
  return Array.from({ length: 6 }, (_, i) => ({
    left: rng() * 100 - 10,
    top: rng() * 100 - 10,
    clipPath: SHAPES[i % SHAPES.length],
    anim: ANIMS[i % ANIMS.length],
    duration: 12 + rng() * 10,
    delay: -rng() * 12,
    rotate: rng() * 360,
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
        {option === "13" && BOKEH.map((b, i) => (
          <span
            key={i}
            className="bg-bokeh"
            style={{
              left: `${b.left}%`,
              top: `${b.top}%`,
              width: b.size,
              height: b.size,
              background: b.color,
              animation: `${b.anim} ${b.duration}s ease-in-out infinite alternate`,
              animationDelay: `${b.delay}s`,
            }}
          />
        ))}
        {option === "14" && RIPPLES.map((r, i) => (
          <span
            key={i}
            className="bg-ripple"
            style={{
              left: `${r.left}%`,
              top: `${r.top}%`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}
        {option === "16" && CONFETTI.map((c, i) => (
          <span
            key={i}
            className="bg-confetti"
            style={{
              left: `${c.left}%`,
              width: c.width,
              height: c.height,
              background: c.color,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}
        {option === "19" && (
          <>
            <span className="bg-smoke" style={{ top: "20%", left: 0,    animation: "bg-smoke-a 14s ease-in-out infinite" }} />
            <span className="bg-smoke" style={{ top: "55%", left: 0,    animation: "bg-smoke-b 17s ease-in-out infinite", animationDelay: "-4s" }} />
            <span className="bg-smoke" style={{ top: "35%", left: 0,    animation: "bg-smoke-a 19s ease-in-out infinite", animationDelay: "-8s", background: "rgba(255,180,77,.35)" }} />
            <span className="bg-smoke" style={{ top: "70%", left: 0,    animation: "bg-smoke-b 22s ease-in-out infinite", animationDelay: "-12s" }} />
          </>
        )}
        {option === "20" && (
          <svg className="bg-constellation-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
            {CONSTELLATION.lines.map((l, i) => (
              <line
                key={i}
                className="bg-constellation-line"
                x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                vectorEffect="non-scaling-stroke"
                style={{ animationDelay: `${-i * 0.15}s` }}
              />
            ))}
            {CONSTELLATION.dots.map((d, i) => (
              <circle
                key={i}
                className="bg-constellation-dot"
                cx={d.x} cy={d.y} r={0.6}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        )}
        {option === "21" && (
          <svg className="bg-ecg-svg" viewBox="0 0 6240 200" preserveAspectRatio="none">
            <path className="bg-ecg-path" d={ECG_PATH} vectorEffect="non-scaling-stroke" />
          </svg>
        )}
        {option === "23" && HEX_FLICKERS.map((h, i) => (
          <span
            key={i}
            className="bg-hex-cell"
            style={{
              left: h.col * 60,
              top: h.row * 39,
              animationDelay: `${h.delay}s`,
            }}
          />
        ))}
        {option === "24" && CRYSTALS.map((c, i) => (
          <span
            key={i}
            className="bg-crystal"
            style={{
              left: `${c.left}%`,
              top: `${c.top}%`,
              clipPath: c.clipPath,
              animation: `${c.anim} ${c.duration}s ease-in-out infinite`,
              animationDelay: `${c.delay}s`,
            }}
          />
        ))}

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

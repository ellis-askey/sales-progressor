"use client";

// Placeholder mark for a client agency with no uploaded logo (critique #186,
// option 3): the agency's initials over a generated multi-colour mesh gradient,
// drawn deterministically from the name — so the same agency always gets the
// same mark, and it reads as a crafted brand avatar rather than a plain initial
// tile. Swaps to the real logo the moment one is uploaded (handled by callers).
// Retina-crisp and theme-aware (redraws on light/dark change).

import { useEffect, useRef } from "react";

function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}
function initials(name: string): string {
  return name.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}
// Stable seeded RNG (FNV-1a seed + LCG), so the mesh is identical per name.
function makeRng(name: string): () => number {
  let s = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i++) {
    s ^= name.charCodeAt(i);
    s = Math.imul(s, 16777619) >>> 0;
  }
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function detectDark(): boolean {
  if (typeof document === "undefined") return false;
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function draw(canvas: HTMLCanvasElement, name: string, size: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const x = canvas.getContext("2d");
  if (!x) return;
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = makeRng(name);
  const hue = hashHue(name);
  const d = detectDark();
  const S = size;

  x.clearRect(0, 0, S, S);
  x.fillStyle = d ? `hsl(${hue} 42% 24%)` : `hsl(${hue} 60% 58%)`;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 3; i++) {
    const h = (hue + i * 42 + Math.floor(r() * 26)) % 360;
    const cx = r() * S;
    const cy = r() * S;
    const rad = (22 + r() * 16) * (S / 52);
    const rg = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    rg.addColorStop(0, d ? `hsla(${h} 62% 56% / 0.92)` : `hsla(${h} 86% 68% / 0.92)`);
    rg.addColorStop(1, `hsla(${h} 62% 56% / 0)`);
    x.fillStyle = rg;
    x.fillRect(0, 0, S, S);
  }
  const fs = Math.round(S * 0.38);
  x.font = `800 ${fs}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillStyle = "rgba(0,0,0,0.20)";
  x.fillText(initials(name), S / 2, S / 2 + 1.5);
  x.fillStyle = "#fff";
  x.fillText(initials(name), S / 2, S / 2);
}

export function AgencyMeshMark({ name, size = 52, className }: { name: string; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const redraw = () => draw(c, name, size);
    redraw();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", redraw);
    const obs = new MutationObserver(redraw);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", redraw);
      obs.disconnect();
    };
  }, [name, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, display: "block" }}
      aria-hidden
    />
  );
}

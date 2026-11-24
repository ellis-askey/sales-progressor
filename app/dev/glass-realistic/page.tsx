"use client";
// /dev/glass-realistic — isolates the LiquidLens performance question. Config via
// URL query so each run is a clean mount: ?engine=lens|current|none & bg=animated|static
// & count=N & animate=0|1. Realistic: a few glass cards over TSP content + a draggable
// surface + a drawer, so we can measure idle / scroll / drag FPS per configuration.
// Dev-only; nothing writes data; the legacy engine + production are untouched.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { House } from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";
import { LiquidGlass } from "@/components/liquid";
import { LiquidLens } from "@/components/liquid/LiquidLens";

type Engine = "lens" | "current" | "none";

function Surface({ engine, className, children, ...rest }: { engine: Engine; className?: string; children?: ReactNode } & Record<string, unknown>) {
  if (engine === "lens") return <LiquidLens radius={16} strength="strong" thickness={1.3} tint="var(--lg-glass-card)" className={className} {...rest}>{children}</LiquidLens>;
  if (engine === "current") return <LiquidGlass radius={16} thickness={14} displace={30} aberration={2} tint="var(--lg-glass-card)" className={className} {...rest}>{children}</LiquidGlass>;
  return <div className={`r-plain ${className ?? ""}`} {...rest}>{children}</div>;
}

export default function GlassRealistic() {
  if (process.env.NODE_ENV === "production") notFound();
  const [cfg, setCfg] = useState({ engine: "lens" as Engine, bg: "animated", count: 5, animate: false });
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setCfg({
      engine: (q.get("engine") as Engine) || "lens",
      bg: q.get("bg") || "animated",
      count: Math.max(1, Math.min(12, Number(q.get("count") || 5))),
      animate: q.get("animate") === "1",
    });
  }, []);

  // FPS meter → window.__perfFps
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let raf = 0, frames = 0, t0 = performance.now();
    const tick = (t: number) => {
      frames += 1;
      if (t - t0 >= 500) { const v = Math.round((frames * 1000) / (t - t0)); setFps(v); (window as unknown as { __perfFps: number }).__perfFps = v; frames = 0; t0 = t; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // optional continuous animation of the cards (worst case)
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!cfg.animate) return;
    const wrap = listRef.current; if (!wrap) return;
    let raf = 0; const start = performance.now();
    const cards = Array.from(wrap.querySelectorAll<HTMLElement>(".r-card-move"));
    const loop = (t: number) => { const s = (t - start) / 1000; cards.forEach((el, i) => { el.style.transform = `translateX(${Math.sin(s * 1.6 + i) * 8}px)`; }); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cfg.animate, cfg.count]);

  // draggable surface for the drag test
  const [p, setP] = useState({ x: 0, y: 0, drag: false });

  return (
    <div className="lg-ds r-root" data-theme="dark">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {cfg.bg === "animated" ? <AppBackground /> : <div className="r-staticbg" aria-hidden />}
      <div className="r-amb" aria-hidden />

      <div className="r-hud">
        <span className="r-fps" data-low={fps > 0 && fps < 50 ? "" : undefined}>{fps} fps</span>
        <span className="r-cfg">engine:{cfg.engine} · bg:{cfg.bg} · n:{cfg.count} · {cfg.animate ? "animating" : "static"}</span>
        <Dialog.Root>
          <Dialog.Trigger asChild><button className="r-btn">Open drawer</button></Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="r-overlay" />
            <Dialog.Content className="r-drawer-pos" aria-describedby={undefined}>
              <Surface engine={cfg.engine} className="r-drawer"><Dialog.Title className="r-dtitle">Filters</Dialog.Title><p className="r-dbody">A drawer over the chosen glass material.</p><Dialog.Close asChild><button className="r-btn">Close</button></Dialog.Close></Surface>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <main className="r-wrap">
        <div ref={listRef} className="r-list">
          {Array.from({ length: cfg.count }).map((_, i) => (
            <Surface key={i} engine={cfg.engine} className="r-card r-card-move">
              <div className="r-card-head"><span className="r-marker"><House weight="regular" /></span><div><strong>14 Bushey Avenue</strong><em>Broxbourne, EN10 6QE</em></div><span className="r-status"><span className="r-dot" />Active · 62%</span></div>
              <p className="r-body">You confirmed all enquiries have been raised with the seller&apos;s solicitor. Searches are back with no adverse entries.</p>
              <div className="r-prog"><span style={{ width: "62%" }} /></div>
            </Surface>
          ))}
        </div>
      </main>

      {/* draggable surface */}
      <div className="r-drag-wrap">
        <Surface engine={cfg.engine} className="r-drag"
          style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
          onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => { e.currentTarget.setPointerCapture(e.pointerId); setP((s) => ({ ...s, drag: true })); }}
          onPointerMove={(e: React.PointerEvent<HTMLDivElement>) => setP((s) => (s.drag ? { ...s, x: s.x + e.movementX, y: s.y + e.movementY } : s))}
          onPointerUp={() => setP((s) => ({ ...s, drag: false }))}>
          <span className="r-drag-tag">drag</span>
        </Surface>
      </div>
    </div>
  );
}

const CSS = `
.r-root{ position:relative; min-height:100vh; isolation:isolate; background-color:var(--lg-base); }
.r-staticbg{ position:absolute; inset:0; z-index:0; background:linear-gradient(160deg,#0a0e17,#12172a 60%,#0c1020); }
.r-amb{ position:absolute; inset:0; z-index:0; pointer-events:none; background:radial-gradient(60% 40% at 15% 10%, rgba(56,225,255,0.08), transparent 70%), radial-gradient(50% 35% at 85% 90%, rgba(168,255,96,0.05), transparent 70%); }
.r-hud{ position:fixed; z-index:40; top:14px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:14px; padding:8px 14px; border-radius:14px; background:rgba(20,24,34,0.7); border:1px solid var(--lg-line); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); }
.r-fps{ font-size:14px; font-weight:750; color:var(--lg-ok); font-variant-numeric:tabular-nums; } .r-fps[data-low]{ color:var(--lg-warn); }
.r-cfg{ font-size:11.5px; color:var(--lg-ink-3); font-family:ui-monospace,monospace; }
.r-btn{ font:inherit; font-size:12.5px; font-weight:600; color:#fff; background:var(--lg-accent); border:none; border-radius:9px; padding:6px 12px; cursor:pointer; }
.r-wrap{ position:relative; z-index:2; max-width:640px; margin:0 auto; padding:70px 20px 160px; }
.r-list{ display:flex; flex-direction:column; gap:14px; }
.r-card{ overflow:hidden; padding:0; } .r-card > *{ position:relative; z-index:1; }
.r-plain{ background:rgba(28,32,44,0.72); border:1px solid var(--lg-line); border-radius:16px; }
.r-card-head{ display:flex; align-items:center; gap:12px; padding:14px 16px 0; } .r-marker{ width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); } .r-marker svg{ width:18px; height:18px; color:var(--lg-ink-2); }
.r-card-head strong{ display:block; font-size:14.5px; font-weight:650; } .r-card-head em{ font-style:normal; font-size:12px; color:var(--lg-ink-3); }
.r-status{ margin-left:auto; display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--lg-ink-2); } .r-dot{ width:7px; height:7px; border-radius:50%; background:var(--lg-ok); }
.r-body{ font-size:13px; color:var(--lg-ink-2); line-height:1.5; padding:12px 16px 0; }
.r-prog{ height:4px; border-radius:999px; background:var(--lg-fill); overflow:hidden; margin:12px 16px 16px; } .r-prog > span{ display:block; height:100%; background:var(--lg-accent); }
.r-drag-wrap{ position:fixed; z-index:30; bottom:28px; left:50%; transform:translateX(-50%); }
.r-drag{ width:92px; height:92px; border-radius:999px; display:grid; place-items:center; cursor:grab; touch-action:none; box-shadow:0 12px 30px rgba(0,0,0,0.3) !important; } .r-drag:active{ cursor:grabbing; } .r-drag-tag{ font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,0.85); text-shadow:0 1px 3px rgba(0,0,0,0.4); pointer-events:none; }
.r-overlay{ position:fixed; inset:0; z-index:60; background:rgba(0,0,0,0.42); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); }
.r-drawer-pos{ position:fixed; z-index:61; top:0; right:0; height:100%; width:min(360px,90vw); }
.r-drawer-pos[data-state=open]{ animation:r-in .35s cubic-bezier(.2,.8,.2,1); } .r-drawer-pos[data-state=closed]{ animation:r-out .25s ease; }
@keyframes r-in{ from{transform:translateX(100%)} to{transform:translateX(0)} } @keyframes r-out{ from{transform:translateX(0)} to{transform:translateX(100%)} }
.r-drawer{ height:100%; border-radius:0; padding:24px; } .r-drawer > *{ position:relative; z-index:1; } .r-dtitle{ font-size:18px; font-weight:720; } .r-dbody{ font-size:13px; color:var(--lg-ink-2); margin:8px 0 16px; }
@media (prefers-reduced-motion: reduce){ .r-card-move{ transform:none !important; } }
`;

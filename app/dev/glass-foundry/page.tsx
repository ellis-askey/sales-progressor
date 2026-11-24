"use client";
// /dev/glass-foundry — optical comparison laboratory. Dev-only (blocks in prod).
// Compares five LOCAL material treatments against controlled backgrounds, at three
// sizes, on functional controls, with drag/scroll frame-time analysis and a11y
// fallbacks. Shared primitives used read-only. Nothing is Approved.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { LiquidLens } from "@/components/liquid/LiquidLens";
import {
  Foundry, GButton, GSegmented, GSwitch, GToolbar, VARIANTS, contrastRatio, OPAQUE,
  type Variant,
} from "./materials";

// the proven slab lens, with the EXACT props /dev/glass-optics uses for its puck —
// the reference every foundry treatment is measured against (read-only import).
function ProvenLens() {
  return <LiquidLens radius={999} strength="strong" thickness={1.6} tint="rgba(255,255,255,0.06)" className="gf-ab-surf" />;
}

type Theme = "dark" | "light";
type Bg = "textcolour" | "ambient" | "content" | "photo" | "dense";
const BGS: { key: Bg; name: string }[] = [
  { key: "textcolour", name: "Bold text + colour" },
  { key: "ambient", name: "Ambient gradient" },
  { key: "content", name: "TSP content + text" },
  { key: "photo", name: "Property photo" },
  { key: "dense", name: "Dense content" },
];

/* ── continuous frame-time meter (captures stutter + spikes, not just average) ── */
function useFrameMeter() {
  const buf = useRef<number[]>([]);
  const [stats, setStats] = useState({ fps: 0, p95: 0, max: 0, jank: 0 });
  useEffect(() => {
    let raf = 0, last = 0, acc = 0, n = 0;
    const tick = (t: number) => {
      if (last) { const dt = t - last; buf.current.push(dt); if (buf.current.length > 90) buf.current.shift(); acc += dt; n += 1; }
      last = t;
      if (n >= 12) {
        const arr = [...buf.current].sort((a, b) => a - b);
        const p95 = arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] : 0;
        const max = arr.length ? arr[arr.length - 1] : 0;
        const jank = buf.current.filter((d) => d > 32).length;
        setStats({ fps: Math.round(1000 / (acc / n)), p95: Math.round(p95), max: Math.round(max), jank });
        acc = 0; n = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return { buf, stats };
}

function FrameGraph({ buf, stats }: { buf: React.MutableRefObject<number[]>; stats: { fps: number; p95: number; max: number; jank: number } }) {
  return (
    <div className="gf-perf">
      <div className="gf-graph" aria-hidden>
        {buf.current.map((ms, i) => {
          const h = Math.min(100, (ms / 50) * 100);
          const tone = ms > 48 ? "spike" : ms > 32 ? "jank" : "ok";
          return <span key={i} className="gf-bar" data-tone={tone} style={{ height: `${h}%` }} />;
        })}
        <span className="gf-graph-line" style={{ bottom: `${(16.7 / 50) * 100}%` }} title="60fps budget (16.7ms)" />
        <span className="gf-graph-line gf-graph-line--30" style={{ bottom: `${(33.3 / 50) * 100}%` }} title="30fps (33ms)" />
      </div>
      <div className="gf-perf-stats">
        <span><b>{stats.fps}</b> fps avg</span>
        <span><b>{stats.p95}</b>ms p95</span>
        <span data-warn={stats.max > 32 || undefined}><b>{stats.max}</b>ms worst frame</span>
        <span data-warn={stats.jank > 0 || undefined}><b>{stats.jank}</b> janky frames /90</span>
      </div>
    </div>
  );
}

/* ── backdrops ──────────────────────────────────────────────────────────────── */
function ContentBackdrop() {
  return (
    <div className="gf-content-bd" aria-hidden>
      <h3>14 Bushey Avenue</h3>
      <p className="gf-cb-loc">Broxbourne, EN10 6QE · Legal work · ~11 days to exchange</p>
      {[
        ["A solicitor replied to our chase", "We confirm the boundary runs along the eastern fence line; a copy of the deed plan is enclosed for your records."],
        ["Price changed", "Reduced from £425,000 to £415,000 following the buyer's survey."],
        ["Searches received", "Local authority search returned with no adverse entries."],
        ["Enquiries raised", "Your solicitor has sent the first round of enquiries to the seller's side."],
      ].map(([t, b]) => (<div key={t} className="gf-cb-row"><strong>{t}</strong><span>{b}</span></div>))}
    </div>
  );
}
function DenseBackdrop() {
  return (
    <div className="gf-dense-bd" aria-hidden>
      {Array.from({ length: 56 }).map((_, i) => (
        <div key={i} className="gf-dense-row"><span>{["3 Maple Court", "7 Victoria Road", "41 Oak Lane", "18 Riverside", "9 Kingfisher Drive"][i % 5]}</span><span>{["chase", "overdue", "booking", "mortgage", "filing"][i % 5]}</span></div>
      ))}
    </div>
  );
}
// high-frequency backdrop — big faint words + colour blobs. Refraction is only
// visible over edges like these; smooth gradients reveal nothing. (Same idea as
// /dev/glass-optics' colour scene, replicated locally.)
function TextColourBackdrop() {
  return (
    <div className="gf-tc-bd" aria-hidden>
      <span>REFRACTION</span><span>EXCHANGE</span><span>MAPLE COURT</span><span>SOLICITOR</span>
      <i className="gf-blob a" /><i className="gf-blob b" /><i className="gf-blob c" />
    </div>
  );
}
function BgLayer({ bg, animate }: { bg: Bg; animate?: boolean }) {
  return (
    <div className={`gf-bg gf-bg-${bg} ${animate ? "gf-bg-anim" : ""}`} aria-hidden>
      {bg === "textcolour" && <TextColourBackdrop />}
      {bg === "content" && <ContentBackdrop />}
      {bg === "dense" && <DenseBackdrop />}
    </div>
  );
}
function Stage({ bg, animate, tall, children }: { bg: Bg; animate?: boolean; tall?: boolean; children: ReactNode }) {
  return (
    <div className={`gf-stage ${tall ? "gf-stage-tall" : ""}`}>
      <BgLayer bg={bg} animate={animate} />
      <div className="gf-stage-fg">{children}</div>
    </div>
  );
}

// draggable identical-geometry puck for the A/B — move it over the text to see the bend
function LensPuck({ kind, label, start }: { kind: "proven" | "baseline" | "refined"; label: string; start: { x: number; y: number } }) {
  const [p, setP] = useState({ x: start.x, y: start.y, drag: false });
  return (
    <div className="gf-ab-puck" data-drag={p.drag || undefined} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setP((s) => ({ ...s, drag: true })); }}
      onPointerMove={(e) => setP((s) => (s.drag ? { ...s, x: s.x + e.movementX, y: s.y + e.movementY } : s))}
      onPointerUp={() => setP((s) => ({ ...s, drag: false }))}>
      {kind === "proven"
        ? <ProvenLens />
        : <Foundry variant={kind === "baseline" ? "baseline" : "refined"} radius={999} className="gf-ab-surf" />}
      <span className="gf-ab-tag">{label}</span>
    </div>
  );
}

// sample text that sits ON the glass (text-on-glass legibility read)
function SampleText({ small }: { small?: boolean }) {
  if (small) return <span className="gf-sample-sm">Exchange</span>;
  return (
    <div className="gf-sample">
      <strong>3 Maple Court</strong>
      <span>Exchange overdue · 5 days</span>
    </div>
  );
}

export default function GlassFoundry() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [bg, setBg] = useState<Bg>("textcolour");
  const [variant, setVariant] = useState<Variant>("refined");
  const [opaque, setOpaque] = useState(false);
  const [contrast, setContrast] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [stress, setStress] = useState(0);
  const { buf, stats } = useFrameMeter();

  // draggable puck
  const [pos, setPos] = useState({ x: 120, y: 90 });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const onDown = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); dragRef.current = { dx: e.clientX - r.left - pos.x, dy: e.clientY - r.top - pos.y }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!dragRef.current || !stageRef.current) return; const r = stageRef.current.getBoundingClientRect(); setPos({ x: Math.max(0, Math.min(r.width - 120, e.clientX - r.left - dragRef.current.dx)), y: Math.max(0, Math.min(r.height - 120, e.clientY - r.top - dragRef.current.dy)) }); };
  const onUp = () => { dragRef.current = null; };

  const common = { variant, opaque, contrast, reduced };
  const op = OPAQUE[theme];
  const ratio = contrastRatio(contrast ? op.contrastSurface : op.surface, contrast ? op.contrastInk : op.ink);

  return (
    <div className="lg-ds gf-root" data-theme={theme} data-reduced={reduced || undefined}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="gf-head">
        <div>
          <span className="gf-kicker">Optical laboratory · Phase 1 · nothing approved</span>
          <h1>TSP glass foundry</h1>
          <p>Five material treatments, controlled backgrounds, three sizes, functional controls, and frame-time analysis. <b>Glass optics only render on a GPU browser</b> — judge refraction, blur and reflections live, not from a screenshot.</p>
        </div>
      </header>

      {/* controls */}
      <div className="gf-toolbar-bar">
        <Seg label="Theme" value={theme} set={(v) => setTheme(v as Theme)} opts={[["dark", "Dark"], ["light", "Light"]]} />
        <Seg label="Background" value={bg} set={(v) => setBg(v as Bg)} opts={BGS.map((b) => [b.key, b.name])} />
        <Seg label="Focus variant" value={variant} set={(v) => setVariant(v as Variant)} opts={VARIANTS.map((v) => [v.key, v.key.toUpperCase()])} />
        <div className="gf-a11y">
          <Toggle label="Reduce transparency" on={opaque} set={setOpaque} />
          <Toggle label="Increase contrast" on={contrast} set={setContrast} />
          <Toggle label="Reduce motion" on={reduced} set={setReduced} />
        </div>
      </div>

      {/* 0 · direct identical-geometry A/B over high-contrast text */}
      <section className="gf-sec">
        <h2>0 · Direct A/B — proven optics lens vs V0 vs V1, identical geometry</h2>
        <p className="gf-note"><b>The authoritative refraction test.</b> Three pucks, same size and material settings, over bold text + colour. <b>Drag each over the words</b> — a real lens bends the letters at its rim as it moves. The proven lens (left, the exact `/dev/glass-optics` puck) is the reference; if V0 or V1 don't bend the text the same way, it's visible here. Refraction only renders on a GPU browser.</p>
        <div className="gf-ab-stage">
          <BgLayer bg="textcolour" />
          <LensPuck kind="proven" label="Optics lens · proven" start={{ x: 40, y: 70 }} />
          <LensPuck kind="baseline" label="V0 · current" start={{ x: 360, y: 40 }} />
          <LensPuck kind="refined" label="V1 · refined" start={{ x: 640, y: 100 }} />
          <span className="gf-ab-hint">drag each puck over the text →</span>
        </div>
      </section>

      {/* 1 · side-by-side material comparison */}
      <section className="gf-sec">
        <h2>1 · The five treatments, same background</h2>
        <p className="gf-note">Text sits <i>on</i> the glass; the background sits <i>behind</i> it. Compare refraction, edge, translucency and legibility across treatments.</p>
        <Stage bg={bg}>
          <div className="gf-row5">
            {VARIANTS.map((v) => (
              <div key={v.key} className="gf-cell">
                <Foundry variant={v.key} opaque={opaque} contrast={contrast} radius={18} className="gf-med"><SampleText /></Foundry>
                <span className="gf-cell-lab"><b>{v.name}</b>{v.blurb}</span>
              </div>
            ))}
          </div>
        </Stage>
      </section>

      {/* 2 · size behaviour for the focus variant */}
      <section className="gf-sec">
        <h2>2 · Same treatment at three sizes — <span className="gf-hl">{variant.toUpperCase()}</span></h2>
        <p className="gf-note">A material that convinces as a large panel can distort or smear as a small control. This is where the slab lens tends to fail small.</p>
        <Stage bg={bg}>
          <div className="gf-sizes">
            <div className="gf-sz-col"><Foundry {...common} radius={11} className="gf-small"><SampleText small /></Foundry><span>small control</span></div>
            <div className="gf-sz-col"><Foundry {...common} radius={16} className="gf-med"><SampleText /></Foundry><span>medium surface</span></div>
            <div className="gf-sz-col"><Foundry {...common} radius={22} className="gf-large"><SampleText /></Foundry><span>large panel</span></div>
          </div>
        </Stage>
      </section>

      {/* 3 · functional controls in the focus material */}
      <section className="gf-sec">
        <h2>3 · Functional controls in <span className="gf-hl">{variant.toUpperCase()}</span></h2>
        <p className="gf-note">Real, interactive controls — click, toggle, drag-select. Judge whether the material holds up at control scale and in motion.</p>
        <Stage bg={bg}>
          <div className="gf-ctls">
            <GButton mat={common} reducedMotion={reduced} />
            <GSegmented mat={common} reducedMotion={reduced} />
            <GSwitch mat={common} reducedMotion={reduced} />
            <GToolbar mat={common} />
          </div>
        </Stage>
      </section>

      {/* 4 · drag + scroll responsiveness */}
      <section className="gf-sec">
        <h2>4 · Drag &amp; scroll responsiveness — <span className="gf-hl">{variant.toUpperCase()}</span></h2>
        <p className="gf-note">Drag the puck across the background and scroll the strip. Watch the frame graph below for stutter and spikes — not just the average.</p>
        <div className="gf-dragscroll">
          <div className="gf-stage gf-stage-tall" ref={stageRef} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <BgLayer bg={bg} />
            <div className="gf-puck" style={{ left: pos.x, top: pos.y }} onPointerDown={onDown}>
              <Foundry {...common} radius={18} className="gf-puck-surf"><span className="gf-puck-lab">drag</span></Foundry>
            </div>
          </div>
          <div className="gf-scrollbox">
            <div className="gf-scroll-bar"><Foundry {...common} radius={14} className="gf-ctl-surf" /><span className="gf-scroll-bar-lab">Glass bar · scroll under me</span></div>
            <div className="gf-scroll-inner">{Array.from({ length: 40 }).map((_, i) => (<div key={i} className="gf-scroll-row"><span>{["Chase the buyer's solicitor", "Confirm the survey booking", "Send the memorandum of sale", "Mortgage offer expiring", "Place 3 emails on a file"][i % 5]}</span><time>{i + 1}h</time></div>))}</div>
          </div>
        </div>
        <FrameGraph buf={buf} stats={stats} />
      </section>

      {/* 5 · performance stress */}
      <section className="gf-sec">
        <h2>5 · Performance stress — <span className="gf-hl">{variant.toUpperCase()}</span> over an animated background</h2>
        <p className="gf-note">The real cost is animated-background × glass-surface count. Add surfaces and watch the worst-frame and jank counts, not the average. 60 displacement surfaces is the worst case.</p>
        <div className="gf-stress-ctl">
          {[0, 5, 20, 60].map((n) => <button key={n} className="gf-chip" data-on={stress === n} onClick={() => setStress(n)}>{n === 0 ? "off" : `${n} surfaces`}</button>)}
        </div>
        {stress > 0 && (
          <div className="gf-stage gf-stage-tall">
            <div className="gf-bg gf-bg-ambient gf-bg-anim" aria-hidden />
            {Array.from({ length: stress }).map((_, i) => (
              <div key={i} className="gf-stress-surf" style={{ left: `${(i * 37) % 88}%`, top: `${(i * 23) % 70}%`, animationDelay: `${(i % 10) * -0.6}s` }}>
                <Foundry {...common} radius={12} className="gf-stress-inner" />
              </div>
            ))}
          </div>
        )}
        <FrameGraph buf={buf} stats={stats} />
      </section>

      {/* 6 · accessibility */}
      <section className="gf-sec">
        <h2>6 · Accessibility &amp; legibility</h2>
        <div className="gf-a11y-grid">
          <div className="gf-a11y-card">
            <h4>Opaque fallback (Reduce Transparency)</h4>
            <p className="gf-note">The only surface with a <i>measurable</i> contrast ratio, because its colour is fixed.</p>
            <div className="gf-a11y-demo" data-theme-surface={theme}>
              <Foundry variant={variant} opaque contrast={contrast} radius={14} className="gf-med"><SampleText /></Foundry>
            </div>
            <p className="gf-ratio" data-pass={ratio >= 4.5 || undefined}>Measured: <b>{ratio}:1</b> ({ratio >= 4.5 ? "passes" : ratio >= 3 ? "passes large/bold only" : "fails"} WCAG for body text) — surface {contrast ? op.contrastSurface : op.surface} vs text {contrast ? op.contrastInk : op.ink}.</p>
          </div>
          <div className="gf-a11y-card">
            <h4>Worst-case legibility (translucent)</h4>
            <p className="gf-note">Over the brightest backdrop. We do <b>not</b> claim a fixed ratio for translucent glass — it varies with whatever scrolls behind it. Judge legibility here directly.</p>
            <div className="gf-worst">
              <div className="gf-bg gf-bg-photo" aria-hidden />
              <Foundry variant={variant} contrast={contrast} radius={14} className="gf-med gf-worst-surf"><SampleText /></Foundry>
            </div>
            <p className="gf-note">If the text is hard to read here, the treatment needs a stronger scrim, a dimming layer, or the opaque fallback for this context.</p>
          </div>
        </div>
      </section>

      <footer className="gf-foot">Experimental · local to <code>/dev/glass-foundry</code> · nothing writes data, changes production or is Approved. Inspect optics and performance in a GPU-enabled browser.</footer>
    </div>
  );
}

function Seg({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: [string, string][] }) {
  return (
    <div className="gf-seg2"><span className="gf-seg2-lab">{label}</span><div className="gf-seg2-row">{opts.map(([k, l]) => <button key={k} data-on={value === k} onClick={() => set(k)}>{l}</button>)}</div></div>
  );
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return <button className="gf-toggle" data-on={on} onClick={() => set(!on)}><span className="gf-toggle-dot" />{label}</button>;
}

const CSS = `
.gf-root{ position:relative; min-height:100vh; background:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; padding:0 0 80px; }
.gf-head{ max-width:1180px; margin:0 auto; padding:34px 28px 10px; }
.gf-kicker{ font-size:11.5px; font-weight:700; letter-spacing:.04em; color:var(--lg-accent-ink); text-transform:uppercase; }
.gf-head h1{ font-size:34px; font-weight:820; letter-spacing:-.03em; margin:7px 0 8px; }
.gf-head p{ font-size:14px; color:var(--lg-ink-2); max-width:760px; line-height:1.5; } .gf-head p b{ color:var(--lg-ink); }

.gf-toolbar-bar{ position:sticky; top:0; z-index:50; max-width:1180px; margin:14px auto; padding:12px 18px; display:flex; gap:18px; flex-wrap:wrap; align-items:flex-end; background:color-mix(in srgb,var(--lg-base) 86%,transparent); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border:1px solid var(--lg-line-2); border-radius:16px; }
.gf-seg2-lab{ display:block; font-size:10.5px; font-weight:600; color:var(--lg-ink-3); margin-bottom:5px; text-transform:uppercase; letter-spacing:.03em; }
.gf-seg2-row{ display:inline-flex; gap:3px; padding:3px; background:rgba(0,0,0,.22); border:1px solid var(--lg-line); border-radius:10px; } .lg-ds[data-theme="light"] .gf-seg2-row{ background:rgba(12,16,28,.05); }
.gf-seg2-row button{ font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; padding:6px 11px; border-radius:7px; cursor:pointer; transition:background .2s,color .2s; white-space:nowrap; } .gf-seg2-row button[data-on="true"]{ background:var(--lg-fill); color:var(--lg-ink); } .lg-ds[data-theme="light"] .gf-seg2-row button[data-on="true"]{ background:#fff; }
.gf-a11y{ display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; }
.gf-toggle{ display:inline-flex; align-items:center; gap:7px; font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:7px 11px; cursor:pointer; } .gf-toggle-dot{ width:8px; height:8px; border-radius:50%; background:var(--lg-ink-3); transition:background .2s; } .gf-toggle[data-on="true"]{ color:var(--lg-ink); border-color:var(--lg-accent); } .gf-toggle[data-on="true"] .gf-toggle-dot{ background:var(--lg-accent); }

.gf-sec{ max-width:1180px; margin:0 auto; padding:26px 28px 6px; }
.gf-sec h2{ font-size:17px; font-weight:750; letter-spacing:-.01em; } .gf-hl{ color:var(--lg-accent-ink); }
.gf-note{ font-size:12.5px; color:var(--lg-ink-3); margin:5px 0 14px; max-width:720px; line-height:1.5; } .gf-note b{ color:var(--lg-ink-2); }

/* stages + backdrops */
.gf-stage{ position:relative; border-radius:20px; overflow:hidden; border:1px solid var(--lg-line-2); min-height:190px; }
.gf-stage-tall{ min-height:300px; }
.gf-bg{ position:absolute; inset:0; z-index:0; }
.gf-bg-ambient{ background:radial-gradient(42% 50% at 14% 20%, #5b4bff55, transparent 70%), radial-gradient(40% 50% at 82% 20%, #ff9d2e55, transparent 70%), radial-gradient(50% 60% at 60% 90%, #2fd38955, transparent 72%), #0a0e17; }
.lg-ds[data-theme="light"] .gf-bg-ambient{ background:radial-gradient(42% 50% at 14% 20%, #8b7bff88, transparent 70%), radial-gradient(40% 50% at 82% 20%, #ffb86688, transparent 70%), radial-gradient(50% 60% at 60% 90%, #66e0a888, transparent 72%), #eef1f8; }
.gf-bg-photo{ background-image:url(/agent/demo-house.png); background-size:cover; background-position:center; }
.gf-bg-textcolour{ background:#0a0e17; overflow:hidden; } .lg-ds[data-theme="light"] .gf-bg-textcolour{ background:#eef1f8; }
.gf-tc-bd{ position:absolute; inset:0; display:grid; grid-template-columns:1fr 1fr; align-content:center; gap:0 16px; padding:16px 24px; }
.gf-tc-bd span{ font-size:clamp(26px,4vw,42px); font-weight:850; letter-spacing:-.02em; color:rgba(255,255,255,.16); white-space:nowrap; line-height:1.15; } .lg-ds[data-theme="light"] .gf-tc-bd span{ color:rgba(12,16,28,.2); }
.gf-blob{ position:absolute; border-radius:50%; filter:blur(8px); opacity:.85; } .gf-blob.a{ width:150px; height:150px; left:7%; top:-24px; background:#5e5ce6; } .gf-blob.b{ width:170px; height:170px; right:3%; bottom:-38px; background:#30c8a0; } .gf-blob.c{ width:110px; height:110px; right:36%; top:-12px; background:#ff9f0a; }
.gf-bg-anim{ animation:gfdrift 9s ease-in-out infinite alternate; } @keyframes gfdrift{ from{ transform:scale(1.04) translate(-1%,-1%);} to{ transform:scale(1.12) translate(2%,2%);} }
.gf-content-bd{ padding:18px 22px; } .gf-content-bd h3{ font-size:22px; font-weight:780; } .gf-cb-loc{ font-size:12px; color:var(--lg-ink-3); margin:3px 0 12px; } .gf-cb-row{ padding:7px 0; border-top:1px solid var(--lg-line-2); } .gf-cb-row strong{ display:block; font-size:13px; } .gf-cb-row span{ font-size:12px; color:var(--lg-ink-2); }
.gf-dense-bd{ display:grid; grid-template-columns:repeat(2,1fr); gap:2px 20px; padding:12px 18px; } .gf-dense-row{ display:flex; justify-content:space-between; font-size:11px; color:var(--lg-ink-2); padding:3px 0; border-bottom:1px solid var(--lg-line-2); } .gf-dense-row span:last-child{ color:var(--lg-ink-3); }
.gf-stage-fg{ position:relative; z-index:1; padding:22px; }

/* 0 · A/B draggable pucks (identical geometry, over text + colour) */
.gf-ab-stage{ position:relative; height:280px; border-radius:20px; overflow:hidden; border:1px solid var(--lg-line); }
.gf-ab-puck{ position:absolute; z-index:3; top:0; left:0; width:120px; height:120px; cursor:grab; touch-action:none; display:grid; place-items:center; } .gf-ab-puck[data-drag]{ cursor:grabbing; z-index:4; }
.gf-ab-surf{ position:absolute; inset:0; border-radius:999px; box-shadow:0 14px 34px rgba(0,0,0,.34) !important; }
.gf-ab-tag{ position:relative; z-index:2; font-size:10.5px; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:rgba(255,255,255,.92); text-shadow:0 1px 3px rgba(0,0,0,.55); pointer-events:none; text-align:center; }
.gf-ab-hint{ position:absolute; z-index:1; bottom:12px; left:0; right:0; text-align:center; font-size:11px; color:var(--lg-ink-3); }

/* material cells */
.gf-row5{ display:grid; grid-template-columns:repeat(5,1fr); gap:14px; } @media (max-width:980px){ .gf-row5{ grid-template-columns:repeat(2,1fr);} }
.gf-cell{ display:flex; flex-direction:column; gap:8px; } .gf-cell-lab{ font-size:11px; color:var(--lg-ink-3); line-height:1.35; } .gf-cell-lab b{ display:block; color:var(--lg-ink); font-size:11.5px; }
.gf-small{ width:120px; height:46px; display:grid; place-items:center; } .gf-med{ width:100%; min-width:120px; height:116px; display:grid; place-items:center; } .gf-large{ width:100%; height:200px; display:grid; place-items:center; }
.gf-sizes{ display:flex; align-items:flex-end; gap:20px; flex-wrap:wrap; } .gf-sz-col{ display:flex; flex-direction:column; gap:8px; } .gf-sz-col > span{ font-size:11px; color:var(--lg-ink-3); } .gf-sz-col .gf-med{ width:260px; } .gf-sz-col .gf-large{ width:360px; }
.gf-sample{ text-align:center; } .gf-sample strong{ display:block; font-size:15px; font-weight:700; } .gf-sample span{ font-size:11.5px; color:var(--lg-ink-2); } .gf-sample-sm{ font-size:12.5px; font-weight:650; }

/* ── material treatments (local, experimental) ───────────────────────────────── */
/* V1 refined displacement — crisp rim, inner shadow, sheen, contact shadow */
.gf-disp{ position:relative; border:1px solid rgba(255,255,255,.14); box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 0 0 .5px rgba(255,255,255,.22) inset, 0 -14px 26px rgba(0,0,0,.22) inset, 0 22px 44px rgba(0,0,0,.4); overflow:hidden; transition:transform .5s cubic-bezier(.2,.8,.2,1); }
.gf-disp::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:radial-gradient(130% 80% at 26% 8%, rgba(255,255,255,.3), transparent 42%); mix-blend-mode:screen; opacity:.55; }
.gf-disp::before{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent) top/100% 1.5px no-repeat; }
.gf-disp > *{ position:relative; z-index:1; } .gf-filter{ position:absolute; width:0; height:0; overflow:hidden; }
.gf-disp-fb{ box-shadow:0 1px 1px rgba(255,255,255,.5) inset, 0 20px 40px rgba(0,0,0,.4); }
.lg-ds[data-theme="light"] .gf-disp{ border-color:rgba(12,16,28,.1); box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 0 0 .5px rgba(255,255,255,.6) inset, 0 -14px 26px rgba(20,30,60,.06) inset, 0 22px 44px rgba(20,30,60,.16); }

/* V2 frost · V3 clear · V4 edge — CSS materials */
.gf-css{ position:relative; overflow:hidden; } .gf-css > *{ position:relative; z-index:1; }
.gf-frost{ background:rgba(28,33,46,.56); -webkit-backdrop-filter:blur(28px) saturate(1.5); backdrop-filter:blur(28px) saturate(1.5); border:1px solid rgba(255,255,255,.16); box-shadow:0 1px 0 rgba(255,255,255,.3) inset, 0 18px 40px rgba(0,0,0,.34); }
.lg-ds[data-theme="light"] .gf-frost{ background:rgba(255,255,255,.58); border-color:rgba(255,255,255,.8); box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 18px 38px rgba(20,30,60,.14); }
.gf-frost::before{ content:""; position:absolute; inset:0 0 auto 0; height:40%; border-radius:inherit; background:linear-gradient(180deg,rgba(255,255,255,.14),transparent); pointer-events:none; }
.gf-clear{ background:rgba(255,255,255,.1); -webkit-backdrop-filter:blur(10px) saturate(1.3); backdrop-filter:blur(10px) saturate(1.3); border:1px solid rgba(255,255,255,.3); box-shadow:0 1px 0 rgba(255,255,255,.5) inset, 0 14px 32px rgba(0,0,0,.26); }
.lg-ds[data-theme="light"] .gf-clear{ background:rgba(255,255,255,.22); border-color:rgba(255,255,255,.7); }
.gf-clear::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:linear-gradient(135deg,rgba(255,255,255,.22),transparent 40%); }
.gf-edge{ background:rgba(255,255,255,.04); -webkit-backdrop-filter:blur(5px) saturate(1.25); backdrop-filter:blur(5px) saturate(1.25); border:1.5px solid transparent; background-clip:padding-box; box-shadow:0 0 0 1px rgba(255,255,255,.14) inset, 0 1.5px 1px rgba(255,255,255,.7) inset, 0 -2px 2px rgba(255,255,255,.18) inset, 0 16px 34px rgba(0,0,0,.3); }
.gf-edge::before{ content:""; position:absolute; inset:0; border-radius:inherit; padding:1.5px; pointer-events:none; background:linear-gradient(135deg,rgba(255,255,255,.8),rgba(255,255,255,.1) 40%,transparent 60%,rgba(255,255,255,.5)); -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
.gf-edge::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; background:radial-gradient(120% 80% at 30% 6%, rgba(255,255,255,.28), transparent 44%); }
.lg-ds[data-theme="light"] .gf-edge{ background:rgba(255,255,255,.14); }

/* opaque fallback + high-contrast */
.gf-opaque{ position:relative; overflow:hidden; background:#1c2130; border:1px solid var(--lg-line); box-shadow:0 14px 30px rgba(0,0,0,.2); } .gf-opaque > *{ position:relative; z-index:1; }
.lg-ds[data-theme="light"] .gf-opaque{ background:#ffffff; box-shadow:0 14px 30px rgba(20,30,60,.12); }
.gf-contrast{ border-width:2px !important; border-color:var(--lg-ink) !important; }
.gf-opaque.gf-contrast{ background:#0c0f17; } .lg-ds[data-theme="light"] .gf-opaque.gf-contrast{ background:#ffffff; }

/* functional controls */
.gf-ctls{ display:flex; align-items:center; gap:28px; flex-wrap:wrap; padding:6px 0; }
.gf-ctl{ position:relative; } .gf-ctl-surf{ position:absolute; inset:0; } .gf-ctl-lab{ position:relative; z-index:1; }
.gf-btn{ height:42px; padding:0 20px; border:none; background:none; cursor:pointer; border-radius:13px; display:inline-grid; place-items:center; } .gf-btn .gf-ctl-lab{ font-size:13.5px; font-weight:650; color:var(--lg-ink); } .gf-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.gf-seg{ display:inline-grid; grid-auto-flow:column; grid-auto-columns:1fr; padding:4px; border-radius:12px; background:rgba(0,0,0,.2); position:relative; } .lg-ds[data-theme="light"] .gf-seg{ background:rgba(12,16,28,.06); }
.gf-seg-thumb{ position:absolute; top:4px; bottom:4px; left:4px; border-radius:9px; } .gf-seg-btn{ position:relative; z-index:1; padding:8px 18px; font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-ink-3); background:none; border:none; cursor:pointer; } .gf-seg-btn[data-on="true"]{ color:var(--lg-ink); } .gf-seg-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:1px; border-radius:7px; }
.gf-switch{ width:52px; height:32px; border-radius:999px; border:1px solid var(--lg-line); background:rgba(120,120,128,.3); position:relative; cursor:pointer; padding:0; transition:background .3s; } .gf-switch[data-on="true"]{ background:var(--lg-accent); } .gf-switch-knob{ position:absolute; top:3px; left:3px; width:26px; height:26px; } .gf-switch:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.gf-toolbar{ display:inline-block; } .gf-toolbar-row{ position:relative; z-index:1; display:flex; gap:3px; padding:7px 9px; } .gf-tool-btn{ width:38px; height:38px; border-radius:11px; border:none; background:none; color:var(--lg-ink-2); font-size:16px; cursor:pointer; transition:background .15s,color .15s; } .gf-tool-btn:hover{ background:var(--lg-hover); color:var(--lg-ink); } .gf-tool-btn[data-on="true"]{ color:var(--lg-accent-ink); } .gf-tool-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; }

/* drag + scroll */
.gf-dragscroll{ display:grid; grid-template-columns:1.4fr 1fr; gap:14px; } @media (max-width:900px){ .gf-dragscroll{ grid-template-columns:1fr; } }
.gf-puck{ position:absolute; z-index:2; width:120px; height:120px; cursor:grab; touch-action:none; } .gf-puck:active{ cursor:grabbing; } .gf-puck-surf{ width:100%; height:100%; display:grid; place-items:center; } .gf-puck-lab{ font-size:12px; font-weight:600; color:var(--lg-ink-2); }
.gf-scrollbox{ position:relative; border:1px solid var(--lg-line-2); border-radius:16px; overflow:hidden; height:300px; } .gf-scroll-bar{ position:sticky; top:0; z-index:2; height:52px; display:grid; place-items:center; } .gf-scroll-bar .gf-ctl-surf{ inset:8px; } .gf-scroll-bar-lab{ position:relative; z-index:1; font-size:12px; font-weight:600; color:var(--lg-ink); }
.gf-scroll-inner{ height:248px; overflow-y:auto; } .gf-scroll-row{ display:flex; justify-content:space-between; padding:11px 16px; border-bottom:1px solid var(--lg-line-2); font-size:13px; } .gf-scroll-row time{ color:var(--lg-ink-3); }
.gf-scrollbox{ position:relative; } .gf-scrollbox > .gf-scroll-bar{ position:absolute; left:0; right:0; }
.gf-scroll-inner{ padding-top:52px; height:300px; }

/* perf */
.gf-perf{ margin-top:14px; display:flex; align-items:center; gap:20px; flex-wrap:wrap; }
.gf-graph{ position:relative; flex:1; min-width:260px; height:64px; display:flex; align-items:flex-end; gap:1px; background:rgba(0,0,0,.2); border:1px solid var(--lg-line-2); border-radius:9px; padding:4px; overflow:hidden; } .lg-ds[data-theme="light"] .gf-graph{ background:rgba(12,16,28,.04); }
.gf-bar{ flex:1; min-width:2px; border-radius:1px; background:var(--lg-ok); } .gf-bar[data-tone="jank"]{ background:var(--lg-warn); } .gf-bar[data-tone="spike"]{ background:var(--lg-danger); }
.gf-graph-line{ position:absolute; left:0; right:0; height:1px; background:rgba(255,255,255,.2); } .gf-graph-line--30{ background:rgba(255,159,10,.4); }
.gf-perf-stats{ display:flex; gap:16px; font-size:12px; color:var(--lg-ink-3); flex-wrap:wrap; } .gf-perf-stats b{ color:var(--lg-ink); font-size:14px; } .gf-perf-stats span[data-warn]{ color:var(--lg-danger-ink); } .gf-perf-stats span[data-warn] b{ color:var(--lg-danger-ink); }

/* stress */
.gf-stress-ctl{ display:flex; gap:7px; margin-bottom:12px; } .gf-chip{ font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:8px; padding:6px 12px; cursor:pointer; } .gf-chip[data-on="true"]{ background:var(--lg-accent); border-color:var(--lg-accent); color:#fff; }
.gf-stress-surf{ position:absolute; z-index:1; width:84px; height:56px; animation:gffloat 3.4s ease-in-out infinite alternate; } .gf-stress-inner{ width:100%; height:100%; } @keyframes gffloat{ from{ transform:translate(0,0);} to{ transform:translate(26px,18px);} }

/* a11y */
.gf-a11y-grid{ display:grid; grid-template-columns:1fr 1fr; gap:16px; } @media (max-width:900px){ .gf-a11y-grid{ grid-template-columns:1fr; } }
.gf-a11y-card{ border:1px solid var(--lg-line-2); border-radius:16px; padding:16px; } .gf-a11y-card h4{ font-size:13.5px; font-weight:700; margin-bottom:4px; }
.gf-a11y-demo{ padding:18px; border-radius:12px; background:var(--lg-fill); display:grid; place-items:center; margin:10px 0; } .gf-a11y-demo .gf-med{ width:240px; height:96px; }
.gf-ratio{ font-size:12px; color:var(--lg-ink-2); } .gf-ratio b{ color:var(--lg-ink); } .gf-ratio[data-pass]{ color:#45c46a; } .gf-ratio[data-pass] b{ color:#45c46a; }
.gf-worst{ position:relative; height:150px; border-radius:12px; overflow:hidden; margin:10px 0; display:grid; place-items:center; } .gf-worst .gf-bg-photo{ position:absolute; inset:0; } .gf-worst-surf{ position:relative; z-index:1; width:240px; height:96px; display:grid; place-items:center; }

.gf-foot{ max-width:1180px; margin:24px auto 0; padding:16px 28px; font-size:11.5px; color:var(--lg-ink-3); border-top:1px solid var(--lg-line-2); } .gf-foot code{ font-size:11px; }

@media (prefers-reduced-motion: reduce){ .gf-root *{ animation:none !important; } }
.gf-root[data-reduced="true"] *{ animation:none !important; }
`;

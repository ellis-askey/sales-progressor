"use client";
// /dev/hub-slice — ONE property that needs you, as a complete content-led experience.
// Dev-only (blocks in production). Presentation-only; all actions SIMULATED (no writes).
// Self-contained: the shared kit (LiquidLens, GlassButton, spring.ts) and tokens are used
// READ-ONLY; nothing shared, global, or production is modified. A test of design quality.
//
// Doctrine on show: content reads on the bare ambient page (no cards); the slab LENS is
// the one premium in-flow moment (the floating action bar); FROSTED, portalled, spring-
// driven overlays carry the transient layer (menu, dialog, drawer, toast, tooltip).

import {
  createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type ReactNode, type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, Sparkle, X, PaperPlaneTilt, CaretDown, ArrowClockwise, Check,
  CalendarBlank, DotsThree, ArrowUpRight,
} from "@phosphor-icons/react";
import { LiquidLens } from "@/components/liquid/LiquidLens";
import { GlassButton } from "@/components/liquid";
import { createSpring, stepSpring, createFrameLoop, motionReduced } from "@/components/liquid/lib/spring";

type Theme = "dark" | "light";

/* ── spring-driven enter value (0→1), reduced-motion aware ─────────────────── */
function useEnter(response = 0.5, bounce = 0.26) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (motionReduced()) { setV(1); return; }
    const s = createSpring(response, bounce, 0);
    s.target = 1;
    const loop = createFrameLoop((dt) => { const moving = stepSpring(s, dt, false); setV(s.value); return moving; });
    loop.start();
    return () => loop.stop();
  }, [response, bounce]);
  return v;
}

/* ── portal that re-establishes the .lg-ds scope + theme (tokens survive) ──── */
const ThemeCtx = createContext<Theme>("dark");
function Portal({ children }: { children: ReactNode }) {
  const theme = useContext(ThemeCtx);
  const [m, setM] = useState(false);
  useEffect(() => { setM(true); }, []);
  return m ? createPortal(<div className="lg-ds hs-portal" data-theme={theme}>{children}</div>, document.body) : null;
}
function useAnchored(open: boolean, anchorRef: RefObject<HTMLElement>, floatRef: RefObject<HTMLElement>, opts: { side?: "top" | "bottom"; align?: "start" | "center" | "end"; gap?: number }) {
  const { side = "bottom", align = "start", gap = 8 } = opts;
  const [pos, setPos] = useState({ top: -9999, left: -9999 });
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const f = floatRef.current?.getBoundingClientRect();
      if (!a || !f) return;
      let top = side === "top" ? a.top - f.height - gap : a.bottom + gap;
      if (side === "bottom" && top + f.height > window.innerHeight - 10) top = a.top - f.height - gap;
      if (top < 10) top = 10;
      let left = align === "end" ? a.right - f.width : align === "center" ? a.left + a.width / 2 - f.width / 2 : a.left;
      left = Math.max(10, Math.min(left, window.innerWidth - f.width - 10));
      setPos({ top, left });
    };
    place();
    const t = setTimeout(place, 0);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open, side, align, gap, anchorRef, floatRef]);
  return pos;
}

/* ── the sale, as grounded data (fictional, dev-only) ─────────────────────── */
type NodeState = "done" | "current" | "exchange" | "future";
type JNode = { k: string; label: string; full: string; date: string; state: NodeState };
const BASE_NODES: JNode[] = [
  { k: "offer", label: "Offer", full: "Offer accepted", date: "12 Aug", state: "done" },
  { k: "instructed", label: "Solicitors", full: "Solicitors instructed", date: "19 Aug", state: "done" },
  { k: "searches", label: "Searches", full: "Searches back", date: "14 Sep", state: "done" },
  { k: "enquiries", label: "Enquiries", full: "Enquiries raised", date: "2 Oct", state: "done" },
  { k: "replies", label: "Replies", full: "Awaiting replies", date: "now", state: "current" },
  { k: "exchange", label: "Exchange", full: "Exchange", date: "due 28 Oct", state: "exchange" },
  { k: "completion", label: "Completion", full: "Completion", date: "—", state: "future" },
];
const CURRENT_INDEX = 4;
const EXCHANGE_INDEX = 5;

export default function HubSlice() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("dark");
  const [newDate, setNewDate] = useState<string | null>(null);
  const [chased, setChased] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  const fire = (m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 2600); };
  const reset = () => { setNewDate(null); setChased(false); setMenuOpen(false); setDialog(false); setDrawer(false); setToast(null); };

  const niceDate = (iso: string) => {
    // iso = yyyy-mm-dd → "12 November" (no Date() in some sandboxes; parse by hand)
    const [, mm, dd] = iso.split("-");
    const months = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${Number(dd)} ${months[Number(mm)] ?? ""}`.trim();
  };

  const nodes = useMemo<JNode[]>(() => {
    if (!newDate) return BASE_NODES;
    return BASE_NODES.map((n) => (n.k === "exchange" ? { ...n, date: niceDate(newDate), state: "future" } : n));
  }, [newDate]);
  const onTrack = !!newDate;

  return (
    <ThemeCtx.Provider value={theme}>
      <div className="lg-ds hs-root" data-theme={theme}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="hs-scene" aria-hidden />

        <div className="hs-dev">
          <span className="hs-dev-tag"><Sparkle weight="fill" /> Vertical slice · one property · actions simulated</span>
          <div className="hs-dev-ctl">
            <button className="hs-reset" onClick={reset}><ArrowClockwise weight="bold" /> Replay</button>
            <button className={`hs-theme ${theme === "light" ? "on" : ""}`} aria-label="Theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              <span className="hs-theme-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
            </button>
          </div>
        </div>

        <main className="hs-wrap">
          {/* status, stated — not a pill */}
          <div className="hs-status" data-tone={onTrack ? "ok" : "danger"}>
            <span className="hs-status-dot" />
            <strong>{onTrack ? "On track" : "Exchange overdue"}</strong>
            <span className="hs-status-sub">{onTrack ? `exchange now ${niceDate(newDate!)}` : "was due 28 October · 5 days ago"}</span>
          </div>

          <h1 className="hs-addr">3 Maple Court</h1>
          <p className="hs-loc">Hertford · SG14 1QF</p>

          {/* the journey — the signature */}
          <Journey nodes={nodes} onTrack={onTrack} setTip={setTip} />

          {/* the read — grounded prose with people as presence */}
          <div className="hs-read">
            <p>
              {onTrack ? (
                <>You set a new exchange date of <b>{niceDate(newDate!)}</b>. The sale sits with the buyer&rsquo;s solicitor, waiting on replies to enquiries.</>
              ) : (
                <>Exchange was due on <b>28 October</b>. Nothing has advanced for five days — the sale is waiting on the buyer&rsquo;s solicitor to return replies to enquiries.</>
              )}
            </p>
            <div className="hs-read-people">
              <Avatar role="staff" name="PS" />
              <p>
                <b>Priya</b> has chased <b>Duggan &amp; Co</b>, the buyer&rsquo;s solicitor, three times.{" "}
                {chased ? <span className="hs-read-note">You chased again just now.</span> : "The last reply was six days ago."}
              </p>
            </div>
          </div>

          <div className="hs-spacer" />
        </main>

        {/* the one lens moment: a floating action bar, refracting the content */}
        <div className="hs-bar-wrap">
          <LiquidLens tint="var(--lg-glass-raised)" radius={20} strength="strong" thickness={1.4} className="hs-bar">
            <GlassButton variant="primary" onClick={() => setDialog(true)}><CalendarBlank weight="bold" /> Set a new date</GlassButton>
            <GlassButton variant="secondary" onClick={() => setDrawer(true)}><PaperPlaneTilt weight="regular" /> Chase the solicitor</GlassButton>
            <button ref={menuRef} className="hs-more" aria-haspopup="menu" aria-expanded={menuOpen} aria-label="More actions" onClick={() => setMenuOpen((v) => !v)}><DotsThree weight="bold" /></button>
          </LiquidLens>
        </div>

        {/* overlays — frosted, portalled, spring */}
        <Menu open={menuOpen} anchorRef={menuRef} onClose={() => setMenuOpen(false)}
          items={[
            { label: "Recalculate the estimate", run: () => fire("Estimate recalculated · 3 Maple Court") },
            { label: "Snooze a few days", run: () => fire("Snoozed for 3 days · 3 Maple Court") },
            { label: "Mark as chased", run: () => { setChased(true); fire("Marked as chased · 3 Maple Court"); } },
            { label: "Open the file", run: () => fire("Opening 3 Maple Court"), icon: <ArrowUpRight weight="bold" /> },
          ]} />

        {dialog && (
          <ConfirmDateDialog
            onClose={() => setDialog(false)}
            onSet={(iso) => { setNewDate(iso); setDialog(false); fire(`Exchange date set · ${niceDate(iso)}`); }}
            onRecalc={() => { setDialog(false); fire("Estimate recalculated · 3 Maple Court"); }}
          />
        )}
        {drawer && (
          <ChaseDrawer
            onClose={() => setDrawer(false)}
            onSent={() => { setChased(true); setDrawer(false); fire("Chase sent · Duggan & Co"); }}
          />
        )}

        {tip && <Portal><NodeTip text={tip} /></Portal>}
        {toast && (
          <Portal>
            <div className="hs-toast-layer"><ToastView text={toast} /></div>
          </Portal>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}

/* ── journey line ─────────────────────────────────────────────────────────── */
function Journey({ nodes, onTrack, setTip }: { nodes: JNode[]; onTrack: boolean; setTip: (t: string | null) => void }) {
  const n = nodes.length;
  const enter = useEnter(0.7, 0.18);
  const curPos = (CURRENT_INDEX / (n - 1)) * 100;
  const exPos = (EXCHANGE_INDEX / (n - 1)) * 100;
  return (
    <div className="hs-journey" role="group" aria-label="Sale progress">
      <div className="hs-journey-scroll">
        <div className="hs-track">
          <span className="hs-track-base" />
          <span className="hs-track-fill" style={{ width: `${curPos * enter}%` }} />
          {!onTrack && <span className="hs-track-over" style={{ left: `${curPos}%`, width: `${(exPos - curPos) * enter}%` }} />}
          {nodes.map((node, i) => {
            const pos = (i / (n - 1)) * 100;
            const tone = node.state === "current" ? "current" : node.state === "exchange" ? (onTrack ? "future" : "over") : node.state;
            const tipText = node.state === "exchange" && !onTrack ? "Exchange — was expected 28 October, 5 days ago" : `${node.full} · ${node.date}`;
            return (
              <button
                key={node.k} className="hs-node" data-tone={tone} style={{ left: `${pos}%`, opacity: enter, transform: `translate(-50%,-50%) scale(${0.6 + enter * 0.4})` }}
                onMouseEnter={() => setTip(tipText)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(tipText)} onBlur={() => setTip(null)}
                aria-label={tipText}
              >
                <span className="hs-node-dot" />
              </button>
            );
          })}
        </div>
        <div className="hs-labels">
          {nodes.map((node, i) => {
            const pos = (i / (n - 1)) * 100;
            const over = node.state === "exchange" && !onTrack;
            return (
              <div key={node.k} className="hs-label" data-cur={node.state === "current" || undefined} data-over={over || undefined} style={{ left: `${pos}%`, opacity: enter }}>
                <span className="hs-label-name">{node.label}</span>
                <span className="hs-label-date">{over ? "due 28 Oct · 5d late" : node.date}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Avatar({ role, name }: { role: "staff" | "sol" | "buyer"; name: string }) {
  return <span className="hs-av" data-role={role} aria-hidden>{name}</span>;
}

/* ── frosted portalled menu (spring enter) ────────────────────────────────── */
type MItem = { label: string; run: () => void; icon?: ReactNode };
function Menu({ open, anchorRef, onClose, items }: { open: boolean; anchorRef: RefObject<HTMLElement>; onClose: () => void; items: MItem[] }) {
  const floatRef = useRef<HTMLDivElement>(null);
  const pos = useAnchored(open, anchorRef, floatRef, { side: "top", align: "end", gap: 8 });
  const v = useEnter(0.42, 0.3);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => { const t = e.target as Node; if (floatRef.current?.contains(t) || anchorRef.current?.contains(t)) return; onClose(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); (anchorRef.current as HTMLElement)?.focus?.(); return; }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const b = Array.from(floatRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const i = b.indexOf(document.activeElement as HTMLButtonElement);
        b[e.key === "ArrowDown" ? (i + 1) % b.length : (i - 1 + b.length) % b.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onDoc); document.addEventListener("keydown", onKey);
    const f = setTimeout(() => floatRef.current?.querySelector("button")?.focus(), 10);
    return () => { clearTimeout(f); document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return (
    <Portal>
      <div ref={floatRef} className="hs-layer" style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 1600, opacity: v, transform: `translateY(${(1 - v) * 6}px) scale(${0.97 + v * 0.03})` }}>
        <div className="hs-menu hs-glass" role="menu">
          {items.map((it) => (
            <button key={it.label} role="menuitem" className="hs-menu-item" onClick={() => { onClose(); it.run(); }}>
              <span>{it.label}</span>{it.icon}
            </button>
          ))}
        </div>
      </div>
    </Portal>
  );
}

/* ── confirm-date dialog (frosted, focus-trapped, spring, validation) ─────── */
function ConfirmDateDialog({ onClose, onSet, onRecalc }: { onClose: () => void; onSet: (iso: string) => void; onRecalc: () => void }) {
  const [date, setDate] = useState("");
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const v = useEnter(0.5, 0.24);
  const past = date !== "" && date < "2026-11-03";
  const invalid = date === "" || past;
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,input,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <Portal>
      <div className="hs-scrim" onClick={onClose}>
        <div ref={ref} className="hs-dialog hs-glass" role="dialog" aria-modal="true" aria-label="Set a new exchange date — 3 Maple Court"
          style={{ opacity: v, transform: `translateY(${(1 - v) * 10}px) scale(${0.96 + v * 0.04})` }} onClick={(e) => e.stopPropagation()}>
          <div className="hs-dialog-head"><span className="hs-eyebrow">Exchange overdue</span><strong>3 Maple Court</strong></div>
          <p className="hs-dialog-ctx">Exchange was due 28 October. Set the new expected date, or recalculate the estimate from the file&rsquo;s progress.</p>
          <label className="hs-field-label" htmlFor="hs-date">New exchange date</label>
          <input id="hs-date" ref={firstRef} className="hs-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => setTouched(true)} data-error={touched && invalid || undefined} />
          {touched && date === "" && <p className="hs-err">Choose a date to continue.</p>}
          {past && <p className="hs-err">That date is in the past — choose a future date.</p>}
          <div className="hs-dialog-foot">
            <button className="hs-link" onClick={onRecalc}>Recalculate instead</button>
            <div className="hs-foot-actions">
              <GlassButton variant="ghost" onClick={onClose}>Cancel</GlassButton>
              <GlassButton variant="primary" disabled={invalid} onClick={() => { setTouched(true); if (!invalid) onSet(date); }}>Set date</GlassButton>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ── chase drawer (frosted side sheet, spring slide, loading → success) ───── */
function ChaseDrawer({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  const v = useEnter(0.55, 0.16);
  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sending) onClose();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, sending]);
  const send = () => { setSending(true); setTimeout(onSent, 1200); };
  return (
    <Portal>
      <div className="hs-scrim hs-scrim--end" onClick={() => !sending && onClose()}>
        <div ref={ref} className="hs-drawer hs-glass" role="dialog" aria-modal="true" aria-label="Chase the buyer's solicitor — 3 Maple Court"
          style={{ transform: `translateX(${(1 - v) * 100}%)` }} onClick={(e) => e.stopPropagation()}>
          <div className="hs-drawer-head">
            <div><span className="hs-eyebrow">Chase</span><strong>Duggan &amp; Co</strong><span className="hs-drawer-sub">buyer&rsquo;s solicitor · 3 Maple Court</span></div>
            <button className="hs-icon-btn" aria-label="Close" onClick={() => !sending && onClose()}><X weight="bold" /></button>
          </div>
          <div className="hs-drawer-body">
            <p className="hs-drawer-ctx">Replies to enquiries have been outstanding for 23 days. This is the fourth chase.</p>
            <label className="hs-field-label" htmlFor="hs-msg">Message to the solicitor</label>
            <textarea id="hs-msg" ref={firstRef} className="hs-textarea" rows={8} defaultValue={"Dear Sirs,\n\nWe act on 3 Maple Court. We should be grateful for your replies to the outstanding enquiries at your earliest convenience, so we can move to exchange.\n\nKind regards"} />
            <p className="hs-drawer-note">Nothing is sent — a prototype preview of the real chase composer.</p>
          </div>
          <div className="hs-drawer-foot">
            <GlassButton variant="ghost" onClick={onClose} disabled={sending}>Cancel</GlassButton>
            <GlassButton variant="primary" loading={sending} onClick={send}>{sending ? "Sending" : <><PaperPlaneTilt weight="fill" /> Send chase</>}</GlassButton>
          </div>
        </div>
      </div>
    </Portal>
  );
}

function NodeTip({ text }: { text: string }) {
  // follows the pointer loosely via a fixed centred band under the cursor row
  return <div className="hs-tip-layer"><div className="hs-tip hs-glass">{text}</div></div>;
}
function ToastView({ text }: { text: string }) {
  const v = useEnter(0.5, 0.3);
  return <div className="hs-toast hs-glass" role="status" style={{ opacity: v, transform: `translateY(${(1 - v) * 14}px)` }}><Check weight="bold" />{text}</div>;
}

const CSS = `
.hs-root{ position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; background:var(--lg-base); color:var(--lg-ink); font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Segoe UI",system-ui,sans-serif; letter-spacing:-.011em; -webkit-font-smoothing:antialiased; }
/* ambient backdrop — gives the glass something to refract, keeps the page alive */
.hs-scene{ position:fixed; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(42% 34% at 16% 12%, rgba(255,107,74,0.10), transparent 70%),
    radial-gradient(40% 32% at 85% 22%, rgba(56,189,248,0.07), transparent 72%),
    radial-gradient(50% 40% at 70% 92%, rgba(168,120,255,0.08), transparent 72%); }
.lg-ds[data-theme="light"] .hs-scene{ background:
    radial-gradient(44% 34% at 14% 8%, rgba(255,138,101,0.20), transparent 72%),
    radial-gradient(42% 32% at 88% 16%, rgba(56,189,248,0.14), transparent 72%),
    radial-gradient(52% 42% at 72% 96%, rgba(168,120,255,0.16), transparent 74%); }

.hs-dev{ position:relative; z-index:3; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 22px; }
.hs-dev-tag{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:600; color:var(--lg-accent-ink); } .hs-dev-tag svg{ width:14px; height:14px; }
.hs-dev-ctl{ display:flex; align-items:center; gap:10px; }
.hs-reset{ display:inline-flex; align-items:center; gap:6px; font:inherit; font-size:12px; font-weight:600; color:var(--lg-ink-2); background:var(--lg-fill); border:1px solid var(--lg-line); border-radius:9px; padding:6px 11px; cursor:pointer; transition:color .2s,border-color .2s; } .hs-reset:hover{ color:var(--lg-ink); border-color:var(--lg-ink-3); } .hs-reset svg{ width:13px; height:13px; }
.hs-theme{ width:46px; height:26px; border-radius:999px; border:1px solid var(--lg-line); background:var(--lg-field); position:relative; cursor:pointer; padding:0; } .hs-theme-knob{ position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; transition:transform .3s cubic-bezier(.3,1.35,.4,1); } .hs-theme-knob svg{ width:11px; height:11px; color:#33343c; } .hs-theme.on .hs-theme-knob{ transform:translateX(20px); }

.hs-wrap{ position:relative; z-index:2; max-width:780px; margin:0 auto; padding:42px 28px 40px; }

/* status, stated */
.hs-status{ display:flex; align-items:center; gap:9px; margin-bottom:18px; animation:hsfade .5s ease both; }
.hs-status-dot{ width:9px; height:9px; border-radius:50%; flex-shrink:0; box-shadow:0 0 0 4px rgba(255,69,58,0.12); }
.hs-status[data-tone="danger"] .hs-status-dot{ background:var(--lg-danger); }
.hs-status[data-tone="ok"] .hs-status-dot{ background:var(--lg-ok); box-shadow:0 0 0 4px rgba(48,209,88,0.14); }
.hs-status strong{ font-size:13px; font-weight:700; letter-spacing:.01em; } .hs-status[data-tone="danger"] strong{ color:var(--lg-danger-ink); } .hs-status[data-tone="ok"] strong{ color:#45c46a; }
.lg-ds[data-theme="light"] .hs-status[data-tone="ok"] strong{ color:#1a9c45; }
.hs-status-sub{ font-size:13px; color:var(--lg-ink-3); }

.hs-addr{ font-size:clamp(34px,5vw,52px); font-weight:820; letter-spacing:-.035em; line-height:1; animation:hsrise .6s cubic-bezier(.2,.8,.2,1) both; }
.hs-loc{ font-size:15px; color:var(--lg-ink-3); margin-top:10px; animation:hsrise .6s cubic-bezier(.2,.8,.2,1) .04s both; }
@keyframes hsfade{ from{opacity:0} to{opacity:1} }
@keyframes hsrise{ from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }

/* journey — the signature */
.hs-journey{ margin:40px 0 6px; }
.hs-journey-scroll{ position:relative; }
@media (max-width:640px){ .hs-journey-scroll{ overflow-x:auto; scrollbar-width:none; padding-bottom:4px; } .hs-journey-scroll::-webkit-scrollbar{ display:none } .hs-track, .hs-labels{ min-width:620px; } }
.hs-track{ position:relative; height:12px; }
.hs-track-base{ position:absolute; top:50%; left:0; right:0; height:2px; transform:translateY(-50%); background:var(--lg-line); border-radius:2px; }
.hs-track-fill{ position:absolute; top:50%; left:0; height:3px; transform:translateY(-50%); background:linear-gradient(90deg,var(--lg-accent-2),var(--lg-accent)); border-radius:3px; box-shadow:0 0 12px rgba(255,107,74,.4); transition:width .5s cubic-bezier(.2,.8,.2,1); }
.hs-track-over{ position:absolute; top:50%; height:0; transform:translateY(-50%); border-top:2px dashed var(--lg-danger); opacity:.8; }
.hs-node{ position:absolute; top:50%; width:26px; height:26px; display:grid; place-items:center; background:none; border:none; cursor:pointer; padding:0; }
.hs-node-dot{ width:11px; height:11px; border-radius:50%; background:var(--lg-base); border:2px solid var(--lg-ink-3); transition:transform .2s, box-shadow .2s, border-color .2s, background .2s; }
.hs-node[data-tone="done"] .hs-node-dot{ background:var(--lg-accent); border-color:var(--lg-accent); }
.hs-node[data-tone="current"] .hs-node-dot{ background:var(--lg-base); border-color:var(--lg-accent); box-shadow:0 0 0 5px var(--lg-accent-soft); animation:hspulse 2.4s ease-in-out infinite; }
.hs-node[data-tone="over"] .hs-node-dot{ background:var(--lg-base); border-color:var(--lg-danger); box-shadow:0 0 0 5px rgba(255,69,58,.14); }
.hs-node[data-tone="future"] .hs-node-dot{ background:var(--lg-base); border-color:var(--lg-ink-3); }
.hs-node:hover .hs-node-dot{ transform:scale(1.2); }
.hs-node:focus-visible{ outline:none; } .hs-node:focus-visible .hs-node-dot{ box-shadow:0 0 0 3px var(--lg-base),0 0 0 5px var(--lg-accent); }
@keyframes hspulse{ 0%,100%{ box-shadow:0 0 0 5px var(--lg-accent-soft) } 50%{ box-shadow:0 0 0 8px rgba(255,107,74,.05) } }
.hs-labels{ position:relative; height:46px; margin-top:12px; }
.hs-label{ position:absolute; top:0; transform:translateX(-50%); display:flex; flex-direction:column; align-items:center; gap:2px; width:78px; text-align:center; }
.hs-label-name{ font-size:11px; font-weight:600; color:var(--lg-ink-2); white-space:nowrap; } .hs-label-date{ font-size:10.5px; color:var(--lg-ink-3); white-space:nowrap; }
.hs-label[data-cur] .hs-label-name{ color:var(--lg-ink); } .hs-label[data-over] .hs-label-name{ color:var(--lg-danger-ink); } .hs-label[data-over] .hs-label-date{ color:var(--lg-danger-ink); }
.hs-label:first-child{ transform:translateX(0); align-items:flex-start; text-align:left; } .hs-label:last-child{ transform:translateX(-100%); align-items:flex-end; text-align:right; }

/* the read */
.hs-read{ margin-top:30px; max-width:640px; }
.hs-read > p{ font-size:16.5px; line-height:1.62; color:var(--lg-ink); } .hs-read > p b{ font-weight:650; }
.hs-read-people{ margin-top:16px; display:flex; align-items:flex-start; gap:11px; }
.hs-read-people p{ font-size:15.5px; line-height:1.6; color:var(--lg-ink-2); } .hs-read-people p b{ color:var(--lg-ink); font-weight:650; }
.hs-read-note{ color:var(--lg-accent-ink); font-weight:600; }
.hs-av{ display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%; font-size:10px; font-weight:700; color:#fff; letter-spacing:0; flex-shrink:0; margin-top:1px; }
.hs-av[data-role="staff"]{ background:linear-gradient(180deg,#ff8a65,#ff6b4a); } .hs-av[data-role="sol"]{ background:linear-gradient(180deg,#8b94a6,#5f6675); } .hs-av[data-role="buyer"]{ background:linear-gradient(180deg,#56c596,#2f9d6b); }

.hs-spacer{ height:40px; }

/* the lens floating action bar — the one premium in-flow moment */
.hs-bar-wrap{ position:fixed; z-index:40; left:0; right:0; bottom:26px; display:flex; justify-content:center; padding:0 20px; pointer-events:none; }
.hs-bar{ display:inline-flex; align-items:center; gap:8px; padding:9px 10px; pointer-events:auto; animation:hsbar .6s cubic-bezier(.2,.9,.25,1) both; }
@keyframes hsbar{ from{ opacity:0; transform:translateY(16px) } to{ opacity:1; transform:none } }
.hs-bar > *{ position:relative; z-index:1; }
.hs-more{ display:grid; place-items:center; width:40px; height:40px; border-radius:12px; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; transition:background .2s,color .2s,border-color .2s; } .hs-more:hover{ background:var(--lg-hover); color:var(--lg-ink); border-color:var(--lg-ink-3); } .hs-more svg{ width:18px; height:18px; } .hs-more:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
@media (max-width:560px){ .hs-bar{ width:100%; } .hs-bar .lgbtn{ flex:1; } }

/* frosted overlay surface (blur, no displacement — safe for small portals) */
.hs-glass{ position:relative; border:1px solid var(--lg-line); background:color-mix(in srgb, var(--lg-base) 92%, transparent); -webkit-backdrop-filter:blur(18px) saturate(165%); backdrop-filter:blur(18px) saturate(165%); box-shadow:0 16px 40px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.16); }
.lg-ds[data-theme="light"] .hs-glass{ background:color-mix(in srgb,#fff 92%, transparent); box-shadow:0 16px 36px rgba(20,30,60,.2), inset 0 1px 0 rgba(255,255,255,.8); }

.hs-menu{ min-width:216px; padding:6px; border-radius:14px; }
.hs-menu-item{ display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; text-align:left; font:inherit; font-size:13.5px; font-weight:500; color:var(--lg-ink); background:none; border:none; padding:10px 11px; border-radius:9px; cursor:pointer; transition:background .15s; } .hs-menu-item:hover{ background:var(--lg-hover); } .hs-menu-item:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:-2px; } .hs-menu-item svg{ width:14px; height:14px; color:var(--lg-ink-3); }

/* scrim + dialog + drawer */
.hs-scrim{ position:fixed; inset:0; z-index:1650; background:rgba(0,0,0,.44); -webkit-backdrop-filter:blur(5px); backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; animation:hsfade .22s; }
.hs-scrim--end{ justify-content:flex-end; align-items:stretch; }
.hs-dialog{ width:min(430px,calc(100vw - 32px)); padding:24px; border-radius:20px; } .hs-dialog > *{ position:relative; z-index:1; }
.hs-eyebrow{ display:block; font-size:10.5px; font-weight:700; letter-spacing:.04em; color:var(--lg-accent-ink); margin-bottom:3px; }
.hs-dialog[aria-label*="overdue" i] .hs-eyebrow, .hs-dialog .hs-eyebrow{ color:var(--lg-danger-ink); }
.hs-dialog-head strong{ display:block; font-size:18px; font-weight:750; } .hs-dialog-ctx{ font-size:13.5px; color:var(--lg-ink-2); margin:12px 0 16px; line-height:1.5; }
.hs-field-label{ display:block; font-size:11.5px; font-weight:650; color:var(--lg-ink-2); margin-bottom:7px; }
.hs-input,.hs-textarea{ width:100%; background:var(--lg-field); border:1px solid var(--lg-line); border-radius:11px; padding:11px 13px; color:var(--lg-ink); font:inherit; font-size:14px; line-height:1.5; transition:border-color .2s; } .hs-input:focus,.hs-textarea:focus{ outline:none; border-color:var(--lg-accent); } .hs-input[data-error],.hs-textarea[data-error]{ border-color:var(--lg-danger); } .hs-textarea{ resize:vertical; }
.hs-err{ font-size:11.5px; color:var(--lg-danger-ink); margin-top:7px; }
.hs-dialog-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:18px; flex-wrap:wrap; } .hs-foot-actions{ display:flex; gap:9px; }
.hs-link{ font:inherit; font-size:12.5px; font-weight:600; color:var(--lg-accent-ink); background:none; border:none; padding:0; cursor:pointer; } .hs-link:hover{ text-decoration:underline; }

.hs-drawer{ width:min(440px,100%); height:100%; border-radius:0; border-top:none; border-right:none; border-bottom:none; display:flex; flex-direction:column; }
.hs-drawer-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px 20px; border-bottom:1px solid var(--lg-line-2); } .hs-drawer-head strong{ display:block; font-size:16px; font-weight:700; } .hs-drawer-sub{ font-size:11.5px; color:var(--lg-ink-3); }
.hs-icon-btn{ width:34px; height:34px; border-radius:9px; display:grid; place-items:center; background:var(--lg-fill); border:1px solid var(--lg-line); color:var(--lg-ink-2); cursor:pointer; transition:background .2s,color .2s; } .hs-icon-btn:hover{ background:var(--lg-hover); color:var(--lg-ink); } .hs-icon-btn svg{ width:15px; height:15px; } .hs-icon-btn:focus-visible{ outline:2px solid var(--lg-accent); outline-offset:2px; }
.hs-drawer-body{ flex:1; overflow:auto; padding:20px; } .hs-drawer-ctx{ font-size:13px; color:var(--lg-ink-2); margin-bottom:16px; line-height:1.5; }
.hs-drawer-note{ font-size:11px; color:var(--lg-ink-3); margin-top:10px; }
.hs-drawer-foot{ display:flex; justify-content:flex-end; gap:9px; padding:16px 20px; border-top:1px solid var(--lg-line-2); }

/* tooltip + toast */
.hs-tip-layer{ position:fixed; z-index:1550; left:50%; top:20%; transform:translateX(-50%); pointer-events:none; }
.hs-tip{ padding:8px 12px; border-radius:11px; font-size:12px; font-weight:550; color:var(--lg-ink); white-space:nowrap; }
.hs-toast-layer{ position:fixed; z-index:1700; left:50%; bottom:92px; transform:translateX(-50%); }
.hs-toast{ display:inline-flex; align-items:center; gap:9px; padding:11px 17px; border-radius:13px; font-size:13px; font-weight:550; color:var(--lg-ink); } .hs-toast svg{ width:14px; height:14px; color:#5ce08a; }

.hs-portal{ font-family:inherit; }
@media (prefers-reduced-motion: reduce){ .hs-root *, .hs-portal *{ animation:none !important; transition:none !important; } }
`;

"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Key, Handshake, CalendarBlank, ArrowRight } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Props = {
  address: string;
  // yyyy-mm-dd. Exchange is the event just confirmed; completion is the agreed
  // date set at exchange. Both optional — cards show "To be confirmed" if blank.
  exchangeDate?: string;
  completionDate?: string;
  onDismiss: () => void;
};

const CLOSE_MS = 300; // must cover the longest exit animation (sheet-down).

function fmtLong(v?: string): string {
  if (!v) return "To be confirmed";
  const [y, m, d] = v.split("-").map(Number);
  if (!y || !m || !d) return "To be confirmed";
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

// Warm, brand-toned confetti (coral / amber / gold / white) rather than rainbow.
function startConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#FF6B4A", "#FF8A65", "#f59e0b", "#fbbf24", "#ffffff", "#fca5a5"];

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 200,
    vx: (Math.random() - 0.5) * 4,
    vy: 2.5 + Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    w: 7 + Math.random() * 7,
    h: 3 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.18,
  }));

  let raf = 0;
  const start = Date.now();

  const frame = () => {
    const elapsed = Date.now() - start;
    if (elapsed > 3000) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = elapsed > 2400 ? 1 - (elapsed - 2400) / 600 : 1;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

// The filled tick — a coral-to-red radial gradient disc with a white check,
// matching the tick on the hero document.
function TickDisc() {
  return (
    <span className="exch-tick" aria-hidden>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={3.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

const STEPS = [
  { label: "MOS", kind: "done" as const },
  { label: "Legals", kind: "done" as const },
  { label: "Exchanged", kind: "current" as const },
  { label: "Completion", kind: "future" as const },
];

export function ExchangeCelebration({ address, exchangeDate, completionDate, onDismiss }: Props) {
  const { theme, isNight } = usePortalTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [closing, setClosing] = useState(false);
  const closed = useRef(false);
  const heroImg = isNight ? "/exchange-hero-dark.png" : "/exchange-hero-light.png";

  // Play the exit animation, then unmount. On mobile the card slides down like
  // a drawer; on desktop it fades out.
  function handleClose() {
    if (closed.current) return;
    closed.current = true;
    setClosing(true);
    window.setTimeout(onDismiss, CLOSE_MS);
  }

  useEffect(() => {
    if (!canvasRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return startConfetti(canvasRef.current);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div data-theme={theme} className="exch-overlay fixed inset-0 z-[200]">
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ width: "100%", height: "100%" }} />
      <div className="exch-backdrop" onClick={handleClose} />

      <div className="exch-card" data-night={isNight ? "" : undefined} data-closing={closing ? "true" : undefined}>
        <button type="button" className="exch-close" onClick={handleClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>

        <div className="exch-scroll">
          {/* Hero — transparent theme cutout top-right (desktop only), text left half */}
          <div className="exch-hero">
            <div className="exch-hero-img" style={{ backgroundImage: `url(${heroImg})` }} aria-hidden />
            <div className="exch-hero-text">
              <h1 className="exch-title">Exchanged</h1>
              <p className="exch-address">{address}</p>
              <p className="exch-sub">This one&apos;s in the bag.</p>
            </div>
          </div>

          <div className="exch-body">
            {/* Progress */}
            <div className="exch-stepper">
              {STEPS.map((s, i) => (
                <Fragment key={s.label}>
                  <div className="exch-step">
                    {s.kind === "future" ? (
                      <span className="exch-future" aria-hidden><Key size={16} weight="regular" /></span>
                    ) : (
                      <TickDisc />
                    )}
                    <span className="exch-step-label" data-current={s.kind === "current" ? "true" : undefined} data-muted={s.kind === "future" ? "true" : undefined}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="exch-conn" data-dashed={STEPS[i + 1].kind === "future" ? "true" : undefined} />
                  )}
                </Fragment>
              ))}
            </div>

            {/* Dates */}
            <div className="exch-dates">
              <div className="exch-date">
                <CalendarBlank size={20} weight="regular" className="exch-date-icon" />
                <div>
                  <span className="exch-date-label">Contracts exchanged</span>
                  <span className="exch-date-value">{fmtLong(exchangeDate)}</span>
                </div>
              </div>
              <div className="exch-date">
                <CalendarBlank size={20} weight="regular" className="exch-date-icon" />
                <div>
                  <span className="exch-date-label">Expected completion</span>
                  <span className="exch-date-value">{fmtLong(completionDate)}</span>
                </div>
              </div>
            </div>

            {/* Callout */}
            <div className="exch-callout">
              <Handshake size={22} weight="regular" className="exch-callout-icon" />
              <span>Both parties are now legally committed to the sale.</span>
            </div>
          </div>
        </div>

        <div className="exch-footer">
          <button type="button" onClick={handleClose} className="exch-cta agent-btn agent-btn-primary agent-btn-lg">
            Continue to completion
            <ArrowRight size={18} weight="bold" className="agent-arrow-i" style={{ marginLeft: 8 }} />
          </button>
        </div>
      </div>

      <style>{`
        .exch-overlay { display: flex; align-items: center; justify-content: center; padding: 16px; }
        .exch-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.65); }

        .exch-card {
          position: relative; z-index: 10;
          width: 100%; max-width: 600px; max-height: 92vh;
          display: flex; flex-direction: column;
          border-radius: 24px; overflow: hidden;
          background: #ffffff;
          box-shadow: 0 24px 64px rgba(0,0,0,0.28), 0 4px 12px rgba(0,0,0,0.12);
          animation: exch-pop-in 240ms cubic-bezier(0.16,1,0.3,1);
        }
        .exch-card[data-night] { background: #0e1a2d; }
        .exch-card[data-closing="true"] { animation: exch-pop-out 200ms ease forwards; }

        .exch-scroll { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; }
        .exch-footer { flex-shrink: 0; padding: 8px 24px 24px; }

        .exch-close {
          position: absolute; top: 16px; right: 16px; z-index: 2;
          width: 32px; height: 32px; border-radius: 8px; border: none;
          display: inline-flex; align-items: center; justify-content: center;
          background: transparent; color: #64748b; cursor: pointer;
          transition: background 150ms ease, color 150ms ease;
        }
        .exch-close:hover { background: rgba(100,116,139,0.14); color: #1f2a3d; }
        .exch-card[data-night] .exch-close { color: #9fb0c4; }
        .exch-card[data-night] .exch-close:hover { background: rgba(255,255,255,0.10); color: #f3f6fa; }

        .exch-hero {
          position: relative;
          min-height: 258px;
          padding: 40px 32px 8px;
          display: flex; align-items: flex-start;
        }
        .exch-hero-img {
          position: absolute; top: 0; right: 0;
          width: 60%; aspect-ratio: 1263 / 928;
          background-size: contain; background-position: top right; background-repeat: no-repeat;
          pointer-events: none;
        }
        .exch-hero-text { position: relative; z-index: 1; max-width: 50%; }
        .exch-title { font-size: 46px; font-weight: 800; line-height: 1.02; letter-spacing: -0.02em; margin: 0 0 14px; color: #16233d; }
        .exch-address { font-size: 20px; font-weight: 700; line-height: 1.25; margin: 0 0 12px; color: #51617a; }
        .exch-sub { font-size: 15px; line-height: 1.4; margin: 0; color: #8a97a8; }
        .exch-card[data-night] .exch-title { color: #f3f6fa; }
        .exch-card[data-night] .exch-address { color: #bccadb; }
        .exch-card[data-night] .exch-sub { color: #96a7bb; }

        .exch-body { padding: 6px 24px 8px; display: flex; flex-direction: column; gap: 18px; }

        .exch-stepper { display: flex; align-items: flex-start; padding: 4px 6px 0; }
        .exch-step { display: flex; flex-direction: column; align-items: center; gap: 9px; width: 74px; flex-shrink: 0; }
        .exch-conn { flex: 1; height: 2px; margin-top: 16px; background: var(--agent-coral, #FF8A65); border-radius: 2px; }
        .exch-conn[data-dashed="true"] { background: none; height: 0; border-top: 2px dashed #cbd5e1; }
        .exch-card[data-night] .exch-conn[data-dashed="true"] { border-top-color: rgba(255,255,255,0.22); }
        .exch-tick {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          background: radial-gradient(circle at 35% 28%, #ff9d80, #ff5630 72%);
          box-shadow: 0 4px 14px rgba(255,86,48,0.42), inset 0 1px 2px rgba(255,255,255,0.35);
          display: grid; place-items: center;
        }
        .exch-future {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          border: 2px solid #cbd5e1; color: #94a3b8;
          display: grid; place-items: center;
        }
        .exch-card[data-night] .exch-future { border-color: rgba(255,255,255,0.22); color: #7e91a7; }
        .exch-step-label { font-size: 12.5px; font-weight: 600; color: #33415a; text-align: center; }
        .exch-step-label[data-current="true"] { font-weight: 800; color: #16233d; }
        .exch-step-label[data-muted="true"] { font-weight: 500; color: #94a3b8; }
        .exch-card[data-night] .exch-step-label { color: #cdd9e6; }
        .exch-card[data-night] .exch-step-label[data-current="true"] { color: #f3f6fa; }
        .exch-card[data-night] .exch-step-label[data-muted="true"] { color: #7e91a7; }

        .exch-dates { display: flex; border: 1px solid #eceef1; border-radius: 14px; overflow: hidden; }
        .exch-card[data-night] .exch-dates { border-color: rgba(255,255,255,0.09); }
        .exch-date { flex: 1; display: flex; align-items: center; gap: 12px; padding: 15px 16px; }
        .exch-date + .exch-date { border-left: 1px solid #eceef1; }
        .exch-card[data-night] .exch-date + .exch-date { border-left-color: rgba(255,255,255,0.09); }
        .exch-date-icon { color: #94a3b8; flex-shrink: 0; }
        .exch-card[data-night] .exch-date-icon { color: #7e91a7; }
        .exch-date-label { display: block; font-size: 12px; color: #8a97a8; margin-bottom: 3px; }
        .exch-date-value { display: block; font-size: 14.5px; font-weight: 700; color: #1f2a3d; }
        .exch-card[data-night] .exch-date-label { color: #8496ab; }
        .exch-card[data-night] .exch-date-value { color: #eaf0f7; }

        .exch-callout {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 16px; border-radius: 12px;
          background: #f7f8fb; font-size: 14px; color: #45526a; line-height: 1.45;
        }
        .exch-card[data-night] .exch-callout { background: rgba(255,255,255,0.04); color: #b6c3d4; }
        .exch-callout-icon { color: var(--agent-coral-deep, #FF6B4A); flex-shrink: 0; }

        .exch-cta { width: 100%; justify-content: center; font-size: 15px; font-weight: 700; border-radius: 14px; }

        @keyframes exch-pop-in { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: none; } }
        @keyframes exch-pop-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: scale(0.96); } }
        @keyframes exch-sheet-up { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes exch-sheet-down { from { transform: none; } to { transform: translateY(100%); } }

        /* Below 600px: a bottom-sheet drawer — no hero image, plain background,
           slides up on open / down on dismiss, with the button in a sticky bar. */
        @media (max-width: 599px) {
          .exch-overlay { align-items: flex-end; padding: 0; }
          .exch-card {
            max-width: 100%; max-height: 92vh;
            border-radius: 20px 20px 0 0;
            animation: exch-sheet-up 300ms cubic-bezier(0.16,1,0.3,1);
          }
          .exch-card[data-closing="true"] { animation: exch-sheet-down 260ms ease forwards; }
          .exch-hero-img { display: none; }
          .exch-hero { min-height: 0; padding: 34px 22px 4px; }
          .exch-hero-text { max-width: 100%; }
          .exch-title { font-size: 36px; }
          .exch-footer {
            position: sticky; bottom: 0;
            border-top: 1px solid #eceef1; background: #ffffff;
            padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
          }
          .exch-card[data-night] .exch-footer { border-top-color: rgba(255,255,255,0.09); background: #0e1a2d; }
          .exch-dates { flex-direction: column; }
          .exch-date + .exch-date { border-left: none; border-top: 1px solid #eceef1; }
          .exch-card[data-night] .exch-date + .exch-date { border-top-color: rgba(255,255,255,0.09); }
        }

        @media (prefers-reduced-motion: reduce) {
          .exch-card, .exch-card[data-closing="true"] { animation: none !important; }
        }
      `}</style>
    </div>,
    document.body
  );
}

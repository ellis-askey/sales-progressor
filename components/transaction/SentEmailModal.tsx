"use client";

// The read-only viewer for a SENT email. Centre modal on desktop; a drawer that
// slides up from the bottom on tablet/mobile (<=1024px) — the LogUpdateModal
// pattern. Opens from a sent row (Focus comms list or the file chase timeline),
// fetches the stored OutboundMessage, and shows the email in a sandboxed iframe.
// Newer sends return their exact stored HTML; older sends are re-rendered
// server-side through the branded shell (flagged `reconstructed`).

import { useState, useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { getSentChaseEmailAction, type SentChaseEmail } from "@/app/actions/sent-chase-email";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDateTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

const STEPS = ["Sent", "Delivered", "Opened"] as const;
function reachedIndex(d: SentChaseEmail["delivery"]): number {
  return d === "opened" ? 2 : d === "delivered" ? 1 : 0;
}

export type OpenEmail = { id: string; label: string };

export function SentEmailModal({ email, onClose }: { email: OpenEmail | null; onClose: () => void }) {
  const [data, setData] = useState<SentChaseEmail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    let live = true;
    setData(null); setError(null); setLoading(true);
    getSentChaseEmailAction(email.id)
      .then((res) => { if (live) setData(res); })
      .catch(() => { if (live) setError("Couldn't load this email."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [email]);

  useEffect(() => {
    if (!email) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [email, onClose]);

  if (!email) return null;
  const reached = data ? reachedIndex(data.delivery) : 0;
  const eyebrow = data?.recipientName
    ? `To ${data.recipientName}${email.label ? ` · ${email.label}` : ""}`
    : (loading ? "Sent email" : `Sent email${email.label ? ` · ${email.label}` : ""}`);

  return (
    <div className="sev-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sent email">
      <div className="sev-bg" />
      <div className="sev-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sev-grab" aria-hidden />
        <div className="sev-head">
          <div className="sev-head-main">
            <div className="sev-eyebrow">{eyebrow}</div>
            <h2 className="sev-subject">{data?.subject || (loading ? "Loading…" : "Sent email")}</h2>
          </div>
          <button type="button" className="sev-ic" onClick={onClose} aria-label="Close"><X size={16} weight="bold" /></button>
        </div>

        {data && (
          <div className="sev-meta">
            <span className="sev-sent"><span className="sev-mk">Sent:</span> {fmtDateTime(data.sentAt)}</span>
            {data.fromEmail && <span className="sev-to" title={data.fromEmail}><span className="sev-mk">From:</span> {data.fromEmail}</span>}
            {data.recipientEmail && <span className="sev-to" title={data.recipientEmail}><span className="sev-mk">To:</span> {data.recipientEmail}</span>}
            <div className="sev-steps" aria-label={`Delivery: ${STEPS[reached]}`}>
              {STEPS.map((s, i) => (
                <span key={s} className="sev-stepwrap">
                  {i > 0 && <span className={`sev-sep${i <= reached ? " on" : ""}`} aria-hidden />}
                  <span className={`sev-step${i <= reached ? " on" : ""}${i === reached ? " now" : ""}`}>
                    <span className="sev-step-dot" aria-hidden />
                    <span className="sev-step-label">{s}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {data?.reconstructed && (
          <div className="sev-recon">Reconstructed from the text we sent. Exact formatting is kept for more recent sends.</div>
        )}

        <div className="sev-body">
          {loading && (
            <div className="sev-skel">
              <div className="sev-skel-card">
                <span className="sev-skel-line w40" />
                <span className="sev-skel-line w90" />
                <span className="sev-skel-line w80" />
                <span className="sev-skel-line w60" />
                <span className="sev-skel-btn" />
              </div>
            </div>
          )}
          {!loading && error && <div className="sev-note" style={{ color: "var(--agent-danger)" }}>{error}</div>}
          {!loading && data && data.html && <iframe title="Sent email" srcDoc={data.html} sandbox="" className="sev-frame" />}
          {!loading && data && !data.html && (
            // Reconstruction failed and nothing was stored — show the plain text we have.
            <div className="sev-textwrap">
              <pre className="sev-text">{data.text || "(no content stored)"}</pre>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .sev-ov { position: fixed; inset: 0; z-index: 80; font-family: var(--font-geist-sans, -apple-system, system-ui, sans-serif); }
        .sev-bg { position: absolute; inset: 0; background: rgba(45,24,16,.42); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: sev-bgf .26s ease both; }
        @keyframes sev-bgf { from { opacity: 0 } to { opacity: 1 } }
        .sev-sheet { position: absolute; display: flex; flex-direction: column; overflow: hidden;
          background: var(--agent-bg-paper, #FFFBF5); border: 1px solid rgba(255,255,255,.5);
          box-shadow: 0 24px 70px -24px rgba(40,24,16,.5), 0 8px 24px rgba(45,24,16,.12); }
        .sev-sheet { top: 50%; left: 50%; width: min(720px, calc(100vw - 48px)); height: min(88vh, 860px);
          border-radius: 16px; border-top: 2px solid var(--agent-coral-deep, #FF6B4A);
          transform: translate(-50%, -48%) scale(.97); opacity: 0; animation: sev-in .3s cubic-bezier(.22,1,.36,1) forwards; }
        @keyframes sev-in { to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
        .sev-grab { display: none; }
        @media (max-width: 1024px) {
          .sev-sheet { top: auto; left: 0; right: 0; bottom: 0; width: 100%; max-width: none; height: 94vh;
            border-radius: 18px 18px 0 0; border-top: none;
            transform: translateY(100%); opacity: 1; animation: sev-up .36s cubic-bezier(.22,1,.36,1) forwards; }
          @keyframes sev-up { to { transform: translateY(0) } }
          .sev-grab { display: block; width: 40px; height: 4px; border-radius: 999px; background: var(--agent-border-strong, rgba(45,24,16,.18)); margin: 9px auto 2px; flex: 0 0 auto; }
        }
        /* Header: no lead icon; subject owns the row, close sits top-right */
        .sev-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px 11px; }
        .sev-head-main { flex: 1; min-width: 0; }
        .sev-eyebrow { font-size: 11px; font-weight: 600; color: var(--agent-text-muted, #857d6e); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sev-subject { font-size: 16px; font-weight: 700; letter-spacing: -.01em; margin: 0; color: var(--agent-text-primary, #2D1810); line-height: 1.3;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sev-ic { width: 30px; height: 30px; border-radius: 999px; border: 1px solid var(--agent-border-default, rgba(45,24,16,.1)); background: rgba(255,255,255,.6);
          display: grid; place-items: center; cursor: pointer; color: var(--agent-text-secondary, #5A3A28); flex: 0 0 auto; transition: background .14s, color .14s; }
        .sev-ic:hover { background: #fff; color: var(--agent-text-primary, #2D1810); }
        /* Meta: Sent + recipient on the left, delivery stepper pinned right */
        .sev-meta { display: flex; align-items: center; gap: 7px 16px; flex-wrap: wrap; padding: 0 18px 12px; font-size: 12px; color: var(--agent-text-secondary, #5A3A28);
          border-bottom: 0.5px solid var(--agent-border-subtle, rgba(45,24,16,.08)); }
        .sev-mk { color: var(--agent-text-muted, #857d6e); font-weight: 600; }
        .sev-to { color: var(--agent-text-muted, #857d6e); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
        .sev-steps { display: inline-flex; align-items: center; margin-left: auto; }
        .sev-stepwrap { display: inline-flex; align-items: center; }
        .sev-step { display: inline-flex; align-items: center; gap: 5px; padding: 0 2px; }
        .sev-step-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--agent-border-strong, rgba(45,24,16,.2)); flex: 0 0 auto; }
        .sev-step-label { font-size: 11px; font-weight: 600; color: var(--agent-text-muted, #857d6e); }
        .sev-step.on .sev-step-dot { background: var(--agent-success, #15803d); }
        .sev-step.on .sev-step-label { color: var(--agent-success, #15803d); }
        .sev-step.now .sev-step-label { font-weight: 700; }
        .sev-sep { width: 14px; height: 1px; background: var(--agent-border-strong, rgba(45,24,16,.16)); margin: 0 5px; }
        .sev-sep.on { background: var(--agent-success, #15803d); opacity: .5; }
        @media (max-width: 440px) { .sev-steps { margin-left: 0; } }
        /* Reconstructed note (legacy sends only) */
        .sev-recon { font-size: 11.5px; line-height: 1.45; color: var(--agent-text-muted, #857d6e); background: var(--agent-surface-sunken, #f6f1e9);
          padding: 8px 18px; border-bottom: 0.5px solid var(--agent-border-subtle, rgba(45,24,16,.08)); }
        .sev-body { flex: 1; min-height: 0; overflow: hidden; background: #f4f2ee; display: flex; }
        .sev-frame { width: 100%; height: 100%; min-height: 420px; border: 0; display: block; }
        .sev-note { margin: auto; padding: 48px 20px; font-size: 13px; color: var(--agent-text-muted, #857d6e); }
        .sev-textwrap { width: 100%; overflow-y: auto; padding: 20px; }
        .sev-text { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; line-height: 1.6; color: var(--agent-text-primary, #2D1810); white-space: pre-wrap; word-break: break-word;
          background: #fff; border: 1px solid var(--agent-border-subtle, rgba(45,24,16,.08)); border-radius: 10px; padding: 16px; margin: 0; }
        /* Loading skeleton — mimics the email card so the swap doesn't jump */
        .sev-skel { width: 100%; overflow: hidden; padding: 40px 20px; display: flex; justify-content: center; }
        .sev-skel-card { width: min(560px, 100%); background: #fff; border-radius: 12px; padding: 36px; box-shadow: 0 1px 3px rgba(0,0,0,.05); display: flex; flex-direction: column; gap: 14px; }
        .sev-skel-line { height: 12px; border-radius: 6px; background: linear-gradient(90deg, #ececec 25%, #f5f5f5 37%, #ececec 63%); background-size: 400% 100%; animation: sev-sh 1.4s ease infinite; }
        .sev-skel-line.w40 { width: 40%; } .sev-skel-line.w90 { width: 90%; } .sev-skel-line.w80 { width: 80%; } .sev-skel-line.w60 { width: 60%; }
        .sev-skel-btn { width: 128px; height: 40px; border-radius: 8px; margin-top: 6px; background: linear-gradient(90deg, #e4e4e4 25%, #efefef 37%, #e4e4e4 63%); background-size: 400% 100%; animation: sev-sh 1.4s ease infinite; }
        @keyframes sev-sh { 0% { background-position: 100% 50% } 100% { background-position: 0 50% } }
        @media (prefers-reduced-motion: reduce) { .sev-bg, .sev-sheet, .sev-skel-line, .sev-skel-btn { animation: none !important; } }
      `}</style>
    </div>
  );
}

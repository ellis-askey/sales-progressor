"use client";

// The read-only viewer for a SENT chase email. Centre modal on desktop; a drawer
// that slides up from the bottom on tablet/mobile (<=1024px) — the LogUpdateModal
// pattern. Opens from a sent row in the chase timeline, fetches the stored
// OutboundMessage, and renders the exact HTML we sent inside a sandboxed iframe.

import { useState, useEffect } from "react";
import { Buildings, CheckCircle, X } from "@phosphor-icons/react";
import { getSentChaseEmailAction, type SentChaseEmail } from "@/app/actions/sent-chase-email";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDateTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}
const DELIVERY = {
  sent: { label: "Sent", color: "var(--agent-text-muted)" },
  delivered: { label: "Delivered", color: "var(--agent-info)" },
  opened: { label: "Opened", color: "var(--agent-success)" },
} as const;

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
  const dm = data ? DELIVERY[data.delivery] : null;

  return (
    <div className="sev-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sent email">
      <div className="sev-bg" />
      <div className="sev-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sev-grab" aria-hidden />
        <div className="sev-head">
          <span className="sev-ic-lead" aria-hidden><Buildings size={18} weight="regular" /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sev-eyebrow">Sent email · {email.label}</div>
            <h2 className="sev-subject">{data?.subject || (loading ? "Loading…" : "Sent email")}</h2>
          </div>
          <button type="button" className="sev-ic" onClick={onClose} aria-label="Close"><X size={16} weight="bold" /></button>
        </div>

        {data && (
          <div className="sev-meta">
            {data.recipientName && <span><span className="sev-mk">To</span> {data.recipientName}</span>}
            <span><span className="sev-mk">Sent</span> {fmtDateTime(data.sentAt)}</span>
            {dm && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: dm.color, fontWeight: 600 }}>
                {data.delivery === "opened" ? <CheckCircle size={13} weight="fill" /> : <span style={{ width: 5, height: 5, borderRadius: 999, background: dm.color }} />}
                {dm.label}
              </span>
            )}
          </div>
        )}

        <div className="sev-body">
          {loading && <div className="sev-note">Loading the email…</div>}
          {error && <div className="sev-note" style={{ color: "var(--agent-danger)" }}>{error}</div>}
          {data && data.html && <iframe title="Sent email" srcDoc={data.html} sandbox="" className="sev-frame" />}
          {data && !data.html && (
            // Legacy send with no stored HTML — show the plain text we do have.
            <div className="sev-textwrap">
              <p className="sev-textnote">Older send — the original formatting wasn't stored. Here's the text we sent:</p>
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
        .sev-sheet { top: 50%; left: 50%; width: min(720px, calc(100vw - 48px)); max-height: min(90vh, 820px);
          border-radius: 16px; border-top: 2px solid var(--agent-coral-deep, #FF6B4A);
          transform: translate(-50%, -48%) scale(.97); opacity: 0; animation: sev-in .3s cubic-bezier(.22,1,.36,1) forwards; }
        @keyframes sev-in { to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
        .sev-grab { display: none; }
        @media (max-width: 1024px) {
          .sev-sheet { top: auto; left: 0; right: 0; bottom: 0; width: 100%; max-width: none; max-height: 94vh;
            border-radius: 18px 18px 0 0; border-top: none;
            transform: translateY(100%); opacity: 1; animation: sev-up .36s cubic-bezier(.22,1,.36,1) forwards; }
          @keyframes sev-up { to { transform: translateY(0) } }
          .sev-grab { display: block; width: 40px; height: 4px; border-radius: 999px; background: var(--agent-border-strong, rgba(45,24,16,.18)); margin: 9px auto 2px; flex: 0 0 auto; }
        }
        .sev-head { display: flex; align-items: flex-start; gap: 11px; padding: 15px 18px 12px; border-bottom: 0.5px solid var(--agent-border-subtle, rgba(45,24,16,.08)); }
        .sev-ic-lead { width: 34px; height: 34px; border-radius: 9px; flex: 0 0 auto; display: grid; place-items: center;
          background: color-mix(in srgb, var(--agent-coral, #FF8A65) 10%, transparent); color: var(--agent-coral-deep, #c0573c); margin-top: 1px; }
        .sev-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--agent-text-muted, #857d6e); margin-bottom: 3px; }
        .sev-subject { font-size: 14.5px; font-weight: 700; letter-spacing: -.01em; margin: 0; color: var(--agent-text-primary, #2D1810); line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .sev-ic { width: 30px; height: 30px; border-radius: 999px; border: 1px solid var(--agent-border-default, rgba(45,24,16,.1)); background: rgba(255,255,255,.6);
          display: grid; place-items: center; cursor: pointer; color: var(--agent-text-secondary, #5A3A28); flex: 0 0 auto; transition: background .14s, color .14s; }
        .sev-ic:hover { background: #fff; color: var(--agent-text-primary, #2D1810); }
        .sev-meta { display: flex; flex-wrap: wrap; gap: 6px 18px; padding: 10px 18px; font-size: 12px; color: var(--agent-text-secondary, #5A3A28);
          border-bottom: 0.5px solid var(--agent-border-subtle, rgba(45,24,16,.08)); }
        .sev-mk { font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--agent-text-muted, #857d6e); margin-right: 5px; }
        .sev-body { flex: 1; min-height: 0; overflow: hidden; background: #f4f2ee; display: flex; }
        .sev-frame { width: 100%; height: 100%; min-height: 420px; border: 0; display: block; }
        .sev-note { margin: auto; padding: 48px 20px; font-size: 13px; color: var(--agent-text-muted, #857d6e); }
        .sev-textwrap { width: 100%; overflow-y: auto; padding: 20px; }
        .sev-textnote { font-size: 12px; color: var(--agent-text-muted, #857d6e); margin: 0 0 12px; }
        .sev-text { font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; line-height: 1.6; color: var(--agent-text-primary, #2D1810); white-space: pre-wrap; word-break: break-word;
          background: #fff; border: 1px solid var(--agent-border-subtle, rgba(45,24,16,.08)); border-radius: 10px; padding: 16px; margin: 0; }
        @media (prefers-reduced-motion: reduce) { .sev-bg, .sev-sheet { animation: none !important; } }
      `}</style>
    </div>
  );
}

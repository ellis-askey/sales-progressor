"use client";

// Dev sandbox: the viewer that opens when you click a SENT email on the Focus
// comms list or the file chase timeline. Desktop = centre modal; tablet/mobile
// (<=1024px) = a drawer that slides up from the bottom (the LogUpdateModal
// pattern). This sandbox mirrors the real SentEmailModal chrome so the cleanup
// can be judged, and carries BOTH states:
//   • "stored HTML"  — the exact bytes we captured at send time (true-to-inbox)
//   • "legacy"       — an older send with no stored HTML, re-rendered server-side
//                      through the branded chase shell (faithful, not pixel-exact)

import { useState, useEffect } from "react";
import { CheckCircle, X } from "@phosphor-icons/react";

type SentEmail = {
  id: string;
  recipientName: string;
  recipientEmail: string;
  recipientRole: string;   // "Buyer" | "Seller"
  subject: string;
  sentAt: string;          // display string
  delivery: "sent" | "delivered" | "opened";
  html: string;            // exact (stored) OR reconstructed (legacy) branded HTML
  reconstructed: boolean;  // true = rebuilt from the sent text (no stored bytes)
};

// ── Mock emails ────────────────────────────────────────────────────────────
// Representative of what the two server paths produce. The exact one mirrors
// assembleDigestPayload's default table shell (styled <ul> bullets); the
// reconstructed one mirrors renderEditedChaseEmailHtml (branded shell, bullets
// reflowed as text lines — the honest limitation for pre-capture sends).

const ACCENT = "#0E8C86";
const AGENCY = "Oplah Ltd";

function shell(inner: string, cta: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f5;padding:40px 20px;">
      <tr><td align="center">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.05);">
          <tr><td>
            <p style="font-size:11px;font-weight:700;letter-spacing:.08em;color:${ACCENT};text-transform:uppercase;margin:0 0 16px;">${AGENCY}</p>
            ${inner}
            <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-radius:8px;background:${ACCENT};">
              <a href="#" style="display:inline-block;padding:12px 24px;color:#fff;text-decoration:none;font-weight:500;font-size:15px;">${cta}</a>
            </td></tr></table>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;font-size:11px;color:#c0c4d0;text-align:center;">
          <a href="#" style="color:#c0c4d0;text-decoration:none;">Pause reminders for a week</a> &nbsp;&middot;&nbsp;
          <a href="#" style="color:#c0c4d0;text-decoration:none;">Unsubscribe</a> &nbsp;&middot;&nbsp;
          <a href="#" style="color:#c0c4d0;text-decoration:none;">support@oplah.co.uk</a>
        </p>
      </td></tr>
    </table>
  </body></html>`;
}

const P = `font-size:15px;color:#4a5162;line-height:1.6;margin:0 0 16px;`;
const exactHtml = shell(
  `<p style="${P}">Hi Meir,</p>
   <p style="${P}">A quick update on your purchase at <strong>132 St. Julians Farm Road</strong>.</p>
   <p style="${P}">One thing is sitting with your solicitor right now that we haven't seen confirmed yet:</p>
   <ul style="margin:0 0 20px;padding-left:20px;"><li style="margin:0 0 6px;color:#1a1d29;font-size:14px;line-height:1.5;">Searches being ordered</li></ul>
   <p style="${P}">You don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps.</p>
   <p style="${P}">If you've heard back and we just don't know yet, open the page below and let us know. We'll mark it done on our side so you don't get reminded again.</p>`,
  "Open the page",
);
const reconstructedHtml = shell(
  `<p style="${P}">Hi Meir,</p>
   <p style="${P}">A quick update on your purchase at 132 St. Julians Farm Road.</p>
   <p style="${P}">One thing is sitting with your solicitor right now that we haven't seen confirmed yet:<br>&bull; Searches being ordered</p>
   <p style="${P}">You don't need to do anything yourself. If it's been a while and you want to chase, a short email often helps.</p>
   <p style="${P}">If you've heard back and we just don't know yet, open the page below and let us know. We'll mark it done on our side so you don't get reminded again.</p>`,
  "Open the page",
);

const EMAILS: SentEmail[] = [
  {
    id: "1", recipientName: "Meir Klein", recipientEmail: "meir.klein@example.com", recipientRole: "Buyer",
    subject: "Quick update on 132 St. Julians Farm Road",
    sentAt: "21 Oct 2026, 11:00", delivery: "opened", reconstructed: false, html: exactHtml,
  },
  {
    id: "2", recipientName: "Meir Klein", recipientEmail: "meir.klein@example.com", recipientRole: "Buyer",
    subject: "Quick update on 132 St. Julians Farm Road",
    sentAt: "20 Oct 2026, 11:00", delivery: "opened", reconstructed: true, html: reconstructedHtml,
  },
];

const STEPS = ["Sent", "Delivered", "Opened"] as const;
function reachedIndex(d: SentEmail["delivery"]): number {
  return d === "opened" ? 2 : d === "delivered" ? 1 : 0;
}

export function SentEmailViewerSandbox() {
  const [open, setOpen] = useState<SentEmail | null>(null);
  const [loading, setLoading] = useState(false);

  // Fake a short fetch so the loading skeleton is visible in the sandbox.
  function openEmail(em: SentEmail) {
    setOpen(em);
    setLoading(true);
    window.setTimeout(() => setLoading(false), 650);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(null); }
    if (open) { document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }
  }, [open]);

  const reached = open ? reachedIndex(open.delivery) : 0;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--agent-bg-paper, #FFFBF5)", padding: "40px 20px", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--agent-coral-deep, #c0573c)", margin: "0 0 6px" }}>Dev preview</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary, #2D1810)", margin: "0 0 6px", letterSpacing: "-0.01em" }}>Open a sent email</h1>
        <p style={{ fontSize: 14, color: "var(--agent-text-muted, #857d6e)", margin: "0 0 26px", lineHeight: 1.55 }}>
          Two states: the first row has stored HTML (exact bytes); the second is an older send with no stored HTML, re-rendered through the branded shell. Narrow the window under ~1024px for the drawer.
        </p>

        <div style={{ borderRadius: 16, background: "var(--agent-surface-elevated, #fff)", border: "0.5px solid var(--agent-border-subtle, rgba(45,24,16,.08))", padding: "8px 20px" }}>
          {EMAILS.map((em) => {
            const r = reachedIndex(em.delivery);
            return (
              <button
                key={em.id}
                type="button"
                onClick={() => openEmail(em)}
                className="sev-row"
                style={{ display: "flex", gap: 12, alignItems: "center", width: "100%", textAlign: "left", background: "none", border: "none", borderBottom: em.id === "1" ? "0.5px solid var(--agent-border-subtle, rgba(45,24,16,.08))" : "none", padding: "14px 0", cursor: "pointer", fontFamily: "inherit" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary, #2D1810)" }}>{em.subject}</div>
                  <div style={{ fontSize: 12, color: "var(--agent-text-secondary, #5A3A28)", marginTop: 2 }}>
                    To {em.recipientName} · {em.sentAt}{em.reconstructed ? " · older send" : ""}
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: STEPS[r] === "Opened" ? "var(--agent-success, #15803d)" : "var(--agent-text-muted)" }}>
                  {em.delivery === "opened" ? <CheckCircle size={13} weight="fill" /> : <span style={{ width: 5, height: 5, borderRadius: 999, background: "currentColor" }} />}
                  {STEPS[r]}
                </span>
                <span className="sev-oh-arrow" aria-hidden style={{ color: "var(--agent-coral-deep, #c0573c)", fontWeight: 600 }}>→</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Viewer ─────────────────────────────────────────────────────────── */}
      {open && (
        <div className="sev-ov" onClick={() => setOpen(null)} role="dialog" aria-modal="true" aria-label="Sent email">
          <div className="sev-bg" />
          <div className="sev-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sev-grab" aria-hidden />
            <div className="sev-head">
              <div className="sev-head-main">
                <div className="sev-eyebrow">To {open.recipientName} · {open.recipientRole}</div>
                <h2 className="sev-subject">{open.subject}</h2>
              </div>
              <button type="button" className="sev-ic" onClick={() => setOpen(null)} aria-label="Close"><X size={16} weight="bold" /></button>
            </div>

            <div className="sev-meta">
              <span className="sev-sent"><span className="sev-mk">Sent:</span> {open.sentAt}</span>
              <span className="sev-to" title={open.recipientEmail}>{open.recipientEmail}</span>
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

            {open.reconstructed && (
              <div className="sev-recon">Reconstructed from the text we sent. Exact formatting is kept for sends from Oct 2026 onward.</div>
            )}

            <div className="sev-body">
              {loading ? (
                <div className="sev-skel">
                  <div className="sev-skel-card">
                    <span className="sev-skel-line w40" />
                    <span className="sev-skel-line w90" />
                    <span className="sev-skel-line w80" />
                    <span className="sev-skel-line w60" />
                    <span className="sev-skel-btn" />
                  </div>
                </div>
              ) : (
                <iframe title="Sent email" srcDoc={open.html} sandbox="" className="sev-frame" />
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .sev-row:hover { background: var(--agent-surface-hover, rgba(45,24,16,.02)); }
        .sev-oh-arrow { opacity: 0; transition: opacity .15s ease; }
        .sev-row:hover .sev-oh-arrow { opacity: 1; }

        .sev-ov { position: fixed; inset: 0; z-index: 80; font-family: var(--font-geist-sans, -apple-system, system-ui, sans-serif); }
        .sev-bg { position: absolute; inset: 0; background: rgba(45,24,16,.42); backdrop-filter: blur(3px); -webkit-backdrop-filter: blur(3px); animation: sev-bgf .26s ease both; }
        @keyframes sev-bgf { from { opacity: 0 } to { opacity: 1 } }
        .sev-sheet { position: absolute; display: flex; flex-direction: column; overflow: hidden;
          background: var(--agent-bg-paper, #FFFBF5); border: 1px solid rgba(255,255,255,.5);
          box-shadow: 0 24px 70px -24px rgba(40,24,16,.5), 0 8px 24px rgba(45,24,16,.12); }
        /* Desktop: centre modal */
        .sev-sheet { top: 50%; left: 50%; width: min(720px, calc(100vw - 48px)); height: min(88vh, 860px);
          border-radius: 16px; border-top: 2px solid var(--agent-coral-deep, #FF6B4A);
          transform: translate(-50%, -48%) scale(.97); opacity: 0; animation: sev-in .3s cubic-bezier(.22,1,.36,1) forwards; }
        @keyframes sev-in { to { transform: translate(-50%, -50%) scale(1); opacity: 1 } }
        .sev-grab { display: none; }
        /* Tablet + mobile: bottom drawer */
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

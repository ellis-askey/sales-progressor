"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Users, BellRinging, WarningCircle, Storefront, Plus, ArrowRight, ArrowLeft, X, CheckCircle } from "@phosphor-icons/react";
import { markProgressorWelcomeSeenAction } from "@/app/actions/profile";
import { saveProgressorChasePrefsAction } from "@/app/actions/progression-clients";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { useDarkMode } from "@/lib/agent/use-theme";
import type { ThemeMode } from "@/lib/agent/theme-mode";
import type { ProgressorChasePrefs } from "@/lib/services/progressor-chase-prefs";
import { extractFirstName } from "@/lib/contacts/displayName";

// First-run welcome for an EXTERNAL progression-business OWNER. Combines two
// founder critiques: the "what this does" key points (#3) and the "choose which
// chases run" opt-in (#1). Mirrors the agent WelcomeModal's chrome (portal, dim +
// blur backdrop, welcome-modal-open nav treatment, zoom-out close) but is a
// stepped card with an illustration only on the final step. Self-contained styles
// (explicit colours, light + dark) so it renders correctly portaled to <body>.

type Pref = keyof ProgressorChasePrefs;

const CHASES: Array<{ key: Pref; title: string; desc: string }> = [
  { key: "client",    title: "Client chases",        desc: "Nudge buyers and sellers to confirm each step in their portal." },
  { key: "solicitor", title: "Solicitor chases",     desc: "Ask solicitors to confirm the steps that are waiting on them." },
  { key: "enquiries", title: "Enquiry chases",       desc: "Chase solicitors to raise, and reply to, the legal enquiries." },
  { key: "weekly",    title: "Weekly client updates", desc: "A short weekly note reassuring each client their sale's on track." },
  { key: "chain",     title: "Chain updates",        desc: "Tell connected agents when a step moves on a linked sale." },
];

export function ProgressorWelcomeModal({
  businessName,
  userName = "",
  initialPrefs,
  themeMode,
}: {
  businessName: string;
  userName?: string;
  initialPrefs: ProgressorChasePrefs;
  themeMode: ThemeMode;
}) {
  const router = useRouter();
  const firstName = extractFirstName(userName);
  const { theme } = usePortalTheme();
  const { isDark } = useDarkMode(themeMode);

  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<ProgressorChasePrefs>(initialPrefs);

  useEffect(() => {
    setMounted(true);
    markProgressorWelcomeSeenAction().catch(() => {});
    document.documentElement.classList.add("welcome-modal-open");
    return () => document.documentElement.classList.remove("welcome-modal-open");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  function close() {
    if (closing) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }
    setClosing(true);
  }

  function savePrefs() {
    // Fire-and-forget: the welcome must never block on the network. Owner-gated +
    // flag-gated server-side.
    saveProgressorChasePrefsAction(prefs).catch(() => {});
  }

  function goChases() { setStep(1); }
  function goReady() { savePrefs(); setStep(2); }

  function handleAddClient() {
    setVisible(false);
    router.push("/agent/clients");
  }

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      data-theme={theme}
      className="welcome-shell"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        ["--agent-backdrop-bg" as string]: "rgba(0, 0, 0, 0.55)",
      } as React.CSSProperties}
      onClick={close}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className={`agent-backdrop-overlay welcome-backdrop${closing ? " welcome-backdrop-closing" : ""}`} />

      <div
        className={`pw-card${step === 2 ? " pw-art-step" : ""}`}
        data-pw-theme={isDark ? "dark" : "light"}
        style={{
          animation: closing
            ? "welcome-zoom-out 420ms cubic-bezier(0.4,0,1,1) both"
            : "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => { if (closing) setVisible(false); }}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome"
      >
        {/* Illustration + wash — shown on the final step only (desktop) */}
        <div aria-hidden="true" className="pw-art" />
        <div aria-hidden="true" className="pw-wash" />

        <button onClick={close} aria-label="Close" className="pw-close">
          <X size={14} weight="bold" />
        </button>

        <div className="pw-col">
          <div className="pw-dots">
            {[0, 1, 2].map((n) => <span key={n} className={`pw-dot${n === step ? " on" : ""}`} />)}
          </div>

          {step === 0 && (
            <>
              <span className="pw-eyebrow">You&apos;re in</span>
              <h2 className="pw-title">Welcome to {businessName}{firstName ? `, ${firstName}` : ""}.</h2>
              <p className="pw-lede">Here&apos;s how your progression business runs here. Three quick things, then you&apos;re set.</p>

              <ul className="pw-points">
                <li>
                  <span className="pw-chip"><Users size={20} weight="regular" /></span>
                  <span><span className="pw-pt-t">Add your clients and their sales</span><span className="pw-pt-d">Bring an agency on board, then add the sales you&apos;re progressing for them.</span></span>
                </li>
                <li>
                  <span className="pw-chip"><BellRinging size={20} weight="regular" /></span>
                  <span><span className="pw-pt-t">We chase your clients for you</span><span className="pw-pt-d">Buyers and sellers are nudged in their own portal to confirm each step as it happens.</span></span>
                </li>
                <li>
                  <span className="pw-chip"><WarningCircle size={20} weight="regular" /></span>
                  <span><span className="pw-pt-t">Anything late comes to you</span><span className="pw-pt-d">If a step isn&apos;t confirmed in time, it&apos;s raised to you to step in. Nothing slips.</span></span>
                </li>
                <li>
                  <span className="pw-chip"><Storefront size={20} weight="regular" /></span>
                  <span><span className="pw-pt-t">It&apos;s your brand, start to finish</span><span className="pw-pt-d">Clients see your business on every email and portal, not ours.</span></span>
                </li>
              </ul>

              <div className="pw-actions">
                <button className="pw-cta" onClick={goChases}>
                  <span>Next: choose your chases</span>
                  <ArrowRight size={18} weight="bold" />
                </button>
                <button className="pw-ghost" onClick={goReady}>Skip for now</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <span className="pw-eyebrow">Set up · your chases</span>
              <h2 className="pw-title">We&apos;ll do the chasing.</h2>
              <p className="pw-lede">These run automatically on every sale. They&apos;re all on — switch off any you&apos;d rather handle yourself.</p>

              <div className="pw-toggles">
                {CHASES.map((c) => (
                  <div className="pw-trow" key={c.key}>
                    <div className="pw-tx">
                      <span className="pw-tr-t">{c.title}</span>
                      <span className="pw-tr-d">{c.desc}</span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={prefs[c.key]}
                      aria-label={c.title}
                      className="pw-switch"
                      onClick={() => setPrefs((p) => ({ ...p, [c.key]: !p[c.key] }))}
                    >
                      <span className="pw-knob" />
                    </button>
                  </div>
                ))}
              </div>

              <p className="pw-footnote">You can change any of these anytime in Settings. We never send more than twice on any one step.</p>

              <div className="pw-linkrow">
                <button className="pw-back" onClick={() => setStep(0)}><ArrowLeft size={15} weight="bold" /> Back</button>
              </div>
              <div className="pw-actions" style={{ marginTop: 12 }}>
                <button className="pw-cta" onClick={goReady}>
                  <span>Save and continue</span>
                  <ArrowRight size={18} weight="bold" />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="pw-ready-ico"><CheckCircle size={28} weight="fill" /></span>
              <span className="pw-eyebrow" style={{ marginTop: 16 }}>All set</span>
              <h2 className="pw-title">You&apos;re ready to go.</h2>
              <p className="pw-lede">Add your first client to get started, and we&apos;ll take it from there. Or have a quick look around first.</p>

              <div className="pw-actions">
                <button className="pw-cta" onClick={handleAddClient}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><Plus size={18} weight="bold" /> Add your first client</span>
                  <ArrowRight size={18} weight="bold" />
                </button>
                <button className="pw-ghost" onClick={close} style={{ justifyContent: "flex-start", paddingLeft: 2 }}>Explore first</button>
              </div>
              <div className="pw-linkrow">
                <button className="pw-back" onClick={() => setStep(1)}><ArrowLeft size={15} weight="bold" /> Back to chases</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

const CSS = `
.pw-card {
  position: relative; overflow: hidden;
  width: min(864px, calc(100vw - 72px));
  border-radius: 16px;
}
.pw-card[data-pw-theme="light"] {
  --surface:#ffffff; --coral:#FF6B4A; --coral-tint:rgba(255,138,101,0.12);
  --cta-from:#FF7E57; --cta-to:#F0511A; --cta-shadow:rgba(240,81,26,0.30); --cta-shadow-hi:rgba(240,81,26,0.42);
  --heading:#0F1B2D; --body:#54617d; --muted:#9aa3b2;
  --row-border:rgba(45,24,16,0.10); --row-bg:rgba(45,24,16,0.015); --switch-off:rgba(45,24,16,0.18);
  --card-border:rgba(45,24,16,0.10); --card-shadow:0 24px 64px rgba(45,24,16,0.16),0 4px 16px rgba(45,24,16,0.07);
  --wash:linear-gradient(90deg,#ffffff 0%,#ffffff 46%,rgba(255,255,255,0.86) 60%,rgba(255,255,255,0) 82%);
}
.pw-card[data-pw-theme="dark"] {
  --surface:#1e293b; --coral:#FF6B4A; --coral-tint:rgba(255,107,74,0.16);
  --cta-from:#FF7E57; --cta-to:#F0511A; --cta-shadow:rgba(240,81,26,0.40); --cta-shadow-hi:rgba(240,81,26,0.55);
  --heading:#EFF6FF; --body:#94A3B8; --muted:#64748B;
  --row-border:rgba(255,255,255,0.10); --row-bg:rgba(255,255,255,0.03); --switch-off:rgba(255,255,255,0.20);
  --card-border:rgba(255,255,255,0.10); --card-shadow:0 28px 70px rgba(0,0,0,0.55),0 6px 20px rgba(0,0,0,0.40);
  --wash:linear-gradient(90deg,#1e293b 0%,#1e293b 46%,rgba(30,41,59,0.86) 60%,rgba(30,41,59,0) 82%);
}
.pw-card { background: var(--surface); border: 0.5px solid var(--card-border); box-shadow: var(--card-shadow); }
.pw-card::before { content:""; position:absolute; top:0; left:0; right:0; height:2px; background:var(--coral); z-index:3; }

.pw-art { display:none; position:absolute; inset:0; z-index:0;
  background-image:url('/agent/welcome-bg.png'); background-size:cover; background-position:right center; background-repeat:no-repeat; }
.pw-wash { display:none; position:absolute; inset:0; z-index:0; background:var(--wash); }
.pw-card.pw-art-step .pw-art, .pw-card.pw-art-step .pw-wash { display:block; }

.pw-close { position:absolute; top:14px; right:14px; z-index:4; width:26px; height:26px; border-radius:50%;
  display:inline-flex; align-items:center; justify-content:center; background:transparent; border:0; cursor:pointer;
  color:var(--muted); transition:background 140ms ease,color 140ms ease,transform 140ms ease; }
.pw-close:hover { background:var(--row-bg); color:var(--body); }
.pw-close:active { transform:scale(0.88); }

.pw-col { position:relative; z-index:1; max-width:none; padding:40px 54px 34px; display:flex; flex-direction:column; }
.pw-card.pw-art-step .pw-col { max-width:476px; padding:46px 48px 40px; }

.pw-dots { display:flex; gap:6px; align-items:center; margin-bottom:16px; }
.pw-dot { height:6px; width:6px; border-radius:999px; background:var(--row-border); transition:all 220ms ease; }
.pw-dot.on { width:20px; background:var(--coral); }

.pw-eyebrow { font-size:11.5px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:var(--coral); }
.pw-title { margin:11px 0 0; font-size:25px; line-height:1.12; font-weight:800; letter-spacing:-0.5px; color:var(--heading); }
.pw-lede { margin:11px 0 0; font-size:14.5px; line-height:1.55; color:var(--body); }

.pw-points { list-style:none; margin:22px 0 0; padding:0; display:flex; flex-direction:column; gap:3px; }
.pw-points li { display:flex; gap:13px; align-items:flex-start; padding:11px 0; }
.pw-chip { flex-shrink:0; width:38px; height:38px; border-radius:11px; background:var(--coral-tint);
  display:inline-flex; align-items:center; justify-content:center; color:var(--coral); }
.pw-pt-t { display:block; font-size:14.5px; font-weight:700; color:var(--heading); letter-spacing:-0.2px; }
.pw-pt-d { display:block; margin-top:2px; font-size:13px; line-height:1.5; color:var(--body); }

.pw-toggles { margin:20px 0 0; display:flex; flex-direction:column; border-radius:14px; overflow:hidden; border:1px solid var(--row-border); }
.pw-trow { display:flex; gap:12px; align-items:flex-start; padding:15px; background:var(--surface); border-top:1px solid var(--row-border); }
.pw-trow:first-child { border-top:0; }
.pw-tx { flex:1; min-width:0; }
.pw-tr-t { display:block; font-size:13.8px; font-weight:700; color:var(--heading); letter-spacing:-0.2px; }
.pw-tr-d { display:block; margin-top:3px; font-size:12.5px; line-height:1.45; color:var(--body); }

.pw-switch { position:relative; height:22px; width:38px; border-radius:999px; border:0; padding:0; flex-shrink:0;
  background:var(--switch-off); cursor:pointer; transition:background 140ms ease; margin-top:2px; }
.pw-switch[aria-checked="true"] { background:var(--coral); }
.pw-knob { position:absolute; top:2px; left:2px; height:18px; width:18px; border-radius:999px; background:#fff;
  box-shadow:0 1px 3px rgba(0,0,0,0.22); transition:transform 150ms cubic-bezier(0.34,1.3,0.64,1); }
.pw-switch[aria-checked="true"] .pw-knob { transform:translateX(16px); }

.pw-footnote { margin:14px 2px 0; font-size:12px; line-height:1.5; color:var(--muted); }

.pw-ready-ico { width:56px; height:56px; border-radius:50%; background:var(--coral-tint);
  display:inline-flex; align-items:center; justify-content:center; color:var(--coral); margin:2px 0 0; }

.pw-actions { margin-top:24px; display:flex; flex-direction:column; gap:10px; }
.pw-cta { width:100%; display:flex; align-items:center; justify-content:space-between; border:0; border-radius:14px;
  cursor:pointer; padding:15px 20px; font:inherit; font-size:15px; font-weight:700; color:#fff;
  background:linear-gradient(180deg,var(--cta-from) 0%,var(--cta-to) 100%); box-shadow:0 6px 16px var(--cta-shadow);
  transition:transform 140ms ease,box-shadow 160ms ease,filter 160ms ease; }
.pw-cta:hover { transform:translateY(-1px); box-shadow:0 10px 24px var(--cta-shadow-hi); filter:saturate(1.05) brightness(1.02); }
.pw-cta:active { transform:translateY(0); }
.pw-ghost { width:100%; border:0; background:transparent; cursor:pointer; font:inherit; font-size:13.5px; font-weight:600;
  color:var(--muted); padding:8px; border-radius:10px; transition:color 140ms ease; display:inline-flex; align-items:center; justify-content:center; gap:8px; }
.pw-ghost:hover { color:var(--coral); }
.pw-linkrow { display:flex; align-items:center; justify-content:flex-start; margin-top:18px; }
.pw-back { border:0; background:transparent; cursor:pointer; font:inherit; font-size:13.5px; font-weight:600; color:var(--muted);
  padding:6px 2px; display:inline-flex; align-items:center; gap:6px; transition:color 140ms ease; }
.pw-back:hover { color:var(--body); }

@media (max-width: 767px) {
  .pw-card, .pw-card.pw-art-step { width:100%; max-width:440px; }
  .pw-art, .pw-wash, .pw-card.pw-art-step .pw-art, .pw-card.pw-art-step .pw-wash { display:none; }
  .pw-col, .pw-card.pw-art-step .pw-col { max-width:100%; padding:32px 28px 26px; }
}
@media (max-width: 460px) {
  .pw-col { padding:30px 22px 24px; }
  .pw-title { font-size:23px; }
}
`;

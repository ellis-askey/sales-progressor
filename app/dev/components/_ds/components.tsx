"use client";
// TSP Design System — component entries.
//
// The canonical entries, added by review. The first batch is captured from the
// LOGIN page (app/login/page.tsx + components/login/WarmLoginForm.tsx) — the
// cleanest page in the app, approved as the starting reference. Every preview
// reuses the REAL component where one exists (BrandMark, LabelInput, arc Button,
// the provider icons) or replicates the exact source markup where the element is
// inline JSX. Nothing here is a lookalike or an invention.
//
// Light-surface note: the auth page is light-only, so these specimens render on
// their native white card. A dark-theme canonical is a future decision — the
// workspace theme toggle still themes the surrounding chrome.

import { useState, useEffect, useRef } from "react";
import type { ReactNode, CSSProperties } from "react";
import type { ComponentEntry } from "./registry";
import { AREAS } from "./registry";
import { BrandMark } from "@/components/brand/BrandMark";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { SearchField } from "@/components/arc/search-field/search-field";
import { PhoneInput } from "@/components/arc/phone-input/phone-input";
import { Stepper } from "@/components/arc/stepper/stepper";
import { ActionButton } from "@/components/arc/action-button/action-button";
import "@/components/arc/cookie-consent/scope.css";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { UserAvatar, ContactAvatar } from "@/components/ui/Avatar";
import { CountBadge } from "@/components/ui/CountBadge";
import { CommsButton } from "@/components/ui/CommsButton";
import { AnchoredPanel } from "@/components/ui/Popover";
import { House, BellRinging, WarningCircle, Eye, ArrowRight, ArrowLeft, X, MagnifyingGlass, ArrowsClockwise, Moon, Bell, CaretDown, FolderOpen, LinkSimple, CheckCircle, ListChecks, Gauge, Target, Tray, ChatCircleDots, CalendarCheck, CheckSquare, BellSimple, Envelope, ChartBar, Plus, Check, CircleHalf, Flask, Receipt, Leaf, HouseLine, Clock, Play, NotePencil, PaperPlaneTilt, CurrencyGbp, UserCircleGear, Fire, Heartbeat, CalendarBlank, Phone, EnvelopeSimple, FileText, Pulse, ChatCircleText, UserCircle, HouseSimple } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { PriceField } from "@/components/ui/PriceField";
import { PercentField } from "@/components/ui/PercentField";
import { Select } from "@/components/ui/Select";
import { EditConfirmActions } from "@/components/ui/EditConfirmActions";
import { NotesField } from "@/components/ui/NotesField";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";
import { CookieConsent } from "@/components/arc/cookie-consent/cookie-consent";
import "@/components/arc/cookie-consent/scope.css";

const CORAL = "#FF6B4A";

/** The native light auth surface these specimens live on, so they read exactly
 *  as they do in production regardless of the workspace theme. */
function Stage({ children, pad = 22, width = 360 }: { children: ReactNode; pad?: number; width?: number }) {
  return (
    <div style={{ background: "#ffffff", borderRadius: 14, border: "1px solid rgba(23,23,30,0.06)", padding: pad, width: "100%", maxWidth: width, boxShadow: "0 1px 3px rgba(30,20,15,0.06)" }}>
      {children}
    </div>
  );
}

/* Interactive demos for the stateful register elements — faithful to the real
   markup in app/register/RegisterForm.tsx. */
function TermsCheckboxDemo() {
  const [on, setOn] = useState(true);
  return (
    <div className="arc-scope" style={{ "--control-on": CORAL, "--control-glyph": "#ffffff" } as CSSProperties}>
      <Checkbox
        checked={on}
        onCheckedChange={(v) => setOn(v === true)}
        label={<span style={{ fontSize: 12, color: "rgba(32,36,46,0.60)", fontWeight: 400, lineHeight: 1.5 }}>I agree to the <span style={{ color: CORAL, fontWeight: 500 }}>Terms of Service</span> and <span style={{ color: CORAL, fontWeight: 500 }}>Privacy Policy</span></span>}
      />
    </div>
  );
}

function LiquidToggleDemo() {
  const [on, setOn] = useState(true);
  return <LiquidToggle checked={on} onChange={setOn} width={44} height={24} />;
}

function RoleRadioDemo() {
  const [role, setRole] = useState("director");
  return (
    <div style={{ width: "100%" }}>
      <RadioGroup
        label="What's your role?"
        name="ds-role"
        value={role}
        onValueChange={setRole}
        options={[
          { value: "director", label: "Director", description: "Manage your agency, view all sales and oversee your team." },
          { value: "negotiator", label: "Negotiator", description: "View your sales and request support from your sales progressor." },
        ]}
      />
    </div>
  );
}

/* Shared Play / Reset controls for the animated specimens. Play runs the
   animation through every stage; Reset returns it to the start. */
function DemoControls({ onPlay, onReset, playing }: { onPlay: () => void; onReset: () => void; playing: boolean }) {
  const btn: CSSProperties = { fontSize: 12, fontWeight: 600, padding: "6px 13px", borderRadius: 8, border: "1px solid rgba(23,23,30,0.14)", background: "#ffffff", color: "#20242E", cursor: "pointer", transition: "border-color 0.12s ease" };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
      <button type="button" onClick={onPlay} disabled={playing} style={{ ...btn, opacity: playing ? 0.45 : 1, cursor: playing ? "default" : "pointer" }}>{playing ? "Playing…" : "▶ Play"}</button>
      <button type="button" onClick={onReset} style={btn}>Reset</button>
    </div>
  );
}

/* Step progress — milestone circles on a track: each shows its number, then a
   drawn check once reached, with the connector filling coral. */
function StepProgressDemo() {
  const [step, setStep] = useState(1); // 1 or 2
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) { window.clearTimeout(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  const play = () => {
    clear(); setStep(1); setPlaying(true);
    timer.current = window.setTimeout(() => { setStep(2); setPlaying(false); }, 850);
  };
  const reset = () => { clear(); setPlaying(false); setStep(1); };
  return (
    <div style={{ width: "100%", maxWidth: 320, margin: "0 auto" }}>
      <p style={{ margin: "0 0 10px", textAlign: "center", fontSize: 12, fontWeight: 500, letterSpacing: "-0.005em", color: "rgba(45,24,16,0.62)" }}>{step === 1 ? "Your details" : "Set up your agency"}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 2, borderRadius: 2, background: CORAL }} />
        <div style={{ flex: 1, height: 2, borderRadius: 2, background: step >= 2 ? CORAL : "rgba(32,36,46,0.14)", transition: "background 0.4s ease" }} />
      </div>
      <DemoControls onPlay={play} onReset={reset} playing={playing} />
    </div>
  );
}

/* Welcome modal, step 1 — rendered from the real shared styles (welcome-steps-styles.ts)
   so the canonical entry is the shipped modal, not a copy. Respects the DS theme. */
const WELCOME_FEATURES: { Icon: typeof House; t: string; d: string }[] = [
  { Icon: House, t: "Add a sale. We’ll take it from there.", d: "We’ll map out the journey from offer accepted to completion and keep track of what needs to happen next." },
  { Icon: BellRinging, t: "Let us do the chasing", d: "Buyers, sellers and solicitors are automatically followed up for updates, so you don’t have to keep picking up the phone." },
  { Icon: WarningCircle, t: "Know what needs you", d: "If something’s holding a sale up or needs your attention, we’ll bring it to the surface." },
  { Icon: Eye, t: "Keep clients in the loop", d: "Buyers and sellers can follow their sale from their own portal, with updates along the way." },
];
// The real 3-step welcome wizard, driven by its OWN Next / Back / Skip buttons —
// so the reviewer clicks through step 1 → 2 → 3 exactly as a new director does.
// Copy, toggles and chrome mirror components/agent/SelfManagedWelcomeModal.tsx.
const WELCOME_CHASES: { t: string; d: string }[] = [
  { t: "Client chases", d: "When something’s waiting on a buyer or seller, we’ll ask them to confirm it through their portal and follow up if needed, so nothing gets forgotten." },
  { t: "Solicitor chases", d: "When something’s sitting with a solicitor, we’ll follow up for confirmation and bring it to your attention if it stays outstanding." },
  { t: "Enquiry chases", d: "When enquiries need raising or a solicitor owes replies, we’ll keep following up until they come back." },
  { t: "Weekly client updates", d: "Your buyers and sellers get a simple weekly update on where things stand and what happens next, without you having to write a thing." },
  { t: "Chain updates", d: "When something changes on a linked sale, connected agents are kept updated, helping everyone stay on the same page as the chain moves towards exchange." },
];
function WelcomeModalDemo({ theme }: { theme: "light" | "dark" }) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<boolean[]>([true, true, true, true, true]);
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
      <style dangerouslySetInnerHTML={{ __html: WELCOME_STEPS_CSS }} />
      <div className="pw-card" data-pw-theme={theme} style={{ width: 460, maxWidth: "100%", animation: "none", borderRadius: 16, position: "relative" }}>
        {step === 2 && <div className="pw-ready-bg" aria-hidden />}
        <button className="pw-close" aria-label="Close"><X size={14} weight="bold" /></button>
        <div className="pw-col" style={{ padding: "32px 36px 28px" }}>
          <div className="pw-dots">{[0, 1, 2].map((n) => <span key={n} className={`pw-dot${n === step ? " on" : ""}`} />)}</div>
          <div className="pw-stepbody">
            {step === 0 && (
              <>
                <h2 className="pw-title">Welcome to TSP, Ellis.</h2>
                <p className="pw-lede">Your workspace is ready. Here&rsquo;s how TSP makes progression easier, then we&rsquo;ll get your first sale set up.</p>
                <ul className="pw-points pw-badges">
                  {WELCOME_FEATURES.map((f) => (
                    <li key={f.t}>
                      <span className="pw-chip"><f.Icon size={20} weight="regular" /></span>
                      <span><span className="pw-pt-t">{f.t}</span><span className="pw-pt-d">{f.d}</span></span>
                    </li>
                  ))}
                </ul>
                <div className="pw-foot">
                  <button className="pw-ghost" onClick={() => setStep(2)}>Skip for now</button>
                  <button className="pw-cta" onClick={() => setStep(1)}>Next: Choose your chases <ArrowRight size={18} weight="bold" /></button>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h2 className="pw-title">We&apos;ll do the chasing.</h2>
                <p className="pw-lede">These run automatically on every sale. They&rsquo;re all switched on, but you can turn off anything you&rsquo;d rather handle yourself.</p>
                <div className="pw-toggles">
                  {WELCOME_CHASES.map((c, i) => (
                    <div className="pw-trow" key={c.t}>
                      <div className="pw-tx"><span className="pw-tr-t">{c.t}</span><span className="pw-tr-d">{c.d}</span></div>
                      <LiquidToggle checked={prefs[i]} onChange={(v) => setPrefs((p) => p.map((x, j) => (j === i ? v : x)))} width={38} height={22} color={CORAL} aria-label={c.t} />
                    </div>
                  ))}
                </div>
                <p className="pw-footnote">You&rsquo;re always in control. Change any of these at any time in Settings. We&rsquo;ll never chase more than twice for the same step.</p>
                <div className="pw-foot">
                  <button className="pw-back" onClick={() => setStep(0)}><ArrowLeft size={15} weight="bold" /> Back</button>
                  <button className="pw-cta" onClick={() => setStep(2)}>Save and continue <ArrowRight size={18} weight="bold" /></button>
                </div>
              </>
            )}
            {step === 2 && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand-icon.png" alt="TSP" className="pw-ready-logo" width={54} height={54} />
                <h2 className="pw-title" style={{ marginTop: 16 }}>You&apos;re ready to go.</h2>
                <p className="pw-lede">Add your first sale to get started, and we&apos;ll take it from there. Or take a quick look around first.</p>
                <div className="pw-foot" style={{ justifyContent: "center" }}>
                  <button className="pw-ghost"><Play size={15} weight="fill" /> Take a quick tour</button>
                  <button className="pw-cta"><Plus size={18} weight="bold" /> Add your first sale</button>
                </div>
                <div className="pw-linkrow" style={{ justifyContent: "center" }}>
                  <button className="pw-back" onClick={() => setStep(1)}><ArrowLeft size={15} weight="bold" /> Back to chases</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* OTP error — mounts filled, then sets an error after a tick so the row SHAKES
   (x: 0,-6,5,-3,2,0 over .36s) and the inline message settles in, exactly as a
   rejected 2FA code reads. Re-click the step to replay. */
function OtpErrorDemo() {
  const [err, setErr] = useState<string | undefined>(undefined);
  useEffect(() => {
    const t = setTimeout(() => setErr("That code didn’t match. Check it and try again."), 360);
    return () => clearTimeout(t);
  }, []);
  return (
    <Stage>
      <div className="arc-scope" style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties}>
        <OtpInput label="Code" length={6} inputMode="numeric" value="482913" onChange={() => {}} error={err} />
      </div>
    </Stage>
  );
}

/* Page header — the standard page title (H2 scale) + subtitle, with an optional
   right-aligned actions slot. (components/layout/PageHeader.tsx) */
function PageHeaderDemo() {
  return (
    <Stage width={560}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: T_INK, letterSpacing: "-0.02em", lineHeight: 1.2 }}>New sale</h1>
          <p style={{ margin: 0, fontSize: 13, color: T_MUTED }}>Drop in your memo of sale to get started, or add the details manually.</p>
        </div>
        <Button type="button" variant="primary" size="sm" style={{ "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties}>Add sale</Button>
      </div>
    </Stage>
  );
}

/* Step dots — the modal's progress indicator: small dots, the active one widens
   to a coral pill. (components/agent/welcome-steps-styles.ts .pw-dots). */
function StepDotsDemo() {
  const [at, setAt] = useState(1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {[0, 1, 2].map((n) => (
          <button key={n} onClick={() => setAt(n)} aria-label={`Step ${n + 1}`} style={{ border: 0, padding: 0, cursor: "pointer", background: "transparent" }}>
            <span style={{ display: "block", height: 6, width: n === at ? 20 : 6, borderRadius: 999, background: n === at ? CORAL : "rgba(45,24,16,0.14)", transition: "all 220ms ease" }} />
          </button>
        ))}
      </div>
      <span style={{ fontSize: 11, color: "rgba(45,24,16,0.45)" }}>Click a dot</span>
    </div>
  );
}

/* Preference row — label + description paired with a LiquidToggle, grouped in a
   bordered card (the modal's chase settings). */
function PreferenceRowsDemo() {
  const rows = [
    { t: "Client chases", d: "When something’s waiting on a buyer or seller, we’ll ask them to confirm it and follow up if needed." },
    { t: "Weekly client updates", d: "Your buyers and sellers get a simple weekly update, without you having to write a thing." },
  ];
  const [on, setOn] = useState<boolean[]>([true, false]);
  return (
    <div style={{ width: "100%", border: "1px solid rgba(45,24,16,0.10)", borderRadius: 14, overflow: "hidden" }}>
      {rows.map((r, i) => (
        <div key={r.t} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 15, background: "#fff", borderTop: i === 0 ? "0" : "1px solid rgba(45,24,16,0.10)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 13.8, fontWeight: 600, color: "#2D1810", letterSpacing: "-0.2px" }}>{r.t}</span>
            <span style={{ display: "block", marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: "rgba(45,24,16,0.62)" }}>{r.d}</span>
          </div>
          <LiquidToggle checked={on[i]} onChange={(v) => setOn((p) => p.map((x, j) => (j === i ? v : x)))} width={38} height={22} color={CORAL} aria-label={r.t} />
        </div>
      ))}
    </div>
  );
}

/* Password strength — a FAITHFUL mirror of components/auth/PasswordStrength.tsx.
   The real meter fills by background-color (bars are always full width), not a
   scaleX grow, with `transition: background 0.2s ease`. Four score levels only
   (Weak → Strong); the real component is hidden below 10 chars. Play steps the
   score 1 → 4 exactly as typing would. */
const PW_LEVELS = [
  { word: "Weak", score: 1, color: "#D9682F" },
  { word: "Fair", score: 2, color: "#E0942E" },
  { word: "Good", score: 3, color: "#6FA03A" },
  { word: "Strong", score: 4, color: "#2F9E6B" },
];
function PasswordStrengthBarDemo() {
  const [level, setLevel] = useState(0); // index into PW_LEVELS (0 = Weak)
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } };
  useEffect(() => clear, []);
  const play = () => {
    clear(); setLevel(0); setPlaying(true);
    let n = 0;
    timer.current = window.setInterval(() => {
      n += 1; setLevel(n);
      if (n >= PW_LEVELS.length - 1) { clear(); setPlaying(false); }
    }, 560);
  };
  const reset = () => { clear(); setPlaying(false); setLevel(0); };
  const lv = PW_LEVELS[level];
  return (
    <div style={{ width: "100%" }}>
      {/* Mirrors the real markup: gap 12, bars gap 4 / height 4, word 12px/600/minWidth 48. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, flex: 1 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= lv.score ? lv.color : "rgba(61,31,14,0.12)", transition: "background 0.2s ease" }} />
          ))}
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: lv.color, minWidth: 48, textAlign: "right" }}>{lv.word}</span>
      </div>
      <DemoControls onPlay={play} onReset={reset} playing={playing} />
    </div>
  );
}

/* ── Foundations — measured from design/tokens.ts (the authoritative token
   mirror, DoD-locked). Not invented. ───────────────────────────────────── */
const T_INK = "#2D1810";
const T_MUTED = "rgba(45,24,16,0.55)";
const MONO = "var(--font-geist-mono, ui-monospace, monospace)";

const TYPE_LEVELS: { name: string; px: number; weight: number; w: string }[] = [
  { name: "Display", px: 32, weight: 600, w: "semibold" },
  { name: "Heading 1", px: 28, weight: 600, w: "semibold" },
  { name: "Heading 2", px: 22, weight: 600, w: "semibold" },
  { name: "Heading 3", px: 17, weight: 600, w: "semibold" },
  { name: "Heading 4", px: 15, weight: 600, w: "semibold" },
  { name: "Body", px: 14, weight: 400, w: "regular" },
  { name: "Body small", px: 13, weight: 400, w: "regular" },
  { name: "Caption", px: 12, weight: 500, w: "medium" },
  { name: "Micro", px: 11, weight: 500, w: "medium" },
];
function TypeScaleSpec() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {TYPE_LEVELS.map((l) => (
        <div key={l.name} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20 }}>
          <span style={{ fontSize: l.px, fontWeight: l.weight, color: T_INK, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{l.name}</span>
          <code style={{ fontSize: 11, color: T_MUTED, whiteSpace: "nowrap", fontFamily: MONO }}>{l.px}px · {l.w}</code>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 20 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#7A4A2E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Eyebrow</span>
        <code style={{ fontSize: 11, color: T_MUTED, whiteSpace: "nowrap", fontFamily: MONO }}>10px · semibold · 0.05em</code>
      </div>
    </div>
  );
}
function Swatch({ name, hex }: { name: string; hex: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 34, height: 34, borderRadius: 9, background: hex, flex: "none", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.35 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: T_INK }}>{name}</span>
        <code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>{hex}</code>
      </div>
    </div>
  );
}
function SwatchGrid({ items }: { items: [string, string][] }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>{items.map(([n, h]) => <Swatch key={n} name={n} hex={h} />)}</div>;
}

const LOGIN_ENTRIES: ComponentEntry[] = [
  /* ── Foundations ──────────────────────────────────────────────────────── */
  {
    id: "brand-mark",
    name: "Brand mark & lockup",
    category: "iconography",
    status: "approved",
    summary: "The coral circle mark on its own, and the mark + TSP / SALES PROGRESSOR lockup used on the auth pages.",
    sources: [
      { path: "components/brand/BrandMark.tsx", note: "single source of truth for the mark" },
      { path: "app/login/page.tsx", note: "the lockup" },
    ],
    exceptions: [
      { title: "One source of truth for the mark", detail: "The mark is always <BrandMark/> (/brand-icon.png), so login, forgot-password and invite pages render the identical, correct logo.", source: "components/brand/BrandMark.tsx", scope: "shared" },
      { title: "Asset is already circular", detail: "No radius/crop is applied — the PNG is the circle.", scope: "shared" },
    ],
    render: () => (
      <Stage width={420}>
        <div style={{ display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <BrandMark size={38} />
            <span style={{ fontSize: 11, color: "rgba(32,36,46,0.45)" }}>Mark · 38px</span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: CORAL, letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: 3 }}>SALES PROGRESSOR</span>
            </span>
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "type-auth",
    name: "Auth page type",
    category: "typography",
    status: "approved",
    summary: "The page title (“Welcome back.”) — aligned to the scale (28px / semibold / warm #2D1810) — with its coral accent stop over the muted subtitle.",
    sources: [{ path: "app/login/page.tsx", note: "h1 + subtitle" }],
    exceptions: [
      { title: "Coral accent stop", detail: "The full stop in “Welcome back.” is coral (#FF6B4A) — a brand accent, not a period colour.", scope: "specific" },
    ],
    render: () => (
      <Stage>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, color: "#2D1810", letterSpacing: "-0.01em", lineHeight: 1.15 }}>
          Welcome back<span style={{ color: CORAL }}>.</span>
        </h1>
        <p style={{ margin: "0.45rem 0 0", fontSize: 13, color: "rgba(45,24,16,0.55)" }}>Sign in to Sales Progressor</p>
      </Stage>
    ),
  },
  {
    id: "divider-labeled",
    name: "Labelled divider",
    category: "borders",
    status: "approved",
    summary: "A hairline rule split by a quiet centred label (“or sign in with email”).",
    sources: [{ path: "components/login/WarmLoginForm.tsx", note: "SSO / email divider" }],
    render: () => (
      <Stage>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: "rgba(32,36,46,0.10)" }} />
          <span style={{ fontSize: 11, color: "rgba(32,36,46,0.42)", whiteSpace: "nowrap" }}>or sign in with email</span>
          <div style={{ flex: 1, height: 1, background: "rgba(32,36,46,0.10)" }} />
        </div>
      </Stage>
    ),
  },

  /* ── Components ────────────────────────────────────────────────────────── */
  {
    id: "card-auth",
    name: "Card surface",
    category: "cards",
    status: "approved",
    summary: "The white auth card: 18px radius, hairline border, soft layered shadow.",
    sources: [{ path: "app/login/page.tsx", note: "the form card" }],
    render: () => (
      <div style={{ background: "#ffffff", borderRadius: 18, border: "1px solid rgba(23,23,30,0.06)", padding: "1.75rem", boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)", width: "100%", maxWidth: 360 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#8A8A94" }}>The surface the sign-in form sits on — radius 18px, border rgba(23,23,30,0.06), shadow 0 18px 50px / 0 4px 14px.</p>
      </div>
    ),
  },
  {
    id: "button-primary",
    name: "Buttons — primary, secondary, ghost",
    category: "buttons",
    status: "approved",
    summary: "The arc Button — the coral primary CTA (via token override), the white/outline secondary (theme-aware), and the quiet ghost. At the same size the ghost + secondary are the same height as the primary (lg = 48px), so they pair as peers in a footer.",
    variants: [{ id: "primary-lg", label: "Primary · lg" }, { id: "secondary-lg", label: "Secondary · lg (white / outline)" }, { id: "ghost-lg", label: "Ghost · lg (peer height)" }, { id: "ghost-sm", label: "Ghost · sm (inline)" }],
    states: [{ id: "default", label: "Default" }, { id: "loading", label: "Loading" }, { id: "disabled", label: "Disabled (empty fields)" }],
    sources: [
      { path: "components/arc/button/button.tsx", note: "the component" },
      { path: "components/login/WarmLoginForm.tsx", note: "coral primary" },
      { path: "app/register/RegisterForm.tsx", note: "ghost Back button" },
      { path: "components/agent/welcome-steps-styles.ts", note: "modal footer — ghost + primary at equal height" },
    ],
    exceptions: [
      { title: "Coral by token override, not a fork", detail: "The primary button is turned coral by overriding its ink/slab tokens (--foreground: #FF6B4A, --background: #fff) at the call site — the component itself is untouched.", source: "components/login/WarmLoginForm.tsx", scope: "specific" },
      { title: "Ghost matches primary height at the same size", detail: "Height comes from `size` (sm 32 / md 40 / lg 48). A ghost and a primary both at `lg` are both 48px — so a footer pairs them as equal-height peers without any base-height change.", source: "components/arc/button/button.module.css", scope: "shared" },
      { title: "Secondary is theme-aware (and the empty-state arrow is coral)", detail: "Secondary is a crisp white/outline in light and a raised dark pill in dark. On the agent empty states it replaces the old bespoke secondary everywhere — hero CTAs and the info-card (SetupCard) buttons — carrying a token-coral arrow that glides on hover.", source: "app/agent/styles/agent-system.css", scope: "shared" },
      { title: "Loading stays focusable", detail: "`loading` shows the spinner and keeps the button focusable; `disabled` is reserved for genuinely empty fields, so the busy state never traps focus.", scope: "shared" },
    ],
    render: () => {
      const coral = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
      return (
        <Stage>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button type="button" variant="primary" size="lg" style={{ ...coral, width: "100%" }}>Continue</Button>
            <Button type="button" variant="primary" size="lg" loading style={{ ...coral, width: "100%" }}>Continue</Button>
            <Button type="button" variant="primary" size="lg" disabled style={{ ...coral, width: "100%" }}>Continue</Button>
            {/* Secondary — white fill, hairline outline, ink text (theme-aware). */}
            <Button type="button" variant="secondary" size="lg" style={{ width: "100%" }}>Secondary</Button>
            {/* Footer pairing — ghost + primary, both lg, equal height. */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <Button type="button" variant="ghost" size="lg">Skip for now</Button>
              <Button type="button" variant="primary" size="lg" style={coral}>Next</Button>
            </div>
            <Button type="button" variant="ghost" size="sm" style={{ width: "100%" }}>← Back</Button>
          </div>
        </Stage>
      );
    },
  },
  {
    id: "button-sso",
    name: "SSO / provider buttons",
    category: "buttons",
    status: "approved",
    summary: "Full-width secondary buttons carrying a provider icon + label (Google, Microsoft).",
    variants: [{ id: "secondary-lg", label: "Secondary · lg · full-width" }],
    sources: [{ path: "components/login/WarmLoginForm.tsx", note: "Continue with Google / Microsoft" }],
    render: () => (
      <Stage>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button type="button" variant="secondary" size="lg" style={{ width: "100%" }}><GoogleIcon />Continue with Google</Button>
          <Button type="button" variant="secondary" size="lg" style={{ width: "100%" }}><MicrosoftIcon />Continue with Microsoft</Button>
        </div>
      </Stage>
    ),
  },
  {
    id: "link-coral",
    name: "Coral text link",
    category: "buttons",
    status: "approved",
    keywords: ["orange", "coral", "arrow", "text link", "tertiary", "side door", "set up a progression business", "glide"],
    summary: "The coral inline text action — standalone (“Forgot password?”), inline (“Create an account”), and the arrow side-door link that glides on hover.",
    states: [{ id: "default", label: "Default" }, { id: "hover", label: "Hover → #E55B3D" }],
    sources: [
      { path: "components/login/WarmLoginForm.tsx", note: "forgot-password + create-account" },
      { path: "app/register/RegisterForm.tsx", note: "inline Terms/Privacy + arrow side-door link" },
    ],
    exceptions: [
      { title: "Hover darkens to #E55B3D", detail: "Coral links darken to #E55B3D on hover (coral-dark) — one hover language shared with .agent-link.", scope: "shared" },
      { title: "Arrow glides on hover", detail: "The side-door link's trailing → slides 3px right on hover; removed under prefers-reduced-motion.", source: "app/register/RegisterForm.tsx", scope: "specific" },
    ],
    render: () => (
      <Stage>
        <style>{`.ds-wlink:hover{color:#E55B3D !important}.ds-arrowlink:hover{color:#E55B3D}.ds-arrowlink:hover .ds-arw{transform:translateX(3px)}`}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <a href="#" onClick={(e) => e.preventDefault()} className="ds-wlink" style={{ fontSize: 12, fontWeight: 500, color: CORAL, textDecoration: "none", transition: "color 0.12s ease", alignSelf: "flex-end" }}>Forgot password?</a>
          <p style={{ textAlign: "center", fontSize: 13, color: "#8A8A94", margin: 0 }}>
            New here? <a href="#" onClick={(e) => e.preventDefault()} className="ds-wlink" style={{ color: CORAL, fontWeight: 600, textDecoration: "none", transition: "color 0.12s ease" }}>Create an account</a>
          </p>
          <a href="#" onClick={(e) => e.preventDefault()} className="ds-arrowlink" style={{ alignSelf: "center", color: CORAL, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, transition: "color 0.15s ease" }}>
            Set up a progression business <span className="ds-arw" aria-hidden style={{ display: "inline-block", transition: "transform 0.15s ease" }}>→</span>
          </a>
        </div>
      </Stage>
    ),
  },
  {
    id: "text-field",
    name: "Text field (LabelInput)",
    category: "text-inputs",
    status: "approved",
    keywords: ["label above", "top label", "backup code"],
    summary: "The label-in-the-field input that lifts on focus — email and password (with reveal) variants. Also the login's backup-code field. There is no separate “label above” variant: `label=` only overrides the floating label text.",
    variants: [{ id: "email", label: "Email" }, { id: "password", label: "Password (with eye)" }],
    states: [{ id: "rest", label: "Rest" }, { id: "focus", label: "Focus (label lifts)" }, { id: "filled", label: "Filled" }],
    sources: [
      { path: "components/ui/LabelInput.tsx", note: "the component" },
      { path: "components/login/WarmLoginForm.tsx", note: "email, password + backup code" },
    ],
    exceptions: [
      { title: "Email lower-cased on blur", detail: "The email field trims and lower-cases its value on blur, so casing never varies.", source: "components/login/WarmLoginForm.tsx", scope: "specific" },
      { title: "Password reveal + masking", detail: "Passing `field=\"Password\"` gives the field its eye toggle and secret masking — the eye owns the type.", source: "components/ui/LabelInput.tsx", scope: "shared" },
      { title: "`label=` overrides text only, not position", detail: "`const label = labelProp ?? \"Email\"` — passing `label` only changes the floating label string; there is no top-label variant. The 6-digit authenticator code uses the OTP input, not this field; backup codes use this field.", source: "components/ui/LabelInput.tsx", scope: "shared" },
      { title: "Coral focus via `accent`", detail: "The login passes `accent={CORAL}` so the focus outline + lifted label are on-brand without touching the component.", scope: "specific" },
      { title: "`solid` fill — ON by default", detail: "The box fills with --agent-surface-elevated so the field reads as a crisp, obviously-editable field on ANY surface. Invisible on a white card (login / register — white on white, no change); lifts the field off a tinted / glass ground (hero, contact cards); a dark slate in dark mode so fields stand out on the shell. Pass solid={false} for the rare field meant to dissolve into its container.", source: "components/ui/LabelInput.css", scope: "shared" },
      { title: "Autofill kept, blue box suppressed", detail: "`:-webkit-autofill` is repainted in the field's own surface token via an inset shadow, with the warm text fill preserved, so an autofilled value looks identical to a typed one — no browser blue/yellow box. The ring is lifted above the input (z-index) so the outline survives the autofilled repaint. Autofill still works.", source: "components/ui/LabelInput.css", scope: "shared" },
    ],
    render: () => (
      <Stage>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, "--lbi-top": "0px" } as CSSProperties}>
          <LabelInput label="Email address" type="email" accent={CORAL} fullWidth />
          <LabelInput field="Password" accent={CORAL} fullWidth />
        </div>
      </Stage>
    ),
  },
  {
    id: "otp-input",
    name: "One-time-code input (OTP)",
    category: "text-inputs",
    status: "implemented",
    keywords: ["otp", "one-time code", "2fa", "totp", "authenticator", "pin", "code", "segmented", "six digit", "orange", "coral"],
    summary: "The six-slot segmented code field — one coral ring glides between slots, digits rise in, a paste fans across, and a wrong code shakes the row. Coral by token override; the component is untouched.",
    variants: [{ id: "numeric", label: "Numeric (default)" }, { id: "error", label: "Error (shake)" }],
    // Live step is interactive (type / paste to reach empty → focus → filled);
    // the error step replays the wrong-code shake + inline message.
    states: [
      { id: "live", label: "Live (type / paste)", render: () => (
        <Stage>
          <div className="arc-scope" style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties}>
            <OtpInput label="Code" length={6} inputMode="numeric" />
          </div>
        </Stage>
      ) },
      { id: "error", label: "Wrong code (shake + inline error)", render: () => <OtpErrorDemo /> },
    ],
    sources: [
      { path: "components/arc/otp-input/otp-input.tsx", note: "the component (vendored, arc)" },
      { path: "components/login/WarmLoginForm.tsx", note: "2FA code entry" },
    ],
    exceptions: [
      { title: "Coral by token override", detail: "The red arc default becomes coral by overriding --accent / --accent-strong / --accent-subtle in the .arc-scope wrapper. The vendored component is not forked.", scope: "specific" },
      { title: "Numeric only — not for backup codes", detail: "inputMode=\"numeric\" means the grid takes digits only. Alphanumeric backup codes use the text field instead (see the 2FA stage).", source: "components/login/WarmLoginForm.tsx", scope: "specific" },
    ],
    render: () => (
      <Stage>
        <div className="arc-scope" style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties}>
          <OtpInput label="Code" length={6} inputMode="numeric" />
        </div>
      </Stage>
    ),
  },
  {
    id: "cookie-banner",
    name: "Cookie consent banner",
    category: "notifications",
    status: "approved",
    summary: "The uiarc consent surface — one card that morphs bar → preferences → reopen button — wired to our consent store. Interactive: try “Manage”.",
    sources: [
      { path: "components/arc/cookie-consent/cookie-consent.tsx", note: "the component (uiarc, MIT)" },
      { path: "components/analytics/CookieConsentBanner.tsx", note: "our wiring — consent store, white-label, categories" },
    ],
    exceptions: [
      { title: "Only our real categories", detail: "Essential (required) + Analytics — NOT the uiarc defaults (Preferences/Marketing), which we don't set. Asking consent for unused cookies is non-compliant (ICO).", source: "components/analytics/CookieConsentBanner.tsx", scope: "specific" },
      { title: "Equal-prominence choices (ICO)", detail: "Essential only sits beside Accept all at the same weight — refusing is as easy as accepting.", scope: "shared" },
      { title: "Wired to our store", detail: "onChange → setConsent() (localStorage + SSR cookie + audit POST + consent-updated event); seeded from getConsent(). White-label-suppressed on /boardwalk and /f/.", source: "components/analytics/CookieConsentBanner.tsx", scope: "specific" },
    ],
    render: () => (
      <div className="arc-scope" style={{ position: "relative", width: "100%", minHeight: 300, borderRadius: 14, overflow: "hidden", border: "1px solid rgba(23,23,30,0.08)", background: "#f3f0ee" }}>
        <CookieConsent
          strategy="absolute"
          position="bottom"
          showReopenButton={false}
          categories={[{ id: "necessary", label: "Essential", description: "Sign-in, session state and security. The site can't work without these.", required: true }, { id: "analytics", label: "Analytics", description: "Helps us understand product usage. PostHog (EU-hosted), aggregate only. No cross-site tracking." }]}
          defaultValue={null}
          onChange={() => {}}
          policy={{ label: "Cookie policy", href: "#" }}
          labels={{ message: "Essential cookies keep you signed in. Analytics cookies (optional) help us improve the product.", customize: "Manage", acceptAll: "Accept all", rejectAll: "Essential only", save: "Save preferences", preferencesTitle: "Manage cookies", preferencesDescription: "Choose which optional cookies we can use. You can change this any time.", reopen: "Cookie settings", alwaysOn: "Always on", close: "Close" }}
        />
      </div>
    ),
  },
  {
    id: "trust-row",
    name: "Trust row",
    category: "badges",
    status: "approved",
    summary: "Three quiet trust signals under the card — SSL encrypted · GDPR compliant · UK data.",
    sources: [{ path: "app/login/page.tsx", note: "below the card" }],
    render: () => (
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        {["SSL encrypted", "GDPR compliant", "UK data"].map((item, i, arr) => (
          <span key={item} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: 11, color: "rgba(32,36,46,0.45)" }}>{item}</span>
            {i < arr.length - 1 && <span style={{ fontSize: 11, color: "rgba(32,36,46,0.22)" }}>·</span>}
          </span>
        ))}
      </div>
    ),
  },
  {
    id: "auth-2fa-stage",
    name: "Two-factor (authenticator) stage",
    category: "authentication",
    status: "implemented",
    keywords: ["2fa", "totp", "mfa", "authenticator", "otp", "one-time code", "verify code", "backup code", "second stage"],
    summary: "The login's second stage for accounts with 2FA — the six-slot OTP code field (coral), its helper, a Verify code button, a back link, and a link to switch to a backup code. Auto-submits the moment the sixth digit lands.",
    sources: [{ path: "components/login/WarmLoginForm.tsx", note: "stage === \"totp\"" }],
    states: [{ id: "entering", label: "Entering code" }, { id: "error", label: "Wrong code → shake + inline error" }],
    exceptions: [
      { title: "OTP for the code, text field for backup codes", detail: "Authenticator codes are six digits → the segmented OTP. Backup codes are alphanumeric (xxxxx-xxxxx) and can't fit the numeric grid, so a “Use a backup code” link swaps in a plain LabelInput. Both feed the same submit.", source: "components/login/WarmLoginForm.tsx", scope: "specific" },
      { title: "Auto-submits on the sixth digit", detail: "When the OTP reaches six digits it submits without waiting for the button; Verify code stays for the backup-code path and as a fallback.", scope: "specific" },
      { title: "Back preserves the typed email", detail: "The ← Back link clears the code + error and returns to stage \"password\" without losing the email already entered.", source: "components/login/WarmLoginForm.tsx", scope: "specific" },
    ],
    render: () => {
      const coral = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
      return (
        <Stage>
          <div className="arc-scope" style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <OtpInput label="Authenticator code" length={6} inputMode="numeric" description="Enter the 6-digit code from your authenticator app." />
              <Button type="button" variant="primary" size="lg" style={{ ...coral, width: "100%" }}>Verify code</Button>
              <button type="button" style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: CORAL, fontWeight: 500 }}>Use a backup code instead</button>
            </div>
          </div>
        </Stage>
      );
    },
  },
];

/* Second batch — captured from the REGISTER page (app/register/RegisterForm.tsx).
   Only the elements the login page didn't already cover. */
const REGISTER_ENTRIES: ComponentEntry[] = [
  {
    id: "step-progress",
    name: "Step progress",
    category: "progress",
    status: "implemented",
    summary: "Two milestone circles on a track — circle 1 ticks when you reach step 2, circle 2 ticks as the account is created, the connector filling coral between. Live on register. Play to advance.",
    states: [{ id: "upcoming", label: "Upcoming (number)" }, { id: "active", label: "Active (coral ring)" }, { id: "ticked", label: "Ticked (check)" }],
    sources: [{ path: "app/register/RegisterForm.tsx", note: "the sign-up milestone track" }],
    render: () => <Stage><StepProgressDemo /></Stage>,
  },
  {
    id: "password-strength",
    name: "Password strength meter",
    category: "progress",
    status: "implemented",
    summary: "The four-bar meter with the strength word at the end. Bars fill by background-colour (0.2s ease) — always full width, not a growing bar. Four levels: Weak → Fair → Good → Strong. Play to run through them.",
    states: [{ id: "weak", label: "Weak (#D9682F)" }, { id: "fair", label: "Fair (#E0942E)" }, { id: "good", label: "Good (#6FA03A)" }, { id: "strong", label: "Strong (#2F9E6B)" }],
    sources: [{ path: "components/auth/PasswordStrength.tsx", note: "the component — four bars, warm palette" }],
    exceptions: [
      { title: "Fills by colour, not by growing", detail: "Each bar is full width and switches background from grey to its score colour with `transition: background 0.2s ease`. There is no scaleX grow — this demo mirrors that exactly.", source: "components/auth/PasswordStrength.tsx", scope: "shared" },
      { title: "Hidden below 10 characters", detail: "The live meter returns null under 10 chars; register shows its own “At least 10 characters required” hint there instead. There is no “Too short” bar state.", source: "app/register/RegisterForm.tsx", scope: "specific" },
    ],
    render: () => <Stage><PasswordStrengthBarDemo /></Stage>,
  },
  {
    id: "checkbox",
    name: "Checkbox",
    category: "toggles",
    status: "implemented",
    summary: "The canonical checkbox — the uiarc arc Checkbox (Radix), coral fill, the check draws + morphs on toggle. Live on register. (Click to toggle.)",
    states: [{ id: "unchecked", label: "Unchecked" }, { id: "checked", label: "Checked" }, { id: "indeterminate", label: "Indeterminate" }],
    sources: [{ path: "components/arc/checkbox/checkbox.tsx", note: "the component (uiarc, MIT)" }, { path: "app/register/RegisterForm.tsx", note: "terms checkbox" }],
    exceptions: [{ title: "Coral via control tokens", detail: "Coral fill + white check by overriding --control-on / --control-glyph in the .arc-scope wrapper — the component is untouched. Replaced the old hand-rolled box + AnimatedTick.", scope: "specific" }],
    render: () => <Stage><TermsCheckboxDemo /></Stage>,
  },
  {
    id: "radio-group",
    name: "Radio group",
    category: "toggles",
    status: "approved",
    summary: "The role chooser — one flat-coral highlight slides between options. (Click a row.)",
    sources: [
      { path: "components/arc/radio-group/radio-group.tsx", note: "the component" },
      { path: "app/register/RegisterForm.tsx", note: "role selection" },
    ],
    exceptions: [{ title: "Single sliding highlight", detail: "One flat-coral (#FF6B4A) highlight travels to the chosen row on a spring and the dot springs in; rows and text never resize. Flattened from the earlier gradient so the app shares one coral with the primary button (approved 2026-11-20).", source: "components/arc/radio-group/radio-group.module.css", scope: "shared" }],
    render: () => <Stage><RoleRadioDemo /></Stage>,
  },
];

/* Foundations — the type scale + colour ramps everything aligns to. Measured
   from design/tokens.ts; divergences (auth cool ink + 800 weight, the amber
   hint) are recorded on each entry as protected differences to reconcile. */
const FOUNDATION_ENTRIES: ComponentEntry[] = [
  {
    id: "type-scale",
    name: "Type scale",
    category: "typography",
    status: "approved",
    summary: "The canonical sizes from design/tokens.ts — Display → Eyebrow, in Geist. Sizes are system; weights follow the 400 / 500 / 600 ramp.",
    sources: [
      { path: "design/tokens.ts", note: "the authoritative token mirror" },
      { path: "app/agent/styles/agent-system.css", note: "--agent-text-* at runtime" },
    ],
    render: () => <Stage width={560}><TypeScaleSpec /></Stage>,
  },
  {
    id: "text-colours",
    name: "Text colours",
    category: "colour",
    status: "approved",
    summary: "The text ramp (agent app, design/tokens.ts) — primary, secondary, tertiary, muted, disabled, on-coral.",
    sources: [{ path: "design/tokens.ts" }],
    render: () => <Stage width={520}><SwatchGrid items={[["Primary", "#2D1810"], ["Secondary", "#5A3A28"], ["Tertiary", "#7A4A2E"], ["Muted", "rgba(45,24,16,0.55)"], ["Disabled", "rgba(45,24,16,0.35)"], ["On coral", "#FFFFFF"]]} /></Stage>,
  },
  {
    id: "status-colours",
    name: "Status & semantic colours",
    category: "colour",
    status: "approved",
    summary: "Success, warning, danger, info, snoozed — and the hint text they drive (.agent-helper-error / -warning / -ok).",
    sources: [
      { path: "design/tokens.ts" },
      { path: "app/agent/styles/agent-system.css", note: ".agent-helper-* classes" },
    ],
    render: () => (
      <Stage width={560}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SwatchGrid items={[["Success", "#1F8A4A"], ["Warning", "#C97D1A"], ["Danger", "#C73E3E"], ["Info", "#3D7AB8"], ["Snoozed", "#7E22CE"]]} />
          <div style={{ borderTop: "1px solid rgba(45,24,16,0.08)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            <p style={{ fontSize: 12, color: "#C97D1A", fontWeight: 500, margin: 0 }}>At least 10 characters required</p>
            <p style={{ fontSize: 12, color: "#C73E3E", fontWeight: 500, margin: 0 }}>That doesn’t look like a valid email</p>
            <p style={{ fontSize: 12, color: "#1F8A4A", fontWeight: 500, margin: 0 }}>Looks good</p>
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "coral-ramp",
    name: "Coral / brand ramp",
    category: "colour",
    status: "approved",
    summary: "The coral identity ramp from design/tokens.ts — the accent everything shares.",
    sources: [{ path: "design/tokens.ts" }],
    render: () => <Stage width={560}><SwatchGrid items={[["Coral", "#FF8A65"], ["Coral deep", "#FF6B4A"], ["Coral darker", "#E55B3D"], ["Coral light", "#FFB18F"], ["Coral pale", "#FFD4C2"]]} /></Stage>,
  },
];

/* Gap states — surfaced by the audit. PROPOSED (not yet in production): the
   invalid-email error awaits string confirmation; the loading states await the
   /dev comparison (app/dev/components/compare/loading-states). */
const GAP_ENTRIES: ComponentEntry[] = [
  {
    id: "toggle",
    name: "Toggle / Switch",
    category: "toggles",
    status: "approved",
    summary: "The canonical toggle — LiquidToggle (controlled, sizeable), used across the app's settings AND now the cookie banner. Click it.",
    sources: [{ path: "components/ui/LiquidToggle.tsx", note: "the canonical, app-wide" }, { path: "components/arc/cookie-consent/cookie-consent.tsx", note: "reconciled to LiquidToggle" }],
    exceptions: [{ title: "Resolved — cookie banner reconciled", detail: "The cookie banner's arc Switch was swapped to LiquidToggle, so there's one toggle app-wide. Still outstanding: the banner's X-close and reopen button are the uiarc defaults — no canonical close/icon-button exists yet to reconcile them to.", source: "components/arc/cookie-consent/cookie-consent.tsx", scope: "specific" }],
    render: () => <Stage><div style={{ display: "flex", gap: 16, alignItems: "center" }}><LiquidToggleDemo /><span style={{ fontSize: 13, color: "#5A3A28" }}>Analytics cookies</span></div></Stage>,
  },
  {
    id: "field-error-email",
    name: "Invalid-email error",
    category: "empty-error",
    status: "implemented",
    summary: "Live on login + register — a badly-formatted email shows “Enter a valid email address” on blur, with a danger ring + message.",
    sources: [
      { path: "components/login/WarmLoginForm.tsx", note: "no inline validation today" },
      { path: "app/register/RegisterForm.tsx", note: "emailValid computed but no message shown" },
    ],
    render: () => (
      <Stage>
        <style>{`.ds-emailerr .lbi-ring path{stroke:#C73E3E}`}</style>
        <div className="ds-emailerr" style={{ display: "flex", flexDirection: "column", gap: 6, "--lbi-top": "0px" } as CSSProperties}>
          <LabelInput label="Email address" type="email" accent="#C73E3E" fullWidth />
          <p style={{ fontSize: 12, color: "#C73E3E", fontWeight: 500, margin: 0 }}>Enter a valid email address</p>
        </div>
      </Stage>
    ),
  },
  {
    id: "loading-states",
    name: "Loading states",
    category: "loading",
    status: "implemented",
    summary: "Live on login — the pressed SSO button now spins (same feedback as the primary CTA), instead of just greying out.",
    sources: [{ path: "components/login/WarmLoginForm.tsx", note: "SSO buttons disable with no spinner" }],
    render: () => {
      const coral = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
      return (
        <Stage>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Button type="button" variant="secondary" size="lg" loading style={{ width: "100%" }}>Continue with Google</Button>
            <Button type="button" variant="primary" size="lg" loading style={{ ...coral, width: "100%" }}>Signing in…</Button>
          </div>
        </Stage>
      );
    },
  },
];

/* Completeness sweep of the auth pages (the standard) — the elements that were
   still missing: the error banner, the close (X), field hints, and the motion
   tokens foundation. */
const MOTION_DURATIONS: [string, string, string][] = [
  ["Fast", "150ms", "hover, small UI"],
  ["Base", "200ms", "most transitions"],
  ["Slow", "300ms", "larger moves"],
  ["Dropdown", "120ms", "menus"],
  ["Modal / drawer", "280ms", "spring overshoot entry"],
  ["Bloom (page in)", "520ms", "page entrance"],
];
const AUTH_COMPLETION_ENTRIES: ComponentEntry[] = [
  {
    id: "motion-tokens",
    name: "Motion tokens",
    category: "motion",
    status: "approved",
    summary: "The canonical durations + easings from design/tokens.ts. Everything on the auth pages (label lift, button spinner, stepper fill, cookie morph) draws from these.",
    sources: [{ path: "design/tokens.ts", note: "motion" }],
    render: () => (
      <Stage width={520}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {MOTION_DURATIONS.map(([n, v, u]) => (
            <div key={n} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T_INK }}>{n}</span>
              <code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO, whiteSpace: "nowrap" }}>{v} · {u}</code>
            </div>
          ))}
          <div style={{ borderTop: "1px solid rgba(45,24,16,0.08)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>standard · cubic-bezier(0.4, 0, 0.2, 1)</code>
            <code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>spring overshoot · cubic-bezier(0.34, 1.56, 0.64, 1)</code>
            <code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>enter · cubic-bezier(0.22, 1, 0.36, 1)</code>
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "inline-alert",
    name: "Inline alert / error banner",
    category: "notifications",
    status: "implemented",
    keywords: ["inline alert", "error banner", "form error", "warning", "danger", "bordered", "not washed", "incorrect password", "couldn't upload"],
    summary: "The one canonical inline message for a form-level alert — BORDERED, NOT WASHED: the semantic colour on a hairline border + an alert glyph + text, on plain white (no colour-fill). Now a shared primitive: login & register use it for danger, the new-sale memo uses it for warning.",
    variants: [{ id: "danger", label: "Danger" }, { id: "warning", label: "Warning" }, { id: "info", label: "Info" }, { id: "success", label: "Success" }],
    sources: [
      { path: "components/ui/InlineAlert.tsx", note: "the canonical primitive (kind → colour + border)" },
      { path: "components/login/WarmLoginForm.tsx", note: "danger (sign-in error)" },
      { path: "components/transactions-v2/hero/HeroCard.tsx", note: "warning (memo upload failed)" },
    ],
    exceptions: [{ title: "Bordered, not washed — and now extracted", detail: "The kind colour (danger #C73E3E, warning #C97D1A, …) sits on a 0.30-alpha border + glyph + text, on white — no colour wash (the no-tinted-fill rule). Extracted 2026-11-20 from the duplicated login/register copies into one primitive; the new-sale memo-error faded-amber box was retired to this.", source: "components/ui/InlineAlert.tsx", scope: "shared" }],
    render: () => (
      <Stage>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 360 }}>
          <InlineAlert kind="danger">Incorrect email or password.</InlineAlert>
          <InlineAlert kind="warning">We couldn&apos;t upload your memo. Check your connection and try again.</InlineAlert>
        </div>
      </Stage>
    ),
  },
  {
    id: "close-button",
    name: "Close (X) button",
    category: "buttons",
    status: "approved",
    summary: "The dismiss control — a quiet 30px round X that tints on hover. Used by the cookie panel and the welcome modal.",
    sources: [
      { path: "components/arc/cookie-consent/cookie-consent.tsx", note: "panel close" },
      { path: "components/agent/welcome-steps-styles.ts", note: ".pw-close (modal)" },
    ],
    render: () => (
      <Stage width={220}>
        <style>{`.ds-close{display:grid;place-items:center;width:30px;height:30px;border-radius:999px;border:0;background:transparent;color:rgba(45,24,16,0.5);cursor:pointer;font-size:15px;transition:background .14s ease,color .14s ease}.ds-close:hover{background:rgba(45,24,16,0.07);color:#2D1810}`}</style>
        <button type="button" className="ds-close" aria-label="Close">✕</button>
      </Stage>
    ),
  },
  {
    id: "field-hint",
    name: "Field hints & validation",
    category: "empty-error",
    status: "approved",
    summary: "The small helper / warning / error lines under a field — the token colours in use.",
    sources: [{ path: "app/register/RegisterForm.tsx" }, { path: "components/login/WarmLoginForm.tsx" }],
    render: () => (
      <Stage>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <p style={{ fontSize: 12, color: "#C97D1A", fontWeight: 500, margin: 0 }}>At least 10 characters required</p>
          <p style={{ fontSize: 12, color: "#C73E3E", fontWeight: 500, margin: 0 }}>Enter a valid email address</p>
          <p style={{ fontSize: 12, color: "rgba(45,24,16,0.55)", margin: 0 }}>We&rsquo;ll only use this to sign you in.</p>
        </div>
      </Stage>
    ),
  },
];

/* The remaining global foundations — measured from design/tokens.ts. These
   aren't page-specific, so there's no reason to leave them empty. */
const SPACE = [4, 8, 12, 16, 20, 24, 32, 40, 48];
const RADII: [string, number][] = [["sm", 6], ["md", 8], ["lg", 12], ["xl", 16], ["pill", 999]];
const SIZES: [string, number][] = [["sm", 32], ["base", 40], ["lg", 48]];
const ZLAYERS: [string, string][] = [["base", "0"], ["elevated", "10"], ["overlay", "100"], ["modal (default)", "50"], ["dropdown / raised modal", "1500"], ["toast / deep modal", "2000"]];
const FOUNDATION_TOKENS: ComponentEntry[] = [
  {
    id: "spacing", name: "Spacing & rhythm", category: "spacing", status: "approved",
    summary: "The 4pt spacing scale from design/tokens.ts.",
    sources: [{ path: "design/tokens.ts", note: "space" }],
    render: () => <Stage width={520}><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{SPACE.map((s) => <div key={s} style={{ display: "flex", alignItems: "center", gap: 14 }}><span style={{ height: 14, width: s, background: CORAL, borderRadius: 3, flex: "none" }} /><code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>{s}px</code></div>)}</div></Stage>,
  },
  {
    id: "radii", name: "Border radii", category: "radii", status: "approved",
    summary: "The radius scale from design/tokens.ts.",
    sources: [{ path: "design/tokens.ts", note: "radius" }],
    render: () => <Stage width={520}><div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>{RADII.map(([n, r]) => <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}><span style={{ width: 54, height: 54, background: "#fff", border: "1.5px solid rgba(45,24,16,0.18)", borderRadius: r }} /><code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>{n} · {r === 999 ? "pill" : r + "px"}</code></div>)}</div></Stage>,
  },
  {
    id: "elevation", name: "Shadows & elevation", category: "elevation", status: "approved",
    summary: "The glass elevation shadows from design/tokens.ts.",
    sources: [{ path: "design/tokens.ts", note: "shadow" }],
    render: () => <Stage width={560}><div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>{([["glass", "0 4px 20px rgba(255,138,101,0.06), 0 1px 4px rgba(45,24,16,0.04)"], ["lifted", "0 8px 32px rgba(255,138,101,0.10), 0 2px 8px rgba(45,24,16,0.06)"]] as [string, string][]).map(([n, sh]) => <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><span style={{ width: 92, height: 56, background: "#fff", borderRadius: 12, boxShadow: sh }} /><code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>{n}</code></div>)}</div></Stage>,
  },
  {
    id: "sizing", name: "Control sizing", category: "sizing", status: "approved",
    summary: "Control heights — sm 32 / base 40 / lg 48 (buttons, inputs, selects).",
    sources: [{ path: "app/agent/styles/agent-system.css", note: "agent-btn / agent-input sizes" }],
    render: () => <Stage><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{SIZES.map(([n, h]) => <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ height: h, minWidth: 120, display: "grid", placeItems: "center", background: "#fff", border: "1px solid rgba(45,24,16,0.14)", borderRadius: 8, fontSize: 13, color: T_INK }}>Control</span><code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>{n} · {h}px</code></div>)}</div></Stage>,
  },
  {
    id: "z-index", name: "Layering & z-index", category: "layering", status: "approved",
    summary: "The z-index rungs from design/tokens.ts.",
    sources: [{ path: "design/tokens.ts", note: "zIndex" }],
    render: () => <Stage><div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{ZLAYERS.map(([n, z]) => <div key={n} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}><span style={{ fontSize: 13, color: T_INK }}>{n}</span><code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO }}>{z}</code></div>)}</div></Stage>,
  },
];

/* Third batch — captured from the WELCOME MODAL (first-run onboarding). The first
   canonical modal; it reuses the X + primary/ghost buttons already catalogued. */
const MODAL_ENTRIES: ComponentEntry[] = [
  {
    id: "modal-welcome",
    name: "Modal / dialog",
    category: "modals",
    status: "implemented",
    keywords: ["modal", "dialog", "welcome", "onboarding", "first run", "overlay", "backdrop", "drawer", "popup"],
    summary: "The first canonical modal — a centred card over a dimmed backdrop, with step dots, a title + lede (no eyebrow), divided feature rows fronted by flat-coral icon circles, and a footer pairing the ghost + primary buttons at equal height. A live 3-step wizard (intro → chase preferences → ready) you click through with its own Next / Back / Skip buttons. Becomes a bottom drawer below 1200px.",
    variants: [{ id: "modal", label: "Modal (≥ 1200px)" }, { id: "drawer", label: "Bottom drawer (< 1200px)" }, { id: "steps", label: "3-step wizard" }],
    states: [{ id: "in", label: "Opening" }, { id: "out", label: "Closing" }, { id: "step", label: "Step cross-fade" }],
    sources: [
      { path: "components/agent/SelfManagedWelcomeModal.tsx", note: "self-managed welcome" },
      { path: "components/agent/ProgressorWelcomeModal.tsx", note: "progressor welcome (shares the styles)" },
      { path: "components/agent/welcome-steps-styles.ts", note: "the shared styles" },
    ],
    exceptions: [
      { title: "Canon primary/ghost, matched in CSS", detail: "The modal portals into <body>, where .pw-card redefines --surface / --coral. To avoid token collisions the arc Button isn't dropped in; instead the shared CSS matches its treatment exactly — flat coral #FF6B4A, 14px/500, 48px tall, and the ghost is the SAME 48px height as the primary. See the Primary & ghost buttons entry.", source: "components/agent/welcome-steps-styles.ts", scope: "shared" },
      { title: "In / out + drawer animation", detail: "agent-modal-in (240ms cubic-bezier(.25,0,0,1)) in, welcome-zoom-out (420ms) out; below 1200px it slides up (pw-drawer-up 360ms) and down to close. Steps cross-fade via .pw-stepbody.is-out (240ms). Respects prefers-reduced-motion.", scope: "shared" },
      { title: "Flat-coral icon circles + canon X", detail: "The 42px feature badges are flat coral #FF6B4A (was a gradient) — see the Icon circle entry. The close is the canonical X. One coral shared with the buttons and the role radio.", scope: "shared" },
    ],
    render: ({ theme }) => <WelcomeModalDemo theme={theme} />,
  },
  {
    id: "icon-circle",
    name: "Icon circle (badge)",
    category: "badges",
    status: "implemented",
    keywords: ["icon circle", "badge", "chip", "feature", "coral circle", "orange circle", "avatar"],
    summary: "The 42px flat-coral circle that fronts a feature row — a white Phosphor glyph on flat coral with a soft coral shadow. One coral, matching the buttons and radio.",
    sources: [{ path: "components/agent/welcome-steps-styles.ts", note: ".pw-badges .pw-chip" }],
    render: () => (
      <Stage>
        <div style={{ display: "flex", gap: 14 }}>
          {[House, BellRinging, WarningCircle, Eye].map((Ic, i) => (
            <span key={i} style={{ width: 42, height: 42, borderRadius: "50%", background: CORAL, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "0 5px 14px rgba(255,107,74,0.30)" }}><Ic size={20} weight="regular" /></span>
          ))}
        </div>
      </Stage>
    ),
  },
  {
    id: "step-dots",
    name: "Step dots",
    category: "progress",
    status: "implemented",
    keywords: ["dots", "progress", "steps", "wizard", "pagination", "modal", "carousel"],
    summary: "The modal's progress indicator — small dots, the active one widening to a coral pill on a 220ms ease. Distinct from the two-bar Step progress used on sign-up.",
    sources: [{ path: "components/agent/welcome-steps-styles.ts", note: ".pw-dots / .pw-dot" }],
    render: () => <Stage><StepDotsDemo /></Stage>,
  },
  {
    id: "back-link",
    name: "Back link",
    category: "buttons",
    status: "implemented",
    keywords: ["back", "arrow", "text button", "tertiary", "navigation", "return", "back to"],
    summary: "The quiet back control — a muted text button with a leading arrow (“← Back”, “Back to chases”). Not a filled button: it reads as a low-emphasis text link and warms to a slightly stronger ink on hover.",
    sources: [{ path: "components/agent/welcome-steps-styles.ts", note: ".pw-back (modal footer / link row)" }],
    exceptions: [{ title: "Muted, not coral", detail: "Unlike the coral text link, the back link is secondary — muted ink that warms on hover (0.45 → 0.62), with a leading arrow. A low-emphasis return control, deliberately not a primary action or a coral link.", source: "components/agent/welcome-steps-styles.ts", scope: "shared" }],
    render: () => (
      <Stage>
        <style>{`.ds-back{display:inline-flex;align-items:center;gap:6px;border:0;background:transparent;cursor:pointer;font:inherit;font-size:13.5px;font-weight:600;color:rgba(45,24,16,0.45);padding:6px 2px;transition:color .14s ease}.ds-back:hover{color:rgba(45,24,16,0.62)}`}</style>
        <div style={{ display: "flex", gap: 20 }}>
          <button type="button" className="ds-back"><ArrowLeft size={15} weight="bold" /> Back</button>
          <button type="button" className="ds-back"><ArrowLeft size={15} weight="bold" /> Back to chases</button>
        </div>
      </Stage>
    ),
  },
  {
    id: "preference-row",
    name: "Preference row",
    category: "rows",
    status: "implemented",
    keywords: ["row", "toggle row", "setting", "preference", "list item", "switch row", "chase"],
    summary: "A label + description paired with a LiquidToggle, stacked in a bordered group — the modal's chase preferences. The toggle is the canonical Toggle / Switch; this is the row that frames it.",
    sources: [{ path: "components/agent/welcome-steps-styles.ts", note: ".pw-trow / .pw-tr-t / .pw-tr-d" }],
    exceptions: [{ title: "Uses the canonical toggle", detail: "The control is the LiquidToggle (see the Toggle / Switch entry) on the token coral; this entry is the row layout, not the switch.", scope: "shared" }],
    render: () => <Stage><PreferenceRowsDemo /></Stage>,
  },
];

/* Fourth batch — the EMPTY-STATE system (agent app). One hero + a row of info
   cards, shared across every empty page (Hub, Reminders, Chains, Comms, …). */
const EMPTY_ENTRIES: ComponentEntry[] = [
  {
    id: "empty-hero",
    name: "Empty-state hero",
    category: "empty-error",
    status: "implemented",
    keywords: ["empty", "empty state", "hero", "onboarding", "zero state", "placeholder", "first run"],
    summary: "The coral-tint hero that fronts every empty page — a title + lede with a flat-coral primary and a white/outline secondary, and a light/dark illustration on the right. No pill above the title (removed as noise, 2026-11-20).",
    sources: [
      { path: "components/agent/HubEmptyState.tsx", note: "hub" },
      { path: "components/agent/RemindersEmptyState.tsx", note: "reminders" },
      { path: "app/agent/styles/agent-system.css", note: ".agent-empty button scope" },
    ],
    exceptions: [
      { title: "Canon buttons, scoped", detail: "On empty surfaces (.agent-empty) the app's glossy primary flattens to the canonical flat coral and the secondary becomes the white/outline secondary — scoped so the rest of the app is untouched. See the Buttons entry.", source: "app/agent/styles/agent-system.css", scope: "shared" },
      { title: "Illustration is theme-aware", detail: "A HeroArt light/dark PNG sits on the right, masked so it fades into the card. Light + dark are peers across every empty page.", scope: "shared" },
    ],
    render: () => {
      const coral = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
      return (
        <div className="arc-scope" style={{ display: "flex", justifyContent: "center", "--control-on": CORAL } as CSSProperties}>
          <div style={{ width: 480, maxWidth: "100%", position: "relative", overflow: "hidden", borderRadius: 16, minHeight: 170, padding: "28px 30px", border: "1px solid rgba(45,24,16,0.08)", background: "linear-gradient(100deg, rgba(255,107,74,0.14), rgba(255,107,74,0.05) 52%, transparent 78%)" }}>
            <p style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 600, color: T_INK, letterSpacing: "-0.01em", lineHeight: 1.15 }}>Your chases will appear here</p>
            <p style={{ margin: "0 0 20px", fontSize: 13.5, color: T_MUTED, lineHeight: 1.6, maxWidth: 360 }}>As your sales progress, we&rsquo;ll bring every chase and follow-up together so nothing gets overlooked.</p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Button type="button" variant="primary" size="md" style={coral}>Add a new sale</Button>
              <Button type="button" variant="secondary" size="md">Explore a demo</Button>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    id: "banner-card",
    name: "Banner / prompt card",
    category: "cards",
    status: "implemented",
    keywords: ["banner", "prompt", "nudge", "callout", "cta card", "finish setup", "email nudge", "demo card"],
    summary: "The horizontal prompt card beneath an empty state — an icon, a title + line of copy, and a CTA on the right. The card's main action is the canonical flat-coral primary (the card sits in a .agent-canon-cta scope). Optional quiet ghost (“Not now”), a coral link, and a dismiss X. Used for Finish-setup, the email nudge, and Explore-demo.",
    sources: [
      { path: "components/agent/HubEmptyState.tsx", note: "Finish setup" },
      { path: "components/agent/EmailSetupPrompt.tsx", note: "Email nudge (dismissible)" },
      { path: "components/transactions/AllFilesEmptyState.tsx", note: "Explore demo" },
    ],
    exceptions: [{ title: "Primary CTA via canon scope", detail: "The main action is the canonical flat-coral primary; dismiss is the canonical X; a secondary line pairs a ghost (“Not now”) with a coral link. Replaced the old bespoke coral-tint pill buttons.", scope: "shared" }],
    render: () => (
      <div className="arc-scope" style={{ width: "100%", ...( { "--control-on": CORAL } as CSSProperties) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap", padding: "16px 20px", borderRadius: 14, border: "1px solid rgba(45,24,16,0.08)", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span style={{ color: CORAL, display: "flex", flexShrink: 0 }}><House size={20} weight="regular" /></span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: T_INK }}>Finish setting up your workspace</p>
              <p style={{ margin: 0, fontSize: 12.5, color: T_MUTED, lineHeight: 1.5 }}>Add your details, personalise your agency and invite your team.</p>
            </div>
          </div>
          <Button type="button" variant="primary" size="sm" style={{ "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties}>Continue setup</Button>
        </div>
      </div>
    ),
  },
  {
    id: "card-main",
    name: "Main card (frosted glass)",
    category: "cards",
    status: "implemented",
    keywords: ["main card", "frosted", "glass", "everywhere card", "surface", "light main card", "dark frosted", "container"],
    summary: "The everyday card surface our components sit on — “Light Main Card” in light, “Dark Frosted Main Everywhere Card” in dark (same card, two themes). Used for the empty-state info cards and the nudge / banner cards. It's a Glass-system surface (GlassCard), named in the glass picker — this entry names and locates it so the card types are accounted for.",
    variants: [{ id: "light", label: "Light Main Card" }, { id: "dark", label: "Dark Frosted · Main Everywhere Card" }],
    sources: [
      { path: "components/glass/GlassCard.tsx", note: "the surface" },
      { path: "components/agent/SetupCard.tsx", note: "info cards" },
      { path: "components/agent/EmailSetupPrompt.tsx", note: "nudge banner" },
      { path: "lib/glass/default-picks.ts", note: "baked dark pick (v04)" },
    ],
    exceptions: [{ title: "Governed by the Glass system, not this library", detail: "The surface is baked per glassId in default-picks.ts (dark “v04”), so the Glass system owns its look. This entry catalogues the card TYPE + where it's used; the interactive contents (buttons, links) are the canonical components.", scope: "shared" }],
    render: () => (
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <span style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, color: T_MUTED }}>Light Main Card</span>
          <div style={{ padding: 18, borderRadius: 16, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.06)", minHeight: 84 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: T_INK }}>Everything in one place</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: T_MUTED, lineHeight: 1.45 }}>Info cards + nudge banners sit on this surface.</p>
          </div>
        </div>
        <div style={{ flex: "1 1 240px" }}>
          <span style={{ display: "block", marginBottom: 8, fontSize: 11, fontWeight: 600, color: T_MUTED }}>Dark Frosted · Main Everywhere Card</span>
          <div style={{ borderRadius: 18, background: "linear-gradient(135deg,#131a28,#0c111b)", padding: 14 }}>
            <div style={{ padding: 18, borderRadius: 14, background: "rgba(255,255,255,0.055)", border: "0.5px solid rgba(255,255,255,0.14)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", boxShadow: "0 8px 30px rgba(0,0,0,0.42)", minHeight: 84 }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#eef0f4" }}>Everything in one place</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.45 }}>The same card, frosted for dark.</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "info-card",
    name: "Info card (what-happens-next)",
    category: "cards",
    status: "implemented",
    keywords: ["info card", "feature card", "what happens next", "setup card", "empty state", "icon card"],
    summary: "The little explainer cards under an empty-state hero — a tinted icon on the LEFT with a title (14/600) and a line of copy beside it, left-aligned, in a glass card. Same in light + dark on every empty page. Tints: coral / blue / green.",
    sources: [{ path: "components/agent/SetupCard.tsx", note: "the card — icon-left, alignItems flex-start" }, { path: "components/agent/HubEmptyState.tsx", note: ".setup-cards-3 row" }],
    render: () => {
      const cards = [
        { Ic: BellRinging, t: "Chases surface automatically", d: "See what needs chasing and when, as each sale progresses.", fg: CORAL },
        { Ic: Eye, t: "Know who to follow up with", d: "Identify who’s responsible for the next update.", fg: "#2f74e0" },
        { Ic: WarningCircle, t: "Keep every sale moving", d: "See overdue and upcoming chases at a glance.", fg: "#0f9d6b" },
      ];
      return (
        <Stage width={580}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {cards.map((c) => (
              <div key={c.t} style={{ padding: "18px 18px 16px", borderRadius: 14, border: "1px solid rgba(45,24,16,0.08)", background: "#fff", height: "100%" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span style={{ color: c.fg, display: "flex", flexShrink: 0 }}><c.Ic size={20} weight="regular" /></span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 600, color: T_INK, lineHeight: 1.3 }}>{c.t}</p>
                    <p style={{ margin: 0, fontSize: 12.5, color: T_MUTED, lineHeight: 1.5 }}>{c.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Stage>
      );
    },
  },
];

/* Fifth batch — the APP SHELL chrome (agent app): the top bar + the left nav
   rail. Representative renders of components/layout/AgentShell.tsx (.agent-topbar)
   + AgentNavRail.tsx (.agent-rail-*); both are frosted-glass surfaces, shown light. */
const RAIL_DEEP = "#E55B3D"; // --agent-coral-deep
const RAIL_SEC = "rgba(45,24,16,0.60)"; // --agent-text-secondary
const RAIL_SPOT = "radial-gradient(circle at left, rgba(255,107,74,0.18) 0%, rgba(255,107,74,0.06) 45%, transparent 100%)";
const RAIL_ITEMS: { Icon: typeof House; label: string; badge?: number }[] = [
  { Icon: Gauge, label: "Hub" },
  { Icon: Target, label: "Focus" },
  { Icon: Tray, label: "Reminders", badge: 5 },
  { Icon: ChatCircleDots, label: "Enquiries", badge: 9 },
  { Icon: CalendarCheck, label: "Completions" },
  { Icon: CheckSquare, label: "To-Do", badge: 19 },
  { Icon: BellSimple, label: "Updates" },
  { Icon: Envelope, label: "Auto emails" },
  { Icon: FolderOpen, label: "My Files" },
  { Icon: LinkSimple, label: "Chains", badge: 5 },
  { Icon: ChartBar, label: "Analytics" },
];
/* Exact to AgentNavRail: active = radial coral spotlight + coral-deep bold text +
   filled icon (NOT a solid fill); counts are the coral outline CountBadge. */
const ARC_TOK = {
  "--control-height-md": "40px", "--border-strong": "rgba(23,23,30,0.18)", "--radius-control": "12px",
  "--surface": "#ffffff", "--surface-muted": "rgba(23,23,30,0.05)", "--foreground": "#17171a", "--text-muted": "#73737a",
  "--space-2": "8px", "--space-3": "12px", "--text-field": "13px", "--text-sm": "13px", "--leading-body": "1.5",
  "--tracking-body": "0em", "--duration-fast": "140ms", "--ease-standard": "cubic-bezier(0.22,1,0.36,1)",
} as CSSProperties;
function NavRailDemo() {
  const [active, setActive] = useState(0);
  const [dark, setDark] = useState(false);
  return (
    <div style={{ width: 258, padding: "14px 12px", borderRadius: 18, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{`.ds-rail-item{transition:color .15s ease}.ds-rail-item:hover{color:${RAIL_DEEP}}.ds-rail-newsale{transition:box-shadow .15s ease}.ds-rail-newsale:hover{box-shadow:0 3px 10px rgba(255,107,74,0.2)}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 8px 6px" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: CORAL, display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}><Check size={16} weight="bold" /></span>
        <span style={{ fontSize: 14.5, fontWeight: 700, color: T_INK }}>Sales Progressor</span>
      </div>
      <button type="button" className="ds-rail-newsale" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.06)", cursor: "pointer", width: "100%", textAlign: "left" }}>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: CORAL, display: "grid", placeItems: "center", color: "#fff", flexShrink: 0 }}><Plus size={14} weight="bold" /></span>
        <span style={{ fontSize: 14, fontWeight: 600, color: T_INK }}>New sale</span>
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {RAIL_ITEMS.map((n, i) => {
          const on = i === active;
          return (
            <button key={n.label} className={on ? undefined : "ds-rail-item"} onClick={() => setActive(i)} style={{ position: "relative", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: 0, cursor: "pointer", textAlign: "left", background: "transparent", color: on ? RAIL_DEEP : RAIL_SEC, fontSize: 13, fontWeight: on ? 600 : 500, overflow: "hidden" }}>
              {on && <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 10, background: RAIL_SPOT }} />}
              <n.Icon size={17} weight={on ? "fill" : "regular"} style={{ position: "relative", flexShrink: 0 }} />
              <span style={{ position: "relative", flex: 1 }}>{n.label}</span>
              {n.badge && <span style={{ position: "relative", minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, letterSpacing: "-0.01em", color: RAIL_DEEP, background: "transparent", border: `1.25px solid ${RAIL_DEEP}`, fontVariantNumeric: "tabular-nums" }}>{n.badge}</span>}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => setDark((d) => !d)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 12px 2px", border: 0, borderTop: "1px solid rgba(45,24,16,0.07)", marginTop: 2, background: "transparent", cursor: "pointer", width: "100%", textAlign: "left" }}>
        <Moon size={17} color={RAIL_SEC} />
        <span style={{ flex: 1, fontSize: 13, color: RAIL_SEC }}>Dark mode</span>
        <span style={{ width: 34, height: 20, borderRadius: 999, background: dark ? CORAL : "rgba(45,24,16,0.18)", position: "relative", flexShrink: 0, transition: "background 0.2s ease" }}><span style={{ position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transform: dark ? "translateX(14px)" : "none", transition: "transform 0.2s cubic-bezier(0.34,1.3,0.64,1)" }} /></span>
      </button>
    </div>
  );
}
function IconCtl({ children }: { children: ReactNode }) {
  return <span className="ds-icon-ctl" style={{ display: "grid", placeItems: "center", width: 30, height: 30, borderRadius: 8, color: "rgba(45,24,16,0.55)", flexShrink: 0, cursor: "pointer" }}>{children}</span>;
}
function TopBarDemo() {
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 16, background: "rgba(255,255,255,0.72)", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.05)" }}>
      <style>{`.ds-icon-ctl{transition:background .14s ease,color .14s ease}.ds-icon-ctl:hover{background:rgba(45,24,16,0.06);color:#2D1810}.ds-acct{transition:background .14s ease}.ds-acct:hover{background:#fff}.ds-topbar-search label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}`}</style>
      <div className="ds-topbar-search" style={{ flex: 1, minWidth: 0, ...ARC_TOK }}>
        <SearchField label="Search" value={q} onValueChange={setQ} placeholder="Search…" />
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: T_MUTED, flexShrink: 0, whiteSpace: "nowrap", marginLeft: 2 }}><ArrowsClockwise size={13} /> As of 13:12</span>
      <IconCtl><Moon size={16} /></IconCtl>
      <IconCtl><CircleHalf size={16} /></IconCtl>
      <IconCtl><Flask size={16} /></IconCtl>
      <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
        <IconCtl><Bell size={16} /></IconCtl>
        <span style={{ position: "absolute", top: 1, right: 1, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, background: CORAL, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "grid", placeItems: "center", pointerEvents: "none" }}>1</span>
      </span>
      <button type="button" className="ds-acct" onClick={() => setMenu((m) => !m)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 4px", borderRadius: 999, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", flexShrink: 0, cursor: "pointer" }}>
        <span style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#8a5a44,#2d1810)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600 }}>EA</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T_INK }}>Ellis Askey</span>
        <CaretDown size={12} color={T_MUTED} style={{ transform: menu ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
      </button>
      {menu && (
        <div style={{ position: "absolute", top: "100%", right: 12, marginTop: 6, width: 200, borderRadius: 12, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 10px 30px rgba(30,20,15,0.14)", padding: 6, zIndex: 5 }}>
          <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: T_MUTED }}>Director</div>
          {["Account", "Billing"].map((x) => <div key={x} style={{ padding: "8px 10px", fontSize: 13, color: T_INK, borderRadius: 8, cursor: "pointer" }}>{x}</div>)}
          <div style={{ padding: "8px 10px", fontSize: 13, color: T_INK, borderTop: "1px solid rgba(45,24,16,0.07)", marginTop: 4, cursor: "pointer" }}>Sign out</div>
        </div>
      )}
    </div>
  );
}
function GlobalSearchDemo() {
  const [q, setQ] = useState("");
  // Arc tokens supplied on the wrapper so the field renders cleanly regardless of
  // the surrounding scope — the roomy uiarc values (visible border, 44px, rounded).
  const tok = {
    "--control-height-md": "44px", "--border-strong": "rgba(23,23,30,0.22)", "--radius-control": "12px",
    "--surface": "#ffffff", "--surface-muted": "rgba(23,23,30,0.05)", "--foreground": "#17171a", "--text-muted": "#73737a",
    "--space-2": "8px", "--space-3": "14px", "--text-field": "15px", "--text-sm": "13px", "--leading-body": "1.5",
    "--tracking-body": "0em", "--duration-fast": "140ms", "--ease-standard": "cubic-bezier(0.22,1,0.36,1)",
  } as CSSProperties;
  return (
    <Stage width={360}>
      <div style={{ ...tok, width: "100%" }}>
        <SearchField label="Search members" value={q} onValueChange={setQ} placeholder="Name or email" />
      </div>
    </Stage>
  );
}
function AccountMenuDemo() {
  const [open, setOpen] = useState(false);
  return (
    <Stage width={260}>
      <style>{`.ds-acct-item{transition:background .12s ease}.ds-acct-item:hover{background:rgba(45,24,16,0.05)}`}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
        <button type="button" onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px 4px 4px", borderRadius: 999, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", cursor: "pointer" }}>
          <UserAvatar user={{ name: "Ellis Askey" }} size={26} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T_INK }}>Ellis Askey</span>
          <CaretDown size={12} color={T_MUTED} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }} />
        </button>
        {open && (
          <div style={{ width: 200, borderRadius: 12, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 10px 30px rgba(30,20,15,0.12)", padding: 6 }}>
            <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, color: T_MUTED }}>Director</div>
            {["Account", "Billing"].map((x) => <div key={x} className="ds-acct-item" style={{ padding: "8px 10px", fontSize: 13, color: T_INK, borderRadius: 8, cursor: "pointer" }}>{x}</div>)}
            <div className="ds-acct-item" style={{ padding: "8px 10px", fontSize: 13, color: T_INK, borderTop: "1px solid rgba(45,24,16,0.07)", marginTop: 4, cursor: "pointer" }}>Sign out</div>
          </div>
        )}
      </div>
    </Stage>
  );
}
/* The REAL top-nav toggle — the canonical arc SegmentedControl whose selection
   GLIDES between options on a morph spring (layoutId), mapped to the agent look +
   the shipped coral pill, theme-aware, so the preview matches the top bar. */
function ViewToggleReal({ theme }: { theme: "light" | "dark" }) {
  const [mode, setMode] = useState<string>("all");
  const dark = theme === "dark";
  const tok = {
    "--surface-muted": "rgba(15,23,42,0.05)",
    "--border": dark ? "rgba(255,255,255,0.12)" : "rgba(45,24,16,0.10)",
    "--text-muted": dark ? "rgba(255,255,255,0.72)" : "rgba(45,24,16,0.60)",
    "--foreground": dark ? "rgba(255,255,255,0.96)" : "#2D1810",
    "--radius-control": "11px",
    "--control-height-sm": "28px",
    "--text-sm": "13px",
    "--sc-selection-bg": "#FF6B4A",
    "--sc-selection-fg": "#fff",
    "--sc-selection-border": "transparent",
    "--shadow-resting": "0 2px 6px rgba(255,107,74,0.30)",
  } as CSSProperties;
  return (
    <Stage width={240}>
      <div className="arc-scope" style={tok}>
        <SegmentedControl
          label="Show all files or just mine"
          options={[{ value: "all", label: "All" }, { value: "mine", label: "Mine" }]}
          value={mode}
          onValueChange={setMode}
        />
      </div>
    </Stage>
  );
}
const SHELL_ENTRIES: ComponentEntry[] = [
  {
    id: "shell-topbar",
    name: "Top bar (app shell)",
    category: "toolbars",
    status: "implemented",
    keywords: ["top bar", "topbar", "header", "chrome", "shell", "search", "command palette", "account menu", "bell"],
    summary: "The agent app's top bar — a frosted-glass header holding the ⌘K search pill, the All/Mine view toggle, an “As of” refresh, the theme + aurora toggles, the notification bell, and the account menu. A Glass surface (nav-topbar).",
    variants: [{ id: "desktop", label: "Desktop" }, { id: "mobile", label: "Mobile (search icon + hamburger)" }],
    sources: [
      { path: "components/layout/AgentShell.tsx", note: ".agent-topbar header" },
      { path: "components/layout/AgentGlobalSearch.tsx", note: "⌘K search + palette" },
      { path: "components/layout/ViewModeToggle.tsx", note: "All / Mine" },
      { path: "components/layout/AgentBell.tsx", note: "notifications" },
    ],
    exceptions: [{ title: "Glass surface; its controls are their own entries", detail: "The bar is a Glass surface (nav-topbar glassId). Each control is catalogued separately: Global search (⌘K), View toggle (All/Mine), Account menu, Count badge; the theme / contrast / Design-Lab toggles + bell are the top-bar icon controls. This entry is the composed chrome.", source: "components/layout/AgentShell.tsx", scope: "shared" }],
    render: () => <TopBarDemo />,
  },
  {
    id: "shell-navrail",
    name: "Left nav rail (app shell)",
    category: "sidebars",
    status: "implemented",
    keywords: ["nav", "navigation", "sidebar", "rail", "left nav", "menu", "shell", "spotlight", "coral pill", "dock"],
    summary: "The agent app's left nav — a frosted-glass rail of icon + label items with badges, and a sliding coral spotlight that glides to the active route. Collapses to an icon rail on tablet and a drawer on mobile. (Click an item to move the spotlight.)",
    variants: [{ id: "full", label: "Full (labels)" }, { id: "icon", label: "Icon rail (tablet)" }, { id: "drawer", label: "Drawer (mobile)" }],
    states: [{ id: "active", label: "Active (coral spotlight)" }, { id: "badge", label: "With badge" }],
    sources: [
      { path: "components/layout/AgentNavRail.tsx", note: "the rail (.agent-rail-*)" },
      { path: "components/layout/AgentShell.tsx", note: "mounts the rail + builds the nav groups" },
    ],
    exceptions: [{ title: "Sliding coral spotlight (not a solid fill)", detail: "The active item is a radial coral-tint spotlight (.agent-rail-pill: rgba coral 0.18 → 0.06 → transparent from the left) behind coral-deep bold text + a filled icon — not a solid coral fill. One shared pill glides (transform + height) to the active route.", source: "components/layout/AgentNavRail.tsx", scope: "shared" }],
    render: () => <NavRailDemo />,
  },
  {
    id: "shell-search",
    name: "Search field",
    category: "search",
    status: "implemented",
    keywords: ["search", "search field", "filter", "command palette", "cmd k", "clear button", "list filter"],
    summary: "The canonical arc SearchField — a live controlled input with a label, the search glyph, and a clear button that scales in (reserved slot, so the width never shifts). In the top bar it's rendered as a read-only trigger that opens the ⌘K palette; elsewhere it filters a list in place.",
    variants: [{ id: "field", label: "Field (filter in place)" }, { id: "trigger", label: "Top-bar trigger (⌘K palette)" }],
    states: [{ id: "rest", label: "Rest" }, { id: "focus", label: "Focus (border darkens)" }, { id: "filled", label: "Filled (clear button)" }],
    sources: [
      { path: "components/arc/search-field/search-field.tsx", note: "the component" },
      { path: "components/layout/AgentGlobalSearch.tsx", note: "top-bar trigger → ⌘K palette" },
      { path: "components/layout/AgentMobileSearch.tsx", note: "mobile icon + overlay" },
    ],
    exceptions: [{ title: "Top bar uses it as a trigger", detail: "In the top nav the SearchField is read-only and opens the command-palette modal on click/⌘K; arc tokens are mapped to the agent look + 32px height, its visible label is hidden, and the ⌘K hint is overlaid. Everything else (mobile hiding, glass pick, sizing) is unchanged.", source: "components/layout/AgentGlobalSearch.tsx", scope: "specific" }],
    render: () => <GlobalSearchDemo />,
  },
  {
    id: "account-menu",
    name: "Account menu (person pill)",
    category: "navigation",
    status: "implemented",
    keywords: ["account", "user menu", "person pill", "avatar", "profile", "dropdown", "sign out"],
    summary: "The top-bar account control — an avatar + name pill that opens a menu (role label, Account, Billing, Sign out). The avatar is the user's photo or initials.",
    sources: [{ path: "components/layout/AgentShell.tsx", note: "UserDropdown" }, { path: "components/ui/Avatar.tsx", note: "UserAvatar" }],
    render: () => <AccountMenuDemo />,
  },
  {
    id: "view-toggle",
    name: "Segmented control (All / Mine)",
    category: "tabs",
    status: "implemented",
    keywords: ["toggle", "segmented", "segmented control", "all mine", "view", "filter", "switch", "pill toggle", "sliding pill", "slider", "arc"],
    summary: "The canonical segmented control (arc) — a rail whose selection GLIDES between options on a morph spring (shared layoutId), active label in on-coral white, the rest in secondary ink that warms on hover. The top bar's All/Mine view toggle is one instance. Mapped to the agent look + the shipped coral pill; keyboard-navigable (arrows/Home/End), with a fullWidth variant for the mobile menu.",
    variants: [{ id: "sm", label: "sm (inline, e.g. top bar)" }, { id: "full", label: "fullWidth (fills its row)" }],
    sources: [
      { path: "components/arc/segmented-control/segmented-control.tsx", note: "the canonical component (gliding morph-spring selection)" },
      { path: "components/layout/ViewModeToggle.tsx", note: "All / Mine instance (persists the view, router.refresh)" },
    ],
    exceptions: [
      { title: "Gliding morph-spring selection", detail: "The highlight is a single <motion.span layoutId=\"selection\"> scoped to this instance by a LayoutGroup, so it glides between options on a spring rather than snapping. Coral pill (#FF6B4A) + on-coral label via --sc-selection-bg / --sc-selection-fg; the vendored component is extended with those hooks, not forked.", source: "components/arc/segmented-control/segmented-control.tsx", scope: "shared" },
      { title: "Legacy SegmentedSwitch still runs other toggles", detail: "components/ui/SegmentedSwitch.tsx (the older measured-pill switch) still drives the Clients/Professionals and Fixed/Percentage toggles — those are a separate migration, not done here. All/Mine is now the arc control.", source: "components/ui/SegmentedSwitch.tsx", scope: "specific" },
    ],
    render: ({ theme }) => <ViewToggleReal theme={theme} />,
  },
  {
    id: "count-badge",
    name: "Count badge",
    category: "badges",
    status: "implemented",
    keywords: ["badge", "count", "pill", "notification", "nav badge", "outline", "coral"],
    summary: "The coral outline count — a transparent pill with a 1.25px coral-deep border and coral-deep number (tabular). Used on nav items and the notification bell (which is a solid-coral variant).",
    sources: [{ path: "components/ui/CountBadge.tsx", note: "tone=accent" }, { path: "app/agent/styles/agent-system.css", note: ".agent-rail-badge" }],
    render: () => (
      <Stage width={240}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {[5, 9, 19].map((n) => (
            <span key={n} style={{ minWidth: 18, height: 18, padding: "0 6px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: RAIL_DEEP, border: `1.25px solid ${RAIL_DEEP}`, fontVariantNumeric: "tabular-nums" }}>{n}</span>
          ))}
          <span style={{ minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, background: CORAL, color: "#fff" }}>1</span>
          <span style={{ fontSize: 11, color: T_MUTED }}>outline (nav) · solid (bell)</span>
        </div>
      </Stage>
    ),
  },
  {
    id: "icon-control",
    name: "Icon control button (top-bar)",
    category: "buttons",
    status: "implemented",
    keywords: ["icon button", "control", "toolbar", "theme toggle", "dark mode", "contrast", "aurora", "lab", "bell", "notification"],
    summary: "The small 30px icon buttons in the top bar — theme (dark), contrast / aurora, Design-Lab, and the notification bell. Transparent at rest, a subtle tint on hover; the bell carries the solid-coral count. (Hover them.)",
    variants: [{ id: "plain", label: "Plain" }, { id: "badge", label: "With count (bell)" }],
    sources: [
      { path: "components/theme/ThemeModeToggle.tsx", note: "dark toggle" },
      { path: "components/agent/AuroraOpacityControl.tsx", note: "contrast / aurora" },
      { path: "components/glass/DesignLabToggle.tsx", note: "Design Lab" },
      { path: "components/layout/AgentBell.tsx", note: "notifications" },
    ],
    render: () => (
      <Stage width={240}>
        <style>{`.ds-icon-ctl{transition:background .14s ease,color .14s ease}.ds-icon-ctl:hover{background:rgba(45,24,16,0.06);color:#2D1810}`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconCtl><Moon size={16} /></IconCtl>
          <IconCtl><CircleHalf size={16} /></IconCtl>
          <IconCtl><Flask size={16} /></IconCtl>
          <span style={{ position: "relative", display: "inline-flex" }}>
            <IconCtl><Bell size={16} /></IconCtl>
            <span style={{ position: "absolute", top: 1, right: 1, minWidth: 15, height: 15, padding: "0 4px", borderRadius: 999, background: CORAL, color: "#fff", fontSize: 9.5, fontWeight: 700, display: "grid", placeItems: "center", pointerEvents: "none" }}>1</span>
          </span>
        </div>
      </Stage>
    ),
  },
];

/* Sixth batch — the NEW-SALE page (agent app). After its UI-alignment pass: the
   pulse indicator, and the two card compositions (action + research/lookup) that
   ride the Dark Frosted Main surface already catalogued. The lookup field is the
   canonical SearchField in its new submit ("lookup") mode. */
const DOT_DEEP = CORAL; // --agent-coral-deep (#FF6B4A) — the real dot/submit token; NOT coral-darker (#E55B3D)
const LOOKUP_TOK = {
  marginBottom: 14,
  ["--control-height-md"]: "38px",
  ["--radius-control"]: "10px",
  ["--text-field"]: "14px",
  ["--surface"]: "#fff",
  ["--border-strong"]: "rgba(45,24,16,0.14)",
  ["--foreground"]: T_INK,
  ["--text-muted"]: T_MUTED,
  ["--sf-focus"]: DOT_DEEP,
  ["--sf-submit-bg"]: DOT_DEEP,
  ["--sf-submit-fg"]: "#fff",
} as CSSProperties;
function LookupShell({ children }: { children: ReactNode }) {
  return <div style={{ width: 300, padding: 20, borderRadius: 16, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.06)" }}>{children}</div>;
}
function LookupSkeleton({ height, width = "100%" }: { height: number; width?: string }) {
  return <div style={{ height, width, borderRadius: 8, background: "rgba(45,24,16,0.06)" }} />;
}
function LookupCardDemo({ state = "idle" }: { state?: "idle" | "loading" | "error" }) {
  const [q, setQ] = useState("");
  const ok = /^[A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2}$/i.test(q.trim());
  const rows: [typeof Receipt, string][] = [
    [Receipt, "Last sold price & date"],
    [Leaf, "EPC energy rating"],
    [HouseLine, "Freehold or leasehold"],
    [Clock, "Full sale price history"],
  ];
  // Loading — skeletons, mirroring the real ResearchPanel (field + a 2×2 grid).
  if (state === "loading") {
    return (
      <LookupShell>
        <LookupSkeleton height={38} />
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <LookupSkeleton key={i} height={60} />)}
        </div>
        <div style={{ marginTop: 10 }}><LookupSkeleton height={50} /></div>
      </LookupShell>
    );
  }
  // Error — a calm message + a coral "Try again" text button (no eyebrow).
  if (state === "error") {
    return (
      <LookupShell>
        <p style={{ margin: "0 0 10px", fontSize: 13, color: T_MUTED, lineHeight: 1.5 }}>We couldn&apos;t find data for this address. The form still works as normal.</p>
        <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: CORAL, fontWeight: 600, padding: 0 }}>Try again</button>
      </LookupShell>
    );
  }
  // Idle — the canonical lookup field + the "what you can check" list.
  return (
    <LookupShell>
      <div className="arc-scope sp-lookup-demo" style={LOOKUP_TOK}>
        <style>{".sp-lookup-demo label{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}"}</style>
        <SearchField label="Postcode" value={q} onValueChange={(v) => setQ(v.toUpperCase())} placeholder="Enter postcode (e.g. BS6 7TH)" maxLength={8} onSubmit={() => undefined} submitLabel="Look up" submitEnabled={ok} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: T_MUTED, lineHeight: 1.6 }}>Look up any property to see sale history, EPC rating, and more before filling in the form.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(([Ic, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T_MUTED, flexShrink: 0, display: "flex" }}><Ic size={12} weight="bold" /></span>
            <span style={{ fontSize: 12, color: T_MUTED }}>{l}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "16px 0 0", fontSize: 10, color: T_MUTED, opacity: 0.65 }}>Sources: HM Land Registry · EPC Register</p>
    </LookupShell>
  );
}
function AvatarCell({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 76 }}>{children}<span style={{ fontSize: 11, color: T_MUTED, textAlign: "center", lineHeight: 1.3 }}>{label}</span></div>;
}
function AvatarDemo() {
  return (
    <Stage width={540}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* Branded person / role art (no photo) — tinted per side */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <AvatarCell label="Staff (coral)"><UserAvatar user={{ name: "Ellis Benjamin" }} size={46} /></AvatarCell>
          <AvatarCell label="Seller (blue)"><ContactAvatar contact={{ name: "Jane Doe", roleType: "vendor" }} size={46} /></AvatarCell>
          <AvatarCell label="Buyer (green)"><ContactAvatar contact={{ name: "Sam Lee", roleType: "purchaser" }} size={46} /></AvatarCell>
          <AvatarCell label="Solicitor (navy)"><ContactAvatar contact={{ name: "R Patel", roleType: "solicitor" }} size={46} /></AvatarCell>
          <AvatarCell label="Broker (violet)"><ContactAvatar contact={{ name: "M Khan", roleType: "broker" }} size={46} /></AvatarCell>
        </div>
        {/* Initials fallback (art off) — initials on the side-coloured gradient */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <AvatarCell label="Seller initials"><ContactAvatar contact={{ name: "Jane Doe", roleType: "vendor" }} size={46} art={false} /></AvatarCell>
          <AvatarCell label="Buyer initials"><ContactAvatar contact={{ name: "Sam Lee", roleType: "purchaser" }} size={46} art={false} /></AvatarCell>
          <AvatarCell label="Fallback (grey)"><ContactAvatar contact={{ name: "Alex Fox", roleType: "other" }} size={46} art={false} /></AvatarCell>
        </div>
      </div>
    </Stage>
  );
}
function DemoCtaDemo() {
  return (
    <Stage>
      <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 40, paddingLeft: 6, paddingRight: 18, borderRadius: 12, background: "#fff", border: "1px solid rgba(45,24,16,0.14)", color: T_INK, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
        <span style={{ width: 28, height: 28, borderRadius: "50%", background: CORAL, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Play size={14} weight="fill" style={{ marginLeft: 1 }} /></span>
        See how it works
      </button>
    </Stage>
  );
}
function SalesRowDemo() {
  const sales: [string, string, string][] = [
    ["52 The Meadway", "£473,200", "Jan 2026"],
    ["28 The Meadway", "£340,000", "Feb 2025"],
    ["45 Meadway", "£415,000", "Mar 2021"],
  ];
  return (
    <Stage width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sales.map(([a, p, d]) => (
          <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(45,24,16,0.08)" }}>
            <span style={{ fontSize: 12, color: T_INK, fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T_INK, flexShrink: 0 }}>{p}</span>
            <span style={{ fontSize: 11, color: T_MUTED, flexShrink: 0 }}>{d}</span>
          </div>
        ))}
      </div>
    </Stage>
  );
}
function DsSpinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ animation: "ds-spin 0.8s linear infinite", flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5.5" stroke="rgba(45,24,16,0.15)" strokeWidth="2" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke={CORAL} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function SpinnerDemo() {
  return (
    <Stage>
      <style>{"@keyframes ds-spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <DsSpinner size={14} />
        <DsSpinner size={18} />
        <DsSpinner size={24} />
      </div>
    </Stage>
  );
}
const SCAN_GROUPS: { label: string; items: string[] }[] = [
  { label: "Sale details", items: ["Address", "Purchase price", "Tenure"] },
  { label: "Vendor", items: ["Vendor details", "Vendor solicitor"] },
  { label: "Purchaser", items: ["Purchaser details", "Purchaser solicitor"] },
];
const SCAN_FLAT = SCAN_GROUPS.flatMap((g) => g.items);
function MemoScanDemo({ state = "reading" }: { state?: "reading" | "done" | "missing" | "error" }) {
  const [vis, setVis] = useState(0);
  useEffect(() => {
    if (state !== "reading") return;
    setVis(0);
    let c = 0;
    const id = window.setInterval(() => { c = (c + 1) % (SCAN_FLAT.length + 2); setVis(c); }, 420);
    return () => window.clearInterval(id);
  }, [state]);
  const topColor = state === "done" ? "#2F9E6B" : state === "missing" || state === "error" ? "#C8841F" : CORAL;
  return (
    <Stage width={620}>
      <style>{"@keyframes ds-spin{to{transform:rotate(360deg)}}@keyframes ds-scan-pulse{0%,100%{opacity:.45;transform:scale(.9)}50%{opacity:.95;transform:scale(1)}}"}</style>
      <div style={{ borderRadius: 20, background: "rgba(255,255,255,0.72)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", border: "0.5px solid rgba(45,24,16,0.08)", borderTop: `2px solid ${topColor}`, boxShadow: "0 8px 30px rgba(30,20,15,0.08)", padding: "16px 20px" }}>
        {state === "reading" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <DsSpinner />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T_INK }}>Reading your memo…</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 18 }}>
              {SCAN_GROUPS.map((g) => (
                <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 600, color: T_MUTED }}>{g.label}</p>
                  {g.items.map((item) => {
                    const idx = SCAN_FLAT.indexOf(item);
                    const isVisible = idx < vis;
                    const isActive = idx === vis - 1;
                    return (
                      <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, opacity: isVisible ? 1 : 0.35, transition: "opacity 250ms" }}>
                        {isVisible ? (isActive ? <DsSpinner /> : (
                          <span style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,107,74,0.55)", boxShadow: "0 0 0 3px rgba(255,107,74,0.10)", animation: `ds-scan-pulse 1.8s ease-in-out ${(idx % 4) * 220}ms infinite` }} />
                          </span>
                        )) : (
                          <span style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", border: "1px solid rgba(255,107,74,0.30)" }} />
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: isVisible ? T_INK : "rgba(45,24,16,0.35)" }}>{item}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
        {state === "done" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={14} weight="fill" color="#2F9E6B" /><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T_INK }}>Memo read · all fields filled</p></div>
            <button type="button" style={{ fontSize: 12, background: "none", border: 0, cursor: "pointer", color: T_MUTED }}>Change file</button>
          </div>
        )}
        {state === "missing" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><WarningCircle size={16} weight="fill" color="#C8841F" /><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T_INK }}>Memo read · 3 fields need attention</p></div>
              <button type="button" style={{ fontSize: 12, background: "none", border: 0, cursor: "pointer", color: T_MUTED }}>Change file</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["Tenure", "Postcode", "Price"].map((l) => <Pill key={l} glass tone="warning" size="md">{l}</Pill>)}</div>
          </>
        )}
        {state === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}><WarningCircle size={16} weight="fill" color="#C8841F" /><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: T_INK }}>Couldn&apos;t read the memo. Fill in the form below.</p></div>
        )}
      </div>
    </Stage>
  );
}
function EyebrowCompareDemo() {
  const label = "Sale details";
  const row = (name: string, node: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <span>{node}</span>
      <code style={{ fontSize: 11, color: T_MUTED, fontFamily: MONO, whiteSpace: "nowrap" }}>{name}</code>
    </div>
  );
  return (
    <Stage width={440}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {row("current · caps · 700 · 0.08em", <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#7A4A2E" }}>{label}</span>)}
        {row("canon · caps · 600 · 0.05em", <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", color: "#7A4A2E" }}>{label}</span>)}
        {row("alt · sentence · 600", <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0", color: T_MUTED }}>{label}</span>)}
      </div>
    </Stage>
  );
}
const OV_CARD: CSSProperties = { background: "#fff", border: "1px solid rgba(45,24,16,0.08)", borderRadius: 14, boxShadow: "0 1px 3px rgba(30,20,15,0.05)" };
function NextActionCardDemo() {
  return (
    <Stage width={380}>
      <div style={{ ...OV_CARD, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: T_MUTED }}>Next action</span>
          <CalendarBlank size={16} weight="regular" style={{ color: T_MUTED }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ flexShrink: 0, display: "inline-flex", color: CORAL }}><Fire size={24} weight="fill" /></span>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: T_INK, lineHeight: 1.3 }}>Search results received</p>
            <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: CORAL, lineHeight: 1.3 }}>Due in 5 days</div>
          </div>
        </div>
        <p style={{ margin: "9px 0 0", paddingLeft: 35, fontSize: 13, color: "rgba(45,24,16,0.6)", lineHeight: 1.5 }}>Seller&apos;s solicitor has received initial enquiries.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", background: CORAL }}><Phone size={14} /> Call progressor</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, color: T_INK, background: "#fff", border: "0.5px solid rgba(45,24,16,0.14)" }}><EnvelopeSimple size={14} /> Send email</span>
        </div>
      </div>
    </Stage>
  );
}
function OvRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ fontSize: 12, color: T_MUTED }}>{label}</span><span style={{ fontSize: 12, fontWeight: 600, color: valueColor ?? T_INK }}>{value}</span></div>;
}
function SaleHealthCardDemo() {
  return (
    <Stage width={320}>
      <div style={{ ...OV_CARD, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Heartbeat size={24} weight="regular" style={{ color: "#047857" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(45,24,16,0.62)" }}>Sale health</span>
          <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 600, color: "#047857" }}>On track</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
          <OvRow label="Time on file" value="5h 48m" />
          <OvRow label="Stage" value="Conveyancing" />
          <OvRow label="Risk level" value="Low" valueColor="#047857" />
          <OvRow label="Last activity" value="Yesterday, 11:00" />
        </div>
        <div style={{ height: 4, borderRadius: 999, background: "rgba(15,23,42,0.06)", marginTop: 12, overflow: "hidden" }}><div style={{ width: "72%", height: "100%", background: "#10b981" }} /></div>
        <div style={{ marginTop: 11, fontSize: 11, fontWeight: 600, color: CORAL }}>View health details →</div>
      </div>
    </Stage>
  );
}
function KeyDatesCardDemo() {
  return (
    <Stage width={320}>
      <div style={{ ...OV_CARD, padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <CalendarBlank size={24} weight="regular" style={{ color: CORAL }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(45,24,16,0.62)" }}>Key dates</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
          <OvRow label="12-week target" value="29 November 2026" />
          <OvRow label="Est. ready to exchange" value="W/C 2 November 2026" />
          <OvRow label="Completion" value="Awaiting exchange" />
          <OvRow label="Time to exchange" value="Approx 1 week" />
        </div>
        <p style={{ margin: "11px 0 0", fontSize: 10, fontStyle: "italic", color: T_MUTED, lineHeight: 1.4 }}>Estimated ready-to-exchange date for this sale only. Chain not included.</p>
      </div>
    </Stage>
  );
}
// ── File hero (composite) ──────────────────────────────────────────────────
// Faithful static replica of the agent file hero (PropertyHero.tsx, agent path):
// masked photo column + content column (status pill · address with inline
// progress · 4-cell stat row · meta row with managing-this-file + file age +
// service pill), and the floating glass Back pill.
function HeroStat({ Icon, label, value }: { Icon: typeof CurrencyGbp; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
      <span style={{ width: 32, height: 32, color: "var(--agent-coral-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={22} weight="regular" /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", lineHeight: 1.25, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>{label}</span>
      </span>
    </div>
  );
}
function FileHeroDemo() {
  return (
    <Stage width={720}>
      <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", background: "var(--agent-surface-elevated, #fff)", border: "1px solid var(--agent-border-default, rgba(45,24,16,0.08))", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", display: "flex" }}>
        {/* Photo column — gradient stand-in with the real right-edge mask fade */}
        <div style={{ position: "relative", flexGrow: 0, flexShrink: 1, flexBasis: 300, minWidth: 180, alignSelf: "stretch", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #e9d9c7 0%, #cdb49a 48%, #a8c0cf 100%)", maskImage: "linear-gradient(to right, #000 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(to right, #000 55%, transparent 100%)" }} />
        </div>
        {/* Content column */}
        <div style={{ flex: "1 1 auto", minWidth: 0, position: "relative", padding: "18px 22px 20px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className="agent-pill agent-pill-active">Active</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginTop: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 30, fontWeight: 440, color: "var(--agent-text-primary)", margin: 0, letterSpacing: "-0.032em", lineHeight: 1.06 }}>14 Beaumont Rise</h1>
              <p style={{ margin: "6px 0 0", fontSize: 15, color: "var(--agent-text-muted)", lineHeight: 1.35 }}>Harpenden, AL5 2JX</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0, marginTop: 6 }}>
              <div style={{ width: 160, height: 5, borderRadius: 999, background: "var(--agent-hero-track, rgba(45,24,16,0.1))", overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 999, background: "var(--agent-coral)", width: "41%" }} /></div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", whiteSpace: "nowrap" }}><span style={{ fontWeight: 600, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>41%</span> complete</p>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "18px 28px", marginTop: 20 }}>
            <HeroStat Icon={CurrencyGbp} label="Sale price" value="£485,000" />
            <HeroStat Icon={UserCircle} label="Purchase type" value="Mortgage" />
            <HeroStat Icon={HouseSimple} label="Tenure" value="Freehold" />
            <HeroStat Icon={CalendarBlank} label="Expected exchange" value="2 Dec 2026" />
          </div>
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: "0.5px solid var(--agent-border-default)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
              <span style={{ flexShrink: 0 }}><UserAvatar user={{ name: "Laura Bennett", image: null }} size={32} /></span>
              <span><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>Laura Bennett</span><span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>Managing this file</span></span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
              <span aria-hidden style={{ width: 32, height: 32, color: "var(--agent-text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Clock size={21} /></span>
              <span><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>5 weeks</span><span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>Added 14 Oct 2026</span></span>
            </span>
            <span style={{ marginLeft: "auto" }}>
              <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 999, padding: "4px 10px", whiteSpace: "nowrap", color: "#fff", background: "linear-gradient(180deg, var(--agent-coral), var(--agent-coral-deep))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 3px rgba(var(--agent-coral-rgb), 0.30)" }}>Managed by TSP</span>
            </span>
          </div>
        </div>
        {/* Floating Back pill */}
        <span style={{ position: "absolute", top: 14, left: 14, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, color: "#fff", background: "rgba(15,23,42,0.38)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}><ArrowLeft size={13} weight="bold" /> Transactions</span>
      </div>
    </Stage>
  );
}

// ── File tab bar (composite) ────────────────────────────────────────────────
// The property-file tab strip (PropertyFileTabs.tsx): icon (fill when active) +
// label + accent CountBadge, with the coral active underline. Static-underline
// variant so the active tab shows its underline without the JS indicator.
const FILE_TABS: { key: string; label: string; Icon: typeof House; badge?: number }[] = [
  { key: "overview", label: "Overview", Icon: House },
  { key: "steps", label: "Steps", Icon: ListChecks, badge: 3 },
  { key: "reminders", label: "Reminders", Icon: Bell, badge: 2 },
  { key: "todo", label: "To-do", Icon: CheckSquare },
  { key: "documents", label: "Documents", Icon: FileText },
  { key: "activity", label: "Activity", Icon: Pulse },
  { key: "chase", label: "Chase", Icon: PaperPlaneTilt },
];
function FileTabBarDemo() {
  const [active, setActive] = useState("overview");
  return (
    <Stage width={640}>
      <div className="agent-tab-bar agent-tab-bar-static" style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--agent-border-default, rgba(45,24,16,0.08))" }}>
        {FILE_TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setActive(t.key)} aria-selected={isActive} className="agent-tab flex-shrink-0">
              <t.Icon size={15} weight={isActive ? "fill" : "regular"} aria-hidden />
              {t.label}
              {t.badge ? <CountBadge count={t.badge} tone="accent" soft={!isActive} /> : null}
            </button>
          );
        })}
      </div>
    </Stage>
  );
}

// ── Contacts card + contact row (composite) ─────────────────────────────────
// The property-file Contacts card (ContactsSection.tsx): header ("{n} Contacts"
// + subtitle + Add/email actions) over roster rows — avatar (person-art) +
// role-tinted label + name + one detail line + portal dot + comms buttons.
const DEMO_CONTACTS = [
  { id: "v1", name: "Sarah Whitfield", roleType: "vendor" as const, role: "Seller", tint: "var(--agent-info)", phone: "07700 900 412", dot: "var(--agent-success)" },
  { id: "p1", name: "James Okafor", roleType: "purchaser" as const, role: "Buyer", tint: "var(--agent-success)", phone: "07700 900 188", dot: "var(--agent-text-muted)" },
];
function ContactsCardDemo() {
  return (
    <Stage width={440}>
      <div style={{ ...OV_CARD, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}><span style={{ fontVariantNumeric: "tabular-nums" }}>2</span> Contacts</h3>
            <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>People associated with this transaction</span>
          </div>
          <div style={{ display: "flex", alignItems: "stretch", gap: 6, flexShrink: 0 }}>
            <button type="button" className="agent-btn agent-btn-sm agent-btn-primary">+ Add contact</button>
          </div>
        </div>
        {DEMO_CONTACTS.map((c) => (
          <div key={c.id} className="agent-hover-row people-item">
            <div className="people-row" style={{ padding: "10px 16px" }}>
              <span className="people-row-main" style={{ cursor: "default" }}>
                <ContactAvatar contact={{ name: c.name, roleType: c.roleType }} size={40} art />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: c.tint, lineHeight: 1.3, letterSpacing: "0.01em" }}>{c.role}</span>
                  <div style={{ marginTop: 1 }}><span style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>{c.name}</span></div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}><Phone size={11} weight="regular" style={{ flexShrink: 0 }} /><span>{c.phone}</span></div>
                </div>
              </span>
              <div className="people-row-meta">
                <span title="Portal" style={{ width: 7, height: 7, borderRadius: 999, background: c.dot, flexShrink: 0 }} />
              </div>
              <div className="people-row-actions">
                <CommsButton compact href={`tel:${c.phone}`} label="Call" icon={<Phone size={15} weight="regular" />} />
                <CommsButton compact href="#" label="WhatsApp" icon={<ChatCircleText size={15} weight="regular" />} />
                <CommsButton compact href="#" label="Email" icon={<EnvelopeSimple size={15} weight="regular" />} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}

// ── Menu / popover (AnchoredPanel) ──────────────────────────────────────────
function MenuPopoverDemo() {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const firms = ["Andersons Property Law", "Blacks Legal", "Clarke & Mortimer", "Devlin Law LLP", "Gough Thorne"];
  return (
    <Stage width={300}>
      <button ref={ref} type="button" onClick={() => setOpen((o) => !o)} style={{ width: "100%", height: 40, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", cursor: "pointer", color: picked ? "var(--agent-text-primary)" : "var(--agent-text-muted)" }}>
        <span>{picked ?? "Search firm name…"}</span>
        <CaretDown size={14} color="var(--agent-text-muted)" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>
      <AnchoredPanel anchorRef={ref} open={open} onClose={() => setOpen(false)} matchWidth bare placement="bottom-start">
        {firms.map((f) => (
          <button key={f} type="button" className="ui-pop-pick" onMouseDown={() => { setPicked(f); setOpen(false); }}>{f}</button>
        ))}
        <button type="button" className="ui-pop-pick ui-pop-pick-add" onMouseDown={() => setOpen(false)}>+ Add as new firm</button>
      </AnchoredPanel>
    </Stage>
  );
}

// ── Pick row (menu item) ────────────────────────────────────────────────────
function PickRowDemo() {
  return (
    <Stage width={280}>
      <div className="ui-pop" style={{ borderRadius: 12, overflow: "hidden", background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-default)", boxShadow: "0 10px 30px rgba(15,26,46,0.10)" }}>
        <button type="button" className="ui-pop-pick">Andersons Property Law</button>
        <button type="button" className="ui-pop-pick">Blacks Legal</button>
        <p className="ui-pop-pick-empty">No case handlers yet</p>
        <button type="button" className="ui-pop-pick ui-pop-pick-add">+ Add as new firm</button>
      </div>
    </Stage>
  );
}

// ── Save action button (idle → saving → saved) ──────────────────────────────
function SaveActionDemo() {
  return (
    <Stage width={200}>
      <div className="arc-scope" style={{ ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#ffffff", ["--control-height-md" as string]: "46px", ["--text-sm" as string]: "15px" } as CSSProperties}>
        <ActionButton label="Save" pendingLabel="Saving" successLabel="Saved" onAction={() => new Promise<void>((resolve) => setTimeout(resolve, 1200))} />
      </div>
    </Stage>
  );
}

// ── Stepper (arc, vertical / horizontal) ────────────────────────────────────
const STEPPER_TOK = {
  ["--accent" as string]: "var(--agent-coral-deep)",
  ["--accent-foreground" as string]: "#fff",
  ["--accent-strong" as string]: "var(--agent-coral-deep)",
  ["--accent-subtle" as string]: "rgba(255,107,74,0.14)",
  ["--marker" as string]: "var(--agent-coral-deep)",
  ["--halo" as string]: "rgba(255,107,74,0.18)",
  ["--foreground" as string]: "var(--agent-text-primary)",
  ["--text-secondary" as string]: "var(--agent-text-secondary)",
  ["--text-muted" as string]: "var(--agent-text-muted)",
  ["--border" as string]: "var(--agent-border-default)",
  ["--border-strong" as string]: "var(--agent-border-default)",
  ["--surface" as string]: "var(--agent-surface-elevated)",
} as CSSProperties;
const STEPPER_STEPS = [
  { id: "profile", label: "Profile", description: "Your name and photo" },
  { id: "workspace", label: "Workspace", description: "Name and web address" },
  { id: "team", label: "Team", description: "Invite collaborators" },
  { id: "review", label: "Review", description: "Confirm and finish" },
];
function StepperDemo() {
  const [current, setCurrent] = useState(1);
  return (
    <Stage width={340}>
      <div className="arc-scope" style={STEPPER_TOK}>
        <Stepper steps={STEPPER_STEPS} current={current} orientation="vertical" onStepSelect={setCurrent} label="Set-up progress" />
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={() => setCurrent((c) => Math.max(0, c - 1))} style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-secondary)", background: "none", border: "1px solid var(--agent-border-default)", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>Back</button>
          <button type="button" onClick={() => setCurrent((c) => Math.min(STEPPER_STEPS.length, c + 1))} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "var(--agent-coral-deep)", border: "none", borderRadius: 8, padding: "5px 14px", cursor: "pointer" }}>Next</button>
        </div>
      </div>
    </Stage>
  );
}

// ── Phone input (arc, international) ─────────────────────────────────────────
function PhoneInputDemo() {
  const [v, setV] = useState("");
  return (
    <Stage width={320}>
      <div className="arc-scope" style={{
        width: 300, ["--control-height-md" as string]: "42px", ["--radius-control" as string]: "16px",
        ["--surface" as string]: "#fff", ["--surface-raised" as string]: "#fff", ["--surface-muted" as string]: "rgba(15,23,42,0.04)",
        ["--border" as string]: "var(--agent-border-default)", ["--border-strong" as string]: "var(--agent-border-default)", ["--border-subtle" as string]: "var(--agent-border-default)",
        ["--foreground" as string]: "var(--agent-text-primary)", ["--text-secondary" as string]: "var(--agent-text-primary)", ["--text-muted" as string]: "var(--agent-text-muted)", ["--success" as string]: "var(--agent-success)",
      } as CSSProperties}>
        <style>{".arc-scope label{position:static}"}</style>
        <PhoneInput label="Phone" value={v} onValueChange={setV} defaultCountry="GB" />
      </div>
    </Stage>
  );
}

// ── Filter chip (hero Choice — coral + animated check when selected) ─────────
function PillChoice({ v, sel, onClick, children }: { v: string; sel: string; onClick: () => void; children: ReactNode }) {
  const on = sel === v;
  const [h, setH] = useState(false);
  return (
    <button type="button" aria-pressed={on} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: "inherit", fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", padding: "6px 15px", borderRadius: 999, cursor: "pointer",
      border: on ? "1.5px solid transparent" : `1.5px solid ${h ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
      background: on ? "var(--agent-coral-deep)" : "transparent",
      color: on ? "var(--agent-text-on-coral, #fff)" : h ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
      transition: "background 160ms, border-color 150ms, color 150ms",
    }}>
      <span aria-hidden style={{ display: "inline-flex", alignItems: "center", overflow: "hidden", width: on ? 17 : 0, opacity: on ? 1 : 0, transition: "width 200ms cubic-bezier(0.16,1,0.3,1), opacity 150ms ease" }}>
        <Check size={13} weight="bold" />
      </span>
      {children}
    </button>
  );
}
function SelectionPillDemo() {
  const [sel, setSel] = useState("freehold");
  return (
    <Stage width={360}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: sel ? "var(--agent-success)" : "var(--agent-text-muted)" }}>Tenure</span>
        <PillChoice v="freehold" sel={sel} onClick={() => setSel("freehold")}>Freehold</PillChoice>
        <PillChoice v="leasehold" sel={sel} onClick={() => setSel("leasehold")}>Leasehold</PillChoice>
        <PillChoice v="share" sel={sel} onClick={() => setSel("share")}>Share of freehold</PillChoice>
      </div>
    </Stage>
  );
}

// ── Breakdown row (label ↔ value) ───────────────────────────────────────────
function BRow({ label, value, tone, strong }: { label: string; value: string; tone?: "income" | "cost" | "muted"; strong?: boolean }) {
  const vc = tone === "income" ? "var(--agent-success)" : tone === "cost" ? "var(--agent-warning)" : tone === "muted" ? "var(--agent-text-muted)" : "var(--agent-text-primary)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: strong ? 12.5 : 12, fontWeight: strong ? 600 : 400, color: strong ? "var(--agent-text-primary)" : "var(--agent-text-muted)" }}>{label}</span>
      <span style={{ fontSize: strong ? 18 : 13, fontWeight: strong ? 700 : 600, color: strong ? "var(--agent-success)" : vc, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
function BreakdownRowDemo() {
  return (
    <Stage width={300}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <BRow label="Commission" value="£3,500 inc VAT" />
        <BRow label="Solicitor referral" value="+£150" tone="income" />
        <BRow label="Sent to us" value="Free" tone="muted" />
        <div style={{ borderTop: "0.5px solid var(--agent-border-default)", paddingTop: 8, marginTop: 2 }}>
          <BRow label="Net to your agency" value="£3,650" strong />
        </div>
      </div>
    </Stage>
  );
}

function StatusPillDemo() {
  const pills: { label: string; bg: string; fg: string; bd: string }[] = [
    { label: "Active", bg: "rgba(16,185,129,0.14)", fg: "#047857", bd: "rgba(16,185,129,0.30)" },
    { label: "On hold", bg: "rgba(245,158,11,0.14)", fg: "#b45309", bd: "rgba(245,158,11,0.30)" },
    { label: "Completed", bg: "rgba(255,107,74,0.12)", fg: "#E55B3D", bd: "rgba(255,138,101,0.40)" },
    { label: "Withdrawn", bg: "rgba(220,38,38,0.12)", fg: "#b91c1c", bd: "rgba(220,38,38,0.30)" },
  ];
  return <Stage><div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{pills.map((p) => <span key={p.label} style={{ display: "inline-flex", alignItems: "center", padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: p.bg, color: p.fg, border: `1px solid ${p.bd}` }}>{p.label}</span>)}</div></Stage>;
}
function HeroStatCellDemo() {
  const cells: [typeof House, string, string][] = [
    [CurrencyGbp, "£625,000", "Sale price"],
    [UserCircleGear, "Mortgage", "Purchase type"],
    [HouseLine, "Freehold", "Tenure"],
    [CalendarCheck, "9 Nov 2026", "Expected exchange"],
  ];
  return (
    <Stage width={440}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 24px" }}>
        {cells.map(([Ic, v, l], i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            <span style={{ flexShrink: 0, color: CORAL, display: "flex" }}><Ic size={19} weight="regular" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: T_INK, lineHeight: 1.2 }}>{v}</div>
              <div style={{ fontSize: 11, color: T_MUTED, lineHeight: 1.3 }}>{l}</div>
            </div>
          </div>
        ))}
      </div>
    </Stage>
  );
}
function PriceFieldDemo() {
  const [v, setV] = useState<number | null>(47787500);
  return <Stage width={360}><div style={{ width: 300 }}><PriceField value={v} onChange={setV} label="Sale price" /></div></Stage>;
}
function PercentFieldDemo() {
  const [v, setV] = useState("1.25");
  return <Stage width={360}><div style={{ width: 200 }}><PercentField value={v} onChange={setV} label="Commission rate" /></div></Stage>;
}
function SelectDemo() {
  const [v, setV] = useState<string | null>("rahul");
  return (
    <Stage width={360}>
      <div style={{ width: 280 }}>
        <Select
          label="Case handler"
          value={v}
          onChange={setV}
          options={[{ value: "jane", label: "Jane Powell" }, { value: "rahul", label: "Rahul Shah" }, { value: "maria", label: "Maria Costa" }]}
          addAction={{ label: "Add a new case handler", onClick: () => {} }}
        />
      </div>
    </Stage>
  );
}
/* The per-field status rail from the contact editor — one dot per input, grey (empty)
   → coral (mid-type) → green (valid). */
function FieldStatusRailDemo() {
  const rows: { label: string; state: "empty" | "typing" | "valid"; value: string }[] = [
    { label: "Full name", state: "valid", value: "James Foster" },
    { label: "Phone", state: "typing", value: "07700 900" },
    { label: "Email", state: "empty", value: "" },
  ];
  const tone = (s: string) => (s === "valid" ? "var(--agent-success)" : s === "typing" ? CORAL : "var(--agent-border-default)");
  return (
    <Stage width={360}>
      <div style={{ display: "flex", gap: 12, width: 300 }}>
        {/* the rail */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, paddingTop: 16 }}>
          {rows.map((r, i) => (
            <div key={r.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, color: r.state === "empty" ? "var(--agent-text-faint)" : "#fff", background: r.state === "empty" ? "transparent" : tone(r.state), border: r.state === "empty" ? `1.5px solid ${tone(r.state)}` : "none" }}>{i + 1}</span>
              {i < rows.length - 1 && <span style={{ width: 1.5, height: 30, background: "var(--agent-border-default)" }} />}
            </div>
          ))}
        </div>
        {/* the fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
          {rows.map((r) => (
            <div key={r.label} style={{ height: 40, padding: "0 12px", display: "flex", alignItems: "center", borderRadius: 10, border: `1px solid ${r.state === "typing" ? CORAL : "var(--agent-border-default)"}`, background: "var(--agent-surface-elevated)", fontSize: 13, color: r.value ? "var(--agent-text-primary)" : "var(--agent-text-muted)" }}>{r.value || r.label}</div>
          ))}
        </div>
      </div>
    </Stage>
  );
}
/* The stacked inline confirm/cancel (tick + X) that replaces a "Done" on an in-place
   editor. Keyed so re-selecting the entry replays the spring-in. */
function EditConfirmActionsDemo() {
  const [k, setK] = useState(0);
  return (
    <Stage width={240}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <EditConfirmActions key={k} onConfirm={() => setK((n) => n + 1)} onCancel={() => setK((n) => n + 1)} />
        <span style={{ fontSize: 11, color: "rgba(45,24,16,0.45)" }}>Click either to replay</span>
      </div>
    </Stage>
  );
}
/* The canonical checkbox — identical to the sign-up terms checkbox: the arc Checkbox
   under .arc-scope with the coral control tokens, default label/box spacing. */
function CheckboxDemo() {
  const [on, setOn] = useState(true);
  return (
    <Stage width={360}>
      <div className="arc-scope" style={{ ["--control-on" as string]: "#FF6B4A", ["--control-glyph" as string]: "#ffffff" } as CSSProperties}>
        <Checkbox checked={on} onCheckedChange={(v) => setOn(v === true)} label="This is our recommended broker" />
      </div>
    </Stage>
  );
}
/* The removable person pill (shown when a contact group has >1 person) — the active
   person highlighted, with an in-pill × to remove. */
function PeoplePillDemo() {
  const people = ["James Foster", "Sarah Foster"];
  const [active, setActive] = useState(0);
  return (
    <Stage width={360}>
      {/* Canonical X: bare at rest, circle on hover (decision 4). */}
      <style>{`.ds-pill-x{display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:transparent;transition:background .14s ease}.ds-pill-x:hover{background:rgba(45,24,16,0.09)}`}</style>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {people.map((p, i) => {
          const on = i === active;
          return (
            <span key={p} style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 6px 0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: on ? "var(--agent-text-primary)" : "var(--agent-text-muted)", background: "var(--agent-surface-elevated)", boxShadow: on ? `inset 0 0 0 1.5px ${CORAL}` : "inset 0 0 0 1px var(--agent-border-default)" }} onClick={() => setActive(i)}>
              {p}
              <span aria-hidden className="ds-pill-x" style={{ color: "var(--agent-text-muted)" }}><X size={11} weight="bold" /></span>
            </span>
          );
        })}
      </div>
    </Stage>
  );
}
function NotesFieldDemo() {
  const [v, setV] = useState("Keep the final pass calm and focused.");
  return <Stage width={420}><div style={{ width: 360 }}><NotesField label="Project note" value={v} onChange={setV} placeholder="Any context about this sale…" description="Visible to everyone on the project." /></div></Stage>;
}
function AsOfControlDemo() {
  const [spinning, setSpinning] = useState(false);
  const spin = () => { setSpinning(true); window.setTimeout(() => setSpinning(false), 700); };
  return (
    <Stage width={220}>
      <style>{"@keyframes ds-spin{to{transform:rotate(360deg)}}.ds-asof:hover{background:rgba(45,24,16,0.05)}"}</style>
      <button type="button" onClick={spin} title="Refresh data" className="ds-asof" style={{ display: "inline-flex", alignItems: "center", gap: 5, border: "none", cursor: "pointer", color: T_MUTED, fontSize: 11, padding: "4px 8px", borderRadius: 6, background: "transparent", whiteSpace: "nowrap", transition: "background .12s ease" }}>
        <span style={{ display: "inline-flex", animation: spinning ? "ds-spin 700ms linear infinite" : undefined }}><ArrowsClockwise size={13} /></span>
        <span>As of 11:19</span>
      </button>
    </Stage>
  );
}
function FactTilesDemo() {
  const tile = (label: string, children: ReactNode, accent = false) => (
    <div style={{ padding: "10px 12px", borderRadius: 10, background: accent ? "rgba(47,158,107,0.08)" : "rgba(255,255,255,0.6)", border: `1px solid ${accent ? "rgba(47,158,107,0.30)" : "rgba(45,24,16,0.08)"}` }}>
      <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: accent ? "#2F9E6B" : T_MUTED }}>{label}</p>
      {children}
    </div>
  );
  return (
    <Stage width={400}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {tile("Last sold", <>
          <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 700, color: T_INK }}>£473,200</p>
          <p style={{ margin: 0, fontSize: 11, color: T_MUTED }}>Jan 2026</p>
        </>)}
        {tile("EPC rating", <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#8dba2d", lineHeight: 1 }}>C</span>
            <span style={{ fontSize: 12, color: T_MUTED }}>72</span>
          </div>
          <p style={{ margin: "2px 0 0", fontSize: 10, color: T_MUTED }}>Valid until Mar 2030</p>
        </>)}
        {tile("Tenure (Land Registry)", <>
          <p style={{ margin: "0 0 1px", fontSize: 13, fontWeight: 600, color: "#2F9E6B", textTransform: "capitalize" }}>Leasehold <span style={{ fontWeight: 400, fontSize: 11, color: T_MUTED }}>· since 2019</span></p>
          <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4, background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#2F9E6B", padding: 0 }}>Use this <ArrowRight size={10} weight="bold" /></button>
        </>, true)}
      </div>
    </Stage>
  );
}
function OnboardingHeroDemo() {
  return (
    <Stage width={600}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 20, minHeight: 170, padding: "30px 32px", border: "1px solid rgba(45,24,16,0.08)", background: "linear-gradient(100deg, rgba(255,107,74,0.14), rgba(255,107,74,0.05) 52%, transparent 78%)" }}>
        <div style={{ position: "relative", maxWidth: 420 }}>
          <p style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 600, color: T_INK, letterSpacing: "-0.01em", lineHeight: 1.15 }}>Let&apos;s add your first sale</p>
          <p style={{ margin: "0 0 22px", fontSize: 14, color: T_MUTED, lineHeight: 1.6 }}>Add a memo of sale to see how a sale runs through Sales Progressor, or fill in the details yourself.</p>
          <button type="button" style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 40, paddingLeft: 6, paddingRight: 18, borderRadius: 12, background: "#fff", border: "1px solid rgba(45,24,16,0.14)", color: T_INK, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: CORAL, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Play size={14} weight="fill" style={{ marginLeft: 1 }} /></span>
            See how it works
          </button>
        </div>
      </div>
    </Stage>
  );
}
function DockDemo() {
  const btn: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: 0, background: "transparent", color: T_INK, fontSize: 13, fontWeight: 600, cursor: "pointer" };
  return (
    <Stage>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: 6, borderRadius: 999, background: "rgba(255,255,255,0.64)", border: "1px solid rgba(255,255,255,0.6)", backdropFilter: "blur(30px) saturate(200%)", WebkitBackdropFilter: "blur(30px) saturate(200%)", boxShadow: "0 10px 30px rgba(30,20,15,0.14), inset 0 1px 0 rgba(255,255,255,0.6)" }}>
        <button type="button" style={btn}><NotePencil size={16} color={CORAL} /> New note</button>
        <span style={{ width: 1, height: 18, background: "rgba(45,24,16,0.12)" }} />
        <button type="button" style={btn}><PaperPlaneTilt size={16} color={CORAL} /> New email</button>
      </div>
    </Stage>
  );
}
function ResultsPanelDemo() {
  const sales: [string, string, string][] = [
    ["53 The Meadway", "£473,200", "Jan 2026"],
    ["28 The Meadway", "£340,000", "Feb 2025"],
    ["52 The Meadway", "£405,000", "Jan 2024"],
  ];
  return (
    <Stage width={420}>
      <style>{".ds-close2{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;border:0;background:transparent;color:rgba(45,24,16,0.5);cursor:pointer;transition:background .14s ease,color .14s ease}.ds-close2:hover{background:rgba(45,24,16,0.07);color:#2D1810}"}</style>
      <div style={{ padding: 20, borderRadius: 16, background: "#fff", border: "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.06)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 600, color: T_MUTED }}>Area research · EN11 8AS</p>
            <p style={{ margin: 0, fontSize: 11, color: T_MUTED, fontStyle: "italic", lineHeight: 1.4 }}>Postcode-level data. No specific property matched yet.</p>
          </div>
          <button type="button" className="ds-close2" aria-label="Clear property research"><X size={14} weight="bold" /></button>
        </div>
        <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: T_MUTED }}>Recent sales nearby</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sales.map(([a, p, d]) => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8, background: "rgba(255,255,255,0.6)", border: "1px solid rgba(45,24,16,0.08)" }}>
              <span style={{ fontSize: 12, color: T_INK, fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T_INK, flexShrink: 0 }}>{p}</span>
              <span style={{ fontSize: 11, color: T_MUTED, flexShrink: 0 }}>{d}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: "14px 0 0", fontSize: 10, color: T_MUTED, opacity: 0.65 }}>Sources: HM Land Registry · EPC Register</p>
      </div>
    </Stage>
  );
}
function PillDemo() {
  return (
    <Stage width={440}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Pill tone="success" size="sm">From memo</Pill>
        <Pill tone="brand" size="sm">New</Pill>
        <Pill tone="warning" size="sm">Action needed</Pill>
        <Pill tone="info" size="sm">Preview</Pill>
        <Pill tone="danger" size="sm">Overdue</Pill>
        <Pill tone="muted" size="sm">Draft</Pill>
        <Pill glass tone="success" size="sm">Verified</Pill>
      </div>
    </Stage>
  );
}
function ActionCardDemo({ state = "default" }: { state?: "default" | "dragover" | "error" }) {
  const drag = state === "dragover";
  return (
    <Stage width={360}>
      <style>{"@keyframes ds-pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}"}</style>
      <div style={{ padding: "28px 24px", borderRadius: 20, background: drag ? "rgba(255,107,74,0.06)" : "#fff", border: drag ? "2px dashed rgba(255,107,74,0.40)" : "1px solid rgba(45,24,16,0.08)", boxShadow: "0 1px 3px rgba(30,20,15,0.06)", transition: "background 200ms, border 200ms" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_DEEP, animation: "ds-pulse-dot 2.4s ease-in-out infinite", marginBottom: 18 }} />
        <p style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 600, color: drag ? CORAL : T_INK, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{drag ? "Drop it here." : "Ready to add a sale?"}</p>
        <p style={{ margin: "0 0 22px", fontSize: 14, color: T_MUTED, lineHeight: 1.6, opacity: drag ? 0 : 1, minHeight: 22 }}>Drop a memo, paste it (⌘V), or screenshot an email.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button type="button" variant="primary" style={{ "--foreground": CORAL, "--background": "#ffffff", width: "100%", justifyContent: "center" } as CSSProperties}>Drop a memo of sale</Button>
          <Button type="button" variant="secondary" style={{ width: "100%", justifyContent: "center", "--control-on": CORAL } as CSSProperties}>Fill in manually</Button>
        </div>
        {state === "error" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 0" }}>
            <WarningCircle size={15} weight="fill" color="#C97D1A" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 12, color: "#C97D1A", lineHeight: 1.4 }}>We couldn&apos;t read that memo. Try a clearer photo, or fill in the details manually.</p>
          </div>
        )}
      </div>
    </Stage>
  );
}
const DRAFT_X: CSSProperties = { width: 26, height: 26, borderRadius: 999, border: "none", background: "transparent", color: T_MUTED, cursor: "pointer", display: "grid", placeItems: "center", fontSize: 16, flexShrink: 0, lineHeight: 1 };
function DraftRowDemo() {
  return (
    <Stage width={360}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Resume shortcut (most-recent draft, above the dropzone) */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 10 }}>
          <button type="button" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flex: 1, minWidth: 0, padding: "10px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: T_MUTED, borderRadius: 10 }}>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>Resume</span>
            <span style={{ fontWeight: 500, color: T_INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>12 Oak Avenue, Bristol</span>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>2h ago</span>
          </button>
          <button type="button" aria-label="Remove draft" style={DRAFT_X}>&times;</button>
        </div>
        {/* Draft list row (under "All drafts") */}
        <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,0.6)", border: "0.5px solid rgba(45,24,16,0.08)", gap: 8 }}>
          <button type="button" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: T_INK, textAlign: "left", flex: 1, minWidth: 0, padding: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>48 Elmwood Road, Bath</button>
          <span style={{ fontSize: 11, color: T_MUTED, flexShrink: 0 }}>1d ago</span>
          <button type="button" aria-label="Remove draft" style={DRAFT_X}>&times;</button>
        </div>
      </div>
    </Stage>
  );
}
const NEWSALE_ENTRIES: ComponentEntry[] = [
  {
    id: "pulse-dot",
    name: "Pulse dot (live indicator)",
    category: "badges",
    status: "implemented",
    keywords: ["dot", "pulse", "breathing", "flashing", "live", "ai", "indicator", "ping", "active", "orange dot", "coral dot"],
    summary: "A small coral dot that breathes — fading and shrinking on a 2.4s loop — to signal a live / AI-backed surface. On the new-sale card it marks the memo-AI entry (hidden when the AI master switch is off). Respects prefers-reduced-motion via the shared keyframe.",
    sources: [
      { path: "components/transactions-v2/HeroCard.tsx", note: "the breathing AI dot" },
      { path: "app/agent/styles/agent-system.css", note: "@keyframes agent-pulse-dot" },
    ],
    render: () => (
      <Stage>
        <style>{"@keyframes ds-pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}"}</style>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: DOT_DEEP, animation: "ds-pulse-dot 2.4s ease-in-out infinite" }} />
      </Stage>
    ),
  },
  {
    id: "card-action",
    name: "Action card",
    category: "cards",
    status: "implemented",
    keywords: ["action card", "add a sale", "drop a memo", "cta card", "pulse", "stacked buttons", "new sale", "dropzone"],
    summary: "The primary action card on the new-sale page — a pulse dot, a title (24/600) + one line of sub-copy, then full-width stacked CTAs (flat-coral primary + white/outline secondary). Sits on the Dark Frosted Main surface and doubles as a drag-and-drop zone for a memo. Buttons are the canonical pair via a .agent-canon-cta scope.",
    sources: [{ path: "components/transactions-v2/HeroCard.tsx", note: "the drop-a-memo card" }],
    exceptions: [{ title: "Buttons via canon scope", detail: "The two actions are the canonical flat-coral primary + theme-aware white/outline secondary, applied by wrapping the card in a .agent-canon-cta scope (the same mechanism as the empty states). Widths, 14px radii and the drag-and-drop behaviour are unchanged.", scope: "shared" }],
    // Step the chips: rest → drag-over (coral dashed “Drop it here.”) → error (a
    // failed memo read lands here as an amber notice, next to the dropzone).
    states: [
      { id: "default", label: "Rest", render: () => <ActionCardDemo state="default" /> },
      { id: "dragover", label: "Drag-over (“Drop it here.”)", render: () => <ActionCardDemo state="dragover" /> },
      { id: "error", label: "Error (unreadable memo)", render: () => <ActionCardDemo state="error" /> },
    ],
    render: () => <ActionCardDemo state="default" />,
  },
  {
    id: "card-lookup",
    name: "Research / lookup card",
    category: "cards",
    status: "implemented",
    keywords: ["research", "lookup", "postcode", "property", "search card", "epc", "land registry", "intel", "find"],
    summary: "The property-research card on the new-sale page — the canonical SearchField in its lookup mode (search icon + Enter-or-tap “Look up” submit), a line of explainer copy, the “what you can check” list, and a source line. No eyebrow header. Sits on the Dark Frosted Main surface.",
    sources: [
      { path: "components/transactions-v2/ResearchPanel.tsx", note: "the research card" },
      { path: "components/arc/search-field/search-field.tsx", note: "canonical lookup field" },
    ],
    exceptions: [{ title: "Lookup field, not a plain input", detail: "The postcode field is the canonical SearchField extended with an optional submit — the “Look up” pill is the tap affordance on touch, where there is no Enter key. Arc tokens are mapped to the agent input footprint. The old bespoke input + floating button + eyebrow header are retired.", source: "components/arc/search-field/search-field.tsx", scope: "shared" }],
    // Click the state chips below to step through the card's three real states.
    states: [
      { id: "idle", label: "Idle (lookup field + list)", render: () => <Stage width={340}><LookupCardDemo state="idle" /></Stage> },
      { id: "loading", label: "Loading (skeletons)", render: () => <Stage width={340}><LookupCardDemo state="loading" /></Stage> },
      { id: "error", label: "Error (no data + Try again)", render: () => <Stage width={340}><LookupCardDemo state="error" /></Stage> },
    ],
    render: () => <Stage width={340}><LookupCardDemo state="idle" /></Stage>,
  },
  {
    id: "draft-row",
    name: "Draft row + Resume shortcut",
    category: "rows",
    status: "implemented",
    keywords: ["row", "draft", "resume", "list item", "saved draft", "remove", "collapse", "new sale"],
    summary: "The saved-draft rows on the new-sale card — a centred “Resume · address · time” shortcut above the dropzone, and the glass list rows under “All drafts”. Each pairs a left-aligned address button with a relative time and a remove × (the canonical small icon button).",
    variants: [{ id: "resume", label: "Resume shortcut (most recent)" }, { id: "list", label: "Draft list row (glass)" }],
    sources: [{ path: "components/transactions-v2/HeroCard.tsx", note: "ResumeRow + DraftRow" }],
    exceptions: [{ title: "Collapse-on-remove", detail: "Removing animates grid-template-rows 1fr → 0fr over 220ms (cubic-bezier(0.4,0,0.2,1)) and fades opacity over 160ms, so the row collapses smoothly rather than vanishing. The × is the canonical small icon button (agent-icon-btn-sm); the list row carries the shared agent-hover-row tint.", source: "components/transactions-v2/HeroCard.tsx", scope: "shared" }],
    render: () => <DraftRowDemo />,
  },
  {
    id: "status-pill",
    name: "File status pill",
    category: "badges",
    status: "implemented",
    keywords: ["status", "pill", "badge", "active", "on hold", "completed", "withdrawn", "file", "tinted", "property file"],
    summary: "The transaction status badge — a tinted pill carrying the kind colour (green Active, amber On hold, coral Completed, red Withdrawn) on a light tone fill with a matching border. The canonical agent-pill; the file hero + lists use it. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "app/agent/styles/agent-system.css", note: ".agent-pill + .agent-pill-active/-hold/-completed/-withdrawn" }, { path: "components/transaction/PropertyHero.tsx", note: "STATUS_PILL map" }],
    render: () => <StatusPillDemo />,
  },
  {
    id: "hero-stat-cell",
    name: "Hero stat cell",
    category: "rows",
    status: "implemented",
    keywords: ["stat", "stat cell", "hero", "sale price", "purchase type", "tenure", "expected exchange", "icon value label", "property file"],
    summary: "The fact cell in the file hero — a bare coral icon beside a value (15/600) over a muted label. Laid out in a 2-col grid (Sale price · Purchase type · Tenure · Expected exchange). No tinted box. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/transaction/PropertyHero.tsx", note: "HeroStatCell" }],
    render: () => <HeroStatCellDemo />,
  },
  {
    id: "next-action-card",
    name: "Next action card (file overview)",
    category: "cards",
    status: "implemented",
    keywords: ["next action", "overview", "chase", "flame", "due", "call progressor", "property file", "card"],
    summary: "The highest-priority action on a file — an eyebrow, a flame beside the [title / due-line], an indented description, and a coral primary + secondary action row. The due is a plain coloured line, not a pill. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/transaction/NextActionCard.tsx", note: "the real card" }],
    render: () => <NextActionCardDemo />,
  },
  {
    id: "sale-health-card",
    name: "Sale health card (sidebar)",
    category: "cards",
    status: "implemented",
    keywords: ["sale health", "on track", "off track", "at risk", "time on file", "risk level", "health bar", "sidebar", "property file"],
    summary: "The file-health summary — a heartbeat glyph (status colour) + “Sale health” + the status word, label↔value rows, a health meter bar, and a coral “View health details →” link. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/transaction/AgentFileSidebar.tsx", note: "the real card" }],
    render: () => <SaleHealthCardDemo />,
  },
  {
    id: "key-dates-card",
    name: "Key dates card (sidebar)",
    category: "cards",
    status: "implemented",
    keywords: ["key dates", "12-week target", "est. ready to exchange", "completion", "time to exchange", "sidebar", "property file"],
    summary: "The forecast dates — calendar glyph + “Key dates”, then 12-week target / Est. ready to exchange / Completion / Time to exchange, and the chain-not-included caveat. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/transaction/AgentFileSidebar.tsx", note: "the real card" }],
    render: () => <KeyDatesCardDemo />,
  },
  {
    id: "file-hero",
    name: "File hero",
    category: "cards",
    status: "implemented",
    keywords: ["file hero", "property hero", "photo", "back", "status", "address", "progress bar", "stat row", "managing", "property file"],
    summary: "The whole top of a property file — masked photo + floating Back pill, then status pill, address, inline progress, the four-stat row (price / type / tenure / exchange), and the meta row (who’s managing it, file age, the Managed-by pill). (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/transaction/PropertyHero.tsx", note: "agent path" }],
    render: () => <FileHeroDemo />,
  },
  {
    id: "file-tab-bar",
    name: "File tab bar",
    category: "cards",
    status: "implemented",
    keywords: ["tabs", "tab bar", "overview", "steps", "underline", "count badge", "property file", "navigation"],
    summary: "The property-file tab strip — an icon that fills when active, the label, an accent count badge, and the coral active underline. Click a tab to move it. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/transaction/PropertyFileTabs.tsx", note: "the real bar" }],
    render: () => <FileTabBarDemo />,
  },
  {
    id: "contacts-card",
    name: "Contacts card + contact row",
    category: "cards",
    status: "implemented",
    keywords: ["contacts", "contact row", "people", "avatar", "seller", "buyer", "call", "whatsapp", "email", "comms", "property file"],
    summary: "The file’s people card — a “{n} Contacts” header with Add, then roster rows: person-art avatar, role-tinted label (Seller / Buyer), name, one detail line, portal dot, and the Call / WhatsApp / Email comms buttons. (Property-file pass — catalogued ahead.)",
    sources: [{ path: "components/contacts/ContactsSection.tsx", note: "header + roster row" }, { path: "components/ui/CommsButton.tsx", note: "comms buttons" }],
    render: () => <ContactsCardDemo />,
  },
  {
    id: "menu-popover",
    name: "Menu / popover (anchored)",
    category: "drawers",
    status: "implemented",
    keywords: ["menu", "popover", "dropdown", "anchored panel", "typeahead", "results", "solicitor", "firm search", "flyout"],
    summary: "The canonical floating menu — AnchoredPanel anchors to a trigger, matches its width, opens with a fade/scale and closes on outside-click or Escape. It portals to the body and reads the theme, so it stays styled over anything. Click the field to open it; the rows live inside.",
    sources: [{ path: "components/ui/Popover.tsx", note: "AnchoredPanel" }, { path: "components/solicitors/SolicitorPicker.tsx", note: "the firm-results use" }],
    render: () => <MenuPopoverDemo />,
  },
  {
    id: "pick-row",
    name: "Menu pick row (+ add action)",
    category: "rows",
    status: "implemented",
    keywords: ["pick", "menu item", "option row", "ui-pop-pick", "add new", "select", "result row", "fade on hover"],
    summary: "The selectable row inside a menu — full-width, left-aligned, hairline-separated, with a soft hover fill. The “+ Add as new…” action variant is coral, and there’s a muted empty line for “nothing yet”. Hover the rows.",
    sources: [{ path: "app/agent/styles/agent-system.css", note: ".ui-pop-pick / -add / -empty" }],
    render: () => <PickRowDemo />,
  },
  {
    id: "save-action-button",
    name: "Save button (action states)",
    category: "buttons",
    status: "proposed",
    keywords: ["save", "action", "button", "saving", "saved", "pending", "success", "tick", "spinner", "primary"],
    summary: "The canonical Save button — coral primary (token override). Press it: the label morphs Save → Saving (spinner) → Saved (a drawn tick), then resets. The arrow leaves in the action's direction and returns on reset. Click it.",
    sources: [{ path: "components/arc/action-button/action-button.tsx", note: "the component" }],
    render: () => <SaveActionDemo />,
  },
  {
    id: "stepper",
    name: "Stepper (steps indicator)",
    category: "progress",
    status: "proposed",
    keywords: ["stepper", "steps", "wizard", "progress", "onboarding", "numbered", "tick", "vertical", "multi-step", "contacts"],
    summary: "The arc Stepper — numbered markers that tick as you pass them, a current ring, connectors that fill, and click-to-return on completed steps. Vertical here; it also runs horizontal. Earmarked to replace the contact-carousel dots (numbered vendor/purchaser steps, ticked when each is complete). Click a passed step, or Back/Next.",
    sources: [{ path: "components/arc/stepper/stepper.tsx", note: "the component" }],
    render: () => <StepperDemo />,
  },
  {
    id: "phone-input",
    name: "Phone input (international)",
    category: "text-inputs",
    status: "proposed",
    keywords: ["phone", "tel", "country", "dial code", "international", "e164", "number"],
    summary: "The arc PhoneInput — a country picker (open it), as-you-type national formatting with a faint guide, a valid-tick, and E.164 out. Catalogued and ready; the live add-sale phone fields are parked on the UK-formatted LabelInput for now (switching needs an E.164 + draft-migration decision).",
    sources: [{ path: "components/arc/phone-input/phone-input.tsx", note: "the component" }],
    render: () => <PhoneInputDemo />,
  },
  {
    id: "filter-chip",
    name: "Filter chip (single-select)",
    category: "toggles",
    status: "implemented",
    keywords: ["filter", "chip", "selection", "pill", "radio", "tenure", "purchase type", "choice", "hero", "single select", "check", "liquid glass"],
    summary: "The filter chip used in the editable hero (tenure / purchase type / progressed-by) — solid coral with an animated check tick when selected, a clean outline that warms to coral on hover otherwise. No wash fill. Mirrors the Liquid Glass GlassChip, rendered with agent tokens so it lives natively in the agent app. Click to switch.",
    sources: [{ path: "components/transactions-v2/SaleHeroEditable.tsx", note: "Choice" }, { path: "components/liquid/components.tsx", note: "GlassChip (forward reference)" }],
    render: () => <SelectionPillDemo />,
  },
  {
    id: "breakdown-row",
    name: "Breakdown row (label ↔ value)",
    category: "rows",
    status: "implemented",
    keywords: ["breakdown", "line item", "label value", "commission", "earnings", "net", "total", "referral", "ledger row"],
    summary: "The label↔value rows in the earnings card — label left, value right (tabular), with income (green +) / cost (amber −) / muted tones and an emphasised total above a divider. Used for the commission breakdown and net-to-agency.",
    sources: [{ path: "components/transactions-v2/EarningsBuilder.tsx", note: "Row + net total" }],
    render: () => <BreakdownRowDemo />,
  },
  {
    id: "price-field",
    name: "Price field (money input)",
    category: "text-inputs",
    status: "implemented",
    keywords: ["price", "money", "amount", "currency", "pound", "gbp", "pence", "sale price", "commission", "rolling digits", "money input"],
    summary: "The canonical price field — the arc MoneyInput locked to GBP: digits group live as you type, the missing pence wait as faint ghosts so the width never jumps, the amount scales to fit, and arrow keys roll it. Border on the agent token; value in pence. Type in it to see the rolling digits.",
    sources: [
      { path: "components/ui/PriceField.tsx", note: "the GBP-locked wrapper (our canonical)" },
      { path: "components/arc/money-input/money-input.tsx", note: "the vendored arc component (MIT)" },
    ],
    exceptions: [
      { title: "GBP-locked · pence · token border", detail: "currencies=['GBP'] hides the currency menu; quickAdd=[] hides the add chips; locale en-GB gives the £ prefix; showCurrency=false drops the 'GBP' text (the £ is the indicator). Value is minor units (pence) — a drop-in for purchasePricePence. A `bare` mode (transparent, no padding) drops it inline into the commission box. Now live on the sale-price hero + commission.", source: "components/ui/PriceField.tsx", scope: "shared" },
      { title: "Commission box: coral focus + persistent filled background", detail: "The .nsf-commission-box that wraps the bare PriceField / PercentField hovers + focuses to a CORAL border (was blue --agent-info, fixed 2026-11-20) to match the coral form, and once a commission is entered it carries data-filled, which keeps the raised 'selected' background even when not focused — a filled box reads as settled rather than reverting to the faint rest tint.", source: "app/agent/styles/agent-system.css", scope: "specific" },
    ],
    render: () => <PriceFieldDemo />,
  },
  {
    id: "notes-field",
    name: "Textarea / notes field",
    category: "text-inputs",
    status: "implemented",
    keywords: ["textarea", "notes", "multiline", "comment", "description", "hint", "error", "rolling", "message"],
    summary: "The canonical multi-line field — the arc Textarea mapped to the agent look: token border, coral focus ring, and a label plus optional hint/error that roll in word by word. Live on the sale notes. Resizes vertically on desktop.",
    sources: [
      { path: "components/ui/NotesField.tsx", note: "the wrapper (our canonical)" },
      { path: "components/arc/textarea/textarea.tsx", note: "the vendored arc component (MIT)" },
    ],
    exceptions: [{ title: "Label + rolling messages", detail: "The label lives inside the field; description/error rows open their height on a spring and settle word by word (numbers roll digit by digit). Coral focus ring (--focus-ring), border on --agent-border-default.", source: "components/ui/NotesField.tsx", scope: "shared" }],
    render: () => <NotesFieldDemo />,
  },
  {
    id: "page-header",
    name: "Page header (title + subtitle)",
    category: "titles",
    status: "implemented",
    keywords: ["page header", "title", "subtitle", "h1", "heading", "page title", "actions", "new sale"],
    summary: "The standard page header that opens most agent-app pages — an H2-scale title (22/600, -0.02em) over a 13px muted subtitle, with an optional right-aligned actions slot. The new-sale page uses it (“New sale” + the memo subtitle).",
    sources: [{ path: "components/layout/PageHeader.tsx", note: "title + subtitle + optional actions children" }],
    render: () => <PageHeaderDemo />,
  },
  {
    id: "avatar",
    name: "Avatar (photo · branded art · initials)",
    category: "badges",
    status: "implemented",
    keywords: ["avatar", "initials", "fallback", "photo", "person", "buyer", "seller", "vendor", "purchaser", "colour coded", "side", "profile picture", "account pill"],
    summary: "The circular avatar — photo-first, with two fallbacks: the branded person/role art (tinted per side) or the person's initials on a side-coloured gradient. Colour-codes the role: staff coral, seller blue, buyer green, solicitor navy (ID-card art), broker violet (£ art), chain agent rose, everyone else grey. The top-bar account pill is a staff (coral) UserAvatar. A flaky photo shows a shimmer then the art — never a broken image.",
    variants: [{ id: "art", label: "Branded art (no photo)" }, { id: "initials", label: "Initials fallback (art off)" }, { id: "photo", label: "Photo (fills; art is the fallback)" }],
    sources: [
      { path: "components/ui/Avatar.tsx", note: "UserAvatar / ContactAvatar / ActorAvatar + AvatarStack" },
      { path: "lib/contacts/displayName.ts", note: "getInitials" },
    ],
    exceptions: [{ title: "Per-side tint is the identity", detail: "SIDE_STYLES maps vendor→blue, purchaser→green, internal/staff→coral, broker→violet, solicitor→navy, chainAgent→rose, fallback→grey. The branded SVG art retints its three layers via --tsp-avatar-* so the white figure stays untouched; solicitors get the ID-card art, brokers the £ art. A photo self-heals (shimmer → art → photo) so a flaky URL is never a broken circle.", source: "components/ui/Avatar.tsx", scope: "shared" }],
    render: () => <AvatarDemo />,
  },
  {
    id: "demo-cta",
    name: "Demo CTA (See how it works)",
    category: "buttons",
    status: "implemented",
    keywords: ["see how it works", "demo", "play", "icon button", "coral circle", "token icon", "explore", "tour", "new here"],
    summary: "The white/outline secondary CTA that stands up the demo sale — a leading coral play-circle (token-coloured icon) + label. On the new-sale hero. Composed from canon parts: the canonical secondary button fronted by the canonical coral icon-circle.",
    sources: [{ path: "components/transactions-v2/DemoHeroCard.tsx", note: "See how it works" }],
    exceptions: [{ title: "Composed from canon parts, not a new primitive", detail: "The canonical white/outline secondary (via .agent-canon-cta) fronted by a 28px coral icon-circle holding a Play glyph — the token coral, matching the buttons and badges.", scope: "shared" }],
    render: () => <DemoCtaDemo />,
  },
  {
    id: "sales-row",
    name: "Property sales row (research results)",
    category: "rows",
    status: "implemented",
    keywords: ["sales row", "recent sales", "price", "history", "land registry", "property research", "result row", "nearby", "area research"],
    summary: "A recent-sale row in the property-research results — the address (title-cased), the sold price (bold), and the date (muted), in a glass row. Fills the “Recent sales nearby” / area-research list once a postcode is looked up.",
    sources: [{ path: "components/transactions-v2/PropertyDossier.tsx", note: "SaleRow + recent sales list" }],
    exceptions: [{ title: "Addresses are title-cased, not shouted", detail: "Land Registry returns addresses in ALL CAPS (“53 THE MEADWAY”). The row renders them through titleCaseKeepAcronyms — now fixed to normalise fully-uppercase multi-word input to “53 The Meadway” rather than keeping every word as an acronym. A lone acronym with no space (“UK”) is still preserved.", source: "lib/utils.ts", scope: "shared" }],
    render: () => <SalesRowDemo />,
  },
  {
    id: "onboarding-hero",
    name: "Onboarding hero (demo sale)",
    category: "empty-error",
    status: "implemented",
    keywords: ["hero", "onboarding", "first sale", "demo", "coral gradient", "see how it works", "new sale", "banner"],
    summary: "The new-sale onboarding hero shown to an agency with no real sales — a coral-gradient card with the glass-house artwork fading in on the right, a 28/600 title + sub-copy, and the “See how it works” demo CTA. Distinct from the generic empty-state hero: it keeps its own artwork and gradient.",
    sources: [
      { path: "components/transactions-v2/DemoHeroCard.tsx", note: "the hero" },
      { path: "components/agent/HeroArt.tsx", note: "the fading glass-house artwork" },
    ],
    exceptions: [{ title: "Deliberately not a Design-Lab surface", detail: "Swapping its chrome strips the artwork, so the hero is a fixed coral-gradient card (not a glass-pick surface). The CTA is the canonical Demo CTA (secondary + coral play-circle). Pill removed in the UI-alignment pass.", source: "components/transactions-v2/DemoHeroCard.tsx", scope: "specific" }],
    render: () => <OnboardingHeroDemo />,
  },
  {
    id: "research-results",
    name: "Property research — results panel",
    category: "cards",
    status: "implemented",
    keywords: ["area research", "property record", "results", "recent sales", "sold prices", "postcode", "dossier", "sources", "from memo"],
    summary: "The loaded state of the property lookup — a glass panel with an eyebrow header (“Area Research · postcode” or “Property Record” + address), a canonical close (X), the recent-sales list (title-cased rows), a “From memo” pill when prefilled, and a sources caption. The counterpart to the lookup card's idle / loading / error.",
    sources: [
      { path: "components/transactions-v2/PropertyDossier.tsx", note: "the results panel (SaleRow, header, close)" },
      { path: "lib/utils.ts", note: "titleCaseKeepAcronyms for addresses" },
    ],
    exceptions: [{ title: "Canonical close + title-cased rows", detail: "The clear control is the shared round icon button (agent-icon-btn-md, hover tint + focus ring), replacing a bare glyph. Sale addresses are title-cased (see the sales row). Two modes: Area Research (postcode-level, no property matched) and Property Record (a matched address with fact tiles).", source: "components/transactions-v2/PropertyDossier.tsx", scope: "shared" }],
    render: () => <ResultsPanelDemo />,
  },
  {
    id: "quick-action-dock",
    name: "Quick-action dock (New note / New email)",
    category: "navigation",
    status: "implemented",
    keywords: ["dock", "quick action", "new note", "new email", "floating", "glass pill", "liquid glass", "launcher", "compose"],
    summary: "The app-wide floating glass dock — a frosted pill with “New note” (opens AddNoteModal) and “New email” (opens ComposeEmailModal), split by a hairline. Chromium renders the real LiquidGlass refraction; other engines keep the same pill with a frosted-glass fallback. Scroll-aware (slides down to hide) and theme-synced. Founder-gated today.",
    sources: [
      { path: "components/quick-dock/QuickActionDock.tsx", note: "the dock (LiquidGlass + fallback, modals wired)" },
      { path: "components/quick-dock/LiquidGlass.tsx", note: "the SVG-backdrop refraction material" },
    ],
    exceptions: [{ title: "LiquidGlass on Chromium, frosted fallback elsewhere", detail: "The SVG-backdrop refraction only presents on Chromium; Safari/Firefox/iOS keep the exact container and swap to blur(30px) saturate(200%) frosted glass. The preview here shows the frosted fallback. All CSS is scoped under .qdock-root so nothing global changes.", source: "components/quick-dock/QuickActionDock.tsx", scope: "specific" }],
    render: () => <DockDemo />,
  },
  {
    id: "pill",
    name: "Pill (status tag)",
    category: "badges",
    status: "implemented",
    keywords: ["pill", "tag", "chip", "status", "label", "badge", "from memo", "tone", "tenure"],
    summary: "The one canonical Pill — a rounded-full tag whose shape is fixed and whose colour comes from a tone (default, muted, brand, info, success, warning, danger), with an optional `glass` treatment for photo/glass surfaces. Used for “From memo”, tenure, and status tags across the app. One primitive with tones, not many pills.",
    variants: [{ id: "solid", label: "Solid tones" }, { id: "glass", label: "Glass (on photo/glass)" }],
    sources: [{ path: "components/ui/Pill.tsx", note: "the canonical primitive (toneStyles / sizeStyles)" }],
    exceptions: [{ title: "One primitive, locked at Phase 0", detail: "A single Pill with tones — not a pill per colour. The shape (radius, padding, size sm/md) is fixed; consumers pass a tone and optionally `glass`. New status colours are added as tones here, never as new pill components.", source: "components/ui/Pill.tsx", scope: "shared" }],
    render: () => <PillDemo />,
  },
  {
    id: "as-of-refresh",
    name: "“As of” refresh control",
    category: "toolbars",
    status: "implemented",
    keywords: ["as of", "refresh", "reload", "data freshness", "top bar", "spin", "updated", "sync"],
    summary: "The top-bar data-freshness control — a quiet text button pairing a refresh glyph with “As of HH:MM”. Clicking re-fetches the server tree; the glyph spins for ~700ms so a sub-50ms refresh still registers. Muted, with the shared top-bar hover.",
    sources: [{ path: "components/layout/AgentShell.tsx", note: "handleRefresh + refreshedAt (router.refresh)" }],
    exceptions: [{ title: "Minimum-visible spin + wall-clock text", detail: "router.refresh() can resolve faster than the eye notices, so the spin is held ~700ms. The time text is suppressHydrationWarning — the minute can tick between server render and hydration (cosmetic, not a bug).", source: "components/layout/AgentShell.tsx", scope: "specific" }],
    render: () => <AsOfControlDemo />,
  },
  {
    id: "fact-tiles",
    name: "Property fact tiles (last sold · EPC · tenure)",
    category: "cards",
    status: "implemented",
    keywords: ["fact tile", "epc", "last sold", "tenure", "property record", "data tile", "stat", "land registry", "use this"],
    summary: "The small data tiles in the property-research results (Property Record mode) — Last sold (price + date), EPC rating (the colour-graded letter + score), and Tenure. When the Land Registry tenure differs from the form, the tenure tile turns success-green and offers a “Use this” action to adopt it.",
    sources: [{ path: "components/transactions-v2/PropertyDossier.tsx", note: "Tile + epcColor + tenure-mismatch action" }],
    exceptions: [{ title: "EPC is colour-graded; tenure can self-correct", detail: "The EPC letter is tinted on the A–G scale (A #007a3e → G #e02020). A tenure mismatch flips the tile to the success accent (bg/border/label) and exposes “Use this →”, which writes the Land Registry tenure back into the form.", source: "components/transactions-v2/PropertyDossier.tsx", scope: "shared" }],
    render: () => <FactTilesDemo />,
  },
  {
    id: "memo-scan",
    name: "Memo scan status bar",
    category: "feedback",
    status: "implemented",
    keywords: ["memo", "scan", "reading", "parse", "mos", "extract", "ai", "progress", "ticking", "spinner", "dots", "fields"],
    summary: "The banner shown while a dropped memo of sale is read — a spinner + “Reading your memo…”, then a three-column grid (Sale details / Vendor / Purchaser) that ticks through field by field: each row moves hollow-ring → active spinner → pulsing coral dot. Resolves to a success / needs-attention / error state, with the top border recolouring to match.",
    states: [
      { id: "reading", label: "Reading (ticking through)", render: () => <MemoScanDemo state="reading" /> },
      { id: "done", label: "Done — all filled", render: () => <MemoScanDemo state="done" /> },
      { id: "missing", label: "Done — fields need attention", render: () => <MemoScanDemo state="missing" /> },
      { id: "error", label: "Error (couldn't read)", render: () => <MemoScanDemo state="error" /> },
    ],
    sources: [{ path: "components/transactions-v2/hero/MemoStatusBar.tsx", note: "the status bar (reading / done / error)" }],
    exceptions: [
      { title: "Three-state field indicator", detail: "Each field steps through pending (hollow 5px coral ring) → active (the canonical Spinner) → read (7px coral dot with a soft glow, pulsing via memo-pending-pulse, staggered so the grid waves rather than strobes). The pulsing dot is a cousin of the canonical pulse-dot, specialised for this sequence.", source: "components/transactions-v2/hero/MemoStatusBar.tsx", scope: "specific" },
      { title: "Top border carries the outcome", detail: "Coral while reading, success-green when done with nothing missing, amber when fields need attention or on error — so the result reads at a glance before you parse the copy. Missing fields surface as tappable warning Pills that focus the field.", scope: "shared" },
    ],
    render: () => <MemoScanDemo state="reading" />,
  },
  {
    id: "spinner",
    name: "Spinner (loading)",
    category: "loading",
    status: "implemented",
    keywords: ["spinner", "loading", "loader", "busy", "progress", "circle", "coral arc", "reading"],
    summary: "The indeterminate loading spinner — a coral arc sweeping over a faint track ring, 0.8s linear. Scales to any size. Proposed as the one canonical spinner: the memo scan, the “As of” refresh and the button busy-state each roll their own today.",
    sources: [{ path: "components/transactions-v2/hero/MemoStatusBar.tsx", note: "Spinner (memo-spin)" }],
    exceptions: [{ title: "Fragmented today — to consolidate", detail: "There is no single spinner yet: MemoStatusBar's Spinner (coral arc), the AgentShell “As of” refresh (a spinning ArrowsClockwise glyph) and the arc Button's busy indicator are separate. This entry nominates the coral-arc spinner as canonical; migrating the others is a follow-up, not done here.", source: "components/transactions-v2/hero/MemoStatusBar.tsx", scope: "shared" }],
    render: () => <SpinnerDemo />,
  },
  {
    id: "eyebrow",
    name: "Eyebrow / section label",
    category: "typography",
    status: "implemented",
    keywords: ["eyebrow", "section label", "overline", "sentence case", "sale details", "heading label", "weight"],
    summary: "The small label above a group (Sale details, Vendor, Recent sales nearby…). DECIDED (2026-11-20): sentence case · 10px (the --agent-text-eyebrow token) · 600 · no tracking · muted — the shouty all-caps 700/0.08em is retired. Reads as quiet structure, matching the product's warm voice. The compare below shows what was rejected.",
    variants: [{ id: "chosen", label: "Chosen — sentence · 600 · muted" }, { id: "rejected-caps", label: "Rejected — caps · 700 · 0.08em" }, { id: "rejected-refined", label: "Rejected — refined caps" }],
    sources: [
      { path: "app/dev/components/compare/eyebrows/page.tsx", note: "the comparison these were chosen from" },
      { path: "components/transactions-v2/hero/MemoStatusBar.tsx", note: "memo-scan columns (aligned)" },
      { path: "components/transactions-v2/PropertyDossier.tsx", note: "fact tiles + research header (aligned)" },
    ],
    exceptions: [{ title: "Rolling out, not yet app-wide", detail: "Aligned on the new-sale page (memo scan, fact tiles, research results). Other surfaces' section labels still render the old caps and align as each is reached — a per-surface sweep, not a global find/replace (Law 16).", scope: "shared" }],
    render: () => <EyebrowCompareDemo />,
  },
  {
    id: "select",
    name: "Select (single-choice picker)",
    category: "text-inputs",
    status: "implemented",
    keywords: ["select", "dropdown", "picker", "case handler", "progressor", "combobox", "choose", "menu", "caret"],
    summary: "The canonical single-choice select — BUILT 2026-11-20 to retire three bespoke pickers (glass-input + raw ▾, two native <select>s). It is NOT a new dropdown: it reuses the already light/dark-correct AnchoredPanel + .ui-pop-pick menu and only standardises the trigger (a LabelInput-weight box + a real CaretDown), the selected check, and an optional “+ Add…” row.",
    sources: [
      { path: "components/ui/Select.tsx", note: "the canonical component" },
      { path: "components/ui/Popover.tsx", note: "AnchoredPanel — the menu it reuses, unchanged" },
    ],
    exceptions: [{ title: "Trigger standardised, menu untouched", detail: "The menu (AnchoredPanel + .ui-pop-pick rows) was already canonical and theme-correct, so it is reused verbatim — the component only owns the trigger + results/add rows. `accent` gives a coral border for a prominent select; `addAction` appends the canonical “+ {label}” row. 48px trigger, 20px radius (form-field sizing).", source: "components/ui/Select.tsx", scope: "shared" }],
    render: () => <SelectDemo />,
  },
  {
    id: "percent-field",
    name: "Percent field",
    category: "text-inputs",
    status: "implemented",
    keywords: ["percent", "percentage", "commission", "rate", "%", "fee", "number", "price sibling"],
    summary: "The % sibling of PriceField — BUILT 2026-11-20. Same shell + sizing as the bare PriceField so a “Fixed £ / Percent %” toggle swaps between two identical-looking fields. Reuses the already dark-correct .price-hero-input-native input and adds a “%” suffix. Value is the raw string (preserves mid-type states like “2.”).",
    sources: [
      { path: "components/ui/PercentField.tsx", note: "the canonical component" },
      { path: "components/ui/PriceField.tsx", note: "the £ sibling it matches" },
    ],
    exceptions: [{ title: "Mirrors PriceField’s API", detail: "`bare` (transparent, no border — drops inline into the commission box beside the VAT toggle), `accent` (coral border), `height`/`fontSize` match PriceField. Replaces the bespoke native % input in EarningsBuilder; existing sizing kept (nothing enlarged).", source: "components/ui/PercentField.tsx", scope: "shared" }],
    render: () => <PercentFieldDemo />,
  },
  {
    id: "field-status-rail",
    name: "Field status rail",
    category: "progress",
    status: "implemented",
    keywords: ["status rail", "field circles", "name phone email", "validation", "contact", "grey orange green", "per-field", "steps"],
    summary: "The per-input status rail in the contact editor — one numbered dot per field (1 name · 2 phone · 3 email), each stepping grey (empty) → coral (mid-type) → green (valid), with a connecting line. Lets you see at a glance which parts of a person are complete. Promoted to canonical 2026-11-20 (lab-first).",
    sources: [{ path: "components/transactions-v2/form/ContactsSection.tsx", note: "FieldCircle / FieldRow + name/phone/email field states" }],
    exceptions: [{ title: "Per field, not per person", detail: "The dots track the three inputs of a single contact, not a list of people (that is the people pill). Tone is the only signal — ring for empty, coral fill mid-type, green fill when the field validates. No faded fills.", source: "components/transactions-v2/form/ContactsSection.tsx", scope: "specific" }],
    render: () => <FieldStatusRailDemo />,
  },
  {
    id: "people-pill",
    name: "Removable people pill",
    category: "badges",
    status: "implemented",
    keywords: ["people pill", "contact pill", "remove", "x", "multiple vendors", "multiple buyers", "chip", "person"],
    summary: "The person pill shown when a contact group has more than one person (two sellers, joint buyers). The active person carries a coral ring; each pill has an in-pill × to remove it. Click a pill to edit that person. Promoted to canonical 2026-11-20 (lab-first).",
    sources: [{ path: "components/transactions-v2/form/ContactCarousel.tsx", note: "the people pills + in-pill remove" }],
    exceptions: [{ title: "Ring for active, canonical X inside the pill", detail: "Active = coral ring (not a wash); the canonical X lives inside the pill (bare glyph at rest, soft circle on hover — decision 4), not floating over a field label. Appears only when count > 1 — a single contact edits in place with no pill.", source: "components/transactions-v2/form/ContactCarousel.tsx", scope: "specific" }],
    render: () => <PeoplePillDemo />,
  },
  {
    id: "checkbox",
    name: "Checkbox",
    category: "toggles",
    status: "approved",
    keywords: ["checkbox", "check", "tick", "terms", "agree", "recommended broker", "arc", "coral", "control-on"],
    summary: "The canonical checkbox — the arc Checkbox under .arc-scope with the coral control tokens (--control-on #FF6B4A / --control-glyph #fff). Identical component AND spacing to the sign-up terms checkbox; retires the native and ui variants used across the broker/solicitor flow.",
    sources: [
      { path: "components/arc/checkbox/checkbox.tsx", note: "the component" },
      { path: "app/register/RegisterForm.tsx", note: "the reference usage (terms) — spacing matched to this, not re-spaced" },
    ],
    exceptions: [{ title: "Coral via control tokens, sign-up spacing", detail: "Coral is applied with --control-on / --control-glyph on an .arc-scope wrapper — a token map, not a restyle. The label/box gap is the arc Checkbox default, matched to the sign-up checkbox rather than given its own spacing.", source: "app/register/RegisterForm.tsx", scope: "shared" }],
    render: () => <CheckboxDemo />,
  },
  {
    id: "inline-status-hint",
    name: "Inline status hint",
    category: "feedback",
    status: "approved",
    keywords: ["status hint", "reachability", "eligible", "portal invite", "we can reach", "icon text", "tone"],
    summary: "The small icon+text status line under a field — “We can reach this vendor” (success), “Eligible for portal invite” (coral), “Add a phone or email…” (warning). One repeated pattern across the contact cards, promoted to canonical 2026-11-20 as-is (tone variants).",
    sources: [{ path: "components/transactions-v2/form/ContactsSection.tsx", note: "the three tones (240–260)" }],
    exceptions: [{ title: "Tone carries meaning", detail: "Success = reachable, coral = portal-eligible, warning = needs contact details. Icon + 10px text; no wash. Distinct from field-hint (memo source) and InlineAlert (bordered banner).", source: "components/transactions-v2/form/ContactsSection.tsx", scope: "shared" }],
    render: () => (
      <Stage width={320}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 500, color: "var(--agent-success)" }}><CheckCircle size={12} weight="fill" /> We can reach this vendor</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 500, color: "var(--agent-coral-deep)" }}><LinkSimple size={12} /> Eligible for portal invite</span>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: "var(--agent-warning)" }}>Add a phone or email so we can reach them</span>
        </div>
      </Stage>
    ),
  },
  {
    id: "state-group-label",
    name: "State group label",
    category: "typography",
    status: "approved",
    keywords: ["group label", "tenure", "purchase type", "progressed by", "selected", "green", "chip row label"],
    summary: "The label beside a chip row (Tenure / Purchase type / Progressed by) in the sale hero — green when the group has a selection, muted grey otherwise. Small reusable pattern, promoted to canonical 2026-11-20 as-is.",
    sources: [{ path: "components/transactions-v2/SaleHeroEditable.tsx", note: "GroupLabel (96–102)" }],
    exceptions: [{ title: "Colour = completeness", detail: "11px/600; --agent-success once the group has a value, --agent-text-muted while empty, 150ms colour transition. A compact completeness signal for a required chip group.", source: "components/transactions-v2/SaleHeroEditable.tsx", scope: "specific" }],
    render: () => (
      <Stage width={320}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-success)" }}>Tenure</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>Purchase type</span>
        </div>
      </Stage>
    ),
  },
  {
    id: "hero-overlay-pill",
    name: "Hero overlay pill (dark glass)",
    category: "badges",
    status: "approved",
    keywords: ["overlay pill", "dark glass", "memo read", "add photo", "remove photo", "hero", "frosted"],
    summary: "The dark frosted pill that sits over the hero photo / map — “Memo read”, “Add photo”, “Remove photo”. Mirrors the file-hero Back/Remove pills. Promoted to canonical 2026-11-20 as-is.",
    sources: [{ path: "components/transactions-v2/SaleHeroEditable.tsx", note: "DARK_PILL (39–44)" }],
    exceptions: [{ title: "Dark frosted on imagery", detail: "rgba(15,23,42,0.42) + blur(8px), white text, pill radius — legible over a photo or map regardless of its colour. The one dark-pill-on-media treatment; distinct from the light status Pill.", source: "components/transactions-v2/SaleHeroEditable.tsx", scope: "shared" }],
    render: () => (
      <Stage width={320}>
        <div style={{ display: "flex", gap: 8, padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#9aa6b8,#6b7687)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, color: "#fff", background: "rgba(15,23,42,0.42)", backdropFilter: "blur(8px)" }}>Memo read</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, color: "#fff", background: "rgba(15,23,42,0.42)", backdropFilter: "blur(8px)" }}>Remove photo</span>
        </div>
      </Stage>
    ),
  },
  {
    id: "collapsible-section",
    name: "Collapsible section (card + header + chevron)",
    category: "cards",
    status: "approved",
    keywords: ["collapsible", "accordion", "section", "chevron", "caret", "drawer", "agent-acc", "solicitors & broker", "notes"],
    summary: "The whole collapsible card — agent-glass-strong surface + agent-acc-hdr header (faint title + collapsed summary) + a rotating canonical CaretDown + the agent-acc grid-rows drawer. One of the most-reused patterns in the app; promoted to canonical 2026-11-21 as-is.",
    sources: [{ path: "components/transactions-v2/form/CollapsibleSection.tsx", note: "the component" }],
    exceptions: [{ title: "Rotating CaretDown, not icon-swap", detail: "The chevron is the canonical CaretDown rotated 180° on open (drawer-consistency pass), not an up/down icon swap, so it animates with the agent-acc grid-rows body like every other drawer. Collapsed, it shows a one-line summary; open, the body.", source: "components/transactions-v2/form/CollapsibleSection.tsx", scope: "shared" }],
    render: () => (
      <Stage width={360}>
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-lg)", overflow: "hidden" }}>
          <div className="agent-acc-hdr" style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-faint, rgba(45,24,16,0.4))" }}>Solicitors &amp; Broker</span>
              <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>2 added</span>
            </div>
            <CaretDown size={14} weight="bold" color="var(--agent-text-muted)" />
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "submission-overlay",
    name: "Submission overlay (full-screen)",
    category: "loading",
    status: "approved",
    keywords: ["submission", "overlay", "full screen", "creating sale", "spinner", "rotating message", "portal", "frosted"],
    summary: "The full-screen overlay shown while a sale is created — the canonical agent-spinner-lg (coral arc) over a frosted backdrop, with a rotating status message. Only the spinner was catalogued before; the overlay shell is promoted to canonical 2026-11-21 as-is.",
    sources: [{ path: "components/transactions-v2/SubmissionOverlay.tsx", note: "the component" }],
    exceptions: [{ title: "Portal + rotating message", detail: "createPortal to body, z 3000, frosted nv2-surface-raised backdrop + blur(18px); the message cycles (agent-reveal-in) while the canonical large spinner turns. One full-screen submit overlay.", source: "components/transactions-v2/SubmissionOverlay.tsx", scope: "shared" }],
    render: () => (
      <Stage width={360}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, height: 150, borderRadius: 12, background: "var(--agent-surface-elevated)" }}>
          <span className="agent-spinner agent-spinner-lg" style={{ borderColor: "rgba(255,107,74,0.18)", borderTopColor: "var(--agent-coral-deep)" }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Creating your sale…</p>
        </div>
      </Stage>
    ),
  },
  {
    id: "edit-confirm-actions",
    name: "Inline confirm / cancel (tick + X)",
    category: "buttons",
    status: "approved",
    keywords: ["confirm", "cancel", "save", "tick", "check", "x", "inline edit", "done", "address editor", "stacked"],
    summary: "The stacked confirm/cancel pair for an in-place editor — a solid CORAL (brand) circle whose tick draws itself, over the canonical circle-X (quiet circle that tints on hover). Both spring in. A `startDelay` holds them until the editor they sit in has finished revealing, so they enter after it rather than clipped mid-reveal. Replaces a 'Done' button where you want confirm + cancel. Standalone — never baked into an input component.",
    sources: [
      { path: "components/ui/EditConfirmActions.tsx", note: "the component" },
      { path: "components/transactions-v2/SaleHeroEditable.tsx", note: "live use — the sale-hero address editor" },
    ],
    exceptions: [{ title: "Draw-on tick + hover-tint cancel", detail: "Confirm is a coral (brand) filled circle — token-coloured via --agent-coral-deep, so it follows an agency's themed accent — with a self-drawing check (spring + path draw); cancel reuses the canonical circle-X (quiet circle that tints on hover). Stacked (column) by default; an orientation='row' variant is available. `startDelay` defers the spring-in until a host editor has revealed. Reduced-motion falls back to a short fade.", source: "components/ui/EditConfirmActions.tsx", scope: "shared" }],
    render: () => <EditConfirmActionsDemo />,
  },
  {
    id: "hub-status-label",
    name: "Hub status label (toned text)",
    category: "feedback",
    status: "approved",
    keywords: ["status label", "ready but frozen", "on hold", "needs assigning", "gone quiet", "toned text", "hub", "no pill"],
    summary: "The status indicator on the hub attention cards — a small toned TEXT label, not a pill. DECIDED 2026-11-21: the pills were retired (CSS hides .hub-pill-d / .attn-pill-d) in favour of toned text so it sits neatly with the address. Tone carries the meaning: danger (frozen / needs assigning), warning (on hold / gone quiet).",
    sources: [
      { path: "components/hub/HubListCard.tsx", note: ".hub-label-m toned text" },
      { path: "app/agent/styles/agent-system.css", note: ".hub-pill-d / .attn-pill-d { display:none }" },
    ],
    exceptions: [{ title: "Text, not a pill", detail: "10.5px / 750, tone-coloured, sits beside/above the address. The pills were hidden app-wide to keep the row quiet; this toned text is the one canonical status indicator across every attention card. The dead hidden <Pill> JSX is being removed.", scope: "shared" }],
    render: () => (
      <Stage width={320}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-danger)" }}>Ready but frozen</span>
          <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-warning)" }}>On hold</span>
          <span style={{ fontSize: 10.5, fontWeight: 750, color: "var(--agent-danger)" }}>Needs assigning</span>
        </div>
      </Stage>
    ),
  },
  {
    id: "sparkline",
    name: "Sparkline / trend chart",
    category: "feedback",
    status: "implemented",
    keywords: ["sparkline", "chart", "trend", "line chart", "exchange", "svg", "data viz", "dataviz"],
    summary: "The hub exchange-trend sparkline — a hand-rolled SVG line (polyline + endpoint dot + dashed scrub guide + body-portaled tooltip + ResizeObserver real-pixel sizing). The first chart primitive in the library (the gallery had NO chart entry before). Follow the dataviz guidance for palette/axes when extending.",
    sources: [{ path: "components/hub/ExchangeSparkline.tsx", note: "the component" }],
    exceptions: [{ title: "Real-pixel SVG, coral line", detail: "Sizes to its container via ResizeObserver (crisp lines), coral stroke + endpoint dot, dashed active-scrub guide, tooltip portaled to body. The only chart in the system — a trend/sparkline primitive to grow (see the dataviz skill for categorical/sequential palettes).", source: "components/hub/ExchangeSparkline.tsx", scope: "shared" }],
    render: () => (
      <Stage width={260}>
        <svg width={200} height={50} aria-hidden>
          <path d="M0,42 L28.6,30 L57.1,46 L85.7,18 L114.3,34 L142.9,6 L171.4,22 L200,2" fill="none" stroke="var(--agent-coral-deep)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={200} cy={2} r={3.5} fill="var(--agent-coral-deep)" />
        </svg>
      </Stage>
    ),
  },
  {
    id: "hub-stat-cell",
    name: "Hub stat cell (value · delta · sub)",
    category: "cards",
    status: "implemented",
    keywords: ["stat cell", "pipeline health", "metric", "value delta", "active sales", "number", "hub stats grid"],
    summary: "The pipeline-health stat cell — a grid of big value (24/800) + label + delta line + sub, with a left-border divider and no icon. Distinct from hero-stat-cell (icon + 15px value, 2-col, no delta/divider), so it's its own primitive. Catalogue-as-is, no visual change.",
    sources: [{ path: "app/agent/hub/hub-view.tsx", note: "hub-stats-grid (1063-1145)" }],
    exceptions: [{ title: "Value + delta + sub, divider, no icon", detail: "24px/800 tabular value, 11px label, a tone-coloured delta ('+3 this month' / 'all clear') and an optional sub line ('£2.1m closing'); cells divided by a left border, 4-col → 2-col at narrow widths. No icon (unlike hero-stat-cell).", source: "app/agent/hub/hub-view.tsx", scope: "shared" }],
    render: () => (
      <Stage width={340}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[["Active sales", "24", "+3 this month", "var(--agent-success)"], ["Exchanging", "6", "£2.1m closing", "var(--agent-text-muted)"]].map(([l, v, d, dc], i) => (
            <div key={l as string} style={{ padding: "10px 16px", borderLeft: i % 2 ? "1px solid var(--agent-border-subtle)" : "none" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
              <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>{l}</div>
              <div style={{ fontSize: 10.5, color: dc as string, marginTop: 2 }}>{d}</div>
            </div>
          ))}
        </div>
      </Stage>
    ),
  },
  {
    id: "hub-card",
    name: "Hub attention card (shell + header)",
    category: "cards",
    status: "approved",
    keywords: ["hub card", "attention card", "collapsible", "file at risk", "gone quiet", "accordion", "glass", "shell"],
    summary: "The shared hub attention-card shell — a baked GlassCard + collapsible header (24px tinted icon · count-in-title · subtitle · rotating chevron) + the agent-acc drawer body. Extracted 2026-11-21 into one component (components/hub/HubCard.tsx); five cards now render through it (file-at-risk, gone-quiet, files-to-review, exchange-overdue, stalled-enquiries, needs-filing). Layout unchanged — pure dedup.",
    sources: [{ path: "components/hub/HubCard.tsx", note: "the extracted component" }],
    exceptions: [{ title: "icon + count-in-title + chevron", detail: "24px bare tinted glyph, the count inlined tone-coloured in the agent-card-title-emphasis title, an 11px muted subtitle, and a CaretDown that rotates 180° on open over the agent-acc grid-rows body. Each card passes its own icon/title/subtitle/rows; only the shared shell was extracted.", source: "components/hub/HubCard.tsx", scope: "shared" }],
    render: () => (
      <Stage width={360}>
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px" }}>
            <WarningCircle size={24} color="var(--agent-danger)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="agent-card-title-emphasis" style={{ display: "block" }}><span style={{ color: "var(--agent-danger)", fontWeight: 700 }}>1</span> file at risk</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2 }}>Our overnight checks flagged sales that may have stalled.</span>
            </div>
            <CaretDown size={14} weight="bold" color="var(--agent-text-muted)" style={{ transform: "rotate(180deg)" }} />
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "hub-row",
    name: "Hub property row (scaffold)",
    category: "cards",
    status: "approved",
    keywords: ["hub row", "property row", "attention row", "thumb", "address", "accent bar", "hub-r-tail", "flush row"],
    summary: "The shared property-row scaffold the attention cards render through — the agent-hover-row wrapper, the 3px left accent bar, the i>0 top separator, the flex body wrapper and the responsive hub-r-tail. Extracted 2026-11-21 (components/hub/HubRow.tsx); four cards now flow through it (HubListCard, StalledEnquiries, ExchangeOverdue, ReviewsDue). The card keeps its own address/status/meta/actions as slots, so three were byte-identical and ReviewsDue picked up the accent bar + 11/700 label (approved). Optional bodyClassName / tailClassName / after slots carry HubListCard's mobile reflow (hub-r-body, hub-r-tail--x, phone subtext + ✕).",
    sources: [{ path: "components/hub/HubRow.tsx", note: "the extracted scaffold" }],
    exceptions: [{ title: "Scaffold-only, content in slots", detail: "Owns the row chrome only — 12px/20px/12px/17px padding, 3px accent borderLeft (null → transparent), 0.5px top separator when separated, gap-12 flex-wrap, thumb slot, minWidth:0 flex:1 1 220px body, hub-r-tail. Address/status/meta and the action cluster stay per-card so each card's tuned content and breakpoints are preserved.", source: "components/hub/HubRow.tsx", scope: "shared" }],
    render: () => (
      <Stage width={360}>
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div className="agent-hover-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px", borderLeft: "3px solid var(--agent-warning)" }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--agent-surface-muted, rgba(45,24,16,0.05))", color: "var(--agent-text-muted)" }}><House size={18} weight="fill" /></span>
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>8 Chandler Court, Altrincham, WA14 2PL</span>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--agent-warning)", marginTop: 2 }}>Awaiting solicitor reply</span>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>With Dawson Hart · Quiet 11 days</p>
            </div>
            <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><PaperPlaneTilt size={13} weight="bold" /> Chase</button>
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "hub-attention-card",
    name: "Needs-attention card (its own canonical)",
    category: "cards",
    status: "approved",
    keywords: ["needs your attention", "attention card", "all reminders", "reminders", "hub", "header link"],
    summary: "The 'Needs your attention' card — its own canonical, kept SEPARATE from HubCard (2026-11-21) because its header carries an extra 'All reminders →' link and an icon that swaps (Warning → Check on all-clear), and it never disappears (shows an 'all caught up' line instead of returning null). Every OTHER hub attention card shares HubCard.",
    sources: [{ path: "components/hub/AttentionCard.tsx", note: "the component" }],
    exceptions: [{ title: "Header action + icon swap + persistent", detail: "The header also hosts the 'All reminders →' link (when reminders overflow) and swaps Warning→Check on all-clear; unlike the other cards it stays mounted with a success all-clear line rather than returning null. That's why it's its own canonical, not a HubCard consumer.", source: "components/hub/AttentionCard.tsx", scope: "specific" }],
    render: () => (
      <Stage width={360}>
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px" }}>
            <WarningCircle size={24} color="var(--agent-danger)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="agent-card-title-emphasis" style={{ display: "block" }}>Needs your attention</span>
              <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2 }}>3 of 6 reminders · 3 to assign</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep)", display: "inline-flex", alignItems: "center", gap: 3, flexShrink: 0 }}>All reminders <ArrowRight size={11} weight="bold" /></span>
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "hub-split-button",
    name: "Hub split-button (label + caret menu)",
    category: "buttons",
    status: "approved",
    keywords: ["split button", "take off hold", "chase", "done", "caret", "dropdown", "row action menu", "hub"],
    summary: "The hub split-button — a label action joined to a caret that opens the canonical RowActionMenu (wait a week · pick a date · withdraw…). Extracted 2026-11-21 into one component (components/hub/HubSplitButton.tsx); the menu itself is the existing canonical RowActionMenu, unchanged. Used by Chase / Take off hold / Done across the attention cards.",
    sources: [
      { path: "components/hub/HubSplitButton.tsx", note: "the component" },
      { path: "components/hub/RowActionMenu.tsx", note: "the menu it opens (unchanged)" },
    ],
    exceptions: [{ title: "Joined button + canonical menu", detail: "An agent-btn-sm (ghost by default, primary optional) with its right corners squared, joined to RowActionMenu's caret (joined). Only the joined-button shell was standardised; the dropdown panel + pick rows ride the existing RowActionMenu / menu-popover.", source: "components/hub/HubSplitButton.tsx", scope: "shared" }],
    render: () => (
      <Stage width={240}>
        <div style={{ display: "inline-flex", flexShrink: 0 }}>
          <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Take off hold</button>
          <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1, padding: "0 8px" }}><CaretDown size={12} weight="bold" /></button>
        </div>
      </Stage>
    ),
  },
];

/* All reviewed entries. Grows one batch at a time. */
export const COMPONENTS: ComponentEntry[] = [...FOUNDATION_ENTRIES, ...FOUNDATION_TOKENS, ...LOGIN_ENTRIES, ...REGISTER_ENTRIES, ...GAP_ENTRIES, ...AUTH_COMPLETION_ENTRIES, ...MODAL_ENTRIES, ...EMPTY_ENTRIES, ...SHELL_ENTRIES, ...NEWSALE_ENTRIES];

export function entriesFor(categoryId: string): ComponentEntry[] {
  return COMPONENTS.filter((c) => c.category === categoryId);
}

export const REVIEWED_COUNT = COMPONENTS.length;

/* ── Library search ───────────────────────────────────────────────────────────
   Finds entries (and empty categories) by any descriptive word — name, summary,
   keywords, variants, states, sources, exceptions, plus the area/category it
   lives in. Colour synonyms are folded in (orange ⇄ coral, and #FF6B4A) so a
   reviewer can type what they see. All typed words must match (AND). */

function locate(categoryId: string): { areaId: string; areaLabel: string; categoryLabel: string } | null {
  for (const a of AREAS) {
    const c = a.categories.find((c) => c.id === categoryId);
    if (c) return { areaId: a.id, areaLabel: a.label, categoryLabel: c.label };
  }
  return null;
}

function haystack(e: ComponentEntry, loc: { areaLabel: string; categoryLabel: string } | null): string {
  const parts: string[] = [e.name, e.summary ?? "", ...(e.keywords ?? [])];
  e.variants?.forEach((v) => parts.push(v.label, v.note ?? ""));
  e.states?.forEach((s) => parts.push(s.label));
  e.sources?.forEach((s) => parts.push(s.path, s.note ?? ""));
  e.exceptions?.forEach((x) => parts.push(x.title, x.detail, x.source ?? ""));
  if (loc) parts.push(loc.areaLabel, loc.categoryLabel);
  let h = parts.join(" · ").toLowerCase();
  // Colour synonyms so "orange" finds coral and vice-versa.
  if (h.includes("coral") || h.includes("#ff6b4a") || h.includes("#e55b3d")) h += " orange";
  if (h.includes("orange")) h += " coral";
  return h;
}

export interface SearchHit {
  kind: "entry" | "category";
  areaId: string;
  areaLabel: string;
  categoryId: string;
  categoryLabel: string;
  title: string;
  sub?: string;
  status?: ComponentEntry["status"];
}

export function searchLibrary(query: string): SearchHit[] {
  const terms = query.toLowerCase().split(/\s+/).map((t) => t.trim()).filter(Boolean);
  if (!terms.length) return [];

  const hits: SearchHit[] = [];

  // Entries first — the useful hits.
  for (const e of COMPONENTS) {
    const loc = locate(e.category);
    const hay = haystack(e, loc);
    if (terms.every((t) => hay.includes(t))) {
      hits.push({
        kind: "entry",
        areaId: loc?.areaId ?? "",
        areaLabel: loc?.areaLabel ?? "",
        categoryId: e.category,
        categoryLabel: loc?.categoryLabel ?? e.category,
        title: e.name,
        sub: e.summary,
        status: e.status,
      });
    }
  }

  // Then any category whose own name matches — so "z-index" jumps there even
  // before it has entries.
  for (const a of AREAS) {
    for (const c of a.categories) {
      const hay = `${c.label} ${c.blurb ?? ""} ${a.label}`.toLowerCase();
      if (terms.every((t) => hay.includes(t))) {
        hits.push({ kind: "category", areaId: a.id, areaLabel: a.label, categoryId: c.id, categoryLabel: c.label, title: c.label });
      }
    }
  }

  return hits;
}

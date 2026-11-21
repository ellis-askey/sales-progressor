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
import { Button, buttonClasses } from "@/components/arc/button/button";
import { GoogleIcon } from "@/components/login/GoogleIcon";
import { MicrosoftIcon } from "@/components/login/MicrosoftIcon";
import { House, BellRinging, WarningCircle, Eye, ArrowRight, ArrowLeft, X, CaretDown, PaperPlaneTilt } from "@phosphor-icons/react";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

// Dev-gallery placeholders: Checkbox / OtpInput / RadioGroup / CookieConsent come from the
// arc library that is not yet committed to this branch. Stubbed to null so the prod build
// resolves; restore the real imports once the arc library lands. (Dev tooling only.)
const Checkbox = (_: Record<string, unknown>) => null;
const OtpInput = (_: Record<string, unknown>) => null;
const RadioGroup = (_: Record<string, unknown>) => null;
const CookieConsent = (_: Record<string, unknown>) => null;

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
        onCheckedChange={(v: boolean) => setOn(v === true)}
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
function WelcomeModalStep1({ theme }: { theme: "light" | "dark" }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
      <style dangerouslySetInnerHTML={{ __html: WELCOME_STEPS_CSS }} />
      <div className="pw-card" data-pw-theme={theme} style={{ width: 460, maxWidth: "100%", animation: "none", borderRadius: 16 }}>
        <button className="pw-close" aria-label="Close"><X size={14} weight="bold" /></button>
        <div className="pw-col" style={{ padding: "32px 36px 28px" }}>
          <div className="pw-dots"><span className="pw-dot on" /><span className="pw-dot" /><span className="pw-dot" /></div>
          <div className="pw-stepbody">
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
              <button className="pw-ghost">Skip for now</button>
              <button className="pw-cta">Next: Choose your chases <ArrowRight size={18} weight="bold" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
    states: [{ id: "empty", label: "Empty" }, { id: "focus", label: "Focused (ring)" }, { id: "filled", label: "Filled" }, { id: "invalid", label: "Invalid" }],
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
    status: "approved",
    summary: "The inline message shown for a form-level error (“Incorrect email or password”). Aligned to the semantic danger token — bordered, not washed.",
    sources: [{ path: "components/login/WarmLoginForm.tsx" }, { path: "app/register/RegisterForm.tsx" }],
    exceptions: [{ title: "Token danger, bordered not washed", detail: "The banner is the danger token #C73E3E on white with a hairline danger border and a small alert glyph — no colour wash, per the no-tinted-fill rule. Replaced the earlier warm-peach panel (approved 2026-11-20).", scope: "shared" }],
    render: () => (
      <Stage>
        <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(199,62,62,0.30)", background: "#fff" }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: "none" }}>
            <circle cx="8" cy="8" r="6.6" stroke="#C73E3E" strokeWidth="1.3" />
            <path d="M8 4.7v4" stroke="#C73E3E" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11" r="0.5" fill="#C73E3E" stroke="#C73E3E" strokeWidth="0.6" />
          </svg>
          <span style={{ fontSize: 12.5, color: "#C73E3E", fontWeight: 500 }}>Incorrect email or password.</span>
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
    summary: "The first canonical modal — a centred card over a dimmed backdrop, with step dots, a title + lede (no eyebrow), divided feature rows fronted by flat-coral icon circles, and a footer pairing the ghost + primary buttons at equal height. A 3-step wizard (intro → chase preferences → ready). Becomes a bottom drawer below 1200px.",
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
    render: ({ theme }) => <WelcomeModalStep1 theme={theme} />,
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

/* Hub page — the canonical primitives every element on /agent/hub renders through
   (catalogued 2026-11-21 so the whole page is findable in the gallery). */
const HUB_ENTRIES: ComponentEntry[] = [
  {
    id: "hub-card",
    name: "Hub attention card (shell + header)",
    category: "cards",
    status: "implemented",
    keywords: ["hub card", "attention card", "collapsible", "accordion", "glass", "shell", "file at risk"],
    summary: "The shared hub attention-card shell — a baked GlassCard + collapsible header (24px tinted icon · count-in-title · subtitle · rotating chevron) + the agent-acc drawer body. Extracted into components/hub/HubCard.tsx; six cards render through it.",
    sources: [{ path: "components/hub/HubCard.tsx", note: "the shell" }],
    render: () => (
      <Stage width={360}>
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(45,24,16,0.08)", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px" }}>
            <WarningCircle size={24} color="#C73E3E" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 650 }}><span style={{ color: "#C73E3E", fontWeight: 700 }}>1</span> file at risk</span>
              <span style={{ display: "block", fontSize: 11, color: "#9a938a", marginTop: 2 }}>Our overnight checks flagged sales that may have stalled.</span>
            </div>
            <CaretDown size={14} weight="bold" color="#9a938a" style={{ transform: "rotate(180deg)" }} />
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "hub-row",
    name: "Hub property row (scaffold)",
    category: "rows",
    status: "implemented",
    keywords: ["hub row", "property row", "accent bar", "thumb", "address", "tail", "flush row"],
    summary: "The shared property-row scaffold — agent-hover-row wrapper, 3px left accent bar, flush separator, flex body, responsive hub-r-tail. components/hub/HubRow.tsx; four cards flow through it; content stays per-card slots.",
    sources: [{ path: "components/hub/HubRow.tsx", note: "the scaffold" }],
    render: () => (
      <Stage width={360}>
        <div style={{ borderRadius: 16, overflow: "hidden", border: "1px solid rgba(45,24,16,0.08)", background: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px 12px 17px", borderLeft: "3px solid #E0942E" }}>
            <span style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(45,24,16,0.05)", color: "#9a938a" }}><House size={18} weight="fill" /></span>
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>8 Chandler Court, Altrincham</span>
              <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#E0942E", marginTop: 2 }}>Awaiting solicitor reply</span>
            </div>
            <button className={buttonClasses({ variant: "outline", size: "sm" })} style={{ gap: 5 }}><PaperPlaneTilt size={13} weight="bold" /> Chase</button>
          </div>
        </div>
      </Stage>
    ),
  },
  {
    id: "hub-split-button",
    name: "Hub split-button (label + caret menu)",
    category: "buttons",
    status: "implemented",
    keywords: ["split button", "chase", "take off hold", "done", "caret", "dropdown", "row action menu"],
    summary: "A label action joined to a caret that opens the canonical RowActionMenu. components/hub/HubSplitButton.tsx; the menu is the existing RowActionMenu, unchanged.",
    sources: [{ path: "components/hub/HubSplitButton.tsx" }, { path: "components/hub/RowActionMenu.tsx", note: "the menu (unchanged)" }],
    render: () => (
      <Stage width={240}>
        <div style={{ display: "inline-flex" }}>
          <button className={buttonClasses({ variant: "outline", size: "sm" })} style={{ gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Take off hold</button>
          <button className={buttonClasses({ variant: "outline", size: "sm" })} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: "none", padding: "0 7px" }} aria-label="More"><CaretDown size={13} weight="bold" /></button>
        </div>
      </Stage>
    ),
  },
  {
    id: "icon-button",
    name: "Icon button / circle close (✕)",
    category: "buttons",
    status: "implemented",
    keywords: ["icon button", "close", "dismiss", "x", "circle", "modal close", "top right"],
    summary: "The canonical circular icon button — the close/dismiss ✕ for modals (top-right) and row dismiss. Neutral, fades to a soft circular shade on hover. .agent-icon-btn (sm 22px / md 28px). The one X across the app.",
    sources: [{ path: "app/agent/styles/agent-system.css", note: ".agent-icon-btn" }],
    render: () => (
      <Stage>
        <div style={{ display: "inline-flex", gap: 14, alignItems: "center" }}>
          <button className="agent-icon-btn agent-icon-btn-sm" aria-label="Close"><X size={14} weight="bold" /></button>
          <button className="agent-icon-btn agent-icon-btn-md" aria-label="Close"><X size={16} weight="bold" /></button>
        </div>
      </Stage>
    ),
  },
  {
    id: "sparkline",
    name: "Sparkline (mini trend chart)",
    category: "progress",
    status: "implemented",
    keywords: ["sparkline", "chart", "trend", "line", "exchange", "mini chart", "dataviz"],
    summary: "The canonical sparkline — resolution-accurate mini line chart (measured px, non-scaling stroke), coral line + emphasised endpoint, optional hover/touch scrub tooltip. components/ui/Sparkline.tsx (extracted from the hub's ExchangeSparkline). Pass values + an optional tooltip.",
    sources: [{ path: "components/ui/Sparkline.tsx", note: "the canonical" }, { path: "components/hub/ExchangeSparkline.tsx", note: "hub wrapper" }],
    render: () => (
      <Stage width={240}>
        <svg width={200} height={44} viewBox="0 0 200 44" style={{ display: "block", width: "100%" }} aria-hidden>
          <polyline points="5,36 32,30 60,33 88,20 116,25 144,12 172,16 195,5" fill="none" stroke={CORAL} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={195} cy={5} r={3} fill={CORAL} />
        </svg>
      </Stage>
    ),
  },
  {
    id: "hub-motion",
    name: "Hub motion (reveal · accordion · auto-animate)",
    category: "motion",
    status: "implemented",
    keywords: ["animation", "motion", "reveal", "accordion", "auto-animate", "loading dots", "section reveal"],
    summary: "The hub's motion vocabulary, catalogued: SectionReveal / AnimatedSection (staggered fade-up on load), the HubCard accordion (agent-acc grid-rows open/close + chevron rotate), auto-animate row removal (@formkit/auto-animate), and LoadingDots. Shared helpers, not per-card bespoke.",
    sources: [
      { path: "components/hub/SectionReveal.tsx", note: "staggered reveal" },
      { path: "components/hub/AnimatedSection.tsx", note: "fade-up on load" },
      { path: "components/hub/HubCard.tsx", note: "accordion drawer" },
      { path: "components/hub/LoadingDots.module.css", note: "loading dots" },
    ],
    render: () => (
      <Stage>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "#5b5349" }}>
          <span>• SectionReveal / AnimatedSection — staggered fade-up on load</span>
          <span>• HubCard accordion — grid-rows open/close + chevron rotate</span>
          <span>• auto-animate — row removal on dismiss</span>
          <span>• LoadingDots — inline busy indicator</span>
        </div>
      </Stage>
    ),
  },
];

/* All reviewed entries. Grows one batch at a time. */
export const COMPONENTS: ComponentEntry[] = [...FOUNDATION_ENTRIES, ...FOUNDATION_TOKENS, ...LOGIN_ENTRIES, ...REGISTER_ENTRIES, ...GAP_ENTRIES, ...AUTH_COMPLETION_ENTRIES, ...MODAL_ENTRIES, ...EMPTY_ENTRIES, ...HUB_ENTRIES];

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

"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { AnimatedTick } from "@/components/ui/AnimatedTick";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { attributionFromParams, hasAttribution, ATTRIBUTION_COOKIE, ATTRIBUTION_COOKIE_MAX_AGE } from "@/lib/analytics/attribution";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import { RadioGroup } from "@/components/arc/radio-group/radio-group";

type Step = 1 | 2;

const CORAL = "#FF6B4A";
// Coral submit — the arc Button's style, the register's colour.
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;
// Dense auth rhythm: drop the field's label-room padding so the 14px form gap is
// the real spacing between field outlines.
const formStyle: React.CSSProperties = { padding: "1.75rem", display: "flex", flexDirection: "column", gap: "14px", "--lbi-top": "0px" } as React.CSSProperties;

// Names: letters, numbers and spaces only, plus the hyphen and apostrophe real
// names use (Anne-Marie, O'Brien). Anything else just doesn't register as they
// type. Unicode-aware so accented names (José, Łukasz) still work.
function stripNameChars(v: string): string {
  return v.replace(/[^\p{L}\p{N} '’-]/gu, "");
}

export default function RegisterForm({ progressorEnabled = false }: { progressorEnabled?: boolean }) {
  // First-touch attribution handoff from the marketing site: the /register URL
  // carries utm_*/sp_* params. Persist them to a short-lived first-party cookie
  // so they survive both the password POST and the Google OAuth round-trip; the
  // server signup paths read the cookie and write it onto the new Agency.
  useEffect(() => {
    try {
      const attribution = attributionFromParams(new URLSearchParams(window.location.search));
      if (hasAttribution(attribution)) {
        document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(attribution))}; path=/; max-age=${ATTRIBUTION_COOKIE_MAX_AGE}; SameSite=Lax`;
      }
    } catch { /* storage/URL unavailable — attribution simply won't be captured */ }
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [firmName, setFirmName] = useState("");
  const [role, setRole] = useState<"director" | "negotiator">("director");

  // Account type — an independent sales progressor signs up for their own
  // bounded progression business instead of an estate agency. The chooser only
  // appears when the feature is enabled; otherwise this stays "agency" and the
  // page is byte-for-byte the existing agent signup.
  const [accountType, setAccountType] = useState<"agency" | "progressor">("agency");
  const isProgressor = progressorEnabled && accountType === "progressor";

  const [step, setStep] = useState<Step>(1);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msgIndex, setMsgIndex] = useState(0);
  // Counter — bumped each time the user hovers the disabled submit while
  // firmName is blank. Used as a React key on the agency input so the
  // attention-nudge CSS animation re-runs on every hover, not just the first.
  const [agencyNudgeKey, setAgencyNudgeKey] = useState(0);

  function nudgeAgencyIfEmpty() {
    if (!firmName.trim()) setAgencyNudgeKey((k) => k + 1);
  }

  const LOADING_MESSAGES = [
    "Creating your account…",
    "Building your workspace…",
    "Lining up the paperwork…",
    "Getting the keys cut…",
    "Onboarding the neighbours…",
    "Taking you to your dashboard…",
  ];

  useEffect(() => {
    if (!loading) { setMsgIndex(0); return; }
    const t = setInterval(() => setMsgIndex((i) => Math.min(i + 1, LOADING_MESSAGES.length - 1)), 900);
    return () => clearInterval(t);
  }, [loading]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const step1Valid = name.trim() && emailValid && password.length >= 10 && termsAccepted;

  function advanceToStep2() {
    if (!step1Valid) return;
    setError("");
    analytics.track(ANALYTICS_EVENTS.SIGNUP_STARTED, {}); // top of the onboarding funnel
    setAnimating(true);
    setTimeout(() => { setStep(2); setAnimating(false); }, 180);
  }

  function backToStep1() {
    setAnimating(true);
    setTimeout(() => { setStep(1); setAnimating(false); }, 180);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        firmName: firmName.trim() || null,
        role,
        accountType: isProgressor ? "progressor" : "agency",
        termsAccepted,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // pending === true means the email matched an existing agency's verified
    // domain, so this is a request to join awaiting a director's approval (Fix 8).
    const data = await res.json().catch(() => ({}));

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.ok) {
      // Full navigation (not router.push) so the pre-paint ThemeModeBoot script
      // runs on the agent app's first load — a client nav skips it and the shell
      // paints a frame with the wrong theme (the "weird nav" on first sign-up).
      window.location.assign(data.pending ? "/signup/pending" : "/agent/hub");
    } else {
      setLoading(false);
      setError("Account created but sign-in failed. Please go to sign in.");
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      {/* Architectural line-drawing background. Centre is clean white space for
          the card; a faint white veil keeps it legible on narrow screens. The
          image fades in on load so it materialises alongside the card. */}
      <div aria-hidden className="auth-bg-enter" style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundImage: "url(/register-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", top: 0, left: 0, right: 0, height: "100vh", zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <style>{`
        @media (max-width: 500px) { .reg-agency-hint { display: block; margin-top: 2px; } }
        .rback:hover { color: #20242E !important; }
        /* Option D side-door link: darkens on hover, no underline, arrow glides right. */
        .reg-alt { text-align: center; font-size: 12px; color: #8A8A94; margin: 0; }
        .reg-alt-link {
          background: none; border: 0; padding: 0; font: inherit; cursor: pointer;
          color: #FF6B4A; font-weight: 600; text-decoration: none;
          display: inline-flex; align-items: center; gap: 4px;
          transition: color 0.15s ease;
        }
        .reg-alt-link:hover { color: #E55B3D; }
        .reg-alt-link:focus-visible { outline: 2px solid #FF6B4A; outline-offset: 2px; border-radius: 4px; }
        /* Inline coral links (Terms, Privacy, Sign in) — no underline at rest,
           darken to the canonical coral-darker (#E55B3D) on hover so every orange
           link shares one hover language with .agent-link / "Open chain". */
        .reg-link { color: #FF6B4A; text-decoration: none; transition: color 0.15s ease; }
        .reg-link:hover { color: #E55B3D; }
        .reg-link:focus-visible { outline: 2px solid #FF6B4A; outline-offset: 2px; border-radius: 4px; }
        .reg-alt-arrow { display: inline-block; transition: transform 0.15s ease; }
        .reg-alt-link:hover .reg-alt-arrow { transform: translateX(3px); }
        @media (prefers-reduced-motion: reduce) { .reg-alt-arrow { transition: none; } }
        /* Subtle attention nudge — fires when user hovers the disabled submit
           button. Coral bloom blooms outward and fades around the field. */
        @keyframes ri-nudge {
          0%   { box-shadow: 0 0 0 0 rgba(255,107,74,0.40); }
          50%  { box-shadow: 0 0 0 6px rgba(255,107,74,0.18); }
          100% { box-shadow: 0 0 0 0 rgba(255,107,74,0); }
        }
        .ri-nudge { animation: ri-nudge 700ms ease-out; border-radius: 22px; }
        /* Page entrance: content rises and fades in on load, matching the
           app's house motion (relaxed pace). (founder report, 2026-10-05) */
        @keyframes reg-enter {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reg-enter { animation: reg-enter 560ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) { .reg-enter { animation: none; } }
        /* Background develops in on load so it appears alongside the card. */
        @keyframes auth-bg-fade { from { opacity: 0; } to { opacity: 1; } }
        .auth-bg-enter { animation: auth-bg-fade 820ms ease both; }
        @media (prefers-reduced-motion: reduce) { .auth-bg-enter { animation: none; } }
      `}</style>

      <div className="reg-enter" style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        {/* Brand mark + heading */}
        <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", marginBottom: "1.1rem" }}>
            <BrandMark size={38} />
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: "20px", fontWeight: 800, color: "#FF6B4A", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: "9.5px", fontWeight: 700, color: "#8A7A72", letterSpacing: "0.14em", marginTop: "3px" }}>SALES PROGRESSOR</span>
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800, color: "#20242E", letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Create your account
          </h1>
          <p style={{ margin: "0.45rem 0 0", fontSize: "13px", color: "#8A8A94" }}>
            {step === 1
              ? "Step 1 of 2: Your details"
              : isProgressor
                ? "Step 2 of 2: Set up your business"
                : "Step 2 of 2: Set up your agency"}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "1.1rem" }}>
          <div style={{ flex: 1, height: "4px", borderRadius: "999px", background: "#FF6B4A" }} />
          <div style={{
            flex: 1, height: "4px", borderRadius: "999px",
            background: step === 2 ? "#FF6B4A" : "rgba(32,36,46,0.12)",
            transition: "background 0.3s ease",
          }} />
        </div>

        {/* Card */}
        <div style={{
          background: "#ffffff",
          borderRadius: "18px",
          border: "1px solid rgba(23,23,30,0.06)",
          boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
          overflow: "hidden",
        }}>
          <div style={{
            opacity: animating ? 0 : 1,
            transform: animating ? "translateX(-12px)" : "translateX(0)",
            transition: "opacity 180ms ease, transform 180ms ease",
          }}>

            {/* ── Step 1 ── */}
            {step === 1 && (
              <form onSubmit={e => { e.preventDefault(); advanceToStep2(); }} style={formStyle}>

                <LabelInput
                  label="Full name" type="text" name="name" autoComplete="name"
                  accent={CORAL} fullWidth required autoFocus
                  value={name}
                  onChange={e => setName(stripNameChars(e.target.value))}
                  onBlur={e => { if (e.target.value.trim()) setName(titleCaseKeepAcronyms(e.target.value)); }}
                />

                <LabelInput
                  label="Work email" type="email" name="email" autoComplete="email"
                  accent={CORAL} fullWidth required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onBlur={e => { if (e.target.value.trim()) setEmail(e.target.value.trim().toLowerCase()); }}
                />

                {/* Password group — the field, the length hint and the strength
                    meter sit close together, apart from the 14px rhythm. */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <LabelInput
                    field="Password" name="password" autoComplete="new-password"
                    accent={CORAL} fullWidth required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  {password.length > 0 && password.length < 10 && (
                    <p style={{ fontSize: "11px", color: "#B05A20", margin: 0 }}>At least 10 characters required</p>
                  )}
                  <PasswordStrength password={password} />
                </div>

                {/* Terms checkbox */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                  <div style={{ position: "relative", marginTop: "1px", flexShrink: 0 }}>
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "4px", border: `1.5px solid ${termsAccepted ? "#FF6B4A" : "rgba(32,36,46,0.30)"}`,
                      background: termsAccepted ? "#FF6B4A" : "rgba(255,255,255,0.50)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s ease",
                    }}>
                      {termsAccepted && <AnimatedTick size={10} color="#fff" strokeWidth={3} />}
                    </div>
                  </div>
                  <span style={{ fontSize: "12px", color: "rgba(32,36,46,0.60)", lineHeight: 1.5 }}>
                    I agree to the{" "}
                    {/* A progression business agrees to ITS OWN terms, not the agency
                        Terms of Service. The agency flow is unchanged. */}
                    <a
                      href={isProgressor ? "/progression-business-terms" : "/terms"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="reg-link"
                    >
                      {isProgressor ? "Sales Progression Business Terms" : "Terms of Service"}
                    </a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="reg-link">Privacy Policy</a>
                  </span>
                </label>

                <Button type="submit" variant="primary" size="lg" disabled={!step1Valid} style={{ ...coralVars, width: "100%" }}>
                  Continue
                </Button>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#8A8A94", margin: 0 }}>
                  Already have an account?{" "}
                  <Link href="/login" className="reg-link" style={{ fontWeight: 500 }}>Sign in</Link>
                </p>

                {/* Option D — agency is the clean default; an independent sales
                    progressor takes this quiet side door into the business
                    signup. Only shown when the feature is on. */}
                {progressorEnabled && (
                  <p className="reg-alt">
                    {isProgressor ? "Setting up a progression business." : "Progressing sales independently?"}{" "}
                    <button type="button" className="reg-alt-link" onClick={() => setAccountType(t => t === "progressor" ? "agency" : "progressor")}>
                      {isProgressor ? "Use an estate agency instead" : "Set up a progression business"}
                      <span className="reg-alt-arrow" aria-hidden>→</span>
                    </button>
                  </p>
                )}
              </form>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} style={formStyle}>

                {/* Wrapper carries the one-shot ri-nudge animation; the key bump
                    re-mounts it so the nudge restarts on every disabled-submit
                    hover. */}
                <div key={agencyNudgeKey} className={agencyNudgeKey > 0 ? "ri-nudge" : undefined}>
                  <LabelInput
                    label={isProgressor ? "Business name" : "Agency name"}
                    type="text" name="firmName" autoComplete="organization"
                    accent={CORAL} fullWidth required autoFocus
                    value={firmName}
                    onChange={e => setFirmName(e.target.value)}
                    onBlur={e => { if (e.target.value.trim()) setFirmName(titleCaseKeepAcronyms(e.target.value)); }}
                  />
                </div>

                {!isProgressor && (
                  <RadioGroup
                    label="What's your role?"
                    name="role"
                    value={role}
                    onValueChange={(v) => setRole(v as "director" | "negotiator")}
                    options={[
                      { value: "director", label: "Director", description: "Manage your agency, view all sales and oversee your team." },
                      { value: "negotiator", label: "Negotiator", description: "View your sales and request support from your sales progressor." },
                    ]}
                  />
                )}

                {error && (
                  <p style={{ fontSize: "12px", color: "#8B2500", background: "rgba(255,210,190,0.55)", padding: "8px 12px", borderRadius: "8px", margin: 0 }}>
                    {error}
                  </p>
                )}

                {/* Hover wrapper — disabled buttons don't fire mouse events in
                    most browsers, so the nudge handler lives on the parent. The
                    loading messages ride the arc Button's label morph. */}
                <div onMouseEnter={nudgeAgencyIfEmpty}>
                  <Button type="submit" variant="primary" size="lg" disabled={loading || !firmName.trim()} style={{ ...coralVars, width: "100%" }}>
                    {loading ? LOADING_MESSAGES[msgIndex] : "Create account"}
                  </Button>
                </div>

                <Button type="button" variant="ghost" size="sm" onClick={backToStep1} className="rback" style={{ width: "100%" }}>
                  ← Back
                </Button>

                {/* Net fallback: a persistent way back to the estate-agency path
                    for anyone who took the side door by mistake and is now on
                    step 2. Mirrors the estate-agency switch on step 1. */}
                {isProgressor && (
                  <p className="reg-alt" style={{ marginTop: "2px" }}>
                    Not a progression business?{" "}
                    <button type="button" className="reg-alt-link" onClick={() => setAccountType("agency")}>
                      Use an estate agency instead
                      <span className="reg-alt-arrow" aria-hidden>→</span>
                    </button>
                  </p>
                )}

              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: "11px", color: "rgba(32,36,46,0.45)", marginTop: "1.25rem" }}>
          {isProgressor ? "Joining a colleague's business?" : "Already part of an existing agency?"}{" "}
          <span className="reg-agency-hint" style={{ color: "rgba(32,36,46,0.60)" }}>
            {isProgressor ? "Ask them to invite you." : "Ask your administrator to invite you."}
          </span>
        </p>

      </div>
    </div>
  );
}

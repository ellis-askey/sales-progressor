"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { BrandMark } from "@/components/brand/BrandMark";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { attributionFromParams, hasAttribution, ATTRIBUTION_COOKIE, ATTRIBUTION_COOKIE_MAX_AGE } from "@/lib/analytics/attribution";
import * as analytics from "@/lib/analytics/posthog";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";

type Step = 1 | 2;

// Names: letters, numbers and spaces only, plus the hyphen and apostrophe real
// names use (Anne-Marie, O'Brien). Anything else just doesn't register as they
// type. Unicode-aware so accented names (José, Łukasz) still work.
function stripNameChars(v: string): string {
  return v.replace(/[^\p{L}\p{N} '’-]/gu, "");
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#F4F4F6",
  border: "0.5px solid rgba(45,24,16,0.12)",
  borderRadius: "10px",
  padding: "11px 14px",
  color: "#20242E",
  fontSize: "16px",
  outline: "none",
  transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#3F3F46",
  marginBottom: "6px",
  letterSpacing: "0.005em",
};

export default function RegisterPage() {
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
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [firmName, setFirmName] = useState("");
  const [role, setRole] = useState<"director" | "negotiator">("director");

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
  const step1Valid = name.trim() && emailValid && password.length >= 8 && termsAccepted;

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
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    if (result?.ok) {
      // Full navigation (not router.push) so the pre-paint ThemeModeBoot script
      // runs on the agent app's first load — a client nav skips it and the shell
      // paints a frame with the wrong theme (the "weird nav" on first sign-up).
      window.location.assign("/agent/hub");
    } else {
      setLoading(false);
      setError("Account created but sign-in failed. Please go to sign in.");
    }
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem", overflow: "hidden" }}>
      {/* Architectural line-drawing background. Centre is clean white space for
          the card; a faint white veil keeps it legible on narrow screens. */}
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 0,
        backgroundColor: "#ffffff",
        backgroundImage: "url(/register-bg.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }} />
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: 1,
        background: "radial-gradient(60% 55% at 50% 48%, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.20) 55%, rgba(255,255,255,0) 100%)",
      }} />

      <style>{`
        .ri::placeholder { color: rgba(32,36,46,0.38); }
        .ri:hover:not(:focus) {
          border-color: rgba(255,138,101,0.45) !important;
        }
        .ri:focus {
          background: #ffffff !important;
          border-color: #FF6B4A !important;
          box-shadow: none !important;
        }
        .ri-pr { padding-right: 42px !important; }
        .rbtn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(255,107,74,0.45) !important;
        }
        .rbtn:active:not(:disabled) { transform: scale(0.98); }
        .rback:hover { color: #20242E !important; }
        @keyframes rpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
        /* Subtle attention nudge — fires when user hovers the disabled
           submit button. Coral box-shadow blooms outward and fades. */
        @keyframes ri-nudge {
          0%   { box-shadow: 0 0 0 0 rgba(255,107,74,0.40); }
          50%  { box-shadow: 0 0 0 6px rgba(255,107,74,0.18); }
          100% { box-shadow: 0 0 0 0 rgba(255,107,74,0); }
        }
        .ri-nudge { animation: ri-nudge 700ms ease-out; border-radius: 8px; }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

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
            {step === 1 ? "Step 1 of 2: your details" : "Step 2 of 2: Set up your agency"}
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
              <form onSubmit={e => { e.preventDefault(); advanceToStep2(); }} style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                <div>
                  <label style={labelStyle}>Full name</label>
                  <input className="ri" type="text" value={name} onChange={e => setName(stripNameChars(e.target.value))}
                    onBlur={e => { if (e.target.value.trim()) setName(titleCaseKeepAcronyms(e.target.value)); }}
                    placeholder="Sarah Jones" required autoComplete="name" autoFocus style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Work email</label>
                  <input className="ri" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    onBlur={e => { if (e.target.value.trim()) setEmail(e.target.value.trim().toLowerCase()); }}
                    placeholder="sarah@youragency.co.uk" required autoComplete="email" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="ri ri-pr" type={showPassword ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      required autoComplete="new-password" style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(32,36,46,0.40)", padding: 0, display: "flex" }}>
                      {showPassword ? (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {password.length > 0 && password.length < 8 && (
                    <p style={{ fontSize: "11px", color: "#B05A20", marginTop: "4px" }}>At least 8 characters required</p>
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
                      {termsAccepted && (
                        <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: "12px", color: "rgba(32,36,46,0.60)", lineHeight: 1.5 }}>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6B4A", textDecoration: "underline", textUnderlineOffset: "2px" }}>Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#FF6B4A", textDecoration: "underline", textUnderlineOffset: "2px" }}>Privacy Policy</a>
                  </span>
                </label>

                <button type="submit" disabled={!step1Valid} className="rbtn" style={{
                  width: "100%", padding: "12px", borderRadius: "8px",
                  background: step1Valid ? "#FF6B4A" : "rgba(255,107,74,0.40)",
                  color: "white", fontSize: "14px", fontWeight: 500, border: "none",
                  cursor: step1Valid ? "pointer" : "not-allowed",
                  boxShadow: "0 4px 20px rgba(255,107,74,0.30)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                }}>
                  Continue
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#8A8A94", margin: 0 }}>
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: "#FF6B4A", fontWeight: 500, textDecoration: "none" }}>Sign in</Link>
                </p>
              </form>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

                <div>
                  <label style={labelStyle}>
                    Agency name
                  </label>
                  {/* Wrapper carries the one-shot ri-nudge animation. key bump
                      re-mounts the wrapper (not the input) so the animation
                      restarts on every disabled-submit hover. */}
                  <div key={agencyNudgeKey} className={agencyNudgeKey > 0 ? "ri-nudge" : undefined}>
                    <input className="ri" type="text" value={firmName} onChange={e => setFirmName(e.target.value)}
                      onBlur={e => { if (e.target.value.trim()) setFirmName(titleCaseKeepAcronyms(e.target.value)); }}
                      placeholder="e.g. Hartwell & Partners" autoComplete="organization" autoFocus required style={inputStyle} />
                  </div>
                </div>

                <div>
                  <p style={{ ...labelStyle, marginBottom: "10px" }}>What&apos;s your role?</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {([
                      { value: "director" as const, label: "Director", sub: "Manage your agency, view all sales and oversee your team." },
                      { value: "negotiator" as const, label: "Negotiator", sub: "View your sales and request support from your sales progressor." },
                    ] as const).map(({ value, label, sub }) => (
                      <label key={value} style={{
                        display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px",
                        borderRadius: "10px", cursor: "pointer",
                        border: `1.5px solid ${role === value ? "#FF6B4A" : "rgba(32,36,46,0.12)"}`,
                        background: role === value ? "rgba(255,107,74,0.08)" : "#F4F4F6",
                        transition: "all 0.15s ease",
                      }}>
                        <div style={{ position: "relative", marginTop: "2px", flexShrink: 0 }}>
                          <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                          <div style={{
                            width: "16px", height: "16px", borderRadius: "50%",
                            border: `2px solid ${role === value ? "#FF6B4A" : "rgba(32,36,46,0.30)"}`,
                            background: role === value ? "#FF6B4A" : "rgba(255,255,255,0.50)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s ease",
                          }}>
                            {role === value && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "white" }} />}
                          </div>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 500, color: "#20242E" }}>{label}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(32,36,46,0.55)", lineHeight: 1.4 }}>{sub}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <p style={{ fontSize: "12px", color: "#8B2500", background: "rgba(255,210,190,0.55)", padding: "8px 12px", borderRadius: "8px", margin: 0 }}>
                    {error}
                  </p>
                )}

                {/* Hover wrapper — disabled buttons don't fire mouse events in
                    most browsers, so the nudge handler lives on the parent. */}
                <div onMouseEnter={nudgeAgencyIfEmpty}>
                <button type="submit" disabled={loading || !firmName.trim()} className="rbtn" style={{
                  width: "100%", padding: "12px", borderRadius: "8px",
                  background: (loading || !firmName.trim()) ? "rgba(255,107,74,0.40)" : "#FF6B4A",
                  color: "white", fontSize: "14px", fontWeight: 500, border: "none",
                  cursor: (loading || !firmName.trim()) ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 20px rgba(255,107,74,0.30)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}>
                  {loading ? LOADING_MESSAGES[msgIndex] : "Create account"}
                </button>
                </div>

                <button type="button" onClick={backToStep1} className="rback" style={{
                  width: "100%", padding: "8px", fontSize: "12px", color: "rgba(32,36,46,0.45)",
                  background: "none", border: "none", cursor: "pointer",
                  transition: "color 0.12s ease",
                }}>
                  ← Back
                </button>

              </form>
            )}
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: "11px", color: "rgba(32,36,46,0.45)", marginTop: "1.25rem" }}>
          Already part of an existing agency?{" "}
          <span style={{ color: "rgba(32,36,46,0.60)" }}>Ask your administrator to invite you.</span>
        </p>

      </div>
    </div>
  );
}

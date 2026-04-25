"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SunriseBackground } from "@/components/login/SunriseBackground";

type Step = 1 | 2;

// Same brand mark as login page
function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#bm-grad-r)" />
      <defs>
        <linearGradient id="bm-grad-r" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFAA7A" />
          <stop offset="100%" stopColor="#FF6B4A" />
        </linearGradient>
      </defs>
      <circle cx="10" cy="22" r="3" fill="white" fillOpacity="0.55" />
      <line x1="13" y1="22" x2="18" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
      <circle cx="21" cy="22" r="3" fill="white" fillOpacity="0.78" />
      <line x1="24" y1="22" x2="29" y2="22" stroke="white" strokeWidth="1.5" strokeOpacity="0.40" strokeLinecap="round" />
      <circle cx="34" cy="22" r="4" fill="white" />
      <path d="M32.2 22l1.5 1.5 2.8-2.8" stroke="#FF7A54" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.50)",
  border: "0.5px solid rgba(255,255,255,0.70)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#3D1F0E",
  fontSize: "14px",
  outline: "none",
  transition: "background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 500,
  color: "#7A4A2E",
  marginBottom: "6px",
  letterSpacing: "0.01em",
};

export default function RegisterPage() {
  const router = useRouter();

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

  const step1Valid = name.trim() && email.trim() && password.length >= 8 && termsAccepted;

  function advanceToStep2() {
    if (!step1Valid) return;
    setError("");
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
      router.push("/agent/dashboard");
    } else {
      setLoading(false);
      setError("Account created but sign-in failed. Please go to sign in.");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />

      <style>{`
        .ri::placeholder { color: rgba(61,31,14,0.42); }
        .ri:focus {
          background: rgba(255,255,255,0.62) !important;
          border-color: rgba(255,255,255,0.95) !important;
          box-shadow: 0 0 0 3px rgba(255,138,101,0.16);
        }
        .ri-pr { padding-right: 42px !important; }
        .rbtn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(216,90,53,0.45) !important;
        }
        .rbtn:active:not(:disabled) { transform: scale(0.98); }
        .rback:hover { color: #3D1F0E !important; }
        @keyframes rpulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.6; transform: scale(0.85); }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        {/* Brand mark + heading */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.1rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Create your account
          </h1>
          <p style={{ margin: "0.35rem 0 0", fontSize: "12px", color: "#7A4A2E", opacity: 0.85 }}>
            {step === 1 ? "Step 1 of 2 — your details" : "Step 2 of 2 — your workspace"}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "1.1rem" }}>
          <div style={{ flex: 1, height: "3px", borderRadius: "2px", background: "#D85A35" }} />
          <div style={{
            flex: 1, height: "3px", borderRadius: "2px",
            background: step === 2 ? "#D85A35" : "rgba(61,31,14,0.15)",
            transition: "background 0.3s ease",
          }} />
        </div>

        {/* Frosted glass card */}
        <div style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: "16px",
          border: "0.5px solid rgba(255,255,255,0.60)",
          borderTop: "0.5px solid rgba(255,255,255,0.82)",
          boxShadow: "0 20px 60px rgba(200,80,30,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.14)",
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
                  <input className="ri" type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Sarah Jones" required autoComplete="name" autoFocus style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Work email</label>
                  <input className="ri" type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="sarah@youragency.co.uk" required autoComplete="email" style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="ri ri-pr" type={showPassword ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters"
                      required autoComplete="new-password" style={inputStyle} />
                    <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                      style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(61,31,14,0.40)", padding: 0, display: "flex" }}>
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
                </div>

                {/* Terms checkbox */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                  <div style={{ position: "relative", marginTop: "1px", flexShrink: 0 }}>
                    <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                    <div style={{
                      width: "16px", height: "16px", borderRadius: "4px", border: `1.5px solid ${termsAccepted ? "#D85A35" : "rgba(61,31,14,0.30)"}`,
                      background: termsAccepted ? "#D85A35" : "rgba(255,255,255,0.50)",
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
                  <span style={{ fontSize: "12px", color: "rgba(61,31,14,0.60)", lineHeight: 1.5 }}>
                    I agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "#D85A35", textDecoration: "underline", textUnderlineOffset: "2px" }}>Terms of Service</a>
                    {" "}and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#D85A35", textDecoration: "underline", textUnderlineOffset: "2px" }}>Privacy Policy</a>
                  </span>
                </label>

                <button type="submit" disabled={!step1Valid} className="rbtn" style={{
                  width: "100%", padding: "12px", borderRadius: "8px",
                  background: step1Valid ? "#D85A35" : "rgba(220,90,55,0.40)",
                  color: "white", fontSize: "14px", fontWeight: 500, border: "none",
                  cursor: step1Valid ? "pointer" : "not-allowed",
                  boxShadow: "0 4px 20px rgba(216,90,53,0.30)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                }}>
                  Continue
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#7A4A2E", margin: 0 }}>
                  Already have an account?{" "}
                  <Link href="/login" style={{ color: "#D85A35", fontWeight: 500, textDecoration: "none" }}>Sign in</Link>
                </p>
              </form>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <form onSubmit={handleSubmit} style={{ padding: "1.75rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

                <div>
                  <label style={labelStyle}>
                    Agency name{" "}
                    <span style={{ color: "rgba(61,31,14,0.40)", fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input className="ri" type="text" value={firmName} onChange={e => setFirmName(e.target.value)}
                    placeholder="e.g. Hartwell & Partners" autoComplete="organization" autoFocus style={inputStyle} />
                </div>

                <div>
                  <p style={{ ...labelStyle, marginBottom: "10px" }}>I am a…</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {([
                      { value: "director" as const, label: "Director", sub: "Manage your agency, see all files, and oversee your pipeline" },
                      { value: "negotiator" as const, label: "Negotiator", sub: "View your files and pipeline, flag requests to your progressor" },
                    ] as const).map(({ value, label, sub }) => (
                      <label key={value} style={{
                        display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px 14px",
                        borderRadius: "10px", cursor: "pointer",
                        border: `1.5px solid ${role === value ? "#D85A35" : "rgba(255,255,255,0.50)"}`,
                        background: role === value ? "rgba(216,90,53,0.08)" : "rgba(255,255,255,0.30)",
                        transition: "all 0.15s ease",
                      }}>
                        <div style={{ position: "relative", marginTop: "2px", flexShrink: 0 }}>
                          <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                          <div style={{
                            width: "16px", height: "16px", borderRadius: "50%",
                            border: `2px solid ${role === value ? "#D85A35" : "rgba(61,31,14,0.30)"}`,
                            background: role === value ? "#D85A35" : "rgba(255,255,255,0.50)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.15s ease",
                          }}>
                            {role === value && <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "white" }} />}
                          </div>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: "13px", fontWeight: 500, color: "#3D1F0E" }}>{label}</p>
                          <p style={{ margin: "2px 0 0", fontSize: "11px", color: "rgba(61,31,14,0.55)", lineHeight: 1.4 }}>{sub}</p>
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

                <button type="submit" disabled={loading} className="rbtn" style={{
                  width: "100%", padding: "12px", borderRadius: "8px",
                  background: loading ? "rgba(220,90,55,0.40)" : "#D85A35",
                  color: "white", fontSize: "14px", fontWeight: 500, border: "none",
                  cursor: loading ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 20px rgba(216,90,53,0.30)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}>
                  {loading ? LOADING_MESSAGES[msgIndex] : "Create account"}
                </button>

                <button type="button" onClick={backToStep1} className="rback" style={{
                  width: "100%", padding: "8px", fontSize: "12px", color: "rgba(61,31,14,0.45)",
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
        <p style={{ textAlign: "center", fontSize: "11px", color: "rgba(61,31,14,0.45)", marginTop: "1.25rem" }}>
          Internal team member?{" "}
          <span style={{ color: "rgba(61,31,14,0.60)" }}>Contact your administrator for access.</span>
        </p>

      </div>
    </div>
  );
}

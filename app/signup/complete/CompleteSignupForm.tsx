"use client";

import { useState } from "react";
import { SunriseBackground } from "@/components/login/SunriseBackground";
import { completeOAuthSignup } from "@/app/actions/complete-oauth-signup";
import { titleCase } from "@/lib/utils";

function BrandMark() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#bm-grad-cs)" />
      <defs>
        <linearGradient id="bm-grad-cs" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
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
  background: "rgba(255,255,255,0.65)",
  border: "1px solid rgba(220,100,70,0.45)",
  borderRadius: "8px",
  padding: "10px 14px",
  color: "#3D1F0E",
  fontSize: "16px",
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

interface Props {
  defaultName: string;
  email: string;
}

export function CompleteSignupForm({ defaultName, email }: Props) {
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState<"director" | "negotiator">("director");
  const [agencyName, setAgencyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Counter — bumped each time the user hovers the disabled submit while
  // agencyName is blank. Used as a React key on the agency-input wrapper so
  // the attention-nudge CSS animation re-runs on every hover.
  const [agencyNudgeKey, setAgencyNudgeKey] = useState(0);

  function nudgeAgencyIfEmpty() {
    if (!agencyName.trim()) setAgencyNudgeKey((k) => k + 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData();
    fd.append("name", name);
    fd.append("role", role);
    fd.append("agencyName", agencyName);

    const result = await completeOAuthSignup(fd);

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Hard navigate to root so Next.js re-runs the JWT callback, picks up the
    // new role/agencyId from the DB, and refreshes the session cookie before
    // the role-aware redirect to /agent/hub fires.
    window.location.href = "/";
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem 1rem" }}>
      <SunriseBackground />

      <style>{`
        .cs-input::placeholder { color: rgba(110,60,30,0.50); }
        .cs-input:focus {
          background: rgba(255,255,255,0.78) !important;
          border-color: rgba(220,100,70,0.65) !important;
          box-shadow: 0 0 0 3px rgba(220,100,70,0.12);
        }
        .cs-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(216,90,53,0.45) !important;
        }
        .cs-btn:active:not(:disabled) { transform: scale(0.98); }
        /* Subtle attention nudge — fires when user hovers the disabled
           submit button. Coral box-shadow blooms outward and fades. */
        @keyframes cs-nudge {
          0%   { box-shadow: 0 0 0 0 rgba(216,90,53,0.40); }
          50%  { box-shadow: 0 0 0 6px rgba(216,90,53,0.18); }
          100% { box-shadow: 0 0 0 0 rgba(216,90,53,0); }
        }
        .cs-nudge { animation: cs-nudge 700ms ease-out; border-radius: 8px; }
      `}</style>

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: "400px" }}>

        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ display: "inline-flex", marginBottom: "1.25rem" }}>
            <BrandMark />
          </div>
          <h1 style={{ margin: 0, fontSize: "1.625rem", fontWeight: 600, color: "#3D1F0E", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
            Almost there.
          </h1>
          <p style={{ margin: "0.4rem 0 0", fontSize: "12px", color: "#7A4A2E", opacity: 0.85 }}>
            Just a few more details to set up your workspace.
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.38)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderRadius: "16px",
          border: "0.5px solid rgba(255,255,255,0.60)",
          borderTop: "0.5px solid rgba(255,255,255,0.82)",
          padding: "1.75rem",
          boxShadow: "0 20px 60px rgba(200,80,30,0.16), inset 0 0 0 0.5px rgba(255,255,255,0.14)",
        }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            {/* Locked email */}
            <div>
              <label style={labelStyle}>Email address</label>
              <div style={{
                ...inputStyle,
                background: "rgba(255,255,255,0.30)",
                border: "1px solid rgba(220,100,70,0.20)",
                color: "rgba(61,31,14,0.55)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14px",
              }}>
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, opacity: 0.5 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                {email}
              </div>
              <p style={{ fontSize: "11px", color: "rgba(61,31,14,0.45)", marginTop: "4px" }}>
                Signed in via Google or Microsoft — can't be changed here
              </p>
            </div>

            {/* Name */}
            <div>
              <label style={labelStyle}>Your name</label>
              <input
                className="cs-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                autoComplete="name"
                placeholder="Sarah Jones"
                style={inputStyle}
              />
            </div>

            {/* Role */}
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
                      <input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)}
                        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
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

            {/* Agency name */}
            <div>
              <label style={labelStyle}>
                Agency name
              </label>
              {/* Wrapper carries the one-shot cs-nudge animation; key bump
                  re-mounts only the wrapper so the input keeps its focus. */}
              <div key={agencyNudgeKey} className={agencyNudgeKey > 0 ? "cs-nudge" : undefined}>
                <input
                  className="cs-input"
                  type="text"
                  value={agencyName}
                  onChange={e => setAgencyName(e.target.value)}
                  onBlur={e => { if (e.target.value.trim()) setAgencyName(titleCase(e.target.value)); }}
                  autoComplete="organization"
                  placeholder="e.g. Hartwell & Partners"
                  required
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <p style={{ fontSize: "12px", color: "#8B2500", background: "rgba(255,210,190,0.55)", padding: "8px 12px", borderRadius: "8px", margin: 0 }}>
                {error}
              </p>
            )}

            {/* Hover wrapper — disabled buttons don't fire mouse events. */}
            <div onMouseEnter={nudgeAgencyIfEmpty}>
            <button
              type="submit"
              disabled={loading || !name.trim() || !agencyName.trim()}
              className="cs-btn"
              style={{
                width: "100%", padding: "12px", borderRadius: "8px",
                background: (loading || !name.trim() || !agencyName.trim()) ? "rgba(220,90,55,0.45)" : "#D85A35",
                color: "white", fontSize: "14px", fontWeight: 500, border: "none",
                cursor: (loading || !name.trim() || !agencyName.trim()) ? "not-allowed" : "pointer",
                boxShadow: "0 4px 20px rgba(216,90,53,0.35)",
                transition: "transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease",
              }}
            >
              {loading ? "Setting up your workspace…" : "Complete signup"}
            </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}

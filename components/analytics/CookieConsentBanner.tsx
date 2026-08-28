"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getConsent, hasDecided, setConsent } from "@/lib/analytics/consent";

// ── ICO compliance: all three top-level CTAs must be visually identical ───────
const BTN: React.CSSProperties = {
  flex: "1 1 0",
  padding: "8px 10px",
  border: "0.5px solid rgba(26,26,26,0.30)",
  borderRadius: "8px",
  background: "rgba(255,255,255,0.60)",
  color: "#1a1a1a",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
  transition: "background 0.12s ease, border-color 0.12s ease",
  textAlign: "center" as const,
};

function Toggle({
  id,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      style={{ display: "inline-flex", alignItems: "center", cursor: disabled ? "not-allowed" : "pointer", gap: 10 }}
    >
      <span style={{
        position: "relative", display: "inline-block", width: 36, height: 20, borderRadius: 10,
        background: checked ? "#1a1a1a" : "#d0d0d0", opacity: disabled ? 0.45 : 1,
        transition: "background 0.15s ease", flexShrink: 0,
      }}>
        <input
          id={id} type="checkbox" checked={checked} disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
          aria-checked={checked}
        />
        <span style={{
          position: "absolute", top: 2, left: checked ? 18 : 2, width: 16, height: 16,
          borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 0.15s ease", pointerEvents: "none",
        }} />
      </span>
    </label>
  );
}

export function CookieConsentBanner() {
  const [visible, setVisible]     = useState(false);
  const [mounted, setMounted]     = useState(false);
  const [held, setHeld]           = useState(false);
  const [leaving, setLeaving]     = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);

  useEffect(() => {
    if (hasDecided()) return;
    // The solicitor portal's first-visit welcome flags itself pre-paint; hold the
    // banner back so the two never share the screen, then fade in once it closes.
    const welcomeOpen = document.documentElement.getAttribute("data-welcome-open") === "1";
    setHeld(welcomeOpen);
    setVisible(true);
    if (!welcomeOpen) return;
    const onClosed = () => setHeld(false);
    window.addEventListener("welcome:closed", onClosed);
    return () => window.removeEventListener("welcome:closed", onClosed);
  }, []);

  // Fade in once we're clear to show (drives opacity/transform from 0).
  useEffect(() => {
    if (visible && !held) {
      const t = window.setTimeout(() => setMounted(true), 20);
      return () => window.clearTimeout(t);
    }
  }, [visible, held]);

  // Record the choice, then fade the card out before unmounting.
  function close() { setLeaving(true); window.setTimeout(() => setVisible(false), 300); }
  function acceptAll()      { setConsent(true);        close(); }
  function essentialOnly()  { setConsent(false);       close(); }
  function savePreferences(){ setConsent(analyticsOn); setShowManage(false); close(); }

  function openManage() {
    const { analytics } = getConsent();
    setAnalyticsOn(analytics);
    setShowManage(true);
  }

  if (!visible || held) return null;

  return (
    <>
      {/* Manage modal */}
      {showManage && (
        <div
          role="dialog" aria-modal="true" aria-label="Manage cookie preferences"
          style={{
            position: "fixed", inset: 0, zIndex: 10001,
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            background: "rgba(0,0,0,0.35)", padding: "0 16px",
          }}
        >
          <div style={{
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderRadius: "16px 16px 0 0",
            border: "0.5px solid rgba(255,255,255,0.70)",
            padding: "28px 28px 32px",
            maxWidth: 480,
            width: "100%",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.12)",
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
              Manage cookies
            </h2>

            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "0.5px solid #e8e8e8", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>Essential cookies</p>
                <p style={{ margin: 0, fontSize: 12, color: "#666", lineHeight: 1.5 }}>Sign-in, session state, security</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Toggle id="toggle-essential" checked={true} onChange={() => {}} disabled={true} />
                <span style={{ fontSize: 11, color: "#999" }}>Always on</span>
              </div>
            </div>

            <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>Analytics cookies</p>
                <p style={{ margin: 0, fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                  Helps us understand product usage. We use PostHog (EU-hosted). No cross-site tracking.
                </p>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Toggle id="toggle-analytics" checked={analyticsOn} onChange={setAnalyticsOn} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={savePreferences}
                style={{ ...BTN, flex: "none", padding: "9px 20px", background: "#1a1a1a", color: "white", border: "0.5px solid #1a1a1a" }}
              >
                Save preferences
              </button>
              <button onClick={() => setShowManage(false)} style={{ ...BTN, flex: "none", padding: "9px 20px" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating consent card */}
      <div
        role="region"
        aria-label="Cookie consent"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 10000,
          width: "min(380px, calc(100vw - 32px))",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "0.5px solid rgba(255,255,255,0.70)",
          borderRadius: 16,
          boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,0.80) inset",
          padding: "18px 20px 16px",
          opacity: leaving ? 0 : mounted ? 1 : 0,
          transform: leaving || !mounted ? "translateY(16px)" : "translateY(0)",
          transition: "opacity 300ms ease, transform 300ms ease",
        }}
      >
        {/* Label */}
        <p style={{ margin: "0 0 6px", fontSize: 10, fontWeight: 700, color: "rgba(26,26,26,0.40)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Cookies
        </p>

        {/* Body */}
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#333", lineHeight: 1.55 }}>
          Essential cookies keep you signed in. Analytics cookies (optional) help us improve the product.{" "}
          <Link href="/cookie-policy" style={{ color: "#555", textDecoration: "underline", textUnderlineOffset: 2 }}>
            Learn more
          </Link>
        </p>

        {/* CTAs — equal prominence (ICO compliance) */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={acceptAll}     style={BTN}>Accept all</button>
          <button onClick={essentialOnly} style={BTN}>Essential only</button>
          <button onClick={openManage}    style={BTN}>Manage</button>
        </div>
      </div>
    </>
  );
}

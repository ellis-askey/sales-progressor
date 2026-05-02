"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getConsent, hasDecided, setConsent } from "@/lib/analytics/consent";

// ─── Shared button style — all three top-level buttons are identical ──────────
// ICO compliance: equal prominence required. No colour differentiation.
const BTN: React.CSSProperties = {
  padding: "10px 20px",
  border: "1.5px solid #1a1a1a",
  borderRadius: "6px",
  background: "transparent",
  color: "#1a1a1a",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
  transition: "background 0.12s ease",
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
      style={{
        display: "inline-flex",
        alignItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        gap: "10px",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-block",
          width: 40,
          height: 22,
          borderRadius: 11,
          background: checked ? "#1a1a1a" : "#d0d0d0",
          opacity: disabled ? 0.45 : 1,
          transition: "background 0.15s ease",
          flexShrink: 0,
        }}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
          aria-checked={checked}
        />
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 0.15s ease",
            pointerEvents: "none",
          }}
        />
      </span>
    </label>
  );
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [analyticsOn, setAnalyticsOn] = useState(false);

  useEffect(() => {
    // Show banner only if no decision has been made yet
    if (!hasDecided()) setVisible(true);
  }, []);

  function acceptAll() {
    setConsent(true);
    setVisible(false);
  }

  function essentialOnly() {
    setConsent(false);
    setVisible(false);
  }

  function savePreferences() {
    setConsent(analyticsOn);
    setVisible(false);
    setShowManage(false);
  }

  function openManage() {
    // Pre-fill toggle from current consent if a decision was already made
    const { analytics } = getConsent();
    setAnalyticsOn(analytics);
    setShowManage(true);
  }

  if (!visible) return null;

  return (
    <>
      {/* Manage cookies modal overlay */}
      {showManage && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Manage cookie preferences"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: "rgba(0,0,0,0.4)",
            padding: "0 16px 0",
          }}
        >
          <div
            style={{
              background: "white",
              borderRadius: "12px 12px 0 0",
              padding: "28px 28px 32px",
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.12)",
            }}
          >
            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600, color: "#1a1a1a" }}>
              Manage cookies
            </h2>

            {/* Essential cookies — always on, disabled toggle */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #e8e8e8", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500, color: "#1a1a1a" }}>
                  Essential cookies
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.5 }}>
                  Sign-in, session state, security
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <Toggle id="toggle-essential" checked={true} onChange={() => {}} disabled={true} />
                <span style={{ fontSize: "12px", color: "#888" }}>Always on</span>
              </div>
            </div>

            {/* Analytics cookies — off by default */}
            <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500, color: "#1a1a1a" }}>
                  Analytics cookies
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: 1.5 }}>
                  Helps us understand product usage. We use PostHog (EU-hosted) for this. No tracking across other websites.
                </p>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Toggle
                  id="toggle-analytics"
                  checked={analyticsOn}
                  onChange={setAnalyticsOn}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={savePreferences}
                style={{
                  ...BTN,
                  background: "#1a1a1a",
                  color: "white",
                  border: "1.5px solid #1a1a1a",
                }}
              >
                Save preferences
              </button>
              <button onClick={() => setShowManage(false)} style={BTN}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main consent banner — fixed to bottom */}
      <div
        role="region"
        aria-label="Cookie consent"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          background: "white",
          borderTop: "1px solid #e8e8e8",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.08)",
          padding: "20px 24px",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Banner text */}
          <p style={{ margin: 0, fontSize: "14px", color: "#1a1a1a", lineHeight: 1.6 }}>
            We use cookies to make this site work and to understand how you use it.
            <br />
            <span style={{ color: "#444" }}>
              Essential cookies (always on) keep you signed in and remember your preferences.
              Analytics cookies help us see what&apos;s working and what isn&apos;t, so we can improve the product.
            </span>
          </p>

          {/* Buttons — equal prominence (ICO compliance) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button onClick={acceptAll} style={BTN}>
              Accept all
            </button>
            <button onClick={essentialOnly} style={BTN}>
              Essential only
            </button>
            <button onClick={openManage} style={BTN}>
              Manage cookies
            </button>
          </div>

          {/* Footer link */}
          <p style={{ margin: 0, fontSize: "12px", color: "#888" }}>
            <Link
              href="/cookie-policy"
              style={{ color: "#555", textDecoration: "underline" }}
            >
              Read our cookie policy
            </Link>
            {/* TODO: /cookie-policy page — currently returns 404. Ship as separate PR. */}
          </p>
        </div>
      </div>
    </>
  );
}

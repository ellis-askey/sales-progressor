"use client";
// Design-system pre-sign-off review — the open decisions on the login + sign-up
// pages, each shown as current vs proposed so Ellis can confirm in one place.
//   1. Role selector fill — coral gradient vs flat coral
//   2. Login error banner — warm peach vs token-danger (bordered, no wash)
//   3. Authenticator field — proof it's the SAME field, not a top-label variant
//   4. 2FA / TOTP stage — the whole composed stage, now in the library
// Dev-only. URL kept stable (/dev/components/compare/radio-fill).

import { notFound } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import { Button } from "@/components/arc/button/button";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import "@/components/arc/cookie-consent/scope.css";

const CORAL = "#FF6B4A";
const GRADIENT = "linear-gradient(180deg, #ff8365 0%, #ff6b4a 52%, #e85a35 100%)";
const DANGER = "#C73E3E";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;

/* ── Section 1 — role selector fill ─────────────────────────────────────────── */
function RadioRow({ selected, title, desc, fill }: { selected?: boolean; title: string; desc: string; fill: string }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "start", gap: 12,
      padding: "12px 14px", borderRadius: 10,
      border: selected ? "1.5px solid transparent" : "1.5px solid rgba(32,36,46,0.12)",
      background: selected ? fill : "transparent",
      boxShadow: selected ? "0 10px 24px rgba(255,107,74,0.4), inset 0 1px 0 rgba(255,255,255,0.4)" : "none",
    }}>
      <span style={{ marginTop: 2, width: 16, height: 16, borderRadius: "50%", border: selected ? "2px solid #fff" : "2px solid rgba(32,36,46,0.3)", background: selected ? "#fff" : "rgba(255,255,255,0.5)", display: "grid", placeItems: "center", flexShrink: 0 }}>
        {selected && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#c7401f" }} />}
      </span>
      <span>
        <strong style={{ display: "block", fontSize: 13, fontWeight: 500, color: selected ? "#fff" : "#20242e" }}>{title}</strong>
        <small style={{ display: "block", marginTop: 2, fontSize: 11, color: selected ? "rgba(255,255,255,0.82)" : "rgba(32,36,46,0.55)", lineHeight: 1.4 }}>{desc}</small>
      </span>
    </div>
  );
}
function RoleCard({ fill }: { fill: string }) {
  return (
    <div style={{ width: 340, maxWidth: "100%", background: "#fff", borderRadius: 16, border: "1px solid rgba(23,23,30,0.06)", padding: 20, boxShadow: "0 1px 3px rgba(30,20,15,0.06)" }}>
      <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "#3f3f46" }}>What&rsquo;s your role?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <RadioRow selected title="Director" desc="Manage your agency, view all sales and oversee your team." fill={fill} />
        <RadioRow title="Negotiator" desc="View your sales and request support from your sales progressor." fill={fill} />
      </div>
    </div>
  );
}

/* ── Section 2 — error banners ──────────────────────────────────────────────── */
function ErrorBannerCurrent() {
  return <p style={{ fontSize: 12, color: "#8B2500", background: "rgba(255,210,190,0.55)", padding: "8px 12px", borderRadius: 8, margin: 0 }}>Incorrect email or password.</p>;
}
function ErrorBannerProposed() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, border: `1px solid ${DANGER}3b`, background: "#fff" }}>
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flex: "none" }}>
        <circle cx="8" cy="8" r="6.6" stroke={DANGER} strokeWidth="1.3" />
        <path d="M8 4.7v4" stroke={DANGER} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.5" fill={DANGER} stroke={DANGER} strokeWidth="0.6" />
      </svg>
      <span style={{ fontSize: 12.5, color: DANGER, fontWeight: 500 }}>Incorrect email or password.</span>
    </div>
  );
}

/* ── Layout helpers ─────────────────────────────────────────────────────────── */
function Section({ n, title, note, approved, children }: { n: number; title: string; note: ReactNode; approved?: boolean; children: ReactNode }) {
  return (
    <section style={{ paddingTop: 36, marginTop: 36, borderTop: "1px solid rgba(45,24,16,0.1)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: CORAL, fontVariantNumeric: "tabular-nums" }}>{String(n).padStart(2, "0")}</span>
        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em", color: "#2D1810" }}>{title}</h2>
        {approved && <span style={{ fontSize: 11, fontWeight: 600, color: "#1F8A4A", background: "rgba(31,138,74,0.1)", padding: "2px 9px", borderRadius: 999 }}>✓ Approved &amp; applied</span>}
      </div>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#6b6258", lineHeight: 1.55, maxWidth: 680 }}>{note}</p>
      {children}
    </section>
  );
}
function Panel({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  const current = tag.toLowerCase() === "current";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 300, flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 999, color: current ? "#9a8d84" : "#2D1810", background: current ? "rgba(45,24,16,0.06)" : "rgba(255,107,74,0.14)" }}>{tag}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#2D1810" }}>{title}</span>
      </div>
      <div style={{ background: "#F4F2EF", borderRadius: 14, border: "1px solid rgba(45,24,16,0.08)", padding: 20, display: "flex", justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}
function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>{children}</div>;
}

export default function AuthSignoffReview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="arc-scope" style={{ minHeight: "100vh", background: "#FBFAF8", color: "#2D1810", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 140px", ...( { "--control-on": CORAL, "--control-glyph": "#fff" } as CSSProperties) }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>
        <header>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9a938a" }}>Design system · pre-sign-off review</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.01em" }}>Login &amp; sign-up — open decisions</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "#6b6258", lineHeight: 1.6, maxWidth: 680 }}>
            The four items standing between us and signing off the auth pages. Confirm a direction on each and I&rsquo;ll apply it, then we sign off login, step&nbsp;1 and step&nbsp;2 together.
          </p>
        </header>

        <Section n={1} approved title="Role selector fill" note={<>Step&nbsp;2&rsquo;s role radio. <strong>Flat</strong> coral <code>#FF6B4A</code> chosen — one coral shared with the login <strong>Sign in</strong> button. Applied to the shipped RadioGroup.</>}>
          <Row>
            <Panel tag="Current" title="Coral gradient"><RoleCard fill={GRADIENT} /></Panel>
            <Panel tag="Proposed" title="Flat coral (#FF6B4A)"><RoleCard fill={CORAL} /></Panel>
          </Row>
        </Section>

        <Section n={2} approved title="Login error banner" note={<>Shown on a wrong password or bad backup code. Aligned to the semantic <strong>danger</strong> token (<code>#C73E3E</code>), bordered rather than washed — per the no-tinted-fill rule. Applied to login and sign-up.</>}>
          <Row>
            <Panel tag="Current" title="Warm peach (bespoke)"><div style={{ width: 300, maxWidth: "100%" }}><ErrorBannerCurrent /></div></Panel>
            <Panel tag="Proposed" title="Token danger, bordered"><div style={{ width: 300, maxWidth: "100%" }}><ErrorBannerProposed /></div></Panel>
          </Row>
        </Section>

        <Section n={3} title="OTP code field — recoloured to the token" note={<>The 6-slot OTP from the gallery replaces the plain code field. <strong>Gallery</strong> ships a red ring; <strong>token</strong> overrides <code>--accent</code> / <code>--accent-strong</code> to coral <code>#FF6B4A</code> — the component itself is untouched. Click in and type to see the gliding ring.</>}>
          <Row>
            <Panel tag="Current" title="Gallery red">
              <div className="arc-scope" style={{ "--accent": "#D4183D", "--accent-strong": "#D4183D", "--accent-subtle": "rgba(212,24,61,0.08)" } as CSSProperties}>
                <OtpInput label="Code" length={6} inputMode="numeric" />
              </div>
            </Panel>
            <Panel tag="Proposed" title="Coral token (#FF6B4A)">
              <div className="arc-scope" style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties}>
                <OtpInput label="Code" length={6} inputMode="numeric" />
              </div>
            </Panel>
          </Row>
        </Section>

        <Section n={4} title="2FA stage — OTP wired + in the library" note={<>Login&rsquo;s second stage, now built on the coral <strong>OTP</strong>. It auto-submits on the sixth digit. Backup codes are alphanumeric (<code>xxxxx-xxxxx</code>), so a <strong>Use a backup code</strong> link swaps in a text field — the numeric grid can&rsquo;t take them. Catalogued under <strong>Lifecycle → Authentication</strong>.</>}>
          <Row>
            <Panel tag="Wired" title="Composed stage">
              <div className="arc-scope" style={{ "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)", width: 320, maxWidth: "100%" } as CSSProperties}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <OtpInput label="Authenticator code" length={6} inputMode="numeric" description="Enter the 6-digit code from your authenticator app." />
                  <Button type="button" variant="primary" size="lg" style={{ ...coralVars, width: "100%" }}>Verify code</Button>
                  <button type="button" style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: CORAL, fontWeight: 500 }}>Use a backup code instead</button>
                </div>
              </div>
            </Panel>
          </Row>
        </Section>
      </div>
    </div>
  );
}

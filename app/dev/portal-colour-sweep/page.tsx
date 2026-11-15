"use client";

// /dev/portal-colour-sweep — a decision tool for the portal colour sweep
// (critique #1, portal side). Change the accent at the top and watch which
// portal elements follow it and which stay stuck on the hardcoded orange.
// The "Preview proposed fix" toggle re-derives each stuck brand element from
// the accent so Ellis can see the before/after before we commit to anything.
//
// Nothing here changes production — it renders the real PortalButton and the
// real hardcoded constants (PORTAL_BTN, heroGradient, the costs-bar gradient)
// so the "stuck" column is honest, alongside accent-derived proposals.

import { useState, type ReactNode, type CSSProperties } from "react";
import { PortalButton } from "@/components/portal/PortalButton";
import { PORTAL_BTN } from "@/components/portal/portal-ui";

// Pick readable text for a fill (the real fix would do this; here it keeps the
// proposed button legible on any accent).
function autoText(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1a1512" : "#ffffff";
}

// Accent-derived values, all off var(--portal-primary) via color-mix so they
// track the picker live. Mirrors the agent button gloss (lighter top, deeper
// bottom) + an accent-tinted drop.
const DERIVED = {
  btnBg: "linear-gradient(180deg, color-mix(in srgb, var(--portal-primary) 90%, #fff) 0%, color-mix(in srgb, var(--portal-primary) 82%, #000) 100%)",
  btnShadow: "0 2px 0 color-mix(in srgb, var(--portal-primary) 72%, #000), 0 6px 16px color-mix(in srgb, var(--portal-primary) 32%, transparent), inset 0 1px 0 rgba(255,255,255,0.30)",
  heroGrad: "linear-gradient(135deg, color-mix(in srgb, var(--portal-primary) 90%, #fff) 0%, color-mix(in srgb, var(--portal-primary) 66%, #fff) 100%)",
  heroGlow: "0 8px 32px color-mix(in srgb, var(--portal-primary) 30%, transparent)",
  costsBar: "linear-gradient(180deg, color-mix(in srgb, var(--portal-primary) 85%, #fff) 0%, var(--portal-primary) 52%, color-mix(in srgb, var(--portal-primary) 80%, #000) 100%)",
};

function Tag({ kind }: { kind: "follows" | "stuck" | "fixed" }) {
  const map = {
    follows: { t: "Follows your colour", bg: "#E7F6EC", fg: "#1B7A3D", bd: "#B6E2C4" },
    stuck: { t: "Stuck on orange", bg: "#FDECEC", fg: "#B4342B", bd: "#F3C7C3" },
    fixed: { t: "Deliberately fixed", bg: "#EEF0F3", fg: "#55606F", bd: "#D7DBE1" },
  }[kind];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: map.fg, background: map.bg, border: `1px solid ${map.bd}`, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>
      {map.t}
    </span>
  );
}

function Cell({ label, tag, children }: { label: string; tag: "follows" | "stuck" | "fixed"; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 18, background: "var(--portal-cardBg)", border: "1px solid #ECEEF2", borderRadius: 16, boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--portal-textPrimary)" }}>{label}</span>
        <Tag kind={tag} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function ColumnLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--portal-textMuted)", marginBottom: 7 }}>{children}</div>;
}

export default function PortalColourSweepPage() {
  const [accent, setAccent] = useState("#7A3FF2");
  const [proposed, setProposed] = useState(false);

  // The scoped portal theme: just enough light-mode portal tokens for the real
  // components + swatches to render truthfully. --portal-primary drives the
  // picker; primaryBg/primaryText derive from it.
  const portalVars = {
    "--portal-primary": accent,
    "--portal-primaryBg": "color-mix(in srgb, var(--portal-primary) 12%, transparent)",
    "--portal-primaryText": "color-mix(in srgb, var(--portal-primary) 82%, #1A1D29)",
    "--portal-pageBg": "#F6F7F9",
    "--portal-cardBg": "#FFFFFF",
    "--portal-textPrimary": "#1A1D29",
    "--portal-textSecondary": "#4A5162",
    "--portal-textMuted": "#8B91A3",
    "--portal-accent": "#6ea8ff",
  } as CSSProperties;

  return (
    <div style={{ minHeight: "100vh", background: "#eef0f3", padding: "0 0 80px" }}>
      {/* Sticky control bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(255,255,255,0.86)", backdropFilter: "blur(14px)", borderBottom: "1px solid #E2E5EA", padding: "16px 28px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <div style={{ marginRight: "auto" }}>
          <div style={{ fontSize: 15, fontWeight: 760, letterSpacing: -0.01, color: "#1A1D29" }}>Portal colour sweep</div>
          <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>Change the accent and watch what follows it. Toggle the proposed fix to see the stuck pieces re-derived from your colour.</div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>Agency accent</span>
          <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 38, height: 32, border: "1px solid #D7DBE1", borderRadius: 9, background: "#fff", cursor: "pointer", padding: 2 }} />
          <input value={accent} onChange={(e) => setAccent(e.target.value)} style={{ width: 92, fontSize: 13, fontFamily: "ui-monospace, monospace", padding: "7px 9px", border: "1px solid #D7DBE1", borderRadius: 9, background: "#fff", color: "#1A1D29" }} />
          <div style={{ display: "flex", gap: 6 }}>
            {["#7A3FF2", "#1E9E6A", "#D4356B", "#2563EB", "#FF6B4A"].map((c) => (
              <button key={c} onClick={() => setAccent(c)} aria-label={c} style={{ width: 22, height: 22, borderRadius: 7, background: c, border: accent.toLowerCase() === c.toLowerCase() ? "2px solid #1A1D29" : "1px solid rgba(0,0,0,0.12)", cursor: "pointer" }} />
            ))}
          </div>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none" }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>Preview proposed fix</span>
          <span onClick={() => setProposed((v) => !v)} style={{ width: 42, height: 24, borderRadius: 999, background: proposed ? accent : "#CBD0D8", position: "relative", transition: "background .18s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 2, left: proposed ? 20 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .18s" }} />
          </span>
        </label>
      </div>

      <div style={{ ...portalVars, maxWidth: 1080, margin: "0 auto", padding: "28px 28px 0", display: "flex", flexDirection: "column", gap: 30 }}>

        {/* ── A. Already follows ─────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, color: "#1B7A3D", margin: "0 0 4px" }}>Already follows your colour</h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 14px" }}>These move the moment you change the accent. No change needed.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            <Cell label="Nav tab (active)" tag="follows">
              <div style={{ display: "flex", gap: 20, fontSize: 13, fontWeight: 650 }}>
                <span style={{ color: "var(--portal-textMuted)" }}>Overview</span>
                <span style={{ color: "var(--portal-primary)", position: "relative" }}>Progress<span style={{ position: "absolute", left: 0, right: 0, bottom: -7, height: 2.5, borderRadius: 2, background: "var(--portal-primary)" }} /></span>
                <span style={{ color: "var(--portal-textMuted)" }}>Documents</span>
              </div>
            </Cell>
            <Cell label="Badge + tinted chip" tag="follows">
              <span style={{ minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "var(--portal-primary)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>3</span>
              <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--portal-primaryText)", background: "var(--portal-primaryBg)", borderRadius: 8, padding: "5px 11px" }}>In progress</span>
            </Cell>
            <Cell label="Link / inline accent" tag="follows">
              <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--portal-primary)" }}>View your documents →</span>
            </Cell>
          </div>
        </section>

        {/* ── B. Stuck on orange ─────────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, color: "#B4342B", margin: "0 0 4px" }}>Stuck on orange — recommend: make these follow</h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 14px" }}>Left is live production (won&rsquo;t move with the picker). Turn on &ldquo;Preview proposed fix&rdquo; to see it re-derived from your accent.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>

            <Cell label="Primary button — the main CTA everywhere" tag="stuck">
              <div>
                <ColumnLabel>Current</ColumnLabel>
                <div style={{ width: 200 }}><PortalButton onClick={() => {}}>Confirm &amp; continue</PortalButton></div>
              </div>
              {proposed && (
                <div>
                  <ColumnLabel>Proposed</ColumnLabel>
                  <button className="pbtn pbtn-primary" style={{ width: 200, color: autoText(accent), background: DERIVED.btnBg, boxShadow: DERIVED.btnShadow, border: "none", borderRadius: 14, padding: "13px 18px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Confirm &amp; continue</button>
                </div>
              )}
            </Cell>

            <Cell label="Hero gradient + glow (top of portal)" tag="stuck">
              <div>
                <ColumnLabel>Current</ColumnLabel>
                <div style={{ width: 150, height: 74, borderRadius: 16, background: "linear-gradient(135deg, #FF8A65 0%, #FFB74D 100%)", boxShadow: "0 8px 32px rgba(255,138,101,0.30)" }} />
              </div>
              {proposed && (
                <div>
                  <ColumnLabel>Proposed</ColumnLabel>
                  <div style={{ width: 150, height: 74, borderRadius: 16, background: DERIVED.heroGrad, boxShadow: DERIVED.heroGlow }} />
                </div>
              )}
            </Cell>

            <Cell label="Costs card accent bar" tag="stuck">
              <div>
                <ColumnLabel>Current</ColumnLabel>
                <div style={{ width: 150, height: 44, borderRadius: 11, background: "linear-gradient(180deg, #ff8365 0%, #FF6B4A 52%, #E85A35 100%)" }} />
              </div>
              {proposed && (
                <div>
                  <ColumnLabel>Proposed</ColumnLabel>
                  <div style={{ width: 150, height: 44, borderRadius: 11, background: DERIVED.costsBar }} />
                </div>
              )}
            </Cell>

            <Cell label="&ldquo;Things to confirm&rdquo; inline button" tag="stuck">
              <div>
                <ColumnLabel>Current</ColumnLabel>
                <button style={{ padding: "8px 15px", borderRadius: 11, fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", boxShadow: "0 1px 0 #C63E20, 0 3px 8px rgba(240,78,44,0.28)", border: "none", cursor: "pointer" }}>Confirm</button>
              </div>
              {proposed && (
                <div>
                  <ColumnLabel>Proposed</ColumnLabel>
                  <button style={{ padding: "8px 15px", borderRadius: 11, fontSize: 13, fontWeight: 700, color: autoText(accent), background: DERIVED.btnBg, boxShadow: "0 1px 0 color-mix(in srgb, var(--portal-primary) 72%, #000), 0 3px 8px color-mix(in srgb, var(--portal-primary) 30%, transparent)", border: "none", cursor: "pointer" }}>Confirm</button>
                </div>
              )}
            </Cell>
          </div>
        </section>

        {/* ── C. Deliberately fixed ──────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, color: "#55606F", margin: "0 0 4px" }}>Deliberately fixed — recommend: keep as-is</h2>
          <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 14px" }}>These are decorative or semantic, not brand accent. They read as intentional even on a different accent — but tell me if you&rsquo;d rather any of them follow too.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
            <Cell label="Gold milestone / next-action accent" tag="fixed">
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #FFA726 0%, #FFD54F 100%)" }} />
              <span style={{ fontSize: 12.5, color: "var(--portal-textSecondary)" }}>A warm &ldquo;achievement&rdquo; gold, not the brand colour</span>
            </Cell>
            <Cell label="Celebration confetti (on confirm)" tag="fixed">
              <div style={{ display: "flex", gap: 7 }}>
                {["#FF8A65", "#FFB74D", "#FFD54F"].map((c) => <span key={c} style={{ width: 20, height: 20, borderRadius: 5, background: c }} />)}
              </div>
            </Cell>
            <Cell label="Info / link blue" tag="fixed">
              <span style={{ width: 20, height: 20, borderRadius: 6, background: "var(--portal-accent)", display: "inline-block" }} />
              <span style={{ fontSize: 12.5, color: "var(--portal-textSecondary)" }}>Separate info blue for help/links</span>
            </Cell>
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Portal component lab (disposable - founder-only via /test gate).
//
// Every element flagged in the portal revamp brief, rendered on the real portal
// background with live, SELECTABLE options. Tap an option to pick it; the picks
// bar at the bottom builds the JSON to copy back to me, and I wire exactly those
// into the live portal.
//
// Background toggle (top-right) swaps between the flat portal bg and the agent
// app's light "ambient wash" so you can judge each card on the surface it will
// actually sit on.
//
// Not shipped product - the /test layout 404s for everyone but the founder.
// Delete this route once the picks are locked.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { P } from "@/components/portal/portal-ui";

// The agent app's light fallback background (app/styles/elevra.css light theme):
// peach + lavender + warm halo + cyan sheen over #f6f8fc. Kept inline so the lab
// is self-contained and leaves no trace when we delete it.
const AMBIENT_WASH: React.CSSProperties = {
  backgroundColor: "#f6f8fc",
  backgroundImage: [
    "radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%)",
    "radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%)",
    "radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%)",
    "radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%)",
  ].join(","),
  backgroundRepeat: "no-repeat",
};

const LAB_CSS = `
@keyframes lab-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes lab-edge-pulse {
  0%   { box-shadow: inset 0 0 0 0 rgba(59,130,246,0.0), inset 0 0 22px 2px rgba(59,130,246,0.10); }
  50%  { box-shadow: inset 0 0 0 1.5px rgba(59,130,246,0.35), inset 0 0 44px 6px rgba(59,130,246,0.28); }
  100% { box-shadow: inset 0 0 0 0 rgba(59,130,246,0.0), inset 0 0 22px 2px rgba(59,130,246,0.10); }
}
.lab-press { transition: transform 120ms cubic-bezier(0.2,0,0,1), box-shadow 160ms ease, filter 120ms ease; -webkit-tap-highlight-color: transparent; }
.lab-press:active { transform: scale(0.965); }
.lab-press-deep:active { transform: scale(0.955) translateY(1px); filter: brightness(0.97); }
.lab-chev { transition: background 160ms ease; }
.lab-chev .lab-chev-i { transition: transform 220ms cubic-bezier(0.16,1,0.3,1); }
.lab-chev:hover .lab-chev-i, .lab-chev:active .lab-chev-i { transform: translateX(4px); }
.lab-chev-spring .lab-chev-i { transition: transform 300ms cubic-bezier(0.34,1.56,0.64,1); }
.lab-fade-run > * { animation: lab-fade-up 520ms cubic-bezier(0.16,1,0.3,1) both; }
.lab-fade-stagger > *:nth-child(1) { animation: lab-fade-up 520ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 0ms; }
.lab-fade-stagger > *:nth-child(2) { animation: lab-fade-up 520ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 90ms; }
.lab-fade-stagger > *:nth-child(3) { animation: lab-fade-up 520ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 180ms; }
.lab-fade-stagger > *:nth-child(4) { animation: lab-fade-up 520ms cubic-bezier(0.16,1,0.3,1) both; animation-delay: 270ms; }
@media (prefers-reduced-motion: reduce) {
  .lab-fade-run > *, .lab-fade-stagger > * { animation: none !important; }
}
`;

const APPLE = {
  blue: "#0A84FF", blueDeep: "#0060DF", blueTint: "rgba(10,132,255,0.12)",
  green: "#25D366", greenDeep: "#1FAE53", greenTint: "rgba(37,211,102,0.14)",
  ink: "#1A1D29",
};

type Picks = Record<string, string>;

// ── Building blocks ──────────────────────────────────────────────────────────

function Selectable({ cat, id, note, picks, onPick, children }: {
  cat: string; id: string; note?: string; picks: Picks; onPick: (cat: string, id: string) => void; children: React.ReactNode;
}) {
  const isSel = picks[cat] === id;
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => onPick(cat, id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(cat, id); } }}
      style={{
        cursor: "pointer", background: P.cardBg, borderRadius: 16, padding: 16,
        boxShadow: isSel ? `0 0 0 2px ${P.accent}, ${P.shadowMd}` : P.shadowSm,
        transition: "box-shadow 160ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${isSel ? P.accent : P.border}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {isSel && <span style={{ width: 8, height: 8, borderRadius: 999, background: P.accent }} />}
          </span>
          <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", color: P.accent, background: P.accentBg, padding: "3px 8px", borderRadius: 6 }}>{id}</code>
        </span>
        {note && <span style={{ fontSize: 11, color: P.textMuted, textAlign: "right", lineHeight: 1.3 }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

function InfoCard({ id, note, children }: { id: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: P.cardBg, borderRadius: 16, boxShadow: P.shadowSm, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <code style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, fontWeight: 700, color: P.textMuted, background: "rgba(15,23,42,0.05)", padding: "3px 8px", borderRadius: 6 }}>{id}</code>
        {note && <span style={{ fontSize: 11, color: P.textMuted, textAlign: "right", lineHeight: 1.3 }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Section({ letter, title, blurb, children }: { letter: string; title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section id={`sec-${letter}`} style={{ scrollMarginTop: 84 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: P.primary }}>{letter}</span>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: P.textPrimary, letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: P.textSecondary, lineHeight: 1.5 }}>{blurb}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────────────

function fullBtnBase(): React.CSSProperties {
  return {
    width: "100%", padding: "14px 18px", border: 0, borderRadius: 14, cursor: "pointer",
    fontSize: 16, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em",
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
  };
}

const PRIMARY_OPTIONS = [
  { id: "PRIMARY-A1", note: "Current - flat coral, big glow", render: () => (
    <button className="lab-press" style={{ ...fullBtnBase(), borderRadius: 16, background: P.primary, boxShadow: P.heroGlow }}>Confirm this step</button>
  ) },
  { id: "PRIMARY-A2", note: "Refined coral - soft gradient, top sheen, gentle press", render: () => (
    <button className="lab-press" style={{ ...fullBtnBase(), background: "linear-gradient(180deg,#FF7A5A 0%,#FF5A38 100%)", boxShadow: "0 1px 2px rgba(204,74,46,0.40), 0 8px 20px rgba(255,107,74,0.26), inset 0 1px 0 rgba(255,255,255,0.28)" }}>Confirm this step</button>
  ) },
  { id: "PRIMARY-A3", note: "Tactile coral - deeper press (scale + drop), physical", render: () => (
    <button className="lab-press-deep lab-press" style={{ ...fullBtnBase(), background: "linear-gradient(180deg,#FF6F4E 0%,#F04E2C 100%)", boxShadow: "0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,0.30), inset 0 1px 0 rgba(255,255,255,0.30)" }}>Confirm this step</button>
  ) },
  { id: "PRIMARY-A4", note: "Ink premium - non-coral, calm and expensive", render: () => (
    <button className="lab-press" style={{ ...fullBtnBase(), background: "linear-gradient(180deg,#2A2E3C 0%,#14161F 100%)", boxShadow: "0 1px 2px rgba(0,0,0,0.30), 0 8px 20px rgba(15,23,42,0.22), inset 0 1px 0 rgba(255,255,255,0.10)" }}>Confirm this step</button>
  ) },
];

function CommsBtn({ children, bg, fg, icon, shadow }: { children: React.ReactNode; bg: string; fg: string; icon: "wa" | "mail"; shadow?: string }) {
  return (
    <span className="lab-press" style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "9px 14px", borderRadius: 11, background: bg, color: fg, boxShadow: shadow }}>
      {icon === "wa" ? <WaIcon /> : <MailIcon />} {children}
    </span>
  );
}
function WaIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3M12 22a9.9 9.9 0 01-5-1.4L3.3 21.6l1-3.6A9.9 9.9 0 1112 22" /></svg>; }
function MailIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2m0 4l-8 5-8-5V6l8 5 8-5z" /></svg>; }

const COMMS_OPTIONS = [
  { id: "COMMS-C1", note: "Current - green solid + coral-tinted email", render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <CommsBtn bg="#25D366" fg="#fff" icon="wa">WhatsApp</CommsBtn>
      <CommsBtn bg={P.primaryBg} fg={P.primaryText} icon="mail">Email</CommsBtn>
    </div>
  ) },
  { id: "COMMS-C2", note: "Solid pair - Apple green + Apple blue, depth", render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <CommsBtn bg="linear-gradient(180deg,#2ED974 0%,#1FAE53 100%)" fg="#fff" icon="wa" shadow="0 1px 2px rgba(31,174,83,0.4), 0 6px 14px rgba(37,211,102,0.24), inset 0 1px 0 rgba(255,255,255,0.3)">WhatsApp</CommsBtn>
      <CommsBtn bg="linear-gradient(180deg,#2A93FF 0%,#0A6FE8 100%)" fg="#fff" icon="mail" shadow="0 1px 2px rgba(0,96,223,0.4), 0 6px 14px rgba(10,132,255,0.24), inset 0 1px 0 rgba(255,255,255,0.3)">Email</CommsBtn>
    </div>
  ) },
  { id: "COMMS-C3", note: "Tonal pair - soft tinted bg, coloured text", render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <CommsBtn bg={APPLE.greenTint} fg={APPLE.greenDeep} icon="wa">WhatsApp</CommsBtn>
      <CommsBtn bg={APPLE.blueTint} fg={APPLE.blueDeep} icon="mail">Email</CommsBtn>
    </div>
  ) },
  { id: "COMMS-C4", note: "Mixed - WhatsApp brand green, Email blue tonal", render: () => (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <CommsBtn bg="#25D366" fg="#fff" icon="wa" shadow="0 4px 12px rgba(37,211,102,0.24), inset 0 1px 0 rgba(255,255,255,0.28)">WhatsApp</CommsBtn>
      <CommsBtn bg={APPLE.blueTint} fg={APPLE.blueDeep} icon="mail">Email</CommsBtn>
    </div>
  ) },
];

// ── Pills ────────────────────────────────────────────────────────────────────

type PillTone = { label: string; fg: string; bg: string; dot: string };
const PILL_SET: PillTone[] = [
  { label: "You", fg: P.primaryText, bg: P.primaryBg, dot: P.primary },
  { label: "Your lender", fg: APPLE.blueDeep, bg: APPLE.blueTint, dot: APPLE.blue },
  { label: "Solicitor", fg: APPLE.blueDeep, bg: APPLE.blueTint, dot: APPLE.blue },
  { label: "Completed", fg: "#047857", bg: "rgba(16,185,129,0.12)", dot: P.success },
  { label: "In progress", fg: P.primary, bg: "rgba(255,107,74,0.12)", dot: P.primary },
  { label: "Pending", fg: P.textMuted, bg: "rgba(15,23,42,0.06)", dot: P.textMuted },
];

const PILL_OPTIONS = [
  { id: "PILL-P1", note: "Current - tinted bg, coloured text, no dot", render: (t: PillTone) => (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: t.bg, color: t.fg }}>{t.label}</span>
  ) },
  { id: "PILL-P2", note: "Dotted tonal - status dot + text (Apple idiom)", render: (t: PillTone) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 999, background: t.bg, color: t.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot }} />{t.label}
    </span>
  ) },
  { id: "PILL-P3", note: "Hairline glass - white bg, 0.5px coloured border, dot", render: (t: PillTone) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, padding: "4px 11px", borderRadius: 999, background: "#fff", color: t.fg, border: `0.5px solid ${t.dot}`, boxShadow: "0 1px 2px rgba(15,23,42,0.05)" }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot }} />{t.label}
    </span>
  ) },
  { id: "PILL-P4", note: "Solid micro - saturated bg, white text (loud)", render: (t: PillTone) => (
    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: t.dot, color: "#fff", letterSpacing: "0.01em" }}>{t.label}</span>
  ) },
];

// ── Survey card ──────────────────────────────────────────────────────────────

function ChevRight({ color = P.accent }: { color?: string }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>; }
function MagnifierHouse({ size = 22, color = P.accent }: { size?: number; color?: string }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>; }

const SURVEY_OPTIONS = [
  { id: "SURVEY-S1", note: "Current - icon tile + text + chevron", render: () => (
    <div className="lab-press" style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, borderRadius: 16, background: P.cardBg, boxShadow: P.shadowSm }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: P.accentBg, color: P.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MagnifierHouse size={20} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: P.textPrimary }}>Get a survey quote</p>
        <p style={{ margin: 0, fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>We&apos;ll match you with local firms that cover your area.</p>
      </div>
      <ChevRight />
    </div>
  ) },
  { id: "SURVEY-S2", note: "Imagery banner - gradient header motif, price hint", render: () => (
    <div className="lab-press" style={{ borderRadius: 16, overflow: "hidden", background: P.cardBg, boxShadow: P.shadowMd }}>
      <div style={{ position: "relative", height: 78, background: "linear-gradient(120deg,#0A6FE8 0%,#3AA0FF 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -6, top: -6, opacity: 0.28 }}><MagnifierHouse size={96} color="#fff" /></div>
        <span style={{ position: "absolute", left: 14, bottom: 12, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.92)", background: "rgba(255,255,255,0.18)", padding: "3px 9px", borderRadius: 999, backdropFilter: "blur(6px)" }}>Recommended before exchange</span>
      </div>
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: P.textPrimary }}>Get a survey quote</p>
          <p style={{ margin: 0, fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>Local RICS firms, from around <b style={{ color: P.textPrimary }}>&pound;400</b>. No obligation.</p>
        </div>
        <ChevRight />
      </div>
    </div>
  ) },
  { id: "SURVEY-S3", note: "Trust chips + CTA button - benefits explicit", render: () => (
    <div style={{ borderRadius: 16, background: P.cardBg, boxShadow: P.shadowMd, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: P.accentBg, color: P.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><MagnifierHouse size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: P.textPrimary }}>Book a survey with confidence</p>
          <p style={{ margin: 0, fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>Know the condition of the property before you commit.</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {["RICS Level 2", "Local firms", "No obligation"].map((c) => (
          <span key={c} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: P.pageBg, color: P.textSecondary, border: `0.5px solid ${P.border}` }}>{c}</span>
        ))}
      </div>
      <button className="lab-press" style={{ ...fullBtnBase(), borderRadius: 12, fontSize: 14, background: "linear-gradient(180deg,#2A93FF 0%,#0A6FE8 100%)", boxShadow: "0 6px 14px rgba(10,132,255,0.24), inset 0 1px 0 rgba(255,255,255,0.3)" }}>Get my quote</button>
    </div>
  ) },
  { id: "SURVEY-S4", note: "Standout accent - full blue-tinted card, big price", render: () => (
    <div className="lab-press" style={{ borderRadius: 16, padding: 16, background: "linear-gradient(160deg, rgba(10,132,255,0.10), rgba(10,132,255,0.03))", border: `0.5px solid ${APPLE.blueTint}`, boxShadow: P.shadowSm, display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", color: APPLE.blue, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(10,132,255,0.20)" }}><MagnifierHouse size={24} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: P.textPrimary }}>Get a survey quote</p>
        <p style={{ margin: 0, fontSize: 12, color: P.textSecondary, lineHeight: 1.4 }}>Local firms in your area, <b style={{ color: APPLE.blueDeep }}>from &pound;400</b>.</p>
      </div>
      <ChevRight color={APPLE.blue} />
    </div>
  ) },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function PortalLabPage() {
  const [picks, setPicks] = useState<Picks>({});
  const [wash, setWash] = useState(true);
  const [loadKey, setLoadKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const onPick = (cat: string, id: string) => setPicks((p) => ({ ...p, [cat]: id }));
  const loadMode = picks.loading === "LOADING-L2" ? "L2" : "L1";
  const helpFixed = picks.helpButton !== "HELP-CURRENT";

  const pickLoading = (id: string) => { onPick("loading", id); setLoadKey((k) => k + 1); };

  const json = JSON.stringify(picks, null, 2);
  const copy = () => {
    navigator.clipboard.writeText(json).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };

  const NAV: [string, string][] = [
    ["A", "Buttons"], ["B", "Pills"], ["C", "Survey"], ["D", "Motion"],
    ["E", "Loading"], ["F", "Help"], ["G", "Dates"],
  ];
  const pickCount = Object.keys(picks).length;

  return (
    <div style={{ minHeight: "100vh", position: "relative", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: LAB_CSS }} />
      {/* Fixed background layer - flat portal bg or the agent ambient wash */}
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: -1, ...(wash ? AMBIENT_WASH : { background: P.pageBg }) }} />

      {/* Sticky header + jump nav + bg toggle */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(246,248,252,0.85)", backdropFilter: "blur(14px)", borderBottom: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: P.primary }}>Portal component lab</p>
              <p style={{ margin: 0, fontSize: 12, color: P.textSecondary }}>Tap an option to pick it, then Copy JSON at the bottom.</p>
            </div>
            <div style={{ display: "inline-flex", background: "rgba(15,23,42,0.05)", borderRadius: 999, padding: 3, flexShrink: 0 }}>
              {([["Wash", true], ["Flat", false]] as [string, boolean][]).map(([l, v]) => (
                <button key={l} onClick={() => setWash(v)} style={{ border: 0, cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "5px 11px", borderRadius: 999, background: wash === v ? "#fff" : "transparent", color: wash === v ? P.textPrimary : P.textMuted, boxShadow: wash === v ? "0 1px 2px rgba(15,23,42,0.10)" : "none" }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
            {NAV.map(([l, t]) => (
              <a key={l} href={`#sec-${l}`} style={{ fontSize: 11, fontWeight: 600, textDecoration: "none", color: P.textSecondary, background: "#fff", border: `1px solid ${P.border}`, padding: "4px 9px", borderRadius: 999 }}>{l} · {t}</a>
            ))}
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 120px", display: "flex", flexDirection: "column", gap: 40 }}>

        {/* A · Buttons */}
        <Section letter="A" title="Buttons" blurb="Apple-grade overhaul of the primary CTA (Confirm this step / Add) and the contact pair. Tap a card to pick it; tap the button itself to feel the press. Email is blue in every option.">
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: P.textMuted }}>Primary CTA</p>
          {PRIMARY_OPTIONS.map((o) => <Selectable key={o.id} cat="primary" id={o.id} note={o.note} picks={picks} onPick={onPick}>{o.render()}</Selectable>)}
          <InfoCard id="PRIMARY-SM" note="The primary you pick above, shrunk to the Add-agent size - I match it automatically">
            <div style={{ display: "flex", gap: 10 }}>
              <button className="lab-press" style={{ border: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", padding: "8px 15px", borderRadius: 11, background: "linear-gradient(180deg,#FF7A5A,#FF5A38)", boxShadow: "0 4px 12px rgba(255,107,74,0.26), inset 0 1px 0 rgba(255,255,255,0.28)" }}>Add</button>
              <button className="lab-press" style={{ border: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", padding: "8px 15px", borderRadius: 11, background: "linear-gradient(180deg,#2A2E3C,#14161F)", boxShadow: "0 4px 12px rgba(15,23,42,0.20), inset 0 1px 0 rgba(255,255,255,0.10)" }}>Add</button>
            </div>
          </InfoCard>
          <p style={{ margin: "8px 0 0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: P.textMuted }}>WhatsApp + Email pair</p>
          {COMMS_OPTIONS.map((o) => <Selectable key={o.id} cat="comms" id={o.id} note={o.note} picks={picks} onPick={onPick}>{o.render()}</Selectable>)}
        </Section>

        {/* B · Pills */}
        <Section letter="B" title="Pills" blurb="The who/status pills from Coming up (You / Your lender / Solicitor), the hero (Active / Freehold / Mortgage) and the timeline (Completed / In progress / Pending). Whatever you pick, I roll out to all of them.">
          {PILL_OPTIONS.map((o) => (
            <Selectable key={o.id} cat="pills" id={o.id} note={o.note} picks={picks} onPick={onPick}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {PILL_SET.map((t) => <span key={t.label}>{o.render(t)}</span>)}
              </div>
            </Selectable>
          ))}
        </Section>

        {/* C · Survey card */}
        <Section letter="C" title="Survey quote card" blurb="The buyer prompt once instructed. Options add imagery, a price anchor and trust cues so it stands out instead of reading like a plain row.">
          {SURVEY_OPTIONS.map((o) => <Selectable key={o.id} cat="survey" id={o.id} note={o.note} picks={picks} onPick={onPick}>{o.render()}</Selectable>)}
        </Section>

        {/* D · Motion */}
        <Section letter="D" title="Micro-interactions" blurb="Hover (desktop) or tap (mobile) to see the chevron slide. Pick the easing you prefer. The press-down demo shows the tactile CTA feel that ships with whichever primary you choose in A.">
          <Selectable cat="chevron" id="MICRO-CHEV-EASE" note="View full timeline - chevron glides right, smooth ease" picks={picks} onPick={onPick}>
            <span className="lab-chev" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: P.accent, background: P.accentBg }}>
              View full timeline <span className="lab-chev-i" style={{ display: "inline-flex" }}><ChevRight /></span>
            </span>
          </Selectable>
          <Selectable cat="chevron" id="MICRO-CHEV-SPRING" note="Same, with a springier overshoot" picks={picks} onPick={onPick}>
            <span className="lab-chev lab-chev-spring" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: P.accent, background: P.accentBg }}>
              View full timeline <span className="lab-chev-i" style={{ display: "inline-flex" }}><ChevRight /></span>
            </span>
          </Selectable>
          <InfoCard id="MICRO-PRESS" note="Press and hold - the feel that ships on your chosen primary">
            <button className="lab-press-deep lab-press" style={{ ...fullBtnBase(), background: "linear-gradient(180deg,#FF6F4E,#F04E2C)", boxShadow: "0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,0.30), inset 0 1px 0 rgba(255,255,255,0.30)" }}>Press and hold me</button>
          </InfoCard>
        </Section>

        {/* E · Loading */}
        <Section letter="E" title="Loading treatment" blurb="Replaces the grey skeletons. The screen edge pulses blue while content settles, then everything fades up into place. Pick a mode, hit Replay to watch.">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setLoadKey((k) => k + 1)} className="lab-press" style={{ border: 0, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#fff", padding: "9px 16px", borderRadius: 11, background: P.primary }}>Replay ▸</button>
          </div>
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: P.pageBg, boxShadow: P.shadowSm, padding: 14, minHeight: 320 }}>
            <div key={`pulse-${loadKey}`} aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 20, pointerEvents: "none", animation: "lab-edge-pulse 700ms ease-in-out 2", zIndex: 2 }} />
            <div key={`content-${loadKey}`} className={loadMode === "L1" ? "lab-fade-run" : "lab-fade-stagger"} style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative", zIndex: 1 }}>
              <div style={{ height: 120, borderRadius: 16, background: "linear-gradient(120deg,#FF8A65,#FFB74D)" }} />
              <div style={{ height: 64, borderRadius: 16, background: P.cardBg, boxShadow: P.shadowSm }} />
              <div style={{ height: 48, borderRadius: 16, background: P.cardBg, boxShadow: P.shadowSm }} />
              <div style={{ height: 48, borderRadius: 16, background: P.cardBg, boxShadow: P.shadowSm }} />
            </div>
          </div>
          <Selectable cat="loading" id="LOADING-L1" note="Fade together - one calm motion, no flicker (my pick)" picks={picks} onPick={() => pickLoading("LOADING-L1")}>
            <p style={{ margin: 0, fontSize: 12, color: P.textSecondary }}>All cards settle as a single upward fade.</p>
          </Selectable>
          <Selectable cat="loading" id="LOADING-L2" note="Cascade - cards fade up one after another" picks={picks} onPick={() => pickLoading("LOADING-L2")}>
            <p style={{ margin: 0, fontSize: 12, color: P.textSecondary }}>Staggered by ~90ms for more theatre.</p>
          </Selectable>
        </Section>

        {/* F · Help */}
        <Section letter="F" title="Help button position" blurb="The floating Help pill currently rests 24px off the bottom, so it collides with the portal's bottom nav. Toggle to see the fix - it lifts clear above the bar. Pick HELP-FIX to apply it (portal only; the agent app keeps its position).">
          <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", background: P.pageBg, boxShadow: P.shadowSm, height: 260 }}>
            <div style={{ position: "absolute", right: 16, bottom: helpFixed ? 84 : 16, transition: "bottom 300ms cubic-bezier(0.16,1,0.3,1)", zIndex: 3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 15px", borderRadius: 999, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", border: "0.5px solid rgba(255,255,255,0.7)", boxShadow: "0 8px 24px rgba(45,24,16,0.12)", color: P.primary, fontSize: 13, fontWeight: 600 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
                <span style={{ color: "#1f2937" }}>Help</span>
              </span>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 64, background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderTop: "0.5px solid rgba(15,23,42,0.08)", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", zIndex: 2 }}>
              {["Overview", "Progress", "Updates"].map((t, i) => (
                <div key={t} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: i === 0 ? P.primary : P.textMuted }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? "rgba(255,107,74,0.15)" : "transparent" }} />
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <Selectable cat="helpButton" id="HELP-FIX" note="Raise the Help pill above the bottom nav (recommended)" picks={picks} onPick={onPick}>
            <p style={{ margin: 0, fontSize: 12, color: P.textSecondary }}>Portal-scoped, so the agent app is untouched.</p>
          </Selectable>
          <Selectable cat="helpButton" id="HELP-CURRENT" note="Leave it where it is" picks={picks} onPick={onPick}>
            <p style={{ margin: 0, fontSize: 12, color: P.textSecondary }}>Keeps the current overlap.</p>
          </Selectable>
        </Section>

        {/* G · Dates */}
        <Section letter="G" title="Important dates" blurb="How it works today: a row appears only for a step that is confirmed done AND had a specific date attached at confirmation (instruct solicitor, submit mortgage application, exchange, completion). Never predicted. Two ways to present it.">
          <Selectable cat="dates" id="DATES-D1" note="Current - label left, date right, plain list" picks={picks} onPick={onPick}>
            <div style={{ borderRadius: 16, overflow: "hidden", background: P.cardBg, boxShadow: P.shadowSm }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${P.border}` }}><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.textPrimary }}>Important dates</p></div>
              {[["Instruct your solicitor", "14 August 2026"], ["Submit mortgage application", "14 August 2026"]].map(([l, d], i) => (
                <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "13px 16px", borderBottom: i === 0 ? `1px solid ${P.border}` : undefined }}>
                  <span style={{ fontSize: 14, color: P.textPrimary }}>{l}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: P.primary }}>{d}</span>
                </div>
              ))}
            </div>
          </Selectable>
          <Selectable cat="dates" id="DATES-D2" note="Timeline - calendar chip + relative time" picks={picks} onPick={onPick}>
            <div style={{ borderRadius: 16, overflow: "hidden", background: P.cardBg, boxShadow: P.shadowSm }}>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${P.border}` }}><p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: P.textPrimary }}>Important dates</p></div>
              {[["Instruct your solicitor", "14 Aug 2026", "today"], ["Submit mortgage application", "14 Aug 2026", "today"]].map(([l, d, rel], i) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: i === 0 ? `1px solid ${P.border}` : undefined }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: P.primaryBg, color: P.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 600, color: P.textPrimary }}>{l}</p>
                    <p style={{ margin: 0, fontSize: 12, color: P.textMuted }}>{d} · {rel}</p>
                  </div>
                </div>
              ))}
            </div>
          </Selectable>
        </Section>

        {/* JSON output */}
        <section>
          <h2 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: P.textPrimary }}>Your picks</h2>
          <pre style={{ margin: 0, background: "#0f1420", color: "#d7e0f5", borderRadius: 14, padding: 16, fontSize: 12, lineHeight: 1.6, overflowX: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{pickCount ? json : "{ }  - nothing picked yet"}</pre>
        </section>
      </main>

      {/* Sticky picks bar */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, background: "rgba(246,248,252,0.9)", backdropFilter: "blur(16px)", borderTop: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: P.textSecondary }}>{pickCount} picked</span>
          <button onClick={copy} disabled={!pickCount} className="lab-press" style={{ border: 0, cursor: pickCount ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, color: "#fff", padding: "11px 20px", borderRadius: 12, background: copied ? P.success : pickCount ? P.accent : "rgba(15,23,42,0.2)", boxShadow: pickCount ? "0 4px 12px rgba(59,130,246,0.24)" : "none" }}>
            {copied ? "Copied ✓" : "Copy JSON"}
          </button>
        </div>
      </div>
    </div>
  );
}

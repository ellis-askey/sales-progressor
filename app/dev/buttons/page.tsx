"use client";

// /dev/buttons — the button migration ledger, NARROWED (2026-10-17).
//
// After review, the sweep is scoped to PRIMARIES ONLY for now: every hand-rolled
// coral primary folds into the one canonical gloss. A primary is context-free (it
// should look the same everywhere), so it's safe to do from a list. Secondary /
// ghost / cancel are a later per-screen pass done WITH the founder, because their
// "rightness" depends on the surrounding screen a flat list can't show. Everything
// else (splits, option cards, toggles/segmented, icon buttons, links, the internal
// TSP dashboard) is PARKED — not touched.
//
// HARD RULE: treatment only. The gloss / colour / shadow / border change; width,
// height, padding and corner radius stay exactly as they are at every site. No
// button is resized. Migrations land one area per commit so any single spot can be
// vetoed without a bulk re-sweep.
//
// Canonical primary = vertical coral gloss + inner top highlight + 2px underledge
// (Welcome CTA merged with the Pop underledge). It becomes the token-driven
// <Button> / .agent-btn-primary, so the App Colour Studio customises this one
// button. Dev-only.

import { notFound } from "next/navigation";
import { WELCOME_STEPS_CSS } from "@/components/agent/welcome-steps-styles";
import { ArrowRight, X } from "@phosphor-icons/react";

type Decision = "migrate" | "keep";
type Row = {
  name: string;
  ex: string;
  where?: string;
  cls?: string;                 // real class (agent-system.css / welcome-steps loaded here)
  pw?: boolean;                 // wrap in .pw-scope
  css?: React.CSSProperties;    // faithful inline recreation when the class isn't loadable
  decision: Decision;
  note?: string;
};
type Family = { title: string; blurb?: string; rows: Row[] };

// ── Canonical renders ────────────────────────────────────────────────────────

const canonPrimary = (label: string, size: "xs" | "sm" | "md" | "lg" = "md") => <button className={`btn-canon-primary ${size}`}>{label}</button>;
const canonSecondary = (l: string) => <button className="agent-btn agent-btn-md agent-btn-secondary">{l}</button>;
const canonGhost = (l: string) => <button className="agent-btn agent-btn-md agent-btn-ghost">{l}</button>;
const canonNeutral = (l: string) => <button className="agent-btn agent-btn-md agent-btn-neutral">{l}</button>;
const canonDanger = (l: string) => <button className="agent-btn agent-btn-md agent-btn-danger">{l}</button>;
const canonOutline = (l: string) => <span className="pw-scope"><button className="pw-secondary">{l}</button></span>;

function now(r: Row): React.ReactNode {
  if (r.cls) { const b = <button className={r.cls}>{r.ex}</button>; return r.pw ? <span className="pw-scope">{b}</span> : b; }
  if (r.css && Object.keys(r.css).length) return <button style={r.css}>{r.ex}</button>;
  return <span style={{ fontSize: 12, color: "rgba(45,24,16,0.5)" }}>{r.ex}</span>;
}

// faithful inline recreations (key props only; source named in each row)
const GRAD135 = "linear-gradient(135deg, var(--agent-coral-deep, #FF6B4A), var(--agent-coral-light, #FFB18F))";
const GRAD180 = "linear-gradient(180deg, var(--agent-coral, #FF8A65), var(--agent-coral-deep, #FF6B4A))";
const FLAT = "var(--agent-coral, #FF6B4A)";
const baseBtn: React.CSSProperties = { border: "none", cursor: "pointer", color: "#fff", font: "inherit", fontSize: 13, fontWeight: 650 };
const pD = (p: string, r: number): React.CSSProperties => ({ padding: p, borderRadius: r });

// ── The ledger (scoped) ────────────────────────────────────────────────────────

const CANON: Family = {
  title: "The canonical core — your top 6",
  blurb: "The main button families. Only the primary changes look (gets the gloss); the rest are already right and are the targets the second pass will tidy towards. Sizes shown are examples — real sizes never change.",
  rows: [
    { name: "Primary (upgrades to gloss)", ex: "Save changes", cls: "btn-canon-primary md", decision: "migrate", note: "The one primary. Everything already on <Button> inherits the gloss for free. ~90 sightings." },
    { name: "Secondary", ex: "View timeline", cls: "agent-btn agent-btn-md agent-btn-secondary", decision: "keep", note: "Already right — second pass only applies it to hand-rolled copies, per screen." },
    { name: "Ghost", ex: "Dismiss", cls: "agent-btn agent-btn-md agent-btn-ghost", decision: "keep" },
    { name: "Neutral (Cancel)", ex: "Cancel", cls: "agent-btn agent-btn-md agent-btn-neutral", decision: "keep" },
    { name: "Danger", ex: "Remove file", cls: "agent-btn agent-btn-md agent-btn-danger", decision: "keep" },
    { name: "Coral outline", ex: "Add a sale", cls: "pw-secondary", pw: true, decision: "keep" },
  ],
};

const PRIMARIES: Family = {
  title: "Do now — every primary → the canonical gloss",
  blurb: "Context-free: a Send / Save / Confirm button should look identical everywhere. Each keeps its exact current width, height and radius — only the fill, highlight, underledge and text colour change.",
  rows: [
    { name: "Drawer inline gradient (135°)", ex: "Send chase", css: { ...baseBtn, ...pD("12px 18px", 12), fontSize: 14, fontWeight: 700, background: GRAD135, boxShadow: "0 4px 20px rgba(255,107,74,0.32)", minWidth: 200 }, where: "ChaseDrawer:1228, ChaseNeighbourDrawer:567, EnquiryChaseDrawer:355 (also Generate message, Save & continue)", decision: "migrate", note: "Should BE <Button>. Keeps its leading icon + width." },
    { name: "Drawer inline gradient small", ex: "Add", css: { ...baseBtn, ...pD("7px 14px", 8), background: GRAD135 }, where: "ChaseDrawer:1067", decision: "migrate" },
    { name: "ChaseButton pill", ex: "Chase", css: { ...baseBtn, ...pD("6px 12px", 8), background: FLAT }, where: "ChaseButton.tsx:45", decision: "migrate" },
    { name: "ChaseComposer link-add", ex: "Add", css: { ...baseBtn, ...pD("8px 14px", 10), background: "var(--agent-coral-deep,#E8542F)" }, where: "ChaseComposer.tsx:303", decision: "migrate" },
    { name: "enq-btn-primary2 (coral)", ex: "Yes, raise further", css: { ...baseBtn, ...pD("9px 15px", 8), background: FLAT }, where: "EnquiriesTriageList.tsx:441, EnquiryLogSheet.tsx:160, AddSolicitorModal.tsx:95, CheckpointsPanel.tsx:227", decision: "migrate", note: "Whole parallel enq-btn-* flat-coral family." },
    { name: "NextActionCard flat mini", ex: "Confirm", css: { ...baseBtn, ...pD("8px 14px", 8), background: FLAT }, where: "NextActionCard.tsx:218", decision: "migrate" },
    { name: "EnquiryTracker primaryBtn", ex: "Replies sent", css: { ...baseBtn, ...pD("8px 14px", 8), background: FLAT }, where: "EnquiryTrackerPanel.tsx:208,212", decision: "migrate" },
    { name: "Doc-upload flat coral", ex: "Upload", css: { ...baseBtn, ...pD("10px 18px", 12), background: FLAT }, where: "AgentDocumentUpload.tsx:113", decision: "migrate" },
    { name: "FileSetup jump CTA", ex: "Set it up", css: { ...baseBtn, ...pD("8px 14px", 8), background: FLAT }, where: "FileSetupChecklist.tsx:186", decision: "migrate" },
    { name: "Portal invite submit (180°)", ex: "Add & send portal invite", css: { ...baseBtn, ...pD("10px 16px", 10), background: GRAD180, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(255,107,74,0.28)" }, where: "ClientPortalPreview.tsx:562", decision: "migrate" },
    { name: "Portal message send", ex: "Send", css: { ...baseBtn, ...pD("9px 16px", 10), background: FLAT }, where: "PortalMessagesWidget.tsx:59", decision: "migrate" },
    { name: "account-btn-primary (settings)", ex: "Save changes", css: { ...baseBtn, ...pD("9px 18px", 8), background: FLAT, fontWeight: 500 }, where: "AgencyNameForm, ChangePasswordCard, BrandColorPicker, ProfileFormPlain, BusinessIdentityForm, BusinessVatForm… (~14 files)", decision: "migrate", note: "The whole .account-btn-primary subsystem — flat coral. Biggest single cluster." },
    { name: "Coral-gloss hand-rolled pill", ex: "👤 Add team member", css: { ...baseBtn, ...pD("8px 14px", 8), fontWeight: 600, background: GRAD180, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 16px rgba(255,107,74,0.28)" }, where: ".tmp-invite-btn, .bt-invite-btn, .cp-primary, .cw-primary, .cwg-btn", decision: "migrate", note: "The 👤 (and any) icon is KEPT — the one you worried about. Handled, not swept." },
    { name: "Gloss duplicate (sds/cnb/es/eb)", ex: "Save", css: { ...baseBtn, ...pD("9px 16px", 9), background: "linear-gradient(180deg,#FF7A5C,#E2452A)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 2px 8px rgba(226,69,42,0.3)" }, where: "SenderDomainSection, CardNudgeBanner, EmailStudio, EmailBrandingStudio, AgencyMilestoneEmailsEditor", decision: "migrate" },
    { name: "Compose Refine chip (180°)", ex: "✦ Refine", css: { ...baseBtn, display: "inline-flex", alignItems: "center", height: 30, ...pD("0 12px", 8), gap: 6, fontSize: 12, fontWeight: 650, background: GRAD180, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 4px rgba(224,78,44,0.26)" }, where: "ComposeEmailModal.tsx:538 (.cem-refine)", decision: "migrate" },
    { name: "InviteDirector inline coral", ex: "Send invitation", css: { ...baseBtn, ...pD("9px 16px", 8), background: FLAT }, where: "InviteDirectorPlain.tsx:185", decision: "migrate" },
    { name: "Connections flat coral (pbtn)", ex: "Connect my inbox", css: { ...baseBtn, ...pD("9px 16px", 8), background: FLAT }, where: "AccountConnectionsCard:209, ImapConnectionCard:746, WhatsAppConnectionCard:356", decision: "migrate" },
    { name: "Install prompt hardcoded", ex: "Install", css: { ...baseBtn, ...pD("10px 18px", 12), background: "#D85A35" }, where: "AgentInstallPrompt.tsx:119,174,358 (hardcoded #D85A35)", decision: "migrate", note: "Also de-hardcode the colour." },
    { name: "Marketing diagonal", ex: "Install the app", css: { ...baseBtn, ...pD("11px 20px", 12), background: "linear-gradient(135deg,#FF8A65,#FF6B4A)", boxShadow: "0 6px 18px -6px rgba(255,107,74,0.5)" }, where: "NotFoundView:45, SurveyForm:103", decision: "migrate" },
    { name: "Chain intro CTA", ex: "Yes, add the chain", css: { ...baseBtn, ...pD("9px 16px", 999), background: GRAD135 }, where: "ChainSection.tsx:237 (.chain-chip-yes)", decision: "migrate" },
    { name: "Reviews rv-primary", ex: "Save", css: { ...baseBtn, ...pD("9px 16px", 10), background: FLAT }, where: "ReviewsSection.tsx:638,710", decision: "migrate" },
    { name: "Monthly-target save", ex: "Save target", css: { ...baseBtn, ...pD("9px 15px", 8), background: GRAD135 }, where: "MonthlyTargetMenu.tsx:83", decision: "migrate" },
    { name: "Recommended-solicitors save", ex: "Save", css: { ...baseBtn, ...pD("6px 16px", 8), background: FLAT }, where: "RecommendedSolicitorsSettings.tsx:253", decision: "migrate" },
    { name: "Stage-1 / new-sale continue", ex: "Continue", css: { ...baseBtn, ...pD("11px 20px", 10), background: GRAD135 }, where: "Stage1Fields.tsx:236, NewSaleFlow nav, AllFilesEmptyState.tsx:104", decision: "migrate" },
    { name: "Welcome CTA / Pop", ex: "Next: Choose your chases", cls: "pw-cta", pw: true, where: "welcome-steps .pw-cta; LogUpdate .lum-primary/.lum-trigger", decision: "keep", note: "KEPT — it's the reference look (Pop stays as-is). Already matches the canonical." },
  ],
};

const PW_SCOPE_CSS = `
.pw-scope { --coral:#FF6B4A; --cta-from:#FF7E57; --cta-to:#F0511A; --cta-shadow:rgba(240,78,44,0.32); --cta-shadow-hi:rgba(240,78,44,0.42); --muted:rgba(45,24,16,0.55); --body:#5A3A28; --surface:#ffffff; --row-border:rgba(45,24,16,0.10); display:inline-block; }
`;

const CANON_CSS = `
.btn-canon-primary { display:inline-flex; align-items:center; justify-content:center; gap:9px; border:0; cursor:pointer; font:inherit; font-weight:700; color:#fff; background:linear-gradient(180deg, #FF7E57 0%, #F0511A 100%); box-shadow:0 2px 0 #C63E20, 0 6px 16px rgba(240,81,26,0.30), inset 0 1px 0 rgba(255,255,255,0.32); transition:transform .14s ease, box-shadow .16s ease, filter .16s ease; }
.btn-canon-primary:hover { transform:translateY(-1px); box-shadow:0 3px 0 #C63E20, 0 11px 24px rgba(240,81,26,0.42), inset 0 1px 0 rgba(255,255,255,0.42); filter:saturate(1.05) brightness(1.02); }
.btn-canon-primary:active { transform:translateY(1px); box-shadow:0 0 0 #C63E20, 0 4px 12px rgba(240,81,26,0.30), inset 0 1px 0 rgba(255,255,255,0.22); }
.btn-canon-primary.xs { font-size:12px; padding:6px 11px; border-radius:9px; gap:6px; }
.btn-canon-primary.sm { font-size:13px; padding:8px 14px; border-radius:10px; gap:7px; }
.btn-canon-primary.md { font-size:14px; padding:11px 18px; border-radius:11px; }
.btn-canon-primary.lg { font-size:15px; padding:14px 24px; border-radius:14px; }
@media (prefers-reduced-motion: reduce) { .btn-canon-primary { transition:none; } .btn-canon-primary:hover { transform:none; } }
`;

const DM: Record<Decision, { label: string; bg: string; fg: string }> = {
  migrate: { label: "Migrate", bg: "rgba(240,81,26,0.14)", fg: "#d2491f" },
  keep: { label: "Keep", bg: "rgba(15,27,45,0.1)", fg: "#0f1b2d" },
};

const PARKED = [
  "Secondary / Ghost / Cancel one-offs — a SECOND pass, done per-screen with you (not from a list). Your #51 'keep the text colour' is logged for this.",
  "Split buttons (Chase split, Compose send split, enquiries, reviews)",
  "Option / choice cards (tenure, billing point, survey, theme pickers…)",
  "Toggles & segmented controls (switches, seg pills)",
  "Icon buttons (close ✕, kebabs, toolbars)",
  "Links (beyond the obvious), coral-ink text actions",
  "Internal TSP dashboard (its own blue/slate system)",
];

export default function DevButtonsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  let n = 0;
  const migrateCount = PRIMARIES.rows.filter((r) => r.decision === "migrate").length;

  const renderRow = (r: Row) => {
    n += 1;
    const dm = DM[r.decision];
    const changed = r.decision === "migrate";
    return (
      <div key={r.name} style={{ display: "grid", gridTemplateColumns: "34px minmax(0,1fr) 26px minmax(0,1fr) minmax(230px,320px)", gap: 14, alignItems: "center", padding: "14px 16px", borderRadius: 13, background: "rgba(255,255,255,0.78)", border: "0.5px solid rgba(45,24,16,0.10)", boxShadow: "0 2px 10px rgba(45,24,16,0.05)" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "rgba(45,24,16,0.35)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{n}</div>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(45,24,16,0.4)" }}>Now</p>
          <div style={{ display: "flex", alignItems: "center", minHeight: 42 }}>{now(r)}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", color: changed ? "#d2491f" : "rgba(45,24,16,0.2)" }}>{changed ? <ArrowRight size={17} weight="bold" /> : <span style={{ fontSize: 16 }}>=</span>}</div>
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: changed ? "#d2491f" : "rgba(45,24,16,0.4)" }}>{changed ? "Will be" : "Unchanged"}</p>
          <div style={{ display: "flex", alignItems: "center", minHeight: 42 }}>{changed ? canonPrimary(r.ex, r.ex.length > 18 ? "md" : "sm") : now(r)}</div>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: dm.bg, color: dm.fg, flexShrink: 0 }}>{dm.label}</span>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2D1810", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</p>
          </div>
          {r.where && <p style={{ margin: "2px 0 0", fontSize: 10.5, fontFamily: "ui-monospace, monospace", color: "rgba(45,24,16,0.5)", overflowWrap: "anywhere", lineHeight: 1.4 }}>{r.where}</p>}
          {r.note && <p style={{ margin: "5px 0 0", fontSize: 11.5, lineHeight: 1.45, color: "#5A3A28" }}>{r.note}</p>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 28px 110px", fontFamily: "var(--font-geist-sans, system-ui)" }}>
      <style>{WELCOME_STEPS_CSS}</style>
      <style>{PW_SCOPE_CSS}</style>
      <style>{CANON_CSS}</style>

      <p style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#E8542F" }}>Dev · button sweep (narrowed)</p>
      <h1 style={{ margin: "8px 0 6px", fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color: "#2D1810" }}>Primaries → one canonical gloss</h1>
      <p style={{ margin: "0 0 10px", fontSize: 14.5, color: "#5A3A28", maxWidth: 760, lineHeight: 1.55 }}>
        Scoped down to the part that&apos;s safe to do from a list: the {migrateCount} hand-rolled primaries below all become the one canonical gloss. Secondary / ghost / cancel come later, per-screen, with you. Everything else is parked.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 760, marginBottom: 26, padding: "12px 14px", borderRadius: 11, background: "rgba(240,81,26,0.06)", border: "0.5px solid rgba(240,81,26,0.2)" }}>
        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: "#C63E20" }}>Hard rule</p>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#5A3A28" }}>Treatment only. The gloss, colour, shadow and border change — <strong>width, height, padding and corner radius stay exactly as they are</strong> at every site. Nothing is resized. One area per commit, so any single spot can be vetoed without a re-sweep.</p>
      </div>

      <section style={{ marginTop: 6 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 750, color: "#2D1810" }}>{CANON.title}</h2>
        {CANON.blurb && <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "rgba(45,24,16,0.55)", maxWidth: 820, lineHeight: 1.5 }}>{CANON.blurb}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{CANON.rows.map(renderRow)}</div>
      </section>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 750, color: "#2D1810" }}>{PRIMARIES.title}</h2>
        {PRIMARIES.blurb && <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "rgba(45,24,16,0.55)", maxWidth: 820, lineHeight: 1.5 }}>{PRIMARIES.blurb}</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{PRIMARIES.rows.map(renderRow)}</div>
      </section>

      <section style={{ marginTop: 44 }}>
        <h2 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 750, color: "#2D1810" }}>Parked — not touched in this work</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 820 }}>
          {PARKED.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "11px 14px", borderRadius: 11, background: "rgba(45,24,16,0.03)", border: "0.5px solid rgba(45,24,16,0.08)" }}>
              <span aria-hidden style={{ color: "rgba(45,24,16,0.3)", marginTop: 1, flexShrink: 0 }}><X size={13} weight="bold" /></span>
              <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: "#5A3A28" }}>{p}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

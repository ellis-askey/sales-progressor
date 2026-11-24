"use client";
/* Add New Sale — canonical comparison workspace (Stage 2).
 *
 * LEFT = CURRENT (faithful static reproduction of the shipped card).
 * RIGHT = PROPOSED (real canonical components where they exist; clearly-labelled
 *         isolated proposals where a canonical doesn't yet exist).
 *
 * Read-only / isolated. No production Add-Sale code, no canonical components, and
 * no server actions are touched. Light/dark + desktop/tablet/mobile toggles drive
 * the real token system (html[data-theme]) so both themes render true-to-app.
 */
import { notFound } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { PriceField } from "@/components/ui/PriceField";
import { NotesField } from "@/components/ui/NotesField";
import { Pill } from "@/components/ui/Pill";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Select } from "@/components/ui/Select";
import { PercentField } from "@/components/ui/PercentField";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { AnchoredPanel } from "@/components/ui/Popover";
import { Check, CaretDown, LinkSimple, MagnifyingGlass, Buildings, Plus } from "@phosphor-icons/react";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";

/* ── Theme + viewport ─────────────────────────────────────────────────────── */
type Theme = "light" | "dark";
type VW = "desktop" | "tablet" | "mobile";
const VW_W: Record<VW, number | undefined> = { desktop: undefined, tablet: 720, mobile: 380 };

/* ── Scaffolding ──────────────────────────────────────────────────────────── */
type TagKind = "canonical" | "apply" | "new" | "protected" | "decision";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  canonical: { label: "Canonical — in use", fg: "#1f7a4d", bg: "rgba(47,158,107,0.13)", bd: "rgba(47,158,107,0.32)" },
  apply:     { label: "Proposed — apply canonical", fg: "#8a5a00", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  new:       { label: "Proposed — not yet canonical", fg: "#7E22CE", bg: "rgba(126,34,206,0.12)", bd: "rgba(126,34,206,0.30)" },
  protected: { label: "Protected exception", fg: "#2563eb", bg: "rgba(37,99,235,0.12)", bd: "rgba(37,99,235,0.30)" },
  decision:  { label: "Decision required", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}

function Pane({ side, vw, children }: { side: "current" | "proposed"; vw: VW; children: ReactNode }) {
  const isP = side === "proposed";
  const w = VW_W[vw];
  return (
    <div style={{ flex: "1 1 340px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>
        {isP ? "Proposed" : "Current"}
      </span>
      <div style={{ borderRadius: 16, padding: 18, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", justifyContent: "center" }}>
        <div style={{ width: w ? `min(${w}px, 100%)` : "100%", minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}

function Block({ n, title, tags, note, source, canonical, vw, current, proposed }: {
  n: string; title: string; tags: TagKind[]; note: ReactNode; source?: string; canonical?: string; vw: VW; current: ReactNode; proposed: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section id={`c-${n}`} style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "var(--font-geist-mono, monospace)", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 860 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current" vw={vw}>{current}</Pane>
        <Pane side="proposed" vw={vw}>{proposed}</Pane>
      </div>
      {(source || canonical) && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--compare-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CaretDown size={11} weight="bold" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /> Technical detail
          </button>
          {open && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--compare-body)", lineHeight: 1.6, background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "10px 12px" }}>
              {source && <div><strong>Source:</strong> <code>{source}</code></div>}
              {canonical && <div><strong>Canonical ref:</strong> <code>{canonical}</code></div>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Small primitives reused across blocks ────────────────────────────────── */
// The canonical eyebrow (sentence · 11 · 600 · no tracking · muted).
function Eyebrow({ children }: { children: ReactNode }) {
  return <p style={{ margin: 0, fontSize: 11, fontWeight: 600, letterSpacing: 0, color: "var(--agent-text-muted)" }}>{children}</p>;
}
// A current-style card shell (faithful: agent-glass-strong look).
function CardShell({ children, pad = 18 }: { children: ReactNode; pad?: number }) {
  return <div style={{ borderRadius: 16, padding: pad, background: "var(--agent-surface-elevated, #fff)", border: "0.5px solid var(--agent-border-default)", boxShadow: "0 1px 3px rgba(30,20,15,0.05)" }}>{children}</div>;
}

const SEG_TOK = {
  ["--surface-muted" as string]: "rgba(120,80,60,0.06)", ["--border" as string]: "var(--agent-border-default)",
  ["--text-muted" as string]: "var(--agent-text-muted)", ["--foreground" as string]: "var(--agent-text-primary)",
  ["--radius-control" as string]: "11px", ["--control-height-sm" as string]: "28px", ["--text-sm" as string]: "13px",
  ["--sc-selection-bg" as string]: CORAL, ["--sc-selection-fg" as string]: "#fff", ["--sc-selection-border" as string]: "transparent",
  ["--shadow-resting" as string]: "0 2px 6px rgba(255,107,74,0.30)",
} as CSSProperties;
const CHECK_TOK = {
  ["--control-on" as string]: CORAL, ["--surface" as string]: "var(--agent-surface-elevated)", ["--border-strong" as string]: "var(--agent-border-default)",
  ["--foreground" as string]: "var(--agent-text-secondary)", ["--text-muted" as string]: "var(--agent-text-muted)", ["--text-sm" as string]: "12.5px", ["--control-height-md" as string]: "20px",
} as CSSProperties;

/* Field-status rail (the live contact pattern) — grey → coral → green. */
type FS = "empty" | "typing" | "valid";
function RailCircle({ n, state, last }: { n: number; state: FS; last?: boolean }) {
  const c = state === "valid" ? { b: "var(--agent-success)", t: "#fff", g: "var(--agent-success)" } : state === "typing" ? { b: CORAL, t: CORAL, g: "transparent" } : { b: "var(--agent-border-strong, rgba(45,24,16,0.22))", t: "var(--agent-text-muted)", g: "transparent" };
  return (
    <div style={{ position: "relative", width: 22, height: 48, flexShrink: 0, display: "grid", placeItems: "center" }}>
      {!last && <span style={{ position: "absolute", top: 24, left: "calc(50% - 1px)", width: 2, height: 58, background: "var(--agent-border-default)", zIndex: 0 }} />}
      <span style={{ position: "relative", zIndex: 1, width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, border: `1.5px solid ${c.b}`, color: c.t, background: c.g }}>{state === "valid" ? <Check size={12} weight="bold" /> : n}</span>
    </div>
  );
}

export default function AddSaleComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const [vw, setVw] = useState<VW>("desktop");

  // Drive the real token system via html[data-theme]; restore on unmount.
  const restore = useRef<string | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    if (restore.current === null) restore.current = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
  }, [theme]);
  useEffect(() => () => {
    const html = document.documentElement;
    if (restore.current) html.setAttribute("data-theme", restore.current); else html.removeAttribute("data-theme");
  }, []);

  // interactive demo state
  const [chip, setChip] = useState("freehold");
  const [seg, setSeg] = useState("Fixed £");
  const [vat, setVat] = useState("+ VAT");
  const [chain, setChain] = useState("Not sure yet");
  const [chk, setChk] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [pct, setPct] = useState("");
  const [fee, setFee] = useState<number | null>(null);

  const pageVars = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-pane" as string]: theme === "dark" ? "rgba(255,255,255,0.03)" : "#faf8f5",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
  } as CSSProperties;

  const toggleBtn = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  return (
    <div data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      {/* Sticky toolbar */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Add New Sale — comparison</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggleBtn(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggleBtn(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {(["desktop", "tablet", "mobile"] as VW[]).map((v) => <button key={v} type="button" style={toggleBtn(vw === v)} onClick={() => setVw(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · compare · Stage 2</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add New Sale — current vs proposed</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 820 }}>
            Left is the shipped card, faithfully reproduced. Right is how it would look after applying approved canonicals and the audit’s fixes.
            Proposals with no canonical yet are labelled <Tag kind="new" />. Toggle theme + viewport above. Nothing here changes production.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {(["canonical", "apply", "new", "protected", "decision"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}
          </div>
        </header>

        {/* 01 — Section headings */}
        <Block n="01" title="Section headings — one eyebrow convention" tags={["apply", "decision"]} vw={vw}
          source="SaleHeroEditable / ContactCarousel / CollapsibleSection / EarningsBuilder / ChainSection"
          canonical="eyebrow (components.tsx) · .agent-eyebrow"
          note={<>Today peer section headings use ≥6 treatments (faint 11/600, muted 11/600, 12/500 reading, 14/600 primary, uppercase, text-sm/semibold). Proposed: the <strong>decided eyebrow</strong> — sentence case · 11 · 600 · no tracking · muted — applied to all of them. (Decision: should “Property address” stay a prominent section title or join the eyebrow family?)</>}
          current={
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--nv2-text-faint, rgba(45,24,16,0.4))" }}>Vendors</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>Property address</p>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(45,24,16,0.4)" }}>Chain (optional)</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Is this sale part of a chain?</p>
            </div>
          }
          proposed={
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {["Vendors", "Property address", "Chain", "Your commission", "Notes"].map((l) => <Eyebrow key={l}>{l}</Eyebrow>)}
            </div>
          }
        />

        {/* 02 — Text inputs / field labels */}
        <Block n="02" title="Text inputs — LabelInput everywhere" tags={["apply"]} vw={vw}
          source="ContactsSection · BrokerField · AddFirmModal (glass-input / agent-input)"
          canonical="text-field (LabelInput)"
          note={<>Three input vocabularies ship side by side: arc <code>LabelInput</code> (contacts/broker), legacy <code>glass-input</code> (solicitor/modals) and <code>agent-input</code>. Proposed: the canonical floating-label <code>LabelInput</code>, coral accent, everywhere — with capitalise/format behaviour preserved.</>}
          current={
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 300 }}>
              <div><p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 500, color: "var(--agent-text-muted)" }}>Full name</p><input placeholder="e.g. Sarah Johnson" style={{ width: "100%", height: 40, padding: "0 14px", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "rgba(255,255,255,0.5)", outline: "none" }} /></div>
              <div><p style={{ margin: "0 0 5px", fontSize: 10.5, fontWeight: 650, letterSpacing: "0.04em", textTransform: "uppercase", color: "#9C9086" }}>Brokerage name</p><input placeholder="e.g. Bright Future" style={{ width: "100%", height: 40, padding: "0 14px", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "rgba(255,255,255,0.5)", outline: "none" }} /></div>
            </div>
          }
          proposed={
            <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 300, ["--lbi-top" as string]: "0px" } as CSSProperties}>
              <LabelInput field="name" label="Full name" type="text" accent={CORAL} fullWidth />
              <LabelInput field="brokerage" label="Brokerage name" type="text" accent={CORAL} fullWidth />
            </div>
          }
        />

        {/* 03 — Buttons */}
        <Block n="03" title="Buttons — the arc Button family" tags={["apply"]} vw={vw}
          source="agent-btn / agent-btn-color-primary (solicitor, broker, modals)"
          canonical="button-primary (arc Button)"
          note={<>The solicitor/broker/modal sub-tree still uses grandfathered <code>agent-btn</code>. Proposed: arc <code>Button</code> — coral primary via token override (so it follows a themed agency accent), secondary peer at the same height.</>}
          current={<button style={{ padding: "10px 20px", borderRadius: 12, border: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer", background: "linear-gradient(180deg,#FF8A65,#FF6B4A)", boxShadow: "0 6px 18px rgba(255,107,74,0.35)" }}>Assign broker</button>}
          proposed={<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Button variant="primary" size="md" style={{ ["--foreground" as string]: CORAL, ["--background" as string]: "#fff" } as CSSProperties}>Assign broker</Button><Button variant="secondary" size="md">Cancel</Button></div>}
        />

        {/* 04 — Contacts: field-status rail + people pill */}
        <Block n="04" title="Contacts — per-field status rail + people pill" tags={["new"]} vw={vw}
          source="ContactsSection.FieldCircle · ContactCarousel pills"
          note={<>The per-field circles (grey → coral → green) and the removable people pills are <strong>new patterns absent from the registry</strong>. Shown here as the proposed canonicals — tokenised, with the raw amber normalised to <code>--agent-warning</code>. (Decision: promote both to canonical, lab-first.)</>}
          current={
            <CardShell>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--nv2-text-faint, rgba(45,24,16,0.4))" }}>Purchasers</p><span style={{ fontSize: 12, fontWeight: 600, color: CORAL }}>+ Add purchaser</span></div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 999, background: CORAL, color: "#fff" }}>Mr James Foster ×</span>
                <span style={{ fontSize: 12, fontWeight: 500, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--agent-border-default)", color: "var(--agent-text-secondary)" }}>Purchaser 2</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Full name", "valid", 1], ["Phone", "typing", 2], ["Email", "empty", 3]].map(([l, s, n], i) => (
                  <div key={l as string} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <RailCircle n={n as number} state={s as FS} last={i === 2} />
                    <div style={{ flex: 1, height: 44, borderRadius: 14, border: "1px solid var(--agent-border-default)", display: "flex", alignItems: "center", padding: "0 14px", fontSize: 14, color: "var(--agent-text-muted)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </CardShell>
          }
          proposed={
            <CardShell>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><Eyebrow>Purchasers</Eyebrow><span style={{ fontSize: 12, fontWeight: 600, color: CORAL }}>+ Add purchaser</span></div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "5px 7px 5px 11px", borderRadius: 999, background: CORAL, color: "#fff" }}>Mr James Foster <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.28)", display: "grid", placeItems: "center" }}>×</span></span>
                <span style={{ fontSize: 12, fontWeight: 500, padding: "5px 11px", borderRadius: 999, border: "1px solid var(--agent-border-default)", color: "var(--agent-text-secondary)" }}>Purchaser 2</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Full name", "valid", 1], ["Phone", "typing", 2], ["Email", "empty", 3]].map(([l, s, n], i) => (
                  <div key={l as string} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <RailCircle n={n as number} state={s as FS} last={i === 2} />
                    <div style={{ flex: 1, height: 44, borderRadius: 14, border: "1px solid var(--agent-border-default)", display: "flex", alignItems: "center", padding: "0 14px", fontSize: 14, color: "var(--agent-text-muted)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </CardShell>
          }
        />

        {/* 05 — Portal-invite banner → AgentBanner recipe */}
        <Block n="05" title="Portal-invite banner → canonical banner recipe" tags={["apply"]} vw={vw}
          source="PortalInvitePrompt.tsx"
          canonical="AgentBanner / banner-card"
          note={<>A hand-rolled re-implementation of the canonical <code>AgentBanner</code> (divergent radius/padding/type/dismiss). Proposed: the canonical recipe — neutral frosted surface, kind colour on the icon only, canonical dismiss.</>}
          current={<div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", borderRadius: 14, background: "rgba(90,160,235,0.08)", border: "0.5px solid rgba(90,160,235,0.2)", maxWidth: 440 }}><span style={{ color: CORAL, display: "flex", marginTop: 1 }}><LinkSimple size={18} /></span><div><p style={{ margin: "0 0 3px", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>Want to invite the buyer or seller?</p><p style={{ margin: "0 0 7px", fontSize: 11.5, color: "var(--agent-text-secondary)" }}>Add their details below and send the invite once the file is created.</p><span style={{ fontSize: 11.5, fontWeight: 600, color: CORAL }}>I won&apos;t be using the client portal</span></div></div>}
          proposed={<div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 17px", borderRadius: 18, background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 30px rgba(15,26,46,0.06)", maxWidth: 440 }}><span style={{ color: CORAL, display: "flex", paddingTop: 1 }}><LinkSimple size={20} /></span><div style={{ minWidth: 0 }}><p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Want to invite the buyer or seller?</p><p style={{ margin: "0 0 7px", fontSize: 12, color: "var(--agent-text-muted)" }}>Add their details below and send the invite once the file is created.</p><span className="agent-link" style={{ fontSize: 12.5, fontWeight: 600, color: CORAL }}>I won&apos;t be using the client portal</span></div></div>}
        />

        {/* 06 — Firm search + results menu (canonical already) */}
        <Block n="06" title="Firm search + results menu" tags={["canonical"]} vw={vw}
          source="SolicitorPicker.tsx"
          canonical="shell-search (SearchField) · menu-popover · pick-row"
          note={<>Already canonical and the healthiest part of the flow — arc <code>SearchField</code> + the <code>AnchoredPanel</code> menu with <code>.ui-pop-pick</code> rows. Shown for confirmation; no change beyond tokenising the picked-state blue.</>}
          current={<FirmSearchDemo />} proposed={<FirmSearchDemo />}
        />

        {/* 07 — Case-handler select */}
        <Block n="07" title="Case-handler select — a canonical Select" tags={["new"]} vw={vw}
          source="SolicitorPicker (glass-input + raw ▾), BrokerPicker/ReferralSection (native select)"
          canonical="components/ui/Select.tsx — BUILT 2026-11-20"
          note={<>Three bespoke selects, no canonical <code>Select</code> existed. <strong>Now built</strong> — <code>components/ui/Select.tsx</code>: a <code>LabelInput</code>-weight trigger + a real <code>CaretDown</code> opening the <em>existing</em> canonical <code>AnchoredPanel</code> + <code>.ui-pop-pick</code> menu (unchanged), with a selected check and an optional <code>+ Add…</code> row. Open it.</>}
          current={<div style={{ width: "100%" }}><span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", marginBottom: 6 }}>Case handler</span><div style={{ width: "100%", height: 42, padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "rgba(255,255,255,0.5)", color: "var(--agent-text-muted)" }}><span>Select case handler…</span><span style={{ color: "rgba(45,24,16,0.35)" }}>▾</span></div></div>}
          proposed={<Select label="Case handler" options={[{ value: "jane", label: "Jane Powell" }, { value: "rahul", label: "Rahul Shah" }, { value: "maria", label: "Maria Costa" }]} value={sel} onChange={setSel} addAction={{ label: "Add a new case handler", onClick: () => {} }} />}
        />

        {/* 08 — Checkbox */}
        <Block n="08" title="Checkbox — one implementation" tags={["apply"]} vw={vw}
          source="native (SolicitorSection) · arc (BrokerField) · ui (BrokersSection)"
          canonical="checkbox (arc Checkbox)"
          note={<>Three checkbox implementations across the broker/solicitor flow. Proposed: the arc <code>Checkbox</code> (coral) everywhere.</>}
          current={<label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--agent-text-primary)" }}><input type="checkbox" defaultChecked style={{ width: 13, height: 13, accentColor: "#FF6B4A" }} />This is our recommended broker</label>}
          proposed={<div className="arc-scope" style={CHECK_TOK}><Checkbox checked={chk} onCheckedChange={(c) => setChk(c === true)} label="This is our recommended broker" /></div>}
        />

        {/* 09 — Commission: segmented + % field + box focus */}
        <Block n="09" title="Commission — percent field + box focus" tags={["canonical", "new"]} vw={vw}
          source="EarningsBuilder.tsx"
          canonical="view-toggle (SegmentedControl) · price-field"
          note={<>Fixed/Percent + VAT are the canonical <code>SegmentedControl</code> (keep). Two gaps: the % input was a bespoke native field and the box’s focus border was <strong>blue</strong> (<code>--agent-info</code>) inside a coral form. <strong>Now built</strong> — <code>components/ui/PercentField.tsx</code>, a % sibling of <code>PriceField</code> (same shell/sizing, reuses the dark-correct native input) + a coral focus border.</>}
          current={
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}>
              <div style={{ display: "inline-flex", borderRadius: 10, background: "rgba(45,24,16,0.05)", padding: 3, gap: 2, alignSelf: "flex-start" }}>{["Fixed £", "Percent %"].map((o, i) => <span key={o} style={{ padding: "5px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: i === 1 ? "linear-gradient(180deg,#FF8A65,#FF6B4A)" : "transparent", color: i === 1 ? "#fff" : "var(--agent-text-muted)" }}>{o}</span>)}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "8px 12px", borderRadius: 12, border: "1px solid rgba(37,99,235,0.45)", background: "rgba(255,107,74,0.04)" }}><input type="number" placeholder="0" style={{ width: 60, border: "none", background: "none", outline: "none", fontSize: 16, fontWeight: 600, color: "var(--agent-text-primary)" }} /><span style={{ fontSize: 20, fontWeight: 600, color: "var(--agent-text-muted)" }}>%</span><span style={{ marginLeft: "auto", fontSize: 10.5, color: "#2563eb" }}>blue focus</span></div>
            </div>
          }
          proposed={
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 300 }}>
              <div className="arc-scope" style={{ ...SEG_TOK, alignSelf: "flex-start" }}><SegmentedControl label="Fee type" options={[{ value: "Fixed £", label: "Fixed £" }, { value: "Percent %", label: "Percent %" }]} value={seg} onValueChange={setSeg} /></div>
              <div style={{ display: "flex", alignItems: "center", padding: "8px 12px", borderRadius: 12, border: `1px solid ${pct ? CORAL : "rgba(255,107,74,0.32)"}`, background: "rgba(255,107,74,0.04)", transition: "border-color .15s" }}><PercentField bare hideLabel value={pct} onChange={setPct} fontSize={20} /></div>
            </div>
          }
        />

        {/* 10 — Chain: position segmented */}
        <Block n="10" title="Chain position — one segmented control" tags={["apply"]} vw={vw}
          source="ChainSection .chain-seg"
          canonical="view-toggle (SegmentedControl)"
          note={<>The chain position toggle is a bespoke <code>.chain-seg</code> (CSS-transform slide) — a second segmented control on the same form. Proposed: the arc <code>SegmentedControl</code>, full-width, same coral tokens, gliding spring selection.</>}
          current={<div style={{ display: "inline-flex", width: "100%", borderRadius: 12, background: "rgba(255,107,74,0.05)", padding: 4, gap: 0 }}>{["Top", "Middle", "Bottom", "Not sure yet"].map((o) => <span key={o} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 9, fontSize: 12.5, fontWeight: 650, background: o === "Not sure yet" ? CORAL : "transparent", color: o === "Not sure yet" ? "#fff" : "var(--agent-text-secondary)" }}>{o}</span>)}</div>}
          proposed={<div className="arc-scope" style={SEG_TOK}><SegmentedControl label="Chain position" fullWidth options={["Top", "Middle", "Bottom", "Not sure yet"].map((o) => ({ value: o, label: o }))} value={chain} onValueChange={setChain} /></div>}
        />

        {/* 11 — Drafts active row: wash → ring */}
        <Block n="11" title="Active row — ring, not a wash" tags={["apply"]} vw={vw}
          source="DraftPanel.tsx"
          note={<>The current draft row marks “active” with a coral <strong>fill wash</strong> (<code>rgba(coral,0.06)</code>) — against the no-faded-fill rule the rest of the flow follows (chain “Your file”, progressor cards use a ring). Proposed: a coral ring.</>}
          current={<div style={{ width: 320, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 12, background: "rgba(255,107,74,0.06)", border: "1px solid var(--agent-border-default)" }}><div><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>24 Willow Close</p><p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Draft · 2 days ago</p></div></div>}
          proposed={<div style={{ width: 320, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 12, background: "var(--agent-surface-elevated)", boxShadow: `inset 0 0 0 1.5px ${CORAL}` }}><div><p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>24 Willow Close</p><p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>Draft · 2 days ago</p></div></div>}
        />

        {/* 12 — Progressor fee-missing warning → InlineAlert */}
        <Block n="12" title="Warning box → canonical InlineAlert" tags={["apply"]} vw={vw}
          source="NewSaleFlow.tsx progressorFeeMissing box"
          canonical="inline-alert"
          note={<>A washed amber colour-fill card with hardcoded <code>rgba(245,158,11,…)</code>. Proposed: the canonical <code>InlineAlert</code> (warning kind) — bordered, not washed — keeping the message + link.</>}
          current={<div style={{ maxWidth: 440, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 10, padding: "12px 14px" }}><p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 700, color: "var(--agent-warning)" }}>This progressor has no rate card</p><p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-secondary)" }}>Set their fee before this sale can be priced. <span style={{ color: CORAL, fontWeight: 700 }}>Set fee</span></p></div>}
          proposed={<div style={{ maxWidth: 440 }}><InlineAlert kind="warning">This progressor has no rate card — set their fee before this sale can be priced.</InlineAlert></div>}
        />

        {/* 13 — Filter chips (confirm canonical) */}
        <Block n="13" title="Tenure / purchase / progressed-by chips" tags={["canonical"]} vw={vw}
          source="SaleHeroEditable.Choice"
          canonical="filter-chip"
          note={<>Already the canonical filter-chip (coral + animated check, no wash) — confirmed, no change. Click to switch.</>}
          current={<ChipRow sel={chip} setSel={setChip} />} proposed={<ChipRow sel={chip} setSel={setChip} />}
        />

        {/* 14 — Notes (confirm canonical) */}
        <Block n="14" title="Notes textarea" tags={["canonical"]} vw={vw}
          source="NotesSection → NotesField"
          canonical="notes-field"
          note={<>Already canonical (arc Textarea, coral focus ring, hover border softened). Confirmed, no change.</>}
          current={<NotesDemo />} proposed={<NotesDemo />}
        />

        {/* D1 — Token family: slate ink → warm agent ink (decision 1, must-see) */}
        <Block n="D1" title="Text colour — cool slate → warm agent ink" tags={["apply"]} vw={vw}
          source="globals.css .nv2-night (--nv2-text-*)"
          canonical="design/tokens.ts (--agent-text-*)"
          note={<>Decision 1, approved: the Add-Sale form inks its text with a cool <strong>slate</strong> ramp (<code>rgba(15,23,42,…)</code>) while the rest of the agent app uses the warm <strong>brown</strong> ramp from <code>design/tokens.ts</code> (your photo). Aliasing <code>--nv2-*</code> → <code>--agent-*</code> warms the ink to match the family. Shown here because it is a <em>visible</em> shift across the whole form — eyeball it before I flip the live token.</>}
          current={
            <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "rgba(15,23,42,0.80)" }}>24 Willow Close</p>
              <p style={{ margin: 0, fontSize: 13, color: "rgba(15,23,42,0.52)" }}>Freehold · Mortgage buyer</p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(15,23,42,0.42)" }}>Add a seller and a buyer to continue</p>
            </div>
          }
          proposed={
            <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 4 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>24 Willow Close</p>
              <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>Freehold · Mortgage buyer</p>
              <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>Add a seller and a buyer to continue</p>
            </div>
          }
        />

        {/* D7 — AgentBanner coral kind (decision 7, "I'll need to see") */}
        <Block n="D7" title="OutsourcedBanner — a coral AgentBanner kind" tags={["new"]} vw={vw}
          source="OutsourcedBanner.tsx (inline coral recipe)"
          canonical={'components/ui/AgentBanner.tsx — proposed kind="coral"'}
          note={<>Decision 7, for your eye: <code>AgentBanner</code> ships 4 kinds (info/warning/danger/success). The outsourced banner needs a coral/brand look it doesn’t offer, so today it re-implements the recipe inline. Proposed: add a 5th <code>kind="coral"</code> so it uses the real component — neutral frosted surface, coral on the icon + title only, <em>no</em> wash (left = today’s inline coral-wash version for contrast).</>}
          current={<div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 16px", borderRadius: 10, background: "rgba(255,107,74,0.08)", border: "1px solid rgba(255,107,74,0.22)", maxWidth: 440 }}><span style={{ color: CORAL, flexShrink: 0, marginTop: 1, display: "flex" }}><Buildings size={16} weight="fill" /></span><div><p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: CORAL }}>Our team is handling this sale.</p><p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>Add at least one seller and one buyer, with a name and either a phone number or email address.</p></div></div>}
          proposed={<div style={{ display: "flex", gap: 13, alignItems: "flex-start", padding: "15px 17px", borderRadius: 18, background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 10px 30px rgba(15,26,46,0.06)", maxWidth: 440 }}><span style={{ color: CORAL, flexShrink: 0, paddingTop: 1, display: "flex" }}><Buildings size={18} weight="fill" /></span><div style={{ minWidth: 0 }}><p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 600, color: CORAL }}>Our team is handling this sale.</p><p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)" }}>Add at least one seller and one buyer, with a name and either a phone number or email address.</p></div></div>}
        />

        {/* Full-page composite */}
        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}><span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>15</span><h3 style={{ margin: 0, fontSize: 17, fontWeight: 650 }}>Full-page harmony</h3></div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", maxWidth: 860 }}>How the stack reads top-to-bottom once every section shares one eyebrow + one input + one segmented + ring-not-wash. The point is cross-card consistency, not making every card identical.</p>
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
            <Pane side="current" vw={vw}><FullStack proposed={false} /></Pane>
            <Pane side="proposed" vw={vw}><FullStack proposed /></Pane>
          </div>
        </section>

        {/* Outstanding decisions */}
        <section style={{ borderTop: "1px solid var(--compare-line)", paddingTop: 26, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 650 }}>Canonical decisions — resolved 2026-11-20</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--compare-body)" }}>All nine ruled on. Eight are settled; the coral banner (7) is the one left to eyeball — see block D7 above.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["1 · Token families", "done", "Alias --nv2-* → the canonical --agent-* ramp (your photo). See block D1 — flips on your nod."],
              ["2 · Section headings", "done", "One eyebrow (10px/600/muted, sentence case) for section labels; the property title stays the single prominent heading."],
              ["3 · Field labels", "done", "The floating LabelInput treatment everywhere; no uppercase picker labels."],
              ["4 · New canonicals", "done", "Promote the per-field status rail + removable people pill (lab-first)."],
              ["5 · Select", "built", "components/ui/Select.tsx — trigger + the existing canonical menu (untouched). See block 07."],
              ["6 · Percent field", "built", "components/ui/PercentField.tsx — PriceField sibling, same sizing. See block 09."],
              ["7 · AgentBanner coral", "to see", "Add a 5th kind=\"coral\" to AgentBanner. Rendered in block D7 for your eye."],
              ["8 · Checkbox / price", "done", "arc Checkbox + PriceField are the record — existing sizes kept, nothing made bigger."],
              ["9 · VOICE.md", "done", "VOICE.md eyebrow rule changed to sentence case; eyebrow size held at the live 10px."],
            ].map(([t, s, d]) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "10px 14px" }}>
                <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", color: s === "to see" ? "#8a5a00" : "#1f7a4d", background: s === "to see" ? "rgba(224,148,46,0.14)" : "rgba(47,158,107,0.13)", border: `1px solid ${s === "to see" ? "rgba(224,148,46,0.34)" : "rgba(47,158,107,0.32)"}` }}>{s}</span>
                <div><strong style={{ fontSize: 13 }}>{t}</strong><p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--compare-body)", lineHeight: 1.5 }}>{d}</p></div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ── Shared interactive demos ─────────────────────────────────────────────── */
function FirmSearchDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const firms = ["Andersons Property Law", "Blacks Legal", "Clarke & Mortimer", "Devlin Law LLP"];
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <span style={{ position: "absolute", left: 12, top: 11, color: "var(--agent-text-muted)" }}><MagnifyingGlass size={16} /></span>
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(!!e.target.value); }} onFocus={() => setOpen(!!q)} placeholder="Search firm name…" style={{ width: "100%", height: 40, padding: "0 12px 0 36px", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", outline: "none", color: "var(--agent-text-primary)" }} />
      <AnchoredPanel anchorRef={ref} open={open && !!q} onClose={() => setOpen(false)} matchWidth bare placement="bottom-start">
        {firms.filter((f) => f.toLowerCase().includes(q.toLowerCase())).map((f) => <button key={f} type="button" className="ui-pop-pick" onMouseDown={() => { setQ(f); setOpen(false); }}>{f}</button>)}
        <button type="button" className="ui-pop-pick ui-pop-pick-add" onMouseDown={() => setOpen(false)}>+ Add as new firm</button>
      </AnchoredPanel>
    </div>
  );
}
function ChipRow({ sel, setSel }: { sel: string; setSel: (v: string) => void }) {
  const opts = [{ v: "freehold", l: "Freehold" }, { v: "leasehold", l: "Leasehold" }, { v: "share", l: "Share of freehold" }];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-success)" }}>Tenure</span>
      {opts.map((o) => {
        const on = sel === o.v;
        return <button key={o.v} type="button" onClick={() => setSel(o.v)} style={{ display: "inline-flex", alignItems: "center", fontSize: 12.5, fontWeight: 600, padding: "6px 15px", borderRadius: 999, cursor: "pointer", border: on ? "1.5px solid transparent" : "1.5px solid var(--agent-border-default)", background: on ? CORAL : "transparent", color: on ? "#fff" : "var(--agent-text-secondary)" }}><span style={{ display: "inline-flex", overflow: "hidden", width: on ? 17 : 0, transition: "width .2s" }}><Check size={13} weight="bold" /></span>{o.l}</button>;
      })}
    </div>
  );
}
function NotesDemo() {
  const [v, setV] = useState("");
  return <div style={{ width: 320, ["--focus-ring" as string]: "rgba(255,107,74,0.18)" } as CSSProperties}><NotesField label="Notes" hideLabel value={v} onChange={setV} placeholder="Any context about this sale…" /></div>;
}
function FullStack({ proposed }: { proposed: boolean }) {
  const H = ({ children, variant }: { children: ReactNode; variant: number }) =>
    proposed ? <Eyebrow>{children}</Eyebrow> :
    variant === 0 ? <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "rgba(45,24,16,0.4)" }}>{children}</p> :
    variant === 1 ? <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{children}</p> :
    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(45,24,16,0.4)" }}>{children}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CardShell pad={14}><H variant={1}>Property address</H><div style={{ height: 40, marginTop: 8, borderRadius: 12, border: "1px solid var(--agent-border-default)" }} /></CardShell>
      <CardShell pad={14}><H variant={0}>Vendors</H><div style={{ height: 40, marginTop: 8, borderRadius: 12, border: "1px solid var(--agent-border-default)" }} /></CardShell>
      <CardShell pad={14}><H variant={2}>Chain (optional)</H><div style={{ marginTop: 10 }}>{proposed
        ? <div className="arc-scope" style={SEG_TOK}><SegmentedControl label="Chain" fullWidth options={["Top", "Middle", "Bottom"].map((o) => ({ value: o, label: o }))} value="Top" onValueChange={() => {}} /></div>
        : <div style={{ display: "flex", borderRadius: 12, background: "rgba(255,107,74,0.05)", padding: 4 }}>{["Top", "Middle", "Bottom"].map((o) => <span key={o} style={{ flex: 1, textAlign: "center", padding: "7px 0", borderRadius: 9, fontSize: 12.5, fontWeight: 650, background: o === "Top" ? CORAL : "transparent", color: o === "Top" ? "#fff" : "var(--agent-text-secondary)" }}>{o}</span>)}</div>}</div>
      </CardShell>
    </div>
  );
}

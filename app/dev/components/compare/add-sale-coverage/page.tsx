"use client";

// Add New Sale — COVERAGE compare (final sign-off). Same Current-vs-Proposed format as
// /compare/add-sale: left = the shipped element reproduced byte-for-byte (or the real
// component imported); right = the canonical / proposed treatment. Only the gaps the
// four coverage sweeps found are shown. Dev-only, read-only. Nothing changes production.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { Buildings, LinkSimple, CheckCircle, Check, CaretDown } from "@phosphor-icons/react";
import { LabelInput } from "@/components/ui/LabelInput";
import { Select } from "@/components/ui/Select";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Pill } from "@/components/ui/Pill";
import { Checkbox } from "@/components/arc/checkbox/checkbox";
import { AddPhotoCircle } from "@/components/transaction/HeroPhotoUpload";
import { AgentPicker } from "@/components/agent-picker/AgentPicker";
import type { AssignableAgent } from "@/lib/services/agency-team";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";
type VW = "desktop" | "tablet" | "mobile";
const VW_W: Record<VW, number | undefined> = { desktop: undefined, tablet: 720, mobile: 380 };

type TagKind = "apply" | "new" | "decision";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  apply:    { label: "Migrate — canonical exists", fg: "#8a5a00", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  new:      { label: "New canonical", fg: "#7E22CE", bg: "rgba(126,34,206,0.12)", bd: "rgba(126,34,206,0.30)" },
  decision: { label: "Decision required", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
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
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed" : "Current (shipped)"}</span>
      <div style={{ borderRadius: 16, padding: 18, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", justifyContent: "center" }}>
        <div style={{ width: w ? `min(${w}px, 100%)` : "100%", minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
function Block({ n, title, tags, note, source, vw, current, proposed }: { n: string; title: string; tags: TagKind[]; note: ReactNode; source?: string; vw: VW; current: ReactNode; proposed: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 860 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current" vw={vw}>{current}</Pane>
        <Pane side="proposed" vw={vw}>{proposed}</Pane>
      </div>
      {source && (
        <div style={{ marginTop: 12 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--compare-muted)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CaretDown size={11} weight="bold" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} /> Source
          </button>
          {open && <div style={{ marginTop: 8, fontSize: 12, color: "var(--compare-body)", background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "10px 12px" }}><code>{source}</code></div>}
        </div>
      )}
    </section>
  );
}
const CHECK_TOK = { ["--control-on" as string]: CORAL, ["--surface" as string]: "var(--agent-surface-elevated)", ["--border-strong" as string]: "var(--agent-border-default)", ["--foreground" as string]: "var(--agent-text-secondary)", ["--text-muted" as string]: "var(--agent-text-muted)", ["--text-sm" as string]: "12.5px", ["--control-height-md" as string]: "20px" } as CSSProperties;
const AGENTS = [{ id: "1", name: "Jane Powell" }, { id: "2", name: "Rahul Shah" }, { id: "3", name: "Maria Costa" }] as unknown as AssignableAgent[];

// A minimal spinning ring, for the "searching" spinner consolidation block.
function Ring({ canonical }: { canonical?: boolean }) {
  return (
    <>
      <style>{`@keyframes cov-spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-block", border: canonical ? `2px solid rgba(255,107,74,0.18)` : "2px solid rgba(45,24,16,0.12)", borderTopColor: canonical ? CORAL : "rgba(45,24,16,0.45)", animation: "cov-spin 0.8s linear infinite" }} />
    </>
  );
}

export default function AddSaleCoveragePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const [vw, setVw] = useState<VW>("desktop");
  const [sel, setSel] = useState<string | null>("1");
  const [chk, setChk] = useState(true);
  const restore = useRef<string | null>(null);
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", theme); }, [theme]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

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
    <div className="agent-shell-root" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Add New Sale — coverage compare</strong>
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
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · coverage · sign-off</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>Add New Sale — the uncovered tail</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 820 }}>
            Left is the shipped element, reproduced byte-for-byte (several are the real component, imported). Right is the canonical / proposed treatment. These are only the gaps the four sweeps found — the core is already canonical. Nothing here changes production.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["apply", "new", "decision"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        {/* ── MIGRATIONS ─────────────────────────────────────────────────────── */}
        <h2 style={{ margin: "26px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Migrations — a canonical already exists</h2>

        <Block n="M1" title="AgentPicker → canonical Select" tags={["apply"]} vw={vw}
          source="components/agent-picker/AgentPicker.tsx (real component, left) → components/ui/Select.tsx"
          note={<>Left is the <strong>real AgentPicker</strong> — a raw native <code>&lt;select class=&quot;glass-input&quot;&gt;</code>. The canonical <code>Select</code> was built 2026-11-20 specifically to retire this picker; it was never migrated.</>}
          current={<AgentPicker value="1" onChange={() => {}} agents={AGENTS} currentUserId="1" label="Assign this file to" />}
          proposed={<Select label="Assign this file to" value={sel} onChange={setSel} options={[{ value: "1", label: "Jane Powell (you)" }, { value: "2", label: "Rahul Shah" }, { value: "3", label: "Maria Costa" }]} height={40} radius={8} />}
        />

        <Block n="M2" title="Progressor-fee warning → InlineAlert" tags={["apply"]} vw={vw}
          source="NewSaleFlow.tsx:1439-1453 → components/ui/InlineAlert.tsx"
          note={<>A faded-amber tinted-fill box (<code>rgba(245,158,11,0.1)</code>) duplicating the warning alert — against the no-faded-fill rule. The canonical <code>InlineAlert</code> is bordered, not washed.</>}
          current={<div style={{ margin: 0, padding: "12px 14px", borderRadius: 10, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", display: "flex", flexDirection: "column", gap: 8 }}><span style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-warning)" }}>Set a fee for Oakwood first</span><span style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>You need a fee set for this client before you can add a sale for them.</span><a className="agent-link" style={{ fontWeight: 700, fontSize: 12.5, color: CORAL }}>Set fee for Oakwood →</a></div>}
          proposed={<InlineAlert kind="warning">Set a fee for Oakwood before you can add a sale for them. <span style={{ fontWeight: 700 }}>Set fee →</span></InlineAlert>}
        />

        <Block n="M3" title="Native referral checkbox → arc Checkbox" tags={["apply"]} vw={vw}
          source="SolicitorSection.tsx:124-134 (native input) → components/arc/checkbox"
          note={<>A raw native <code>&lt;input type=checkbox&gt;</code>. The canonical checkbox entry says it retires exactly the native/ui variants across this flow (BrokerField already uses the arc one).</>}
          current={<label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input type="checkbox" defaultChecked style={{ width: 13, height: 13, borderRadius: 4, accentColor: "#FF6B4A" }} /><span style={{ fontSize: 12, fontWeight: 500, color: CORAL }}>Referred by us</span></label>}
          proposed={<div className="arc-scope" style={CHECK_TOK}><Checkbox checked={chk} onCheckedChange={(c) => setChk(c === true)} label="Referred by us" /></div>}
        />

        <Block n="M4" title="Company person field → LabelInput" tags={["apply"]} vw={vw}
          source="ContactsSection.tsx:170-177 (.agent-input) → LabelInput"
          note={<>Inside an otherwise all-<code>LabelInput</code> contact card, the company contact-person field is a lone raw <code>.agent-input</code>. Proposed: the canonical floating-label field (solid).</>}
          current={<div><p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 500, color: "var(--agent-text-muted)" }}>Who should we address?</p><input placeholder="e.g. the managing director" className="agent-input" style={{ width: "100%", height: 40, padding: "0 14px", fontSize: 14, borderRadius: 10, border: "1px solid var(--agent-border-default)", background: "rgba(255,255,255,0.5)", outline: "none" }} /></div>}
          proposed={<div style={{ ["--lbi-top" as string]: "0px" } as CSSProperties}><LabelInput field="person" label="Who should we address?" type="text" accent="#FF6B4A" fullWidth /></div>}
        />

        <Block n="M5" title="“Searching…” ring → canonical coral-arc spinner" tags={["apply"]} vw={vw}
          source="SolicitorSection.tsx:187,238 (agent-spin) → the nominated spinner"
          note={<>The solicitor “Searching…” uses a hand-rolled grey <code>agent-spin</code> ring; the <code>spinner</code> entry flags these as un-consolidated against the one nominated coral-arc spinner.</>}
          current={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--agent-text-muted)" }}><Ring /> Searching…</span>}
          proposed={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--agent-text-muted)" }}><Ring canonical /> Searching…</span>}
        />

        <Block n="M6" title="Memo-source warning line → InlineAlert / field-hint" tags={["apply"]} vw={vw}
          source="SolicitorSection.tsx:212-217 / contacts error lines"
          note={<>Hand-rolled amber-dot warnings and plain red <code>&lt;p&gt;</code> errors instead of the canonical message primitives.</>}
          current={<p style={{ margin: 0, display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, color: "var(--agent-warning)" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} /> The buyer’s solicitor is in the memo — add it</p>}
          proposed={<InlineAlert kind="warning">The buyer’s solicitor is named in the memo — add it to continue.</InlineAlert>}
        />

        <Block n="M7" title="Relist-catch status pill → canonical Pill" tags={["apply"]} vw={vw}
          source="RelistCatchModal.tsx:70 → components/ui/Pill"
          note={<>A bespoke inline gradient pill inside the relist modal; the canonical <code>Pill</code> primitive carries tones.</>}
          current={<span style={{ fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 999, color: "#fff", background: "linear-gradient(180deg,#FF8A65,#FF6B4A)" }}>Previously fell through</span>}
          proposed={<Pill tone="warning" size="sm">Previously fell through</Pill>}
        />

        {/* ── NEW CANONICAL CANDIDATES ───────────────────────────────────────── */}
        <h2 style={{ margin: "36px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>New canonical candidates</h2>

        <Block n="N1" title="Empty-state contact card — drop the faded fill" tags={["new"]} vw={vw}
          source="ContactCarousel.tsx:54-84 (EmptyStateCard)"
          note={<>Byte-for-byte the shipped empty vendor card: a dashed border over a <strong>faded amber wash</strong>. Proposed: catalogue it, but define it with a ring / neutral surface (no wash).</>}
          current={<div style={{ textAlign: "center", padding: "14px 16px", background: "rgba(245,158,11,0.04)", border: "0.5px dashed rgba(245,158,11,0.30)", borderRadius: 12 }}><p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 500, color: "var(--agent-text-primary)" }}>Add a vendor</p><p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-secondary)" }}>Add a name and a phone number or email.</p></div>}
          proposed={<div style={{ textAlign: "center", padding: "14px 16px", background: "var(--agent-surface-elevated)", border: `0.5px dashed ${CORAL}`, borderRadius: 12 }}><p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>Add a vendor</p><p style={{ margin: 0, fontSize: 11, color: "var(--agent-text-secondary)" }}>Add a name and a phone number or email.</p></div>}
        />

        <Block n="N2" title="People pill — ring vs fill (needs your call)" tags={["decision"]} vw={vw}
          source="ContactCarousel.tsx:286-334 vs gallery people-pill copy"
          note={<>The <strong>gallery entry</strong> documents the active pill as a coral <strong>ring</strong>; the <strong>live code</strong> (left) uses a solid coral <strong>fill</strong> with white text. Pick one so the record and code agree.</>}
          current={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "5px 7px 5px 11px", borderRadius: 999, background: "var(--agent-coral)", color: "#fff" }}>Mr James Foster <span style={{ width: 16, height: 16, borderRadius: "50%", background: "rgba(255,255,255,0.28)", display: "grid", placeItems: "center", fontSize: 11 }}>×</span></span>}
          proposed={<span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "5px 7px 5px 11px", borderRadius: 999, background: "var(--agent-surface-elevated)", color: "var(--agent-text-primary)", boxShadow: `inset 0 0 0 1.5px ${CORAL}` }}>Mr James Foster <span style={{ width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, color: "var(--agent-text-muted)" }}>×</span></span>}
        />

        <Block n="N3" title="“Your usual broker” pick — drop the faded tile" tags={["new"]} vw={vw}
          source="BrokerField.tsx:273-288 (broker-usual-pick)"
          note={<>Byte-for-byte the shipped one-tap pick: the icon tile uses a <strong>faded-coral wash</strong>. Proposed: a ring / neutral tile, no wash — otherwise identical.</>}
          current={<button type="button" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", cursor: "pointer", textAlign: "left" }}><div style={{ width: 26, height: 26, borderRadius: 7, background: "rgba(255,107,74,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Buildings size={13} weight="bold" color={CORAL} /></div><div style={{ minWidth: 0, flex: 1 }}><p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Your usual broker</p><p style={{ margin: "1px 0 0", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Bright Future Mortgages</p></div><span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: CORAL }}>Use</span></button>}
          proposed={<button type="button" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", cursor: "pointer", textAlign: "left" }}><div style={{ width: 26, height: 26, borderRadius: 7, background: "var(--agent-surface-elevated)", boxShadow: `inset 0 0 0 1.5px ${CORAL}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Buildings size={13} weight="bold" color={CORAL} /></div><div style={{ minWidth: 0, flex: 1 }}><p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--agent-text-muted)" }}>Your usual broker</p><p style={{ margin: "1px 0 0", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>Bright Future Mortgages</p></div><span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: CORAL }}>Use</span></button>}
        />

        <Block n="N4" title="Reachability / eligibility hint" tags={["new"]} vw={vw}
          source="ContactsSection.tsx:240-260 (3 tones)"
          note={<>Byte-for-byte the shipped status lines (success / warning / coral). One repeated icon+text pattern with no entry. Proposed: catalogue a single inline status-hint — <strong>no visual change</strong>, just recorded.</>}
          current={<div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: "var(--agent-success)" }}><CheckCircle size={12} weight="fill" /> We can reach this vendor</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: CORAL }}><LinkSimple size={12} /> Eligible for portal invite</span></div>}
          proposed={<div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: "var(--agent-success)" }}><CheckCircle size={12} weight="fill" /> We can reach this vendor</span><span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 500, color: CORAL }}><LinkSimple size={12} /> Eligible for portal invite</span></div>}
        />

        <Block n="N5" title="State group label (chip row labels)" tags={["new"]} vw={vw}
          source="SaleHeroEditable.tsx:96-102 (GroupLabel)"
          note={<>Byte-for-byte the shipped label beside the Tenure / Purchase / Progressed chip rows — green when the group has a selection, grey otherwise. Small reusable pattern, uncatalogued. Proposed: catalogue as-is.</>}
          current={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-success)" }}>Tenure</span><span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>Purchase type</span></div>}
          proposed={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-success)" }}>Tenure</span><span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)" }}>Purchase type</span></div>}
        />

        <Block n="N6" title="Add-photo circle (real component)" tags={["new"]} vw={vw}
          source="components/transaction/HeroPhotoUpload.tsx AddPhotoCircle (real, both sides)"
          note={<>The <strong>real AddPhotoCircle</strong> — gradient brand ring + camera, with a busy spinner state + “Uploading…”. Shared by the file-hero and the new-sale hero but with no gallery entry. Proposed: promote as-is.</>}
          current={<div style={{ display: "flex", justifyContent: "center" }}><AddPhotoCircle onClick={() => {}} busy={false} size={110} /></div>}
          proposed={<div style={{ display: "flex", justifyContent: "center" }}><AddPhotoCircle onClick={() => {}} busy={false} size={110} /></div>}
        />

        <Block n="N7" title="Hero overlay pill (dark glass)" tags={["new"]} vw={vw}
          source="SaleHeroEditable.tsx:39-44 (DARK_PILL)"
          note={<>Byte-for-byte the shipped dark frosted overlay pill used for “Memo read / Add photo / Remove photo” over the hero photo + map. Reusable (mirrors file-hero Back/Remove); uncatalogued. Proposed: promote as-is.</>}
          current={<div style={{ display: "flex", gap: 8, padding: 10, borderRadius: 12, background: "linear-gradient(135deg,#9aa6b8,#6b7687)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, color: "#fff", background: "rgba(15,23,42,0.42)", backdropFilter: "blur(8px)" }}>Memo read</span></div>}
          proposed={<div style={{ display: "flex", gap: 8, padding: 10, borderRadius: 12, background: "linear-gradient(135deg,#9aa6b8,#6b7687)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 999, color: "#fff", background: "rgba(15,23,42,0.42)", backdropFilter: "blur(8px)" }}>Memo read</span></div>}
        />

        {/* ── Structural items (reviewed, need their own harness) ─────────────── */}
        <section style={{ borderTop: "1px solid var(--compare-line)", paddingTop: 26, marginTop: 8 }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Also found — structural (not pixel-rendered here)</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--compare-body)", maxWidth: 820 }}>These need their own live state/context to render true, so they’re not mocked above. Each is a known target; I’ll build a dedicated compare for any you want to see before touching it.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              ["3 hand-rolled modal shells", "NavAwayModal · DuplicateAddressModal · ChangeFileModal reimplement the portal/backdrop/card while RelistCatchModal in the same flow uses the canonical Modal.", "Migrate to components/ui/Modal (ChangeFile also → agent-icon-btn close)."],
              ["AddFirmModal / AddSolicitorForm fields", "glass-input + hand-rolled valid ticks, hand-rolled radio rows (faded blue), raw NumericFormat fee, blue faded-fill firm chip.", "LabelInput + field-status-rail + arc radio-group + PriceField; drop the faded fills."],
              ["Location map + “you are here” pin", "PropertyLocationMap — keyless map backdrop + pulsing pin; pin hardcodes #2563eb (Command-Centre blue).", "Catalogue the map + pin; retoken the pin."],
              ["Collapsible section header + chevron", "CollapsibleSection .agent-acc — one of the most-reused app patterns.", "Catalogue the collapsible header/drawer."],
              ["Submission overlay + draft launcher", "Full-screen frosted overlay (rotating messages) and the fixed bottom-left draft launcher pill + popover.", "Catalogue both shells."],
              ["Populated firm/broker card", "Same Buildings-icon header + handler sub-card in SolicitorSection + BrokerField.", "Extract one canonical party card."],
            ].map(([t, now, prop]) => (
              <div key={t} style={{ display: "grid", gridTemplateColumns: "210px 1fr 1fr", gap: 14, alignItems: "start", background: "var(--compare-pane)", border: "1px solid var(--compare-line)", borderRadius: 10, padding: "11px 14px" }}>
                <strong style={{ fontSize: 12.5 }}>{t}</strong>
                <span style={{ fontSize: 12, color: "var(--compare-body)", lineHeight: 1.5 }}>{now}</span>
                <span style={{ fontSize: 12, color: "var(--compare-body)", lineHeight: 1.5 }}><span style={{ color: CORAL, fontWeight: 700 }}>→ </span>{prop}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

"use client";

// UPDATES / COMMS (/agent/comms) — canonical-alignment comparison, gallery-style.
//
// BEFORE = real markup + real classes. The cf-* filter/search/checkbox styles
// are injected via an inline <style> inside CommsActivityFeed, so they're
// included here (copied verbatim) so the current side renders faithfully. The
// real Pill / PropertyThumb are imported live. AFTER = the real canonical.
// Light maps to the app's real default theme "sunset" so the full --agent-*
// token set is defined.
//
// Dize-only, read-only. Nothing applied. Drawers/modals excluded.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { MagnifyingGlass, X, CaretDown } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

// The exact cf-* styles from CommsActivityFeed's inline <style>, so BEFORE renders faithfully.
const CF_STYLES = `
  .cf-rail { background:var(--agent-surface-glass); border:1px solid var(--agent-border-subtle); border-radius:14px; padding:5px; }
  .cf-sec { border-bottom:1px solid var(--agent-border-subtle); }
  .cf-sec:last-child { border-bottom:none; }
  .cf-sec-hdr { display:flex; align-items:center; justify-content:space-between; padding:11px 10px; cursor:pointer; font-size:12px; font-weight:700; color:var(--agent-text-primary); border-radius:8px; transition:background-color .14s ease; user-select:none; }
  .cf-sec-hdr:hover { background-color:var(--agent-hover-tint); }
  .cf-sec .cf-caret { color:var(--agent-text-muted); transition:transform .22s cubic-bezier(.4,0,.2,1); }
  .cf-badge { font-size:10px; font-weight:700; color:#fff; background:var(--agent-coral); border-radius:999px; min-width:16px; height:16px; padding:0 5px; display:inline-flex; align-items:center; justify-content:center; font-variant-numeric:tabular-nums; }
  .cf-row { display:flex; align-items:center; gap:10px; width:100%; text-align:left; padding:7px 9px; border:none; background:none; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; color:var(--agent-text-primary); cursor:pointer; transition:background-color .14s ease, box-shadow .14s ease; }
  .cf-row:hover { background-color:var(--agent-hover-tint); box-shadow:var(--agent-hover-lift); }
  .cf-chk { width:17px; height:17px; border-radius:5px; border:1.5px solid var(--agent-border-strong); flex-shrink:0; position:relative; transition:background-color .18s ease, border-color .18s ease, transform .18s cubic-bezier(.34,1.56,.64,1); }
  .cf-chk svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .cf-chk svg path { fill:none; stroke:#fff; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:18; stroke-dashoffset:18; transition:stroke-dashoffset .24s ease .04s; }
  .cf-row[data-on="true"] .cf-chk { background:var(--agent-coral); border-color:var(--agent-coral); transform:scale(1.06); }
  .cf-row[data-on="true"] .cf-chk svg path { stroke-dashoffset:0; }
  .cf-search { display:flex; align-items:center; gap:9px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:11px; padding:10px 13px; transition:border-color .14s ease, box-shadow .14s ease; }
  .cf-search:hover { border-color:var(--agent-coral); }
  .cf-search:focus-within { border-color:var(--agent-coral-deep); }
  .cf-search-ico { color:var(--agent-text-muted); flex-shrink:0; }
  .cf-search-input { flex:1; min-width:0; border:none; background:none; outline:none; font-family:inherit; font-size:13.5px; color:var(--agent-text-primary); }
  .cf-search-input::placeholder { color:var(--agent-text-muted); }
  .cf-search-clear { border:none; background:none; cursor:pointer; color:var(--agent-text-muted); display:inline-flex; align-items:center; justify-content:center; padding:3px; border-radius:6px; }
  .cf-count { font-size:11.5px; color:var(--agent-text-muted); font-variant-numeric:tabular-nums; }
`;

type Cls = "A" | "B" | "C" | "D";
const CLS: Record<Cls, { label: string; fg: string }> = {
  A: { label: "COMPLIANT — already canonical", fg: "#15803d" },
  B: { label: "ALIGN — swap to canonical", fg: "#b45309" },
  C: { label: "REGISTER — keep as-is, make it canonical", fg: "#b91c1c" },
  D: { label: "KEEP — intentional", fg: "#6d28d9" },
};
function Tag({ k }: { k: Cls }) {
  const t = CLS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: `${t.fg}1e`, border: `1px solid ${t.fg}55`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Stage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div style={{ background: "var(--stage-bg)", borderRadius: 14, border: "1px solid var(--stage-line)", padding: 20, minHeight: 60, display: "flex", alignItems: "center", justifyContent: wide ? "flex-start" : "center", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", overflowX: "auto" }}><div style={{ width: wide ? "100%" : "auto", maxWidth: "100%" }}>{children}</div></div>;
}
function Lbl({ kind }: { kind: "before" | "after" | "both" }) {
  const m = { before: { t: "Before — shipped now", c: "var(--compare-muted)" }, after: { t: "After — canonical", c: CORAL }, both: { t: "Current = canonical — register as-is", c: "#b91c1c" } }[kind];
  return <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: m.c, marginBottom: 7 }}>{m.t}</span>;
}
function Spec({ n, title, cls, verdict, before, after, both, wide }: { n: string; title: string; cls: Cls; verdict: ReactNode; before?: ReactNode; after?: ReactNode; both?: ReactNode; wide?: boolean }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag k={cls} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 900 }}>{verdict}</p>
      {both !== undefined ? <div><Lbl kind="both" /><Stage wide={wide}>{both}</Stage></div> : (
        <div style={{ display: wide ? "block" : "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0, marginBottom: wide ? 14 : 0 }}><Lbl kind="before" /><Stage wide={wide}>{before}</Stage></div>
          <div style={{ flex: "1 1 300px", minWidth: 0 }}><Lbl kind="after" /><Stage wide={wide}>{after}</Stage></div>
        </div>
      )}
    </section>
  );
}

/* ---------- current reproductions (real cf-* classes) ---------- */
function CheckRow({ label, on }: { label: string; on?: boolean }) {
  const [checked, setChecked] = useState(!!on);
  return (
    <button type="button" className="cf-row" data-on={checked} onClick={() => setChecked((v) => !v)} style={{ maxWidth: 200 }}>
      <span className="cf-chk" aria-hidden><svg viewBox="0 0 18 18"><path d="M4.5 9.2l2.7 2.7L13.7 5.6" /></svg></span>{label}
    </button>
  );
}
const SearchBefore = () => (
  <div className="cf-search" style={{ width: 340 }}>
    <MagnifyingGlass size={16} weight="regular" className="cf-search-ico" />
    <input className="cf-search-input" placeholder="Search by address" defaultValue="" />
    <button className="cf-search-clear" aria-label="Clear"><X size={13} weight="bold" /></button>
  </div>
);
const SearchAfter = () => (
  <div style={{ position: "relative", width: 340 }}>
    <MagnifyingGlass size={16} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)" }} />
    <input className="agent-input agent-input-sm" placeholder="Search by address" style={{ width: "100%", paddingLeft: 38, fontSize: 13.5, height: 42 }} />
  </div>
);
const ProgressBefore = () => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, width: 150 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Pill glass tone="success" size="sm">Active</Pill><span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>7%</span></div>
    <div style={{ width: 132, height: 4, borderRadius: 999, background: "var(--agent-hero-track, rgba(15,23,42,0.08))", overflow: "hidden" }}><div style={{ width: "7%", height: "100%", borderRadius: 999, background: "var(--agent-coral)" }} /></div>
    <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)", textAlign: "right" }}>Onboarding · about 12 weeks to exchange</span>
  </div>
);
// Activity row — Tailwind text sizes + UPPERCASE meta label.
const ActivityBefore = () => (
  <div className="flex items-start gap-3 px-4 py-3" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
    <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(16,185,129,0.15)", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>JB</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p className="text-[13px] font-medium" style={{ fontSize: 13, fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.4, margin: 0 }}>Jackie Bradding confirmed her solicitor has been instructed</p>
      <p className="text-[10.5px]" style={{ fontSize: 10.5, color: "var(--agent-text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.04em" }}>Shared with client</p>
      <p className="text-[11px]" style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2 }}>22h ago</p>
    </div>
  </div>
);
const ActivityAfter = () => (
  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
    <span style={{ width: 26, height: 26, borderRadius: 999, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(16,185,129,0.15)", color: "#16a34a", fontSize: 11, fontWeight: 700 }}>JB</span>
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: "var(--agent-text-body, 13px)", fontWeight: 500, color: "var(--agent-text-primary)", lineHeight: 1.4, margin: 0 }}>Jackie Bradding confirmed her solicitor has been instructed</p>
      <p className="agent-eyebrow" style={{ margin: "2px 0 0" }}>Shared with client</p>
      <p style={{ fontSize: 11, color: "var(--agent-text-muted)", margin: "2px 0 0" }}>22h ago</p>
    </div>
  </div>
);

const INVENTORY: { item: string; cls: Cls; verdict: string }[] = [
  { item: "PageHeader", cls: "A", verdict: "Shared page-header primitive" },
  { item: "Day group bar (Yesterday · N updates)", cls: "A", verdict: "Canonical SectionDisclosure" },
  { item: "Status pill (Active)", cls: "A", verdict: "Canonical Pill (tone success)" },
  { item: "Property thumb", cls: "A", verdict: "Canonical PropertyThumb" },
  { item: "Actor / user avatars", cls: "A", verdict: "Canonical Avatar" },
  { item: "File card shell", cls: "A", verdict: "agent-glass + canonical parts — compliant" },
  { item: "Filter rail section header", cls: "A", verdict: "Token-based cf-sec-hdr + agent-acc — compliant" },
  { item: "Footer count + Clear link", cls: "A", verdict: "Canonical agent-link-muted" },
  { item: "Empty states (filtered / onboarding)", cls: "A", verdict: "Canonical empty-card / CommsEmptyState" },
  { item: "Search bar", cls: "B", verdict: "cf-search → canonical agent-input search" },
  { item: "Filter count badge", cls: "B", verdict: "cf-badge → canonical Pill (brand tone)" },
  { item: "Mobile filter dropdown", cls: "B", verdict: "cf-dd-btn → canonical dropdown / AnchoredPanel trigger" },
  { item: "Activity row text + meta label", cls: "B", verdict: "Tailwind text-[Npx] → tokens; UPPERCASE label → agent-eyebrow" },
  { item: "Filter checkbox (stroke-in tick)", cls: "C", verdict: "Register cf-chk as a canonical FilterCheckbox (or align to arc Checkbox)" },
  { item: "Progress bar (linear %)", cls: "C", verdict: "Register as a canonical ProgressBar (sibling of ProgressRing)" },
  { item: "loading.tsx skeleton", cls: "A", verdict: "Canonical Skeleton" },
];

export default function CommsComparePage() {
  const restore = useRef<string | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const themeAttr = theme === "light" ? "sunset" : "dark";
  useEffect(() => { const h = document.documentElement; if (restore.current === null) restore.current = h.getAttribute("data-theme"); h.setAttribute("data-theme", themeAttr); }, [themeAttr]);
  useEffect(() => () => { const h = document.documentElement; if (restore.current) h.setAttribute("data-theme", restore.current); else h.removeAttribute("data-theme"); }, []);

  const vars: CSSProperties = {
    ["--compare-ink" as string]: theme === "dark" ? "#f1ece6" : "#20242E",
    ["--compare-body" as string]: theme === "dark" ? "rgba(241,236,230,0.70)" : "#5b5349",
    ["--compare-muted" as string]: theme === "dark" ? "rgba(241,236,230,0.55)" : "#9a938a",
    ["--compare-faint" as string]: theme === "dark" ? "rgba(241,236,230,0.4)" : "#b3a99d",
    ["--compare-line" as string]: theme === "dark" ? "rgba(255,255,255,0.09)" : "#e7e2db",
    ["--compare-bg" as string]: theme === "dark" ? "#17140f" : "#F4F2EF",
    ["--stage-bg" as string]: theme === "dark" ? "#201b14" : "#ffffff",
    ["--stage-line" as string]: theme === "dark" ? "rgba(255,255,255,0.08)" : "rgba(23,23,30,0.07)",
  };
  const tog = (a: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: a ? CORAL : "transparent", color: a ? "#fff" : "var(--compare-body)" });
  const counts = INVENTORY.reduce((a, r) => { a[r.cls] = (a[r.cls] ?? 0) + 1; return a; }, {} as Record<Cls, number>);

  return (
    <div className="agent-shell-root nv2-night" data-theme={themeAttr} style={{ ...vars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <style>{CF_STYLES}</style>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Compare · Updates (/agent/comms)</span>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>Updates — canonical alignment</h1>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 820 }}>
          One component per row, clean like the gallery. This page is already fairly canonical (Pill, PropertyThumb, Avatar, SectionDisclosure). <b style={{ color: CLS.B.fg }}>Before</b> = real shipped. <b style={{ color: CLS.B.fg }}>After</b> = real canonical. <b style={{ color: CLS.C.fg }}>Register</b> = keep, make official.
        </p>

        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "11px 16px", background: "var(--stage-bg)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>{INVENTORY.length} components</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}><b style={{ color: CLS.A.fg }}>{counts.A ?? 0} compliant</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} register</b></span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {INVENTORY.map((r) => (
                  <tr key={r.item} style={{ borderTop: "1px solid var(--compare-line)" }}>
                    <td style={{ padding: "7px 16px", color: "var(--compare-ink)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.item}</td>
                    <td style={{ padding: "7px 16px" }}><span style={{ color: CLS[r.cls].fg, fontWeight: 700 }}>{r.cls}</span></td>
                    <td style={{ padding: "7px 16px", color: "var(--compare-body)" }}>{r.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <Spec n="1" title="Search bar" cls="B" verdict={<>Bespoke <code>cf-search</code> (inline-styled) → the canonical <code>agent-input</code> search. Same leading magnifier + clear.</>} before={<SearchBefore />} after={<SearchAfter />} />
        <Spec n="2" title="Filter count badge" cls="B" verdict={<>The little coral number on an active filter group (<code>cf-badge</code>) → the canonical <code>Pill</code> (brand tone, small).</>}
          before={<span className="cf-badge">3</span>} after={<Pill tone="brand" size="sm">3</Pill>} />
        <Spec n="3" title="Activity row — text + meta label" cls="B" verdict={<>The feed line uses hardcoded Tailwind sizes (<code>text-[13px]</code>, <code>text-[10.5px]</code>) and an <strong>ALL-CAPS</strong> &ldquo;Shared with client&rdquo; label. Proposed: token font sizes + the canonical sentence-case <code>agent-eyebrow</code> for the meta label.</>}
          before={<div style={{ width: 340 }}><ActivityBefore /></div>} after={<div style={{ width: 340 }}><ActivityAfter /></div>} />
        <Spec n="4" title="Filter checkbox (stroke-in tick)" cls="C" verdict={<>The rail checkbox — an empty rounded box whose tick <strong>strokes itself in</strong> and the box springs on check (coral fill). A lovely control. Register <code>cf-chk</code> as a canonical FilterCheckbox (or align to the arc Checkbox). Click it.</>}
          both={<div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 200 }}><CheckRow label="Steps" on /><CheckRow label="Price" /><CheckRow label="Replies" /></div>} />
        <Spec n="5" title="Progress bar (linear %)" cls="C" verdict={<>The file snapshot&apos;s status pill + percent + thin coral bar. We have a canonical ProgressRing but no linear bar — register this as a canonical <code>ProgressBar</code>.</>}
          both={<ProgressBefore />} />
        <Spec n="6" title="Day group bar" cls="A" verdict={<>&ldquo;Yesterday · 1 update&rdquo; is the canonical <code>SectionDisclosure</code> (shim-coupled; a representative row shown). Compliant — no change.</>}
          both={<div style={{ width: 460, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderRadius: 12, border: "1px solid var(--agent-border-subtle)", background: "var(--agent-surface-glass)" }}><span style={{ fontSize: 13, fontWeight: 650, color: "var(--agent-text-primary)" }}>Yesterday</span><span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--agent-text-muted)" }}>1 update <CaretDown size={13} weight="bold" /></span></div>} />
        <Spec n="7" title="File snapshot — status pill + thumb" cls="A" verdict={<>The card header already composes the canonical <code>Pill</code> (Active) + <code>PropertyThumb</code>. Shown live. No change.</>}
          both={<div style={{ display: "flex", alignItems: "center", gap: 12, width: 460 }}><PropertyThumb photoUrl={null} size={48} /><div style={{ flex: 1 }}><span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>24 Emerton Garth</span><span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)" }}>Northchurch · HP4 3XJ</span></div><Pill glass tone="success" size="sm">Active</Pill></div>} />
      </div>
    </div>
  );
}

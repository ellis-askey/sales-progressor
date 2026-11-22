"use client";

// AUTOMATED EMAILS — SIGN-OFF RESIDUALS (/agent/automated-emails)
//
// A fresh deep-tree audit of the ALREADY-migrated page. Everything here is what's
// STILL not canonical — the gap between "pain points fixed" and "every nested
// component is canonical". BEFORE = real shipped code, byte-for-byte. AFTER =
// real canonical (or a labelled proposal). Nothing is applied until each item is
// signed off. A page only joins SIGNED_OFF when this list is empty (every item
// resolved to A = migrate, or D = deliberate exception).
//
// Light maps to the app default theme "sunset" so every --agent-* token resolves.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Pill } from "@/components/ui/Pill";
import { Select } from "@/components/ui/Select";
import { StatBlock } from "@/components/ui/StatBlock";
import { StatNumber } from "@/components/ui/StatNumber";
import { CountBadge } from "@/components/ui/CountBadge";
import { DownloadSimple, Pause, Warning, Check, CaretRight, CheckCircle } from "@phosphor-icons/react";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

type Cls = "B" | "C" | "D" | "BUG";
const CLS: Record<Cls, { label: string; fg: string }> = {
  B: { label: "ALIGN — swap to canonical", fg: "#b45309" },
  C: { label: "REGISTER / RECONCILE", fg: "#b91c1c" },
  D: { label: "CONFIRM — intentional", fg: "#6d28d9" },
  BUG: { label: "BUG — migration defect", fg: "#be123c" },
};
function Tag({ k }: { k: Cls }) {
  const t = CLS[k];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.02em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: `${t.fg}1e`, border: `1px solid ${t.fg}55`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Stage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <div style={{ background: "var(--stage-bg)", borderRadius: 14, border: "1px solid var(--stage-line)", padding: 20, minHeight: 56, display: "flex", alignItems: "center", justifyContent: wide ? "flex-start" : "center", boxShadow: "0 1px 3px rgba(30,20,15,0.05)", overflowX: "auto" }}><div style={{ width: wide ? "100%" : "auto", maxWidth: "100%" }}>{children}</div></div>;
}
function Lbl({ kind }: { kind: "before" | "after" | "both" }) {
  const m = { before: { t: "Now — on the live page", c: "var(--compare-muted)" }, after: { t: "Proposed", c: CORAL }, both: { t: "What it looks like now", c: "var(--compare-muted)" } }[kind];
  return <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: m.c, marginBottom: 7 }}>{m.t}</span>;
}
function Spec({ n, title, cls, verdict, before, after, both, wide, proposed }: { n: string; title: string; cls: Cls; verdict: ReactNode; before?: ReactNode; after?: ReactNode; both?: ReactNode; wide?: boolean; proposed?: boolean }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "22px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        <Tag k={cls} />
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.5, maxWidth: 940 }}>{verdict}</p>
      {both !== undefined ? <div><Lbl kind="both" /><Stage wide={wide}>{both}</Stage></div> : (
        <div style={{ display: wide ? "block" : "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0, marginBottom: wide ? 14 : 0 }}><Lbl kind="before" /><Stage wide={wide}>{before}</Stage></div>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}><Lbl kind="after" /><Stage wide={wide}>{after}{proposed && <span style={{ display: "block", marginTop: 10, fontSize: 10, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#b91c1c" }}>Proposed new canonical — not approved</span>}</Stage></div>
        </div>
      )}
    </section>
  );
}

const ROW_BORDER = "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))";
const PANEL_H2: CSSProperties = { margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" };

/* ───────── BEFORE reproductions (byte-for-byte) ───────── */

// B1 — native select (verbatim)
function SelectNow() {
  return (
    <select className="agent-input agent-input-sm" aria-label="Email type" defaultValue="" style={{ width: "auto", flex: "0 1 auto" }}>
      <option value="">All types</option><option>Chase</option><option>Notification</option>
    </select>
  );
}
// B2 — export icon inline svg (verbatim)
const ExportIconNow = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>;
// B3/B4 — segment-pill as action button (verbatim)
const LoadMoreNow = () => <button type="button" className="agent-segment-pill agent-segment-pill-sm">Load more</button>;
// B5 — filtered-to glass pill (verbatim)
const FilteredNow = () => <Pill glass tone="muted" size="sm" style={{ gap: 6 }}>Filtered to: 24 Emerton Garth <span className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear</span></Pill>;
// B6/StatTile/Tile — bespoke stat group (verbatim Chase Tile)
const TileNow = () => (
  <div>
    <p className="agent-eyebrow" style={{ margin: 0, marginBottom: 2 }}>Response rate</p>
    <StatNumber size="sm">68%</StatNumber>
    <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>of chases replied to</p>
  </div>
);
// BUG — Banner stat: StatBlock wrapping a StatNumber (p-in-p)
const BannerStatBug = () => (
  <div style={{ padding: "0 20px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
    <StatBlock eyebrow="Queued ahead" value={<StatNumber size="sm">8</StatNumber>} sub="Next Fri 27 Nov" />
  </div>
);
// R4 — banner state icons inline svg (verbatim, healthy)
const BannerIconNow = () => <span style={{ color: "var(--agent-success)" }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg></span>;
// R1 — chart tooltip (verbatim, inline .ui-chart-tip)
const ChartTipNow = () => (
  <div className="ui-chart-tip" style={{ padding: "8px 11px", fontSize: 12, maxWidth: 200 }}>
    <p style={{ margin: 0, fontWeight: 600, color: "var(--agent-text-primary)" }}>12 Nov</p>
    <p style={{ margin: "2px 0 0", color: "var(--agent-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--agent-coral)", display: "inline-block" }} />Chase: <strong style={{ color: "var(--agent-text-primary)" }}>9</strong></p>
    <p style={{ margin: "2px 0 0", color: "var(--agent-text-secondary)", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--agent-info)", display: "inline-block" }} />Notification: <strong style={{ color: "var(--agent-text-primary)" }}>3</strong></p>
    <p style={{ margin: "4px 0 0", color: "var(--agent-text-muted)" }}>Total 12</p>
  </div>
);
// C1 — panel header (verbatim, Needs attention)
const PanelHeaderNow = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, width: 300 }}>
    <h2 style={PANEL_H2}>Needs attention</h2>
    <CountBadge count={3} tone="danger" />
    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--agent-text-muted)" }}>Across 2 files</span>
  </div>
);
// C2 — feed-row shell + missing-email row (verbatim)
const MissingRowNow = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--agent-radius-md, 8px)", border: ROW_BORDER, background: "var(--agent-surface-glass)", width: "100%" }}>
    <Pill tone="warning" size="sm" outline>Missing</Pill>
    <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>Mr Ewu · Buyer</span>
    <span style={{ fontSize: 12, color: "var(--agent-text-muted)", flex: 1 }}>75 Upper Belmont Road</span>
    <span className="agent-link" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>Add email</span>
  </div>
);
// C3 — group header (verbatim)
const GroupHeaderNow = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "0 2px", width: 360 }}>
    <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>Chasing now</h2>
    <CountBadge count={18} tone="accent" hideZero={false} />
    <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--agent-text-muted)" }}>on their own · next run <b style={{ color: "var(--agent-text-secondary)" }}>Tomorrow</b></span>
  </div>
);
// C4 — all-set / paused disclosure (verbatim)
const QuietDisclosureNow = () => (
  <div className="agent-glass agent-hover-row" style={{ borderRadius: 14, overflow: "hidden", width: "100%" }}>
    <button type="button" style={{ width: "100%", background: "none", border: 0, cursor: "pointer", padding: "12px 15px", display: "flex", alignItems: "center", gap: 12, textAlign: "left", color: "inherit", font: "inherit" }}>
      <CheckCircle size={20} weight="fill" style={{ color: "var(--agent-success, #16a34a)", flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)" }}>20 sales fully covered</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>Every contact present, chasing on, nothing overdue. Tap to expand.</div>
      </div>
      <CaretRight size={16} weight="bold" style={{ marginLeft: "auto", color: "var(--agent-text-muted)", flexShrink: 0 }} />
    </button>
  </div>
);
// C5 — StatusPill (glass tint) reproduced
const StatusPillNow = () => <Pill glass tone="warning" size="sm"><CaretRight size={11} weight="bold" /> Sends Tue 24 Nov</Pill>;
// C-tab — glass tab chip + track (verbatim, representative)
function TabChipNow() {
  return (
    <div style={{ display: "inline-flex", gap: 3, padding: 4, borderRadius: 12, background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-subtle)" }}>
      {[["Schedule", 65, false], ["History", 338, true], ["Problems", 0, false]].map(([l, n, on]) => (
        <span key={l as string} className="agent-tab-chip" data-on={on} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 600 }}>
          {l as string}<CountBadge count={n as number} tone={on ? "accent" : "muted"} soft={!on} hideZero={false} />
        </span>
      ))}
    </div>
  );
}
// R7 — hardcoded indigo swatch
const IndigoNow = () => <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--agent-text-secondary)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "#6366f1" }} /><b>1</b> Opted out <code style={{ fontSize: 11, color: "var(--compare-muted)" }}>#6366f1</code></span>;

/* ───────── proposed helpers ───────── */
function PanelHeaderNext({ title, badge, meta }: { title: string; badge?: ReactNode; meta?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: 300 }}>
      <h2 style={PANEL_H2}>{title}</h2>
      {badge}
      {meta && <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--agent-text-muted)" }}>{meta}</span>}
    </div>
  );
}

const INVENTORY: { item: string; cls: Cls; verdict: string }[] = [
  { item: "Top 4 numbers (health banner)", cls: "BUG", verdict: "Built wrong underneath (my earlier mistake). Invisible fix." },
  { item: "3 filter dropdowns (Schedule tab)", cls: "B", verdict: "Plain grey browser dropdowns → our own styled one. Visible." },
  { item: "Download icon (Export button)", cls: "B", verdict: "Hand-drawn arrow → our standard icon. Barely visible." },
  { item: "'Load more' / 'Show all' buttons", cls: "B", verdict: "Wearing the 'selected tab' look → normal button look. Visible." },
  { item: "'Filtered to:' tag", cls: "B", verdict: "Still has the soft fill → outline only. Visible." },
  { item: "The 'label + big number + note' blocks", cls: "B", verdict: "Hand-made in 3 places → the same one the banner uses. ~Invisible." },
  { item: "Health-banner status icon", cls: "B", verdict: "Hand-drawn → our standard icon. Barely visible." },
  { item: "'Opted out' colour (coverage)", cls: "B", verdict: "One-off purple → an official colour. ~Invisible." },
  { item: "Chart hover pop-up", cls: "B", verdict: "Renders blurry/see-through-wrong → the proper version. Visible." },
  { item: "Card title rows (×5)", cls: "C", verdict: "Each card draws its own title, already drifting → one shared title." },
  { item: "The row frame (×3)", cls: "C", verdict: "The bordered strip each email/file sits in is copy-pasted → one shared frame." },
  { item: "By-sale section headers (×4)", cls: "C", verdict: "Hand-made header used 4× → one shared header." },
  { item: "'Tap to expand' bars (×2)", cls: "C", verdict: "Written out twice → combine into one." },
  { item: "The tab bar", cls: "C", verdict: "Only exists on this page → make it reusable, or leave page-only." },
  { item: "By-sale status tags", cls: "C", verdict: "Still have the soft fill (shared with other pages) → de-tint or keep." },
  { item: "The thin divider lines", cls: "C", verdict: "Hand-made + slightly inconsistent → one official hairline." },
  { item: "Leftover old code", cls: "C", verdict: "Unused code from a removed panel → delete. Invisible." },
  { item: "Activity chart", cls: "D", verdict: "A normal bar chart (our standard) — confirm it stays." },
  { item: "Email-preview box (By-sale)", cls: "D", verdict: "Shows a real email, so uses email colours — confirm it stays." },
  { item: "'All agency / Mine only' toggle", cls: "D", verdict: "Uses the tab look — correct, it IS a toggle — confirm." },
];

export default function AutoEmailsSignoffPage() {
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
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={tog(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={tog(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Sign-off residuals · Automated emails</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>Automated emails — what's left before sign-off</h1>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 860 }}>
          Yes — this is <b>the canonicals inside the canonicals</b>. When we fixed this page, the big, obvious parts got sorted. But a card can be built from our proper parts and still have small <b>hand-made bits buried inside it</b>: a little number, a title line, a hairline, a dropdown. Those inner bits are what&rsquo;s left. You thought it was done, and the top layer was — this is the layer underneath.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 860 }}>
          Each one is one of three things: <b style={{ color: CLS.B.fg }}>Align</b> = a quick swap to a part we already have (some you&rsquo;ll see, some you won&rsquo;t). <b style={{ color: CLS.C.fg }}>Register</b> = a hand-made thing that&rsquo;s repeated, which we&rsquo;d turn into one proper shared part first. <b style={{ color: CLS.D.fg }}>Confirm</b> = it&rsquo;s fine on purpose, just needs your nod. Each row says plainly what it is and whether you&rsquo;ll <i>see</i> a change.
        </p>

        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "11px 16px", background: "var(--stage-bg)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>{INVENTORY.length} residuals</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}><b style={{ color: CLS.BUG.fg }}>{counts.BUG ?? 0} bug</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} register</b> · <b style={{ color: CLS.D.fg }}>{counts.D ?? 0} confirm-D</b></span>
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

        <Spec n="1" title="Top 4 numbers (health banner) — built wrong underneath" cls="BUG"
          verdict={<>The four numbers across the top of the page — Sent today, Queued ahead, Need attention, Files monitored. When I did the earlier work I accidentally wrapped each number in two layers of the same styling. It still <i>looks</i> right, but underneath it&rsquo;s built wrong (two number-boxes stacked inside each other), which can glitch. The fix is <b>invisible</b> — exact same number, just built properly.</>}
          before={<BannerStatBug />} after={<div style={{ padding: "0 20px" }}><StatBlock eyebrow="Queued ahead" value="8" sub="Next Fri 27 Nov" /></div>} proposed />

        <Spec n="2" title="Filter dropdowns" cls="B"
          verdict={<>The three dropdowns on the Schedule tab — All types / All recipients / All statuses. Right now when you click one you get the plain grey operating-system menu, which doesn&rsquo;t match our look. We&rsquo;ve since built our own styled dropdown; this swaps them to it (works exactly the same). <b>Visible</b> when you open one.</>}
          before={<SelectNow />} after={<div style={{ width: 160 }}><Select options={[{ value: "", label: "All types" }, { value: "chase", label: "Chase" }, { value: "notification", label: "Notification" }]} value="" onChange={() => {}} placeholder="All types" fullWidth height={40} radius={8} /></div>} />

        <Spec n="3" title="Export icon" cls="B"
          verdict={<>The little download arrow on the Export button. It&rsquo;s hand-drawn rather than taken from our standard icon set, so it can sit slightly off. Swap to the matching standard icon. <b>Barely noticeable.</b></>}
          before={<button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ gap: 6 }}><ExportIconNow /> Export</button>}
          after={<button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ gap: 6 }}><DownloadSimple size={14} weight="bold" aria-hidden /> Export</button>} />

        <Spec n="4" title="'Load more' / 'Show all' buttons" cls="B"
          verdict={<>The &ldquo;Load more&rdquo; and &ldquo;Show all&rdquo; buttons are built from our <i>tab</i> style — the thing that shows which tab is currently selected. Putting a &ldquo;this is selected&rdquo; look on a button you click to <i>do</i> something sends the wrong signal. Change them to look like our normal buttons (same as Export, View file, Pause). <b>Visible.</b> (The &ldquo;All agency / Mine only&rdquo; toggle keeps the tab look on purpose — that one really is a pick-one toggle.)</>}
          before={<LoadMoreNow />} after={<button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered">Load more</button>} />

        <Spec n="5" title="'Filtered to:' tag" cls="B"
          verdict={<>When you filter to one property, a little &ldquo;Filtered to: [address]&rdquo; tag appears. It still has the soft coloured fill you asked us to stop using. This removes the fill (outline only), matching the chips we already cleaned up on this page. <b>Visible.</b></>}
          before={<FilteredNow />} after={<Pill tone="muted" size="sm" outline style={{ gap: 6 }}>Filtered to: 24 Emerton Garth <span className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear</span></Pill>} />

        <Spec n="6" title="The 'label + big number + note' blocks" cls="B"
          verdict={<>The little &ldquo;small label + big number + note&rdquo; blocks — e.g. &ldquo;Emails sent / 338&rdquo; in the trend chart, and &ldquo;Response rate / 68%&rdquo; in the Insights tab. There&rsquo;s a proper reusable version of this block (the top banner already uses it), but these ones are <b>hand-made copies</b> — so there are two slightly different versions of the same thing on one page. This makes them all use the one proper version, so they can never drift apart. <b>You won&rsquo;t really see a difference</b> — it&rsquo;s about them being the same part underneath.</>}
          before={<div style={{ width: 180 }}><TileNow /></div>}
          after={<div style={{ width: 180 }}><StatBlock eyebrow="Response rate" value="68%" sub="of chases replied to" /></div>} proposed />

        <Spec n="7" title="Banner state icons" cls="B"
          verdict={<>The icon inside the health banner at the very top — the tick when everything&rsquo;s fine, or a warning triangle / pause bars in the other states. These are hand-drawn rather than from our standard icon set. Swap to the matching standard icons, coloured exactly as now. <b>Tiny change.</b></>}
          before={<BannerIconNow />}
          after={<span style={{ display: "flex", gap: 14, color: "var(--agent-success)" }}><Check size={26} weight="bold" /><span style={{ color: "var(--agent-warning)" }}><Warning size={26} /></span><Pause size={26} weight="fill" /></span>} />

        <Spec n="8" title="Coverage 'Opted out' colour" cls="B"
          verdict={<>The small purple square in the Coverage legend next to &ldquo;Opted out&rdquo; (and the matching slice of the ring). Its purple is a one-off hard-coded colour instead of one from our colour system — so it can&rsquo;t adapt (e.g. in dark mode) and isn&rsquo;t &ldquo;official.&rdquo; Make it an official colour. <b>You likely won&rsquo;t notice.</b></>}
          before={<IndigoNow />}
          after={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--agent-text-secondary)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: "var(--agent-info)" }} /><b>1</b> Opted out <code style={{ fontSize: 11, color: "var(--compare-muted)" }}>var(--agent-info)</code></span>} />

        <Spec n="9" title="Chart hover pop-up" cls="B"
          verdict={<>The little box that pops up when you hover over the activity chart. Because of how it&rsquo;s built, it renders slightly see-through / blurry-wrong against the card behind it. We have a proper version that fixes exactly this (other charts already use it). Same content, renders crisp. <b>Visible when you hover.</b></>}
          before={<ChartTipNow />}
          after={<div style={{ textAlign: "center" }}><ChartTipNow /><span style={{ display: "block", marginTop: 8, fontSize: 11, color: "var(--compare-muted)" }}>same content, rendered via ChartTipPortal (portals to body)</span></div>} />

        <Spec n="10" title="Card titles — the same one hand-made ×5" cls="C"
          verdict={<>The title line at the top of each little card — &ldquo;Needs attention,&rdquo; &ldquo;Still to send today,&rdquo; &ldquo;Automation coverage,&rdquo; and so on. Right now every card draws its own title by hand, and they&rsquo;ve <b>already started to drift</b> (one is a slightly different size). There&rsquo;s no shared &ldquo;card title&rdquo; part because we never made one. <b>Decision:</b> make one official card title and use it everywhere so they can&rsquo;t drift, or leave them hand-made.</>}
          both={<div style={{ display: "flex", flexDirection: "column", gap: 10 }}><PanelHeaderNow /><PanelHeaderNext title="Still to send today" badge={<CountBadge count={8} tone="accent" />} /><PanelHeaderNext title="Automation coverage" /></div>} proposed />

        <Spec n="11" title="The row frame — copy-pasted ×3" cls="C" wide
          verdict={<>The bordered strip that each email / file sits inside (the row &ldquo;frame&rdquo;). The exact same frame is copy-pasted in three places. The stuff <i>inside</i> each row is already proper — it&rsquo;s just the frame that isn&rsquo;t a shared part. <b>Decision:</b> make the frame one official part, or leave the copies. (Shown below: the &ldquo;missing email&rdquo; row, which is entirely hand-made.)</>}
          both={<MissingRowNow />} proposed />

        <Spec n="12" title="By-sale section headers ×4" cls="C" wide
          verdict={<>The section headers in the By-sale tab — &ldquo;Needs you,&rdquo; &ldquo;Chasing now · 18,&rdquo; &ldquo;All set · 20.&rdquo; Same story as the card titles: a hand-made header used in four places rather than one shared part. <b>Decision:</b> make it official, or leave it.</>}
          both={<GroupHeaderNow />} proposed />

        <Spec n="13" title="'Tap to expand' bars ×2" cls="C" wide
          verdict={<>The expandable &ldquo;X sales fully covered — tap to expand&rdquo; bars in the By-sale tab. The exact same thing is written out twice (once for &ldquo;all set,&rdquo; once for &ldquo;paused&rdquo;). <b>Decision:</b> combine into one piece so there&rsquo;s no duplicate, or leave it. Invisible either way.</>}
          both={<QuietDisclosureNow />} proposed />

        <Spec n="14" title="The tab bar" cls="C" wide
          verdict={<>The tab bar I built for you (Schedule / History / Problems / …). It looks good and you approved it — but it&rsquo;s built with a style that only exists on this one page, so it&rsquo;s not a reusable &ldquo;official&rdquo; part yet. <b>Decision:</b> make it official so other pages can reuse it, or leave it page-specific. No visual change either way.</>}
          both={<TabChipNow />} proposed />

        <Spec n="15" title="By-sale status tags" cls="C"
          verdict={<>The little status tags in the By-sale tab — &ldquo;Sends Tue 24 Nov,&rdquo; &ldquo;Needs you.&rdquo; These still have the soft coloured fill. They&rsquo;re a shared tag used on other pages too (Reminders, the file page), so changing them here would change them there as well. <b>Decision:</b> keep them as-is (a recognised shared tag, fill and all), or strip the fill to match the de-tinting we did on this page.</>}
          before={<StatusPillNow />} after={<span style={{ display: "inline-flex", gap: 14, alignItems: "center" }}><Pill tone="warning" size="sm" outline><CaretRight size={11} weight="bold" /> Sends Tue 24 Nov</Pill></span>} />

        <Spec n="16" title="The thin divider lines" cls="C"
          verdict={<>The thin hairline lines that separate rows inside cards. They&rsquo;re hand-made and very slightly inconsistent (a touch fainter in some places than others). <b>Decision:</b> make one official hairline used everywhere, or leave it. Barely visible either way.</>}
          both={<div style={{ width: 300 }}><div style={{ fontSize: 12, color: "var(--agent-text-muted)", paddingBottom: 10, borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))" }}>row A (α 0.07)</div><div style={{ fontSize: 12, color: "var(--agent-text-muted)", padding: "10px 0", borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.08))" }}>row B (α 0.08)</div></div>} />

        <Spec n="17" title="Leftover old code" cls="C"
          verdict={<>Some leftover code for an old &ldquo;automation exhausted&rdquo; panel that was removed weeks ago. It&rsquo;s not shown anywhere — it&rsquo;s just sitting there unused. <b>Proposal:</b> delete it. Completely invisible to you; it&rsquo;s housekeeping.</>}
          both={<span style={{ fontSize: 13, color: "var(--compare-muted)", fontStyle: "italic" }}>Nothing to render — it&rsquo;s unreferenced code. Proposal: remove it.</span>} />

        <h2 style={{ margin: "34px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: CLS.D.fg }}>Confirm as intentional (D)</h2>
        <Spec n="18" title="Chart · email preview · toggle — confirm these are fine" cls="D"
          verdict={<>Three things I think are correct as-is and just want your nod on: <b>(a)</b> the activity chart is a normal bar chart — that&rsquo;s our standard, nothing to change; <b>(b)</b> the email-preview box in the By-sale tab shows a <i>real</i> email, so it uses email colours rather than app colours — correct; <b>(c)</b> the &ldquo;All agency / Mine only&rdquo; toggle uses the tab look — right, because it genuinely is a pick-one toggle. Confirm these stay as they are.</>}
          both={<span style={{ fontSize: 13, color: "var(--compare-body)" }}>Nothing to change — tick to confirm D, or flag if you disagree.</span>} />
      </div>
    </div>
  );
}

"use client";

// Hub — ROWS & SPLIT-BUTTON compare. The two remaining proposed hub consolidations,
// rendered so they can be judged as pixels, not described in text:
//   N2  the property ROW — four cards hand-roll a near-identical row. Left = each
//       card's shipped row reproduced byte-for-byte; right = the SAME data through
//       one proposed shared HubRow, so every delta a merge would impose is visible.
//   N3  the SPLIT-BUTTON — label action joined to the canonical RowActionMenu caret.
//       Left = the shipped hand-joined markup; right = the extracted HubSplitButton.
//       Both sides mount the REAL RowActionMenu, so "identical" is literal.
// Dev-only, read-only. Nothing here changes production.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CaretDown, House, PaperPlaneTilt, Check, Clock, CalendarPlus, Prohibit, ArrowSquareOut, Lightning } from "@phosphor-icons/react";
import { RowActionMenu, type RowMenuItem } from "@/components/hub/RowActionMenu";
import { HubSplitButton } from "@/components/hub/HubSplitButton";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";
type VW = "desktop" | "tablet" | "mobile";
const VW_W: Record<VW, number | undefined> = { desktop: undefined, tablet: 720, mobile: 380 };
type TagKind = "same" | "change" | "new" | "decision";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  same:     { label: "Byte-identical", fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" },
  change:   { label: "Visible change", fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
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
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed (shared HubRow)" : "Current (shipped)"}</span>
      <div style={{ borderRadius: 16, padding: 18, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)" }}>
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl, 18px)", overflow: "hidden", width: w ? `min(${w}px, 100%)` : "100%", margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}
function Block({ n, title, tags, note, vw, current, proposed }: { n: string; title: string; tags: TagKind[]; note: ReactNode; vw: VW; current: ReactNode; proposed: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current" vw={vw}>{current}</Pane>
        <Pane side="proposed" vw={vw}>{proposed}</Pane>
      </div>
    </section>
  );
}

/* ── Shared atoms (placeholder thumb; the real cards use PropertyThumb) ───────── */
function Thumb() {
  return <span className="hub-thumb-link" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "var(--agent-surface-muted, rgba(45,24,16,0.05))", color: "var(--agent-text-muted)" }}><House size={18} weight="fill" /></span>;
}
function Addr({ full, line, loc, size = 13 }: { full: string; line: string; loc: string; size?: number }) {
  return (
    <span className="hub-addr" data-sensitive="true" style={{ fontSize: size, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}>
      <span className="hub-addr-full">{full}</span>
      <span className="hub-addr-line">{line}</span>
      <span className="hub-addr-loc">{loc}</span>
    </span>
  );
}

/* ── THE PROPOSED shared HubRow (option b) ───────────────────────────────────────
   One row: accent bar on the row itself, left-pad 17px, thumb, body
   {addr · optional toned status text 11/700 · optional meta}, tail {meta-m + actions}.
   Everything a merge would standardise onto lives here. */
function HubRow({ accent, full, line, loc, status, statusColor, meta, metaM, tail }: {
  accent: string | null; full: string; line: string; loc: string;
  status?: string; statusColor?: string; meta?: string; metaM?: ReactNode; tail: ReactNode;
}) {
  return (
    <div className="agent-hover-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px", borderLeft: `3px solid ${accent ?? "transparent"}` }}>
      <Thumb />
      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><Addr full={full} line={line} loc={loc} /></div>
        {status && <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: statusColor, marginTop: 2, lineHeight: 1.3 }}>{status}</span>}
        {meta && <p className="hub-r-meta-d" style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} data-sensitive="true">{meta}</p>}
      </div>
      <div className="hub-r-tail">
        {metaM}
        {tail}
      </div>
    </div>
  );
}

/* ── Dummy menu items so the real RowActionMenu mounts on both sides ──────────── */
const noop = () => {};
const RESUME_ITEMS: RowMenuItem[] = [
  { key: "wk", icon: <Clock size={15} />, title: "Wait another week", onClick: noop },
  { key: "dt", icon: <CalendarPlus size={15} />, title: "Pick a date", onClick: noop },
  { key: "ind", icon: <Prohibit size={15} />, title: "Hold indefinitely", onClick: noop },
  { key: "wd", icon: <Prohibit size={15} />, title: "Withdraw the file", danger: true, onClick: noop },
];
const DONE_ITEMS: RowMenuItem[] = [
  { key: "wk", icon: <Clock size={15} />, title: "Snooze a week", onClick: noop },
  { key: "dt", icon: <CalendarPlus size={15} />, title: "Pick a new date", onClick: noop },
  { key: "open", icon: <ArrowSquareOut size={15} />, title: "Open the file", onClick: noop },
];

export default function HubRowsComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
  const [vw, setVw] = useState<VW>("desktop");
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

  const DANGER = "var(--agent-danger, #C73E3E)";
  const WARN = "var(--agent-warning, #E0942E)";
  const INFO = "var(--agent-info, #3B82C4)";

  /* ── N2-1 — HubListCard (file at risk): the template. ───────────────────── */
  const hl_current = (
    <div className="agent-hover-row" style={{ position: "relative", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px", borderLeft: `3px solid ${DANGER}` }}>
      <Thumb />
      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><Addr full="20 Williamson Way, Pitstone, LU7 9FU" line="20 Williamson Way" loc="Pitstone, LU7 9FU" /></div>
        <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: DANGER, marginTop: 2, lineHeight: 1.3 }}>Ready but frozen</span>
        <p className="hub-r-meta-d" style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ready to exchange since 5 Oct. Nothing has moved in 46 days.</p>
      </div>
      <div className="hub-r-tail">
        <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered hub-r-actions" style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><CaretDown size={12} weight="bold" /> Review</button>
      </div>
    </div>
  );
  const hl_proposed = (
    <HubRow accent={DANGER} full="20 Williamson Way, Pitstone, LU7 9FU" line="20 Williamson Way" loc="Pitstone, LU7 9FU"
      status="Ready but frozen" statusColor={DANGER} meta="Ready to exchange since 5 Oct. Nothing has moved in 46 days."
      tail={<button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered hub-r-actions" style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><CaretDown size={12} weight="bold" /> Review</button>} />
  );

  /* ── N2-2 — StalledEnquiriesCard: accent on an OUTER wrapper div today. ──── */
  const st_current = (
    <div style={{ borderLeft: `3px solid ${WARN}` }}>
      <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
        <Thumb />
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><Addr full="8 Chandler Court, Altrincham, WA14 2PL" line="8 Chandler Court" loc="Altrincham, WA14 2PL" /></div>
          <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: WARN, marginTop: 2, lineHeight: 1.3 }}>Awaiting solicitor reply</span>
          <p className="hub-r-meta-d" style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-secondary)", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>With Dawson Hart · Quiet 11 days</p>
        </div>
        <div className="hub-r-tail">
          <span className="hub-r-meta-m" style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}><span>With Dawson Hart</span><span>Quiet 11 days</span></span>
          <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered hub-r-actions" style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><PaperPlaneTilt size={13} weight="bold" /> Chase</button>
        </div>
      </div>
    </div>
  );
  const st_proposed = (
    <HubRow accent={WARN} full="8 Chandler Court, Altrincham, WA14 2PL" line="8 Chandler Court" loc="Altrincham, WA14 2PL"
      status="Awaiting solicitor reply" statusColor={WARN} meta="With Dawson Hart · Quiet 11 days"
      metaM={<span className="hub-r-meta-m" style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}><span>With Dawson Hart</span><span>Quiet 11 days</span></span>}
      tail={<button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered hub-r-actions" style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}><PaperPlaneTilt size={13} weight="bold" /> Chase</button>} />
  );

  /* ── N2-3 — ExchangeOverdueCard: no status label; address is a direct block. ─ */
  const ex_current = (
    <div style={{ borderLeft: `3px solid ${WARN}` }}>
      <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
        <Thumb />
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <span className="hub-addr" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}>
            <span className="hub-addr-full">14 Priory Gardens, Harrogate, HG1 4RJ</span>
            <span className="hub-addr-line">14 Priory Gardens</span><span className="hub-addr-loc">Harrogate, HG1 4RJ</span>
          </span>
          <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Exchange was 3 Nov · 8 days ago</p>
        </div>
        <div className="hub-r-tail">
          <span className="hub-r-meta-m" style={{ fontSize: 11, color: "var(--agent-text-secondary)", minWidth: 0 }}><span>Exchange was 3 Nov</span><span>8 days ago</span></span>
          <div className="hub-r-actions" style={{ flexShrink: 0 }}>
            <RowActionMenu label="Deal with it" items={RESUME_ITEMS} />
          </div>
        </div>
      </div>
    </div>
  );
  const ex_proposed = (
    <HubRow accent={WARN} full="14 Priory Gardens, Harrogate, HG1 4RJ" line="14 Priory Gardens" loc="Harrogate, HG1 4RJ"
      meta="Exchange was 3 Nov · 8 days ago"
      metaM={<span className="hub-r-meta-m" style={{ fontSize: 11, color: "var(--agent-text-secondary)", minWidth: 0 }}><span>Exchange was 3 Nov</span><span>8 days ago</span></span>}
      tail={<div className="hub-r-actions" style={{ flexShrink: 0 }}><RowActionMenu label="Deal with it" items={RESUME_ITEMS} /></div>} />
  );

  /* ── N2-4 — ReviewsDueCard: NO row accent today, 10.5/750 label, pad 20px. ─── */
  const rv_current = (
    <div>
      <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px" }}>
        <Thumb />
        <div style={{ minWidth: 0, flex: "1 1 220px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}><Addr full="31 Oakfield Road, Didsbury, M20 6AB" line="31 Oakfield Road" loc="Didsbury, M20 6AB" /></div>
          <p style={{ margin: "2px 0 0", fontSize: 10.5, fontWeight: 750, color: INFO, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Back from hold today</p>
          <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Due back today · On hold since 14 Oct</p>
        </div>
        <div className="hub-r-tail">
          <span className="hub-r-meta-m" style={{ fontSize: 11, color: "var(--agent-text-secondary)" }}><span>Due back today</span><span>On hold since 14 Oct</span></span>
          <div className="hub-r-actions" style={{ display: "inline-flex", flexShrink: 0 }}>
            <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Take off hold</button>
            <RowActionMenu joined items={RESUME_ITEMS} />
          </div>
        </div>
      </div>
    </div>
  );
  const rv_proposed = (
    <HubRow accent={INFO} full="31 Oakfield Road, Didsbury, M20 6AB" line="31 Oakfield Road" loc="Didsbury, M20 6AB"
      status="Back from hold today" statusColor={INFO} meta="Due back today · On hold since 14 Oct"
      metaM={<span className="hub-r-meta-m" style={{ fontSize: 11, color: "var(--agent-text-secondary)" }}><span>Due back today</span><span>On hold since 14 Oct</span></span>}
      tail={<div className="hub-r-actions" style={{ flexShrink: 0 }}><HubSplitButton label="Take off hold" onClick={noop} items={RESUME_ITEMS} /></div>} />
  );

  /* ── N3 — split-buttons: current hand-join vs HubSplitButton (both REAL menu) ── */
  const splitPane = (which: "current" | "proposed", label: string, items: RowMenuItem[]) => (
    <div style={{ padding: "22px 20px", display: "flex", justifyContent: "center" }}>
      {which === "current" ? (
        <div style={{ display: "inline-flex", flexShrink: 0 }}>
          <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>{label}</button>
          <RowActionMenu joined items={items} />
        </div>
      ) : (
        <HubSplitButton label={label} onClick={noop} items={items} />
      )}
    </div>
  );

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Hub — rows &amp; split-button compare</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggleBtn(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggleBtn(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>{(["desktop", "tablet", "mobile"] as VW[]).map((v) => <button key={v} type="button" style={toggleBtn(vw === v)} onClick={() => setVw(v)}>{v[0].toUpperCase() + v.slice(1)}</button>)}</div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · rows &amp; split-button</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>What a merge would actually change</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 880 }}>
            Two consolidations are left on the hub. <strong>N2</strong> — four cards hand-roll the same property row; the left pane reproduces each shipped row <strong>byte-for-byte</strong>, the right runs the same data through <strong>one shared HubRow</strong>. Three of the four come out <strong>byte-identical</strong>; only <strong>ReviewsDue</strong> changes visibly (it gains a left accent bar, its label normalises 10.5→11px / 750→700, left-pad 20→17px). <strong>N3</strong> — the split-button: the shipped hand-joined markup vs the extracted <code>HubSplitButton</code>, both mounting the real menu, so you can confirm it's pixel-identical before it rolls out. Toggle light/dark and the breakpoints. Nothing here touches production.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["same", "change", "new", "decision"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        <h2 style={{ margin: "26px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>N2 — one shared property row (option b: merge all four)</h2>

        <Block n="N2·1" title="HubListCard — file at risk (the template row)" tags={["same"]} vw={vw}
          note="HubListCard's row is already the richest anatomy, so the shared HubRow is modelled on it. Accent on the row, left-pad 17px, toned status text, meta line, action in the tail. Identical."
          current={hl_current} proposed={hl_proposed} />

        <Block n="N2·2" title="StalledEnquiriesCard — awaiting reply" tags={["same"]} vw={vw}
          note="Today the accent bar sits on an outer wrapper div; the shared row moves it onto the row itself. Same 3px bar, same left edge — visually identical. Status, meta, mobile meta-m and the Chase button all map across unchanged."
          current={st_current} proposed={st_proposed} />

        <Block n="N2·3" title="ExchangeOverdueCard — exchange date passed" tags={["same"]} vw={vw}
          note="No status label here (the row only carries a meta line), and the address is a direct block rather than wrapped in a flex div. The shared row's status slot is optional, so leaving it empty reproduces this exactly. The 'Deal with it' menu is the real RowActionMenu, unchanged."
          current={ex_current} proposed={ex_proposed} />

        <Block n="N2·4" title="ReviewsDueCard — back from hold / review due" tags={["change", "decision"]} vw={vw}
          note={<>The only card that changes visibly. Today its rows have <strong>no accent bar</strong>, a <strong>10.5px / 750</strong> label and <strong>20px</strong> left-pad. The shared row gives it a <strong>3px accent bar</strong> (shown here in info-blue — the colour is a genuine open choice, since a review row isn't one fixed 'type'), an <strong>11px / 700</strong> label and <strong>17px</strong> pad. If you like the accent, option (b) is clean; if ReviewsDue should stay bar-less, it's option (a) — grandfather this one card, merge the other three.</>}
          current={rv_current} proposed={rv_proposed} />

        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>N3 — the split-button (one canonical, menu unchanged)</h2>

        <Block n="N3·1" title="Resume split-button — 'Take off hold ▾'" tags={["same", "new"]} vw={vw}
          note={<>Left is the shipped hand-joined markup (agent-btn + joined RowActionMenu); right is the extracted <code>HubSplitButton</code>. Both mount the <strong>same</strong> RowActionMenu, so the dropdown (wait a week · pick a date · hold indefinitely · withdraw) is untouched — click either caret. The component only standardises the joined shell.</>}
          current={splitPane("current", "Take off hold", RESUME_ITEMS)} proposed={splitPane("proposed", "Take off hold", RESUME_ITEMS)} />

        <Block n="N3·2" title="Manual-review split-button — 'Done ▾'" tags={["same", "new"]} vw={vw}
          note="The manual 'check on this' review's primary action. Same shell, different menu items (snooze a week · pick a new date · open the file). Confirms HubSplitButton carries any item set."
          current={splitPane("current", "Done", DONE_ITEMS)} proposed={splitPane("proposed", "Done", DONE_ITEMS)} />

        <Block n="N3·3" title="DiaryEventRow — 'Confirm exchange ▾' (needs a buttonStyle hook)" tags={["change", "decision"]} vw={vw}
          note={<>A fourth hand-joined split-button, in the diary rows. It differs in two ways: the label is <strong>tone-coloured</strong> (the event's accent) and it carries a <strong>container-query responsive</strong> label (full "Confirm exchange" → short "Confirm" by row width). Both are representable: the label is any ReactNode (so the responsive spans pass straight through), and I added an optional <code>buttonStyle</code> hook to carry the accent <code>color</code>. The proposed pane uses exactly that — compare them. If you're happy, it migrates; if the accent label feels like a genuine one-off, grandfather it.</>}
          current={
            <div style={{ padding: "22px 20px", display: "flex", justifyContent: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "stretch" }}>
                <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ color: CORAL, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>
                  <span className="diary-cta-full">Confirm exchange</span>
                  <span className="diary-cta-short">Confirm</span>
                </button>
                <RowActionMenu joined items={RESUME_ITEMS} />
              </span>
            </div>
          }
          proposed={
            <div style={{ padding: "22px 20px", display: "flex", justifyContent: "center" }}>
              <HubSplitButton
                label={<><span className="diary-cta-full">Confirm exchange</span><span className="diary-cta-short">Confirm</span></>}
                buttonStyle={{ color: CORAL }}
                onClick={noop}
                items={RESUME_ITEMS}
              />
            </div>
          } />

        <Block n="N3·4" title="BookingsToConfirm — 'Confirm ▾' (fragment → wrapper)" tags={["change", "decision"]} vw={vw}
          note={<>The bookings card joins its Close/Confirm toggle to the menu with a bare <code>&lt;&gt;</code> fragment — the parent flex owns the two as separate items. HubSplitButton groups them in its own inline-flex wrapper. Because the two are already joined (squared corners, no gap), the wrapper is visually equivalent — confirm that in the panes. The only behavioural note: the label toggles Confirm↔Close, which stays the card's own state (passed as the label).</>}
          current={
            <div style={{ padding: "22px 20px", display: "flex", justifyContent: "center" }}>
              <span style={{ display: "inline-flex" }}>
                <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Confirm</button>
                <RowActionMenu joined items={DONE_ITEMS} />
              </span>
            </div>
          }
          proposed={splitPane("proposed", "Confirm", DONE_ITEMS)} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "28px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>N3·5</span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>Shapes that are NOT this split-button (stay as-is)</h3>
            <Tag kind="same" />
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}>
            Two nearby controls look adjacent but are different shapes, so they are out of scope and unchanged: AttentionCard's two separate buttons, and ExchangeOverdue's label-trigger menu (which has no separate primary button — the label IS the trigger). Shown so the boundary is explicit.
          </p>
          <div style={{ borderRadius: 16, padding: 22, background: "var(--compare-pane)", border: "1px solid var(--compare-line)", display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center", justifyContent: "center" }}>
            <div style={{ display: "inline-flex", gap: 8 }}>
              <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>Take off hold</button>
              <button type="button" className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Check size={13} weight="bold" /> Done</button>
            </div>
            <RowActionMenu label="Deal with it" items={RESUME_ITEMS} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--compare-muted)" }}><Lightning size={14} /> two-button pair · label-trigger menu</span>
          </div>
        </section>
      </div>
    </div>
  );
}

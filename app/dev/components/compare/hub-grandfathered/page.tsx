"use client";

// The hub buttons that were GRANDFATHERED in the arc migration — rendered byte-for-byte
// (real shipped classes) on the left, with the recommended arc-canonical alignment on the
// right. These were skipped in the hub pilot because each is bespoke or pending; this page
// is the decision sheet to finish aligning them. Dev-only, read-only. No production change.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CaretDown, Check, UserCircle, ArrowRight, Plus, Clock, CalendarPlus, Prohibit } from "@phosphor-icons/react";
import { buttonClasses } from "@/components/arc/button/button";
import { HubSplitButton } from "@/components/hub/HubSplitButton";
import { RowActionMenu, type RowMenuItem } from "@/components/hub/RowActionMenu";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
const CORAL_TOKENS = { ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#ffffff" } as CSSProperties;
type Theme = "light" | "dark";
type TagKind = "recommend" | "same" | "delete";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  recommend: { label: "Recommended align", fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  same: { label: "Already resolved", fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" },
  delete: { label: "Recommend remove", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — arc canonical" : "Current — shipped (byte-for-byte)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", minHeight: 64 }}>{children}</div>
    </div>
  );
}
function Block({ n, title, tags, why, rec, current, proposed }: { n: string; title: string; tags: TagKind[]; why: ReactNode; rec: ReactNode; current: ReactNode; proposed: ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong>Why grandfathered:</strong> {why}</p>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong style={{ color: CORAL }}>Recommendation:</strong> {rec}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

const noop = () => {};
const RESUME_ITEMS: RowMenuItem[] = [
  { key: "wk", icon: <Clock size={15} />, title: "Wait a week", onClick: noop },
  { key: "dt", icon: <CalendarPlus size={15} />, title: "Pick a date", onClick: noop },
  { key: "wd", icon: <Prohibit size={15} />, title: "Withdraw", danger: true, onClick: noop },
];
const CONFIRM_ITEMS: RowMenuItem[] = [
  { key: "desktop", icon: <Check size={15} />, title: "Yes", sub: "Remote valuation", onClick: noop },
  { key: "visit", icon: <CalendarPlus size={15} />, title: "No", sub: "A standard visit", onClick: noop },
];

export default function HubGrandfatheredComparePage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [theme, setTheme] = useState<Theme>("light");
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
  const toggle = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Hub — grandfathered buttons</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggle(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggle(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · hub · grandfathered</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>The hub buttons we skipped — and how to finish them</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            The hub pilot migrated the standard attention-card buttons to arc but <strong>grandfathered five</strong> that are bespoke or pending. You asked why — the honest answer is each needed a judgement call rather than a blind swap. Here is every one, rendered <strong>byte-for-byte as it ships</strong>, next to the arc-canonical version, with a recommendation. Aligning them is cheap now that arc has <code>outline</code> / <code>xs</code> / <code>icon</code> / <code>buttonClasses()</code>.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["recommend", "same", "delete"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        <Block n="G1" title="DiaryEventRow — 'Confirm exchange ▾'" tags={["same", "recommend"]}
          why={<>Its label is <strong>tone-coloured</strong> (the event accent) and <strong>container-query responsive</strong> (full → short by row width) — not a blind swap.</>}
          rec={<>Migrate via <code>HubSplitButton</code> with <code>buttonStyle=&#123;&#123; color &#125;&#125;</code> for the accent and the responsive spans as the label (both already supported). This is buttons-compare N3·3 — the proposed pane is the real component.</>}
          current={
            <span style={{ display: "inline-flex", alignItems: "stretch" }}>
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ color: CORAL, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Confirm exchange</button>
              <RowActionMenu joined items={RESUME_ITEMS} />
            </span>
          }
          proposed={<HubSplitButton label="Confirm exchange" buttonStyle={{ color: CORAL }} onClick={noop} items={RESUME_ITEMS} />} />

        <Block n="G2" title="BookingsToConfirm — 'Confirm ▾'" tags={["same", "recommend"]}
          why={<>Joins its Close/Confirm toggle to the menu with a bare <code>&lt;&gt;</code> fragment (parent flex owns the two).</>}
          rec={<>Migrate via <code>HubSplitButton</code> — its inline-flex wrapper is visually equivalent since the two are already joined. The Confirm↔Close toggle stays the card's own label. Buttons-compare N3·4.</>}
          current={
            <span style={{ display: "inline-flex" }}>
              <button className="agent-btn agent-btn-sm agent-btn-ghost-bordered" style={{ display: "inline-flex", alignItems: "center", gap: 5, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}>Confirm</button>
              <RowActionMenu joined items={CONFIRM_ITEMS} />
            </span>
          }
          proposed={<HubSplitButton label="Confirm" onClick={noop} items={CONFIRM_ITEMS} />} />

        <Block n="G3" title="FirstSaleHero — primary CTA" tags={["recommend"]}
          why={<>A hero <code>&lt;Link&gt;</code> with <strong>custom padding (11/18) and 14px</strong> — bespoke-sized, coral <em>gradient</em>.</>}
          rec={<><code>buttonClasses(&#123;variant:"primary"&#125;)</code> + the coral token override, keeping the hero padding as an inline style. Flat coral replaces the gradient (the app-wide decision). Stays a real anchor.</>}
          current={<a className="agent-btn agent-btn-primary" href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none", justifyContent: "center", padding: "11px 18px", fontSize: 14 }}>Continue with 14 Priory Gardens <ArrowRight size={15} weight="bold" /></a>}
          proposed={<a className={buttonClasses({ variant: "primary" })} href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none", padding: "11px 18px", fontSize: 14, ...CORAL_TOKENS }}>Continue with 14 Priory Gardens <ArrowRight size={15} weight="bold" /></a>} />

        <Block n="G4" title="FirstSaleHero — secondary CTA" tags={["recommend"]}
          why={<>A hand-rolled coral outline done entirely in inline style (glass fill + coral border + coral text) on a <code>&lt;Link&gt;</code>.</>}
          rec={<><code>buttonClasses(&#123;variant:"outline"&#125;)</code> — it already is the coral outline, so the bespoke inline border/colour/fill all drop out; keep only the hero padding.</>}
          current={<a className="agent-btn" href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none", justifyContent: "center", padding: "11px 18px", fontSize: 14, background: "var(--agent-surface-glass, #fff)", border: "1px solid rgba(var(--agent-coral-rgb), 0.35)", color: "var(--agent-coral-deep)" }}><Plus size={15} weight="bold" /> Add another sale</a>}
          proposed={<a className={buttonClasses({ variant: "outline" })} href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none", padding: "11px 18px", fontSize: 14 }}><Plus size={15} weight="bold" /> Add another sale</a>} />

        <Block n="G5" title="hub-view — 'Complete your profile' CTA" tags={["recommend"]}
          why={<>Uses a one-off <code>.hub-profile-cta</code> class (glass fill, coral text, 30%-coral border) on a base <code>agent-btn</code> with no variant.</>}
          rec={<><code>buttonClasses(&#123;variant:"outline", size:"sm"&#125;)</code> as a <code>&lt;Link&gt;</code> — same coral-outline intent, retires the bespoke <code>.hub-profile-cta</code> rule. (Outline is transparent vs the current faint glass fill — the one visible nuance to confirm.)</>}
          current={<a className="agent-btn agent-btn-sm hub-profile-cta" href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none" }}><UserCircle size={15} weight="regular" /> Complete your profile</a>}
          proposed={<a className={buttonClasses({ variant: "outline", size: "sm" })} href="#" onClick={(e) => e.preventDefault()} style={{ textDecoration: "none" }}><UserCircle size={15} weight="regular" /> Complete your profile</a>} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>G6</span>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>ExpiredHoldsCard — dead code</h3>
            <Tag kind="delete" />
          </div>
          <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong>Why grandfathered:</strong> it isn't rendered on the hub — AttentionCard replaced it (and four other stacked cards). Nothing imports it live.</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}><strong style={{ color: CORAL }}>Recommendation:</strong> don't align its buttons — <strong>delete the file</strong> (and AttentionListView / the other replaced views) in a separate dead-code sweep. Migrating buttons in dead code is wasted effort.</p>
        </section>

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0 0" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>Summary</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.75, maxWidth: 900 }}>
            <li><strong>G1 / G2</strong> (Diary, Bookings) — align via <code>HubSplitButton</code>; they're the two still pending your N3·3 / N3·4 nod.</li>
            <li><strong>G3 / G4</strong> (FirstSaleHero) — align via <code>buttonClasses()</code> on the anchors; flat coral primary + real outline secondary.</li>
            <li><strong>G5</strong> (profile CTA) — <code>buttonClasses(outline, sm)</code>, retires <code>.hub-profile-cta</code>.</li>
            <li><strong>G6</strong> (ExpiredHolds) — delete, don't migrate.</li>
          </ul>
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>Say the word and I'll apply G1–G5 (hub only) and file G6 for a dead-code sweep.</p>
        </section>
      </div>
    </div>
  );
}

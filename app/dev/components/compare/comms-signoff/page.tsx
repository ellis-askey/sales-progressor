"use client";

// UPDATES (/agent/comms) — SIGN-OFF RESIDUALS
//
// A fresh deep-tree audit of the already-migrated Updates page. These are the
// bits still not canonical — plus one real bug (the empty-state ghost preview
// shimmers like it's loading). Plain English; BEFORE = real shipped code,
// byte-for-byte. Nothing is applied until each item is signed off.
// Light maps to the app default theme "sunset" so every --agent-* token resolves.

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { CountBadge } from "@/components/ui/CountBadge";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
type Theme = "light" | "dark";

// The cf-* rail styles, copied verbatim so the BEFORE rail renders faithfully.
const CF_STYLES = `
  .sfx-sec-hdr { display:flex; align-items:center; justify-content:space-between; padding:11px 10px; cursor:pointer; font-size:12px; font-weight:700; color:var(--agent-text-primary); border-radius:8px; transition:background-color .14s ease; user-select:none; }
  .sfx-sec-hdr:hover { background-color:var(--agent-hover-tint); }
  .sfx-dd-btn { display:inline-flex; align-items:center; gap:7px; font-family:inherit; font-size:13px; font-weight:600; color:var(--agent-text-primary); background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); border-radius:10px; padding:8px 12px; cursor:pointer; }
`;

type Cls = "B" | "C" | "D" | "BUG";
const CLS: Record<Cls, { label: string; fg: string }> = {
  B: { label: "ALIGN — swap to canonical", fg: "#b45309" },
  C: { label: "REGISTER / DECIDE", fg: "#b91c1c" },
  D: { label: "CONFIRM — intentional", fg: "#6d28d9" },
  BUG: { label: "BUG — real defect", fg: "#be123c" },
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
function Spec({ n, title, cls, verdict, before, after, both, wide }: { n: string; title: string; cls: Cls; verdict: ReactNode; before?: ReactNode; after?: ReactNode; both?: ReactNode; wide?: boolean }) {
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
          <div style={{ flex: "1 1 320px", minWidth: 0 }}><Lbl kind="after" /><Stage wide={wide}>{after}</Stage></div>
        </div>
      )}
    </section>
  );
}

/* ---- BEFORE reproductions (byte-for-byte) ---- */
// Rail section header (cf-sec-hdr) — bespoke
function RailHdrNow() {
  return (
    <div className="sfx-sec-hdr" style={{ width: 236 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Who <CountBadge count={1} solid /></span>
      <CaretDown style={{ width: 13, height: 13, color: "var(--agent-text-muted)" }} />
    </div>
  );
}
// Mobile dropdown with the literal ▼ glyph
function DropdownNow() {
  return (
    <button type="button" className="sfx-dd-btn">
      Type <CountBadge count={2} solid /><span style={{ fontSize: 9, color: "var(--agent-text-muted)" }}>▼</span>
    </button>
  );
}
// KindBadge tinted icon chip
function KindBadgeNow() {
  return (
    <span aria-hidden style={{ width: 26, height: 26, borderRadius: 999, background: "rgba(var(--agent-info-rgb), 0.12)", color: "var(--agent-info)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v12H4zM4 20h16" /></svg>
    </span>
  );
}
// Ghost skeleton bar (shimmering) — reproduces the shimmer via the real class
function SkeletonNow() {
  return (
    <div style={{ opacity: 0.35, pointerEvents: "none", width: 280 }}>
      <div className="agent-glass" style={{ overflow: "hidden", padding: 12, borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div className="agent-skeleton" style={{ width: 56, height: 11, borderRadius: 4 }} />
          <div className="agent-skeleton" style={{ width: 68, height: 11, borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div className="agent-skeleton" style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="agent-skeleton" style={{ height: 12, maxWidth: 148, borderRadius: 4 }} />
            <div className="agent-skeleton" style={{ height: 10, maxWidth: 52, borderRadius: 4 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
// Static placeholder (proposed) — same shapes, no shimmer
function SkeletonNext() {
  const bar = (s: CSSProperties) => <div style={{ background: "var(--agent-border-subtle, rgba(15,23,42,0.08))", borderRadius: 4, ...s }} />;
  return (
    <div style={{ opacity: 0.35, pointerEvents: "none", width: 280 }}>
      <div className="agent-glass" style={{ overflow: "hidden", padding: 12, borderRadius: 10, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>{bar({ width: 56, height: 11 })}{bar({ width: 68, height: 11 })}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {bar({ width: 20, height: 20, borderRadius: "50%", flexShrink: 0 })}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>{bar({ height: 12, maxWidth: 148 })}{bar({ height: 10, maxWidth: 52 })}</div>
        </div>
      </div>
    </div>
  );
}

const INVENTORY: { item: string; cls: Cls; verdict: string }[] = [
  { item: "Ghost 'loading' preview shimmers", cls: "BUG", verdict: "The empty-state preview animates forever like it's still loading → make it static." },
  { item: "The filter rail (left sidebar)", cls: "C", verdict: "Still hand-made markup, not a real shared part. My earlier 'registered' was only a gallery mock-up." },
  { item: "Filter section header hover", cls: "B", verdict: "Hovers like a clickable row; a group header should use the quieter header hover." },
  { item: "Mobile filter dropdown arrow", cls: "B", verdict: "Uses a typed '▼' character; the rail right next to it uses our real caret icon." },
  { item: "Hidden 'View guide' button", cls: "C", verdict: "A button that does nothing (turned off for now). Delete it until the guide exists." },
  { item: "Little icon circles on activity rows", cls: "C", verdict: "The coloured circle+icon on price/reply rows is hand-made → register, or confirm fine." },
  { item: "Document link underline", cls: "B", verdict: "An underlined 'attachment' link without our standard link hover/focus." },
  { item: "File progress % number", cls: "D", verdict: "The '37%' is a tiny hand-made number → confirm it's fine, or match our number style." },
  { item: "Tiny caption texts", cls: "D", verdict: "A few 10.5/11.5px captions (stage, 'Next:', 'Showing X of Y') sit just off our text sizes." },
  { item: "Activity row layout", cls: "D", verdict: "The in-card update row is hand-built (not our bordered row) — confirm it's deliberate." },
  { item: "Welcome hero (empty page)", cls: "C", verdict: "The big coral welcome banner is copied across 15 pages — a whole-app extraction, not a one-page fix." },
  { item: "'the platform' wording (admin only)", cls: "B", verdict: "Admin copy says 'across the platform'; our voice rules avoid that phrase." },
];

export default function CommsSignoffPage() {
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
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Sign-off residuals · Updates</span>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "22px 24px 90px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 700, color: "var(--compare-ink)" }}>Updates — what's left before sign-off</h1>
        <p style={{ margin: "0 0 10px", fontSize: 14, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 860 }}>
          You hoped there&rsquo;d be very little — honestly, there&rsquo;s a bit more than that, and one item is a correction I owe you: the <b>filter rail</b> (the left sidebar) that I said I&rsquo;d &ldquo;registered as canonical&rdquo; was only a <b>mock-up in the library</b> — the real page still draws it by hand. There&rsquo;s also a genuine <b>bug</b>: the &ldquo;No updates yet&rdquo; preview <b>shimmers forever</b> like it&rsquo;s still loading.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 860 }}>
          The rest are small: a few hand-made captions, an underlined link, a dead button. For each: <b style={{ color: CLS.B.fg }}>Align</b> (quick swap), <b style={{ color: CLS.C.fg }}>Register/Decide</b> (make it a shared part, or decide to leave it), <b style={{ color: CLS.D.fg }}>Confirm</b> (fine on purpose).
        </p>

        <div style={{ borderRadius: 14, border: "1px solid var(--compare-line)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 16, padding: "11px 16px", background: "var(--stage-bg)", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 13, color: "var(--compare-ink)" }}>{INVENTORY.length} residuals</strong>
            <span style={{ fontSize: 12.5, color: "var(--compare-body)" }}><b style={{ color: CLS.BUG.fg }}>{counts.BUG ?? 0} bug</b> · <b style={{ color: CLS.B.fg }}>{counts.B ?? 0} align</b> · <b style={{ color: CLS.C.fg }}>{counts.C ?? 0} register</b> · <b style={{ color: CLS.D.fg }}>{counts.D ?? 0} confirm</b></span>
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

        <Spec n="1" title="The 'No updates yet' preview shimmers forever" cls="BUG"
          verdict={<>On an empty account, the staff view shows a faint ghost of what a day of updates looks like. It&rsquo;s built from our <i>loading</i> shimmer bars — so it <b>pulses forever</b>, as if the page is still loading, even though it&rsquo;s a settled empty state. We have a static version of these shapes for exactly this case. Fix: same ghost, no pulse. <b>Visible.</b></>}
          before={<SkeletonNow />} after={<SkeletonNext />} />

        <Spec n="2" title="The filter rail (left sidebar)" cls="C" wide
          verdict={<>The whole left filter sidebar — its card, its collapsing Type / Who / Side / Stage sections, and the mobile dropdown versions — is still <b>drawn by hand</b> on this page (local <code>cf-*</code> styles), not a reusable part. When I did the comms pass I added a <i>mock-up</i> of it to the library and said it was &ldquo;registered&rdquo; — but the real page was never changed to use a shared piece. <b>Decision:</b> extract it into a proper shared Filter rail (so other pages can reuse it and it can&rsquo;t drift), or leave it page-specific and just fix the small bits in #3 and #4. No visual change either way.</>}
          both={<RailHdrNow />} />

        <Spec n="3" title="Filter section header hover" cls="B"
          verdict={<>Each filter group header (&ldquo;Who&rdquo;, &ldquo;Side&rdquo;…) <b>lights up on hover like a clickable row</b>. We have a quieter hover for <i>group headers</i> specifically — the idea being a section opening/closing shouldn&rsquo;t flash as strongly as picking a row. Switch to that. Subtle.</>}
          before={<RailHdrNow />} after={<div className="sfx-sec-hdr" style={{ width: 236, background: "var(--agent-hover-shade)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Who <CountBadge count={1} solid /></span><CaretDown style={{ width: 13, height: 13, color: "var(--agent-text-muted)" }} /></div>} />

        <Spec n="4" title="Mobile filter dropdown arrow" cls="B"
          verdict={<>On narrow screens the filters become dropdowns, and their little down-arrow is a <b>typed &ldquo;▼&rdquo; character</b> — while the rail right next to it uses our proper caret icon. Same control, two different arrows. Swap the typed one for the real icon.</>}
          before={<DropdownNow />} after={<button type="button" className="sfx-dd-btn">Type <CountBadge count={2} solid /><CaretDown size={11} weight="bold" style={{ color: "var(--agent-text-muted)" }} /></button>} />

        <Spec n="5" title="Hidden 'View guide' button" cls="C"
          verdict={<>Inside the welcome/empty state there&rsquo;s a &ldquo;Learn more about Updates&rdquo; card with a <b>&ldquo;View guide&rdquo; button that does nothing</b> — there&rsquo;s no guide to open yet, so the whole card is turned off behind a flag. It&rsquo;s a dead control waiting to ship. <b>Proposal:</b> delete the card until the guide actually exists (we don&rsquo;t keep buttons that go nowhere). Invisible — it&rsquo;s hidden today.</>}
          both={<button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 8 }}>View guide</button>} />

        <Spec n="6" title="Little icon circles on activity rows" cls="C"
          verdict={<>Each non-milestone update (a price change, a reply, an upload) leads with a small coloured circle holding an icon. It&rsquo;s hand-made and reused in a few spots, but isn&rsquo;t a shared part (unlike the people avatars next to it, which are). <b>Decision:</b> register it as a small icon-chip part, or confirm it&rsquo;s fine to leave. No visual change.</>}
          both={<div style={{ display: "flex", gap: 10 }}><KindBadgeNow /><KindBadgeNow /></div>} />

        <Spec n="7" title="Document link underline" cls="B"
          verdict={<>When an update is an uploaded document, its name is an underlined link to open the file — but it uses a plain underline, not our standard link treatment (the one with the coral hover + keyboard focus ring). Swap to our link. Subtle on hover.</>}
          before={<a href="#" onClick={(e) => e.preventDefault()} style={{ color: "var(--agent-text-primary)", textDecoration: "underline", textUnderlineOffset: 2, fontSize: 13 }}>Management pack.pdf</a>}
          after={<a href="#" onClick={(e) => e.preventDefault()} className="agent-link" style={{ fontSize: 13 }}>Management pack.pdf</a>} />

        <Spec n="8" title="File progress % number" cls="D"
          verdict={<>On each file&rsquo;s little snapshot, the &ldquo;37%&rdquo; is a hand-made number. Our signed-off pages route big numbers through one number style — but this is a tiny inline percent next to a status pill, so it may be fine as-is. <b>Confirm:</b> leave it, or match our number style.</>}
          both={<span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>37%</span>} />

        <Spec n="9" title="Tiny caption texts" cls="D"
          verdict={<>A handful of very small captions — the file&rsquo;s stage line, the &ldquo;Next: …&rdquo; note, and the &ldquo;Showing X of Y&rdquo; footer — are set at 10.5 / 11.5px, which sit <i>just</i> off our standard text sizes. <b>Confirm:</b> nudge them onto the nearest standard size, or leave (the difference is a fraction of a pixel). Barely visible.</>}
          both={<div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>Conveyancing · about 9 weeks to exchange</span><span style={{ fontSize: 11.5, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>Showing 94 of 150</span></div>} />

        <Spec n="10" title="Activity row layout" cls="D"
          verdict={<>The update rows inside each file card are hand-built (an avatar, the sentence, a time, a divider). That&rsquo;s different from our bordered standalone row — but it&rsquo;s meant to be: these are quiet rows <i>inside</i> a card, not separate cards. <b>Confirm</b> it&rsquo;s a deliberate in-card row (I believe it is), and we leave it.</>}
          both={<span style={{ fontSize: 13, color: "var(--compare-body)" }}>A deliberate in-card list row — confirm it stays, or flag.</span>} />

        <Spec n="11" title="The welcome hero (empty page)" cls="C" wide
          verdict={<>When an agency has no sales yet, the page opens with a big coral &ldquo;Nothing to catch up on yet&rdquo; banner. That exact banner is <b>copied by hand across 15 different empty pages</b> (Hub, Reminders, Chains, To-do…). Making it one shared part is a <b>whole-app job</b>, not a one-page fix. <b>Decision:</b> leave it as a known group-up-later item (recommended — don&rsquo;t block Updates on a 15-page refactor), or schedule that extraction now.</>}
          both={<span style={{ fontSize: 13, color: "var(--compare-body)" }}>Recommend: grandfather this as a separate &ldquo;extract the shared welcome hero&rdquo; job across all 15 pages.</span>} />

        <Spec n="12" title="'the platform' wording (admin only)" cls="B"
          verdict={<>For admins only, the page subtitle says &ldquo;What&rsquo;s happened <b>across the platform</b>.&rdquo; Our writing rules avoid &ldquo;the platform&rdquo; (it names the system rather than speaking as us). Here it means &ldquo;across every agency&rdquo; — so either reword it (e.g. &ldquo;across every agency&rdquo;) or confirm it&rsquo;s an accepted admin exception.</>}
          both={<span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>&ldquo;What&rsquo;s happened across the platform.&rdquo;</span>} />
      </div>
    </div>
  );
}

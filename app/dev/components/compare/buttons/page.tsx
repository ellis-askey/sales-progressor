"use client";

// D1 — the agent-btn → arc Button migration MAP. Left is the real shipped agent-btn
// (actual classes, actual agent-system.css); right is the real arc Button. Both are live
// components, so this is authoritative, not a mock. It exists to make every decision the
// migration needs VISIBLE before a single call site changes:
//   A  the four arc variants mapped from agent-btn (primary/secondary/ghost/danger)
//   B  the gaps with no clean arc peer — each tagged "decision required"
// Dev-only, read-only. Nothing here changes production.

import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { notFound } from "next/navigation";
import { CaretDown, PaperPlaneTilt, Gear, Trash, Plus, X } from "@phosphor-icons/react";
import { Button, buttonClasses } from "@/components/arc/button/button";

const CORAL = "var(--agent-coral-deep, #FF6B4A)";
/** The gallery's canonical way to keep primary coral: override the ink/slab tokens at the call site. */
const coralOverride = { ["--foreground" as string]: "#FF6B4A", ["--background" as string]: "#ffffff" } as CSSProperties;
type Theme = "light" | "dark";
type TagKind = "same" | "change" | "decision" | "blocker";
const TAG: Record<TagKind, { label: string; fg: string; bg: string; bd: string }> = {
  same:     { label: "Near-identical", fg: "#15803d", bg: "rgba(22,163,74,0.12)", bd: "rgba(22,163,74,0.30)" },
  change:   { label: "Visible change", fg: "#b45309", bg: "rgba(224,148,46,0.14)", bd: "rgba(224,148,46,0.34)" },
  decision: { label: "Decision required", fg: "#b91c1c", bg: "rgba(185,28,28,0.11)", bd: "rgba(185,28,28,0.30)" },
  blocker:  { label: "Structural — no arc form", fg: "#6d28d9", bg: "rgba(109,40,217,0.12)", bd: "rgba(109,40,217,0.30)" },
};
function Tag({ kind }: { kind: TagKind }) {
  const t = TAG[kind];
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 999, color: t.fg, background: t.bg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap" }}>{t.label}</span>;
}
function Pane({ side, children }: { side: "current" | "proposed"; children: ReactNode }) {
  const isP = side === "proposed";
  return (
    <div style={{ flex: "1 1 320px", minWidth: 0 }}>
      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: isP ? CORAL : "var(--compare-muted)", marginBottom: 8 }}>{isP ? "Proposed — arc Button" : "Current — agent-btn (shipped)"}</span>
      <div style={{ borderRadius: 16, padding: 20, background: "var(--compare-pane)", border: isP ? `1.5px solid ${CORAL}` : "1px solid var(--compare-line)", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>{children}</div>
    </div>
  );
}
function Block({ n, title, tags, note, current, proposed, map }: { n: string; title: string; tags: TagKind[]; note: ReactNode; current: ReactNode; proposed: ReactNode; map?: string }) {
  return (
    <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--compare-faint)" }}>{n}</span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 650, color: "var(--compare-ink)" }}>{title}</h3>
        {tags.map((k) => <Tag key={k} kind={k} />)}
      </div>
      {map && <p style={{ margin: "0 0 8px", fontSize: 12, fontFamily: "monospace", color: "var(--compare-muted)" }}>{map}</p>}
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--compare-body)", lineHeight: 1.55, maxWidth: 880 }}>{note}</p>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Pane side="current">{current}</Pane>
        <Pane side="proposed">{proposed}</Pane>
      </div>
    </section>
  );
}

export default function ButtonsComparePage() {
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
  const toggleBtn = (active: boolean): CSSProperties => ({ fontSize: 12.5, fontWeight: 600, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid var(--compare-line)", background: active ? CORAL : "transparent", color: active ? "#fff" : "var(--compare-body)" });

  return (
    <div className="agent-shell-root nv2-night" data-theme={theme} style={{ ...pageVars, minHeight: "100vh", background: "var(--compare-bg)", color: "var(--compare-ink)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "var(--compare-bg)", borderBottom: "1px solid var(--compare-line)", padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>D1 — agent-btn → arc Button map</strong>
        <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
          <button type="button" style={toggleBtn(theme === "light")} onClick={() => setTheme("light")}>Light</button>
          <button type="button" style={toggleBtn(theme === "dark")} onClick={() => setTheme("dark")}>Dark</button>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 24px 120px" }}>
        <header style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>Design system · D1 · buttons</span>
          <h1 style={{ margin: "8px 0 10px", fontSize: 30, fontWeight: 680, letterSpacing: "-0.02em" }}>agent-btn → arc Button: the whole map</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            <strong>agent-btn</strong> is a CSS class family (8+ variants, 4 sizes, applied to <code>&lt;button&gt;</code>, <code>&lt;Link&gt;</code> and <code>&lt;a&gt;</code>). The <strong>arc Button</strong> is a motion React component — 4 variants (primary/secondary/ghost/danger), 3 sizes (sm/md/lg), <code>&lt;button&gt;</code>-only. Sizes line up cleanly (<strong>sm 32 · md 40 · lg 48</strong>), so nothing resizes <em>there</em>. But the <em>looks</em> differ and three agent-btn things have no arc form at all. Left is the real shipped button; right is the real arc Button. This is the decision sheet for the whole app — <strong>~700+ call sites</strong> — so we settle the map here, then migrate surface-by-surface (hub first), each verified. Nothing changes production yet.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>{(["same", "change", "decision", "blocker"] as TagKind[]).map((k) => <Tag key={k} kind={k} />)}</div>
        </header>

        <h2 style={{ margin: "26px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>A · The four arc variants</h2>

        <Block n="A1" title="Primary CTA" tags={["change"]} map="agent-btn agent-btn-primary  →  <Button variant=&quot;primary&quot;> + coral token override"
          note={<>Both are coral — but agent-btn-primary is a <strong>vertical coral gradient</strong> (coral → coral-deep) and the arc primary + the gallery's coral token override is <strong>flat coral</strong>. That's the one unavoidable change on every primary CTA in the app. The gallery already blessed the flat-coral override as canonical; this shows the delta at size lg / md / sm.</>}
          current={<>
            <button className="agent-btn agent-btn-primary agent-btn-lg">Continue</button>
            <button className="agent-btn agent-btn-primary agent-btn-md">Continue</button>
            <button className="agent-btn agent-btn-primary agent-btn-sm">Continue</button>
            <button className="agent-btn agent-btn-primary agent-btn-md" disabled>Disabled</button>
          </>}
          proposed={<>
            <Button variant="primary" size="lg" style={coralOverride}>Continue</Button>
            <Button variant="primary" size="md" style={coralOverride}>Continue</Button>
            <Button variant="primary" size="sm" style={coralOverride}>Continue</Button>
            <Button variant="primary" size="md" style={coralOverride} disabled>Disabled</Button>
          </>} />

        <Block n="A2" title="Secondary" tags={["change"]} map="agent-btn agent-btn-secondary  →  <Button variant=&quot;secondary&quot;>"
          note={<>agent-btn-secondary is <strong>frosted glass</strong> (16px blur, glass border, glass shadow). The arc secondary is a <strong>solid white / hairline-outline</strong> pill (theme-aware: a raised dark pill in dark). <strong>Adopted the arc secondary</strong> — it's the gallery's canonical and already replaces the old glass secondary on the onboarding/empty-state surfaces. On glass it reads heavier; if any migrated surface looks wrong, we catch it at that surface's spot-check.</>}
          current={<>
            <button className="agent-btn agent-btn-secondary agent-btn-lg">Secondary</button>
            <button className="agent-btn agent-btn-secondary agent-btn-md">Secondary</button>
            <button className="agent-btn agent-btn-secondary agent-btn-sm">Secondary</button>
          </>}
          proposed={<>
            <Button variant="secondary" size="lg">Secondary</Button>
            <Button variant="secondary" size="md">Secondary</Button>
            <Button variant="secondary" size="sm">Secondary</Button>
          </>} />

        <Block n="A3" title="Ghost" tags={["same"]} map="agent-btn agent-btn-ghost  →  <Button variant=&quot;ghost&quot;>"
          note={<>The closest match. Both are transparent with a quiet label that darkens and picks up a hover shade. agent-btn-ghost uses text-tertiary at rest; arc ghost uses text-secondary — a hair darker. Effectively the same control.</>}
          current={<>
            <button className="agent-btn agent-btn-ghost agent-btn-lg">Skip for now</button>
            <button className="agent-btn agent-btn-ghost agent-btn-md">Skip for now</button>
            <button className="agent-btn agent-btn-ghost agent-btn-sm">Skip</button>
          </>}
          proposed={<>
            <Button variant="ghost" size="lg">Skip for now</Button>
            <Button variant="ghost" size="md">Skip for now</Button>
            <Button variant="ghost" size="sm">Skip</Button>
          </>} />

        <Block n="A4" title="Danger / destructive" tags={["change"]} map="agent-btn agent-btn-danger  →  <Button variant=&quot;danger&quot;>"
          note={<>agent-btn-danger is <strong>transparent with a red border + red text</strong>. The arc danger is a <strong>surface pill with a neutral border and red text</strong> (it fills on hover). <strong>Adopted the arc danger</strong> for one consistent destructive control — red text stays, the resting fill becomes a surface pill.</>}
          current={<>
            <button className="agent-btn agent-btn-danger agent-btn-md">Remove</button>
            <button className="agent-btn agent-btn-danger agent-btn-sm">Remove</button>
          </>}
          proposed={<>
            <Button variant="danger" size="md">Remove</Button>
            <Button variant="danger" size="sm">Remove</Button>
          </>} />

        <h2 style={{ margin: "40px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--compare-muted)" }}>B · The gaps — no clean arc peer</h2>

        <Block n="B1" title="Ghost-bordered (coral outline) — RESOLVED: new arc variant=&quot;outline&quot;" tags={["same"]} map="agent-btn agent-btn-ghost-bordered  →  <Button variant=&quot;outline&quot;>"
          note={<>The workhorse — the coral-outlined button (coral border + coral text, neutral shade on hover) on 104 call sites, including the Chase / Take-off-hold / Dismiss buttons on the hub. I added a <strong>new <code>outline</code> variant</strong> to the arc Button that ports agent-btn-ghost-bordered's tokens exactly (coral-deep border + text, hover → neutral shade + coral-darker). The proposed pane is that new variant — it should read identical to the shipped one. Check both themes.</>}
          current={<>
            <button className="agent-btn agent-btn-ghost-bordered agent-btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><PaperPlaneTilt size={13} weight="bold" /> Chase</button>
            <button className="agent-btn agent-btn-ghost-bordered agent-btn-md">Take off hold</button>
            <button className="agent-btn agent-btn-ghost-bordered agent-btn-md" disabled>Disabled</button>
          </>}
          proposed={<>
            <Button variant="outline" size="sm"><PaperPlaneTilt size={13} weight="bold" /> Chase</Button>
            <Button variant="outline" size="md">Take off hold</Button>
            <Button variant="outline" size="md" disabled>Disabled</Button>
          </>} />

        <Block n="B2" title="The xs size — 26px — RESOLVED: new arc size=&quot;xs&quot;" tags={["same"]} map="agent-btn agent-btn-xs (26px)  →  <Button size=&quot;xs&quot;> (26px)"
          note={<>agent-btn-xs is a <strong>26px</strong> micro-button (11px text, radius-sm) used in tight inline spots. I added a matching <strong><code>xs</code> size</strong> to arc (26px / 11px / radius-sm) so these migrate with <strong>no resize</strong>. Proposed pane is the new size — same height as the shipped xs.</>}
          current={<>
            <button className="agent-btn agent-btn-ghost-bordered agent-btn-xs">Edit</button>
            <button className="agent-btn agent-btn-primary agent-btn-xs">Save</button>
          </>}
          proposed={<>
            <Button variant="outline" size="xs">Edit</Button>
            <Button variant="primary" size="xs" style={coralOverride}>Save</Button>
          </>} />

        <Block n="B3" title="Neutral (Cancel) — 58 uses" tags={["decision"]} map="agent-btn agent-btn-neutral  →  <Button variant=&quot;secondary&quot;> (closest)"
          note={<>The canonical Cancel: a thin ink-ward border on a see-through fill. arc's nearest is <strong>secondary</strong> (solid white/outline). Reasonable map, but it changes a transparent Cancel into a filled pill. Confirm secondary is the right home for neutral, or keep it as a distinct quiet treatment.</>}
          current={<>
            <button className="agent-btn agent-btn-neutral agent-btn-md">Cancel</button>
            <button className="agent-btn agent-btn-neutral agent-btn-sm">Cancel</button>
          </>}
          proposed={<>
            <Button variant="secondary" size="md">Cancel</Button>
            <Button variant="secondary" size="sm">Cancel</Button>
          </>} />

        <Block n="B4" title="Icon-only buttons — RESOLVED: new arc icon mode" tags={["same"]} map="agent-btn agent-btn-icon-sm/md (square)  →  <Button icon size=…>"
          note={<>Square icon-only buttons (32 / 40px, no label). I added an <strong><code>icon</code> prop</strong> that drops the inline padding and squares the button to its size height. Proposed pane is <code>&lt;Button icon&gt;</code> at sm / md — square, matching the shipped icon buttons. (Note: arc's danger is a surface pill, so an icon danger follows whatever A4 lands on.)</>}
          current={<>
            <button className="agent-btn agent-btn-neutral agent-btn-icon-md" aria-label="Settings"><Gear size={18} /></button>
            <button className="agent-btn agent-btn-ghost-bordered agent-btn-icon-sm" aria-label="Add"><Plus size={15} weight="bold" /></button>
            <button className="agent-btn agent-btn-danger agent-btn-icon-sm" aria-label="Remove"><Trash size={15} /></button>
          </>}
          proposed={<>
            <Button variant="secondary" size="md" icon aria-label="Settings"><Gear size={18} /></Button>
            <Button variant="outline" size="sm" icon aria-label="Add"><Plus size={15} weight="bold" /></Button>
            <Button variant="danger" size="sm" icon aria-label="Remove"><Trash size={15} /></Button>
          </>} />

        <Block n="B5" title="Links styled as buttons — RESOLVED: buttonClasses() helper" tags={["same"]} map="<Link className=&quot;agent-btn…&quot;>  →  <Link className={buttonClasses({…})}>"
          note={<>Many CTAs are navigations, not actions — "View your portal", "All reviews on To-Do", footer links — rendered as <code>&lt;Link className="agent-btn…"&gt;</code>. Rather than force a polymorphic <code>asChild</code> into the motion component (risky), I exported <strong><code>buttonClasses(&#123;variant, size, icon&#125;)</code></strong> — the shadcn escape hatch. A <code>&lt;Link className=&#123;buttonClasses(…)&#125;&gt;</code> gets the <strong>identical</strong> arc look and stays a real anchor; it just skips the press-spring/label-morph, which a navigation doesn't need. Proposed pane is a real <code>&lt;a&gt;</code> styled with the helper.</>}
          current={<>
            <a className="agent-btn agent-btn-primary agent-btn-md" href="#" onClick={(e) => e.preventDefault()} style={coralOverride}>View your portal</a>
            <a className="agent-btn agent-btn-ghost agent-btn-sm" href="#" onClick={(e) => e.preventDefault()}>All reviews on To-Do</a>
          </>}
          proposed={<>
            <a className={buttonClasses({ variant: "primary", size: "md" })} href="#" onClick={(e) => e.preventDefault()} style={coralOverride}>View your portal</a>
            <a className={buttonClasses({ variant: "ghost", size: "sm" })} href="#" onClick={(e) => e.preventDefault()}>All reviews on To-Do</a>
          </>} />

        <section style={{ borderTop: "1px solid var(--compare-line)", padding: "26px 0 0" }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 650 }}>Where each decision stands</h3>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.75, maxWidth: 900, listStyle: "none" }}>
            <li><Tag kind="same" /> &nbsp;<strong>A1 primary → flat coral</strong> — accepted (gallery-blessed). Migrated call sites use <code>variant="primary"</code> + the coral token override.</li>
            <li><Tag kind="same" /> &nbsp;<strong>A3 ghost</strong> — maps clean to <code>variant="ghost"</code>.</li>
            <li><Tag kind="same" /> &nbsp;<strong>B1 coral outline</strong> — <strong>done</strong>: new <code>variant="outline"</code> ports it exactly. (Unblocks the hub buttons.)</li>
            <li><Tag kind="same" /> &nbsp;<strong>B2 xs 26px</strong> — <strong>done</strong>: new <code>size="xs"</code>, no resize.</li>
            <li><Tag kind="same" /> &nbsp;<strong>B4 icon-only</strong> — <strong>done</strong>: new <code>icon</code> prop squares it.</li>
            <li><Tag kind="same" /> &nbsp;<strong>B5 link CTAs</strong> — <strong>done</strong>: <code>buttonClasses()</code> gives <code>&lt;Link&gt;</code>/<code>&lt;a&gt;</code> the identical look as a real anchor.</li>
            <li style={{ marginTop: 8 }}><Tag kind="change" /> &nbsp;<strong>A2 secondary → solid</strong> — adopted arc's canonical secondary (the gallery already blessed it and the catalogue says it replaces the old glass secondary). Visible on migrated surfaces; caught per-surface at spot-check if solid-on-glass ever reads wrong.</li>
            <li><Tag kind="change" /> &nbsp;<strong>A4 danger → surface pill</strong> — adopted arc's danger. Red text stays; the resting fill becomes a surface pill.</li>
          </ul>
          <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--compare-body)", lineHeight: 1.6, maxWidth: 900 }}>
            The arc Button is now a <strong>complete</strong> drop-in for agent-btn: variants primary / secondary / ghost / danger / <strong>outline</strong>, sizes <strong>xs</strong> / sm / md / lg, an <strong>icon</strong> mode, and <code>buttonClasses()</code> for link CTAs. Nothing in production has changed yet. Next is the <strong>rollout</strong> — the hub first as the pilot (which also pulls RowActionMenu's trigger buttons into arc), rendered on a compare before it touches the live surface, then outward one surface at a time.
          </p>
        </section>
      </div>
    </div>
  );
}

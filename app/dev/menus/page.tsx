"use client";

// /dev/menus — candidate SURFACES for the little-menus / tooltips / popovers
// consolidation (critique: align all the tiny floating UI, light + dark).
//
// This page is about the LOOK only — pick the surface + hover treatment here.
// The behaviour half (portal to body, flip/shift to stay on screen, edge gutter,
// z-index above everything) is the shared primitive, built once the surface is
// signed off. Every specimen below is static-positioned on purpose.
//
// Dev-only: 404 in production.

import { notFound } from "next/navigation";
import { ThemeModeToggle } from "@/components/theme/ThemeModeToggle";

const ic = {
  note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  mail: '<path d="M3 7l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/>',
};
function Svg({ d, size = 15 }: { d: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />;
}

// One option's three specimens (menu / tooltip / rich popover) in the given surface.
function Specimens({ surf }: { surf: "a" | "b" | "c" }) {
  const s = `dm-surf dm-${surf}`;
  return (
    <div className="dm-specimens">
      <div className="dm-spec">
        <div className="dm-spec-lbl">Dropdown menu</div>
        <div className={`${s} dm-menu`} role="menu">
          <button className="dm-mi"><Svg d={ic.note} /> Add an update</button>
          <button className="dm-mi"><Svg d={ic.clock} /> Reschedule</button>
          <button className="dm-mi"><Svg d={ic.check} /> Mark done</button>
          <div className="dm-mdiv" />
          <button className="dm-mi"><Svg d={ic.trash} /> Remove</button>
        </div>
      </div>

      <div className="dm-spec">
        <div className="dm-spec-lbl">Tooltip</div>
        <div className={`${s} dm-tip`} role="tooltip">
          <div className="dm-tip-h"><Svg d={ic.mail} size={12} /> Email</div>
          <div className="dm-tip-s">Auto · Logged</div>
          <div className="dm-tip-w">16 Oct 2026, 20:05</div>
        </div>
      </div>

      <div className="dm-spec">
        <div className="dm-spec-lbl">Rich popover</div>
        <div className={`${s} dm-pop`}>
          <div className="dm-lab">New date</div>
          <input className="dm-in" type="date" defaultValue="2026-10-30" />
          <div className="dm-lab" style={{ marginTop: 10 }}>Update <span style={{ fontWeight: 500, textTransform: "none", letterSpacing: 0 }}>(optional)</span></div>
          <input className="dm-in" placeholder="What's happened?" />
          <div className="dm-row">
            <button className="dm-btn">Cancel</button>
            <button className="dm-btn primary">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DevMenusPage() {
  // Viewable on local + staging (for device review), 404 only on real production.
  if (process.env.VERCEL_ENV === "production") notFound();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="dm-page">
        <div className="dm-head">
          <div>
            <h1 className="dm-h1">Little menus — surface options</h1>
            <p className="dm-sub">Pick the one surface + hover we align every dropdown, tooltip and popover to. Toggle light/dark (top-right) — both have to work. This is look only; the positioning fixes (never clipped, never hugging the edge) come with the shared primitive afterwards.</p>
          </div>
          <ThemeModeToggle initialMode="light" />
        </div>

        <section className="dm-sec">
          <div className="dm-sechead"><span className="dm-letter">A</span><span className="dm-name">Solid elevated</span><span className="dm-rec">My recommendation</span></div>
          <p className="dm-desc">Opaque surface, hairline border, soft shadow. Nothing shows through, so text is always crisp over any background. Quietest of the three. Hover = a coral tint on the row (no lift).</p>
          <Specimens surf="a" />
        </section>

        <section className="dm-sec">
          <div className="dm-sechead"><span className="dm-letter">B</span><span className="dm-name">Frosted glass</span></div>
          <p className="dm-desc">Translucent with a blur — the "see-through" look, done consistently. Feels light and modern, but busy content behind it can reduce legibility (the reason some current ones are hard to read).</p>
          <Specimens surf="b" />
        </section>

        <section className="dm-sec">
          <div className="dm-sechead"><span className="dm-letter">C</span><span className="dm-name">High contrast</span></div>
          <p className="dm-desc">A dark, near-opaque surface with light text in both themes — maximum legibility sitting over anything. Natural for tooltips; bold for menus. If we want tooltips to differ from menus, this is the tooltip candidate.</p>
          <Specimens surf="c" />
        </section>

        <footer className="dm-foot">
          <p className="dm-desc" style={{ margin: 0 }}><b style={{ color: "var(--agent-text-primary)" }}>The hover rule</b> (same everywhere): menu rows get a soft tint on hover, never a lift — lift is for cards, not list rows. Tooltips don't hover. Tell me which surface (and whether tooltips should use C while menus use your pick), and I'll build the shared primitive to it — then wire the behaviour and migrate.</p>
        </footer>
      </div>
    </>
  );
}

const CSS = `
.dm-page { position:relative; z-index:1; max-width:1060px; margin:0 auto; padding:40px 28px 120px; color:var(--agent-text-primary); font-family:var(--font-geist-sans, system-ui, sans-serif); }
.dm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; }
.dm-h1 { font-size:26px; font-weight:760; letter-spacing:-0.02em; margin:0; color:var(--agent-text-primary); }
.dm-sub { font-size:14px; color:var(--agent-text-muted); margin:9px 0 0; max-width:66ch; line-height:1.55; }
.dm-sec { margin-top:44px; }
.dm-sechead { display:flex; align-items:center; gap:11px; margin-bottom:6px; }
.dm-letter { width:26px; height:26px; border-radius:8px; background:var(--agent-text-primary); color:var(--agent-surface-elevated); font-size:13px; font-weight:800; display:grid; place-items:center; }
.dm-name { font-size:16px; font-weight:720; color:var(--agent-text-primary); }
.dm-rec { font-size:11px; font-weight:800; color:var(--agent-success,#1f8a4c); background:rgba(31,138,76,0.13); padding:3px 10px; border-radius:999px; }
.dm-desc { font-size:13px; color:var(--agent-text-muted); margin:0 0 18px; max-width:72ch; line-height:1.55; }
.dm-specimens { display:flex; gap:30px; flex-wrap:wrap; align-items:flex-start; }
.dm-spec-lbl { font-size:10.5px; font-weight:750; letter-spacing:0.06em; text-transform:uppercase; color:var(--agent-text-faint,#b8a894); margin-bottom:9px; }
.dm-foot { margin-top:48px; border-top:2px solid var(--agent-coral); padding-top:20px; }

.dm-surf { border-radius:12px; }
.dm-a { background:var(--agent-surface-elevated); border:0.5px solid var(--agent-border-subtle); box-shadow:0 12px 30px rgba(20,12,6,0.16); }
.dm-b { background:var(--agent-surface-glass, rgba(255,255,255,0.55)); -webkit-backdrop-filter:blur(22px); backdrop-filter:blur(22px); border:0.5px solid var(--agent-border-subtle); box-shadow:0 12px 30px rgba(20,12,6,0.16); }
.dm-c { background:#211a14; color:#fff; border:0.5px solid rgba(255,255,255,0.14); box-shadow:0 16px 42px rgba(0,0,0,0.5); }

.dm-menu { width:212px; padding:6px; }
.dm-mi { display:flex; align-items:center; gap:10px; width:100%; padding:9px 11px; border:none; background:none; border-radius:8px; cursor:pointer; font-family:inherit; font-size:13px; font-weight:550; text-align:left; color:var(--agent-text-secondary); transition:background .12s, color .12s; }
.dm-mi > svg { color:var(--agent-text-muted); flex-shrink:0; }
.dm-mi:hover { background:var(--agent-coral-bg-tint, rgba(255,107,74,0.09)); color:var(--agent-text-primary); }
.dm-mi:hover > svg { color:var(--agent-coral-deep, #f0471e); }
.dm-c .dm-mi { color:rgba(255,255,255,0.82); }
.dm-c .dm-mi > svg { color:rgba(255,255,255,0.58); }
.dm-c .dm-mi:hover { background:rgba(255,255,255,0.10); color:#fff; }
.dm-c .dm-mi:hover > svg { color:#fff; }
.dm-mdiv { height:1px; background:var(--agent-border-subtle); margin:5px 8px; }
.dm-c .dm-mdiv { background:rgba(255,255,255,0.11); }

.dm-tip { width:222px; padding:11px 13px; }
.dm-tip-h { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.03em; color:var(--agent-text-muted); margin-bottom:6px; }
.dm-c .dm-tip-h { color:rgba(255,255,255,0.62); }
.dm-tip-s { font-size:13.5px; font-weight:720; color:var(--agent-text-primary); }
.dm-c .dm-tip-s { color:#fff; }
.dm-tip-w { font-size:11.5px; color:var(--agent-text-muted); margin-top:2px; font-variant-numeric:tabular-nums; }
.dm-c .dm-tip-w { color:rgba(255,255,255,0.55); }

.dm-pop { width:250px; padding:13px; }
.dm-lab { font-size:10px; font-weight:750; letter-spacing:.06em; text-transform:uppercase; color:var(--agent-text-muted); margin-bottom:5px; }
.dm-c .dm-lab { color:rgba(255,255,255,0.6); }
.dm-in { width:100%; box-sizing:border-box; font-family:inherit; font-size:12px; padding:7px 9px; border-radius:8px; border:0.5px solid var(--agent-border-default); background:var(--agent-surface-glass,#fff); color:var(--agent-text-primary); }
.dm-c .dm-in { border-color:rgba(255,255,255,0.2); background:rgba(255,255,255,0.08); color:#fff; }
.dm-row { display:flex; gap:6px; justify-content:flex-end; margin-top:12px; }
.dm-btn { font-family:inherit; font-size:12px; font-weight:650; padding:6px 13px; border-radius:9px; cursor:pointer; border:0.5px solid var(--agent-border-default); background:transparent; color:var(--agent-text-secondary); }
.dm-c .dm-btn { border-color:rgba(255,255,255,0.22); color:rgba(255,255,255,0.85); }
.dm-btn.primary { background:var(--agent-coral); border-color:transparent; color:#fff; }
`;

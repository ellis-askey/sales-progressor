"use client";

// /dev/chain-complete — POLISH exploration for the chain-completeness UI, now that
// it's live. Three things: (1) a proper redesign of the Complete / Not-complete
// control with real hover affordances on TSP tokens, (2) the chain connecting line
// going green when complete, (3) a completion filter on the Chains page. Renders in
// the real agent surface so fit is honest. Nothing wired to data. Blocks in prod.

import { useState } from "react";
import { notFound } from "next/navigation";
import { Circle, CheckCircle, Check } from "@phosphor-icons/react";

/* ── a faithful mock of the chain mini-map strip (SVG line + dots), so the green
   line can be judged in context. Mirrors components/chain/ChainMiniMap.tsx. ── */
function ChainStrip({ complete, total = 6, youIndex = 5 }: { complete: boolean; total?: number; youIndex?: number }) {
  const R = 13;
  const gap = 52;
  const padX = R + 2;
  const cx = (i: number) => padX + i * gap + R;
  const width = padX * 2 + (total - 1) * gap + 2 * R;
  const cy = R;
  const lineColor = complete ? "var(--agent-success)" : "var(--agent-border-strong)";
  return (
    <div style={{ overflowX: "auto", overflowY: "hidden", padding: "2px 0" }}>
      <div style={{ position: "relative", width, height: 2 * R + 16 }}>
        <svg width={width} height={2 * R} style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden>
          <g stroke={lineColor} strokeWidth={2} strokeLinecap="round" style={{ transition: "stroke 220ms ease" }}>
            {Array.from({ length: total - 1 }).map((_, i) => (
              <line key={i} x1={cx(i) + R} y1={cy} x2={cx(i + 1) - R} y2={cy} />
            ))}
          </g>
        </svg>
        {Array.from({ length: total }).map((_, i) => {
          const isYou = i === youIndex;
          return (
            <span
              key={i}
              style={{
                position: "absolute", left: cx(i) - R, top: cy - R, width: 2 * R, height: 2 * R,
                borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 680, fontVariantNumeric: "tabular-nums", boxSizing: "border-box",
                background: isYou ? "var(--agent-coral-deep)" : "var(--agent-surface-elevated)",
                color: isYou ? "#fff" : "var(--agent-text-secondary)",
                border: isYou ? "1.5px solid var(--agent-coral-deep)" : "1.5px solid var(--agent-border-default)",
              }}
            >
              {i + 1}
              {isYou && (
                <span style={{ position: "absolute", top: 2 * R + 1, left: R, transform: "translateX(-50%)", fontSize: 9.5, fontWeight: 700, color: "var(--agent-coral-deep)", whiteSpace: "nowrap" }}>You</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* The real view toggle, reused verbatim, so the button can be judged beside it. */
function ViewToggle() {
  return (
    <div className="chain-viewswitch" style={{ margin: 0, "--vs-idx": 0 } as React.CSSProperties}>
      <button type="button" className="chain-vs-btn on">Timeline</button>
      <button type="button" className="chain-vs-btn">Map</button>
      <button type="button" className="chain-vs-btn">Activity</button>
    </div>
  );
}

function Spec({ n, title, caption, children }: { n: number | string; title: string; caption: string; children: React.ReactNode }) {
  return (
    <section className="cc-spec">
      <div className="cc-spec-head"><span className="cc-num">{n}</span><h2 className="cc-spec-title">{title}</h2></div>
      <p className="cc-cap">{caption}</p>
      <div className="cc-stage">{children}</div>
    </section>
  );
}

export default function DevChainCompletePolish() {
  if (process.env.NODE_ENV === "production") notFound();

  const [lineComplete, setLineComplete] = useState(false);
  const [filterVariant, setFilterVariant] = useState<"check" | "segment">("segment");

  return (
    <div className="cc-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <p className="cc-eyebrow">Polish pass · not wired up · hover the buttons</p>
      <h1 className="cc-h1">Chain completeness — making it feel like TSP</h1>
      <p className="cc-lead">
        Three things: a proper button (the live one reads like a warning and has no hover), the chain line going green
        when complete, and a filter on the Chains page. Everything renders on the real tokens, so what you see is the fit.
      </p>

      {/* 1 — THE BUTTON */}
      <Spec
        n={1}
        title="The button, redesigned"
        caption="Three fixes: amber → neutral (an unconfirmed chain isn't a warning), drop the dashed icon, and add a hover that previews what clicking does. Hover each to feel it. Shown in both states; pick the weight that fits."
      >
        <div className="cc-now">
          <span className="cc-now-label">Live now</span>
          <span className="cc-live-pill"><span className="cc-live-dash" aria-hidden />Not complete</span>
          <span className="cc-now-note">amber (reads as an error), dashed circle, nothing on hover</span>
        </div>

        <div className="cc-opts">
          {/* A — preview-on-hover pill */}
          <div className="cc-opt">
            <p className="cc-opt-name">A · Preview-on-hover pill <span className="cc-rec">recommended</span></p>
            <p className="cc-opt-note">Quiet when not done; hovering fills it green and names the action. Hovering a complete one offers the undo.</p>
            <div className="cc-row2">
              <button type="button" className="cc-A">
                <span className="cc-at-rest"><Circle size={13} weight="bold" />Not complete</span>
                <span className="cc-on-hover"><CheckCircle size={13} weight="fill" />Mark complete</span>
              </button>
              <button type="button" className="cc-A is-complete">
                <span className="cc-at-rest"><CheckCircle size={13} weight="fill" />Complete</span>
                <span className="cc-on-hover"><Circle size={13} weight="bold" />Mark not complete</span>
              </button>
            </div>
          </div>

          {/* B — checkbox */}
          <div className="cc-opt">
            <p className="cc-opt-name">B · Checkbox</p>
            <p className="cc-opt-note">Reads unmistakably as a thing you tick. Matches the checkboxes already in the Filters menu.</p>
            <div className="cc-row2">
              <button type="button" className="cc-B"><span className="cc-box" aria-hidden />Chain complete</button>
              <button type="button" className="cc-B is-complete"><span className="cc-box" aria-hidden><Check size={10} weight="bold" /></span>Chain complete</button>
            </div>
          </div>

          {/* C — toggle switch */}
          <div className="cc-opt">
            <p className="cc-opt-name">C · Toggle switch</p>
            <p className="cc-opt-note">A physical on/off. The knob slides and the track greens. Reads as &ldquo;a state I control&rdquo; more than a status.</p>
            <div className="cc-row2">
              <button type="button" className="cc-sw"><span className="cc-sw-track"><span className="cc-sw-knob" /></span>Complete</button>
              <button type="button" className="cc-sw is-complete"><span className="cc-sw-track"><span className="cc-sw-knob" /></span>Complete</button>
            </div>
          </div>

          {/* D — segmented two-state */}
          <div className="cc-opt">
            <p className="cc-opt-name">D · Segmented</p>
            <p className="cc-opt-note">Both states are visible; you pick a side. No ambiguity about what the current state is or how to change it.</p>
            <div className="cc-row2">
              <div className="cc-seg2"><button type="button" className="on cc-seg-not">Not complete</button><button type="button">Complete</button></div>
              <div className="cc-seg2"><button type="button" className="cc-seg-not">Not complete</button><button type="button" className="on">Complete</button></div>
            </div>
          </div>

          {/* E — icon-only */}
          <div className="cc-opt">
            <p className="cc-opt-name">E · Icon only</p>
            <p className="cc-opt-note">Smallest footprint — a single glyph beside the toggle. Hover (and the tooltip) carry the meaning. Hollow ring ↔ filled check.</p>
            <div className="cc-row2">
              <button type="button" className="cc-ico" title="Mark this chain complete"><Circle size={18} weight="bold" /></button>
              <button type="button" className="cc-ico is-complete" title="Chain complete — click to undo"><CheckCircle size={18} weight="fill" /></button>
              <span className="cc-ico-hint">(hover for the tooltip)</span>
            </div>
          </div>

          {/* F — quiet status */}
          <div className="cc-opt">
            <p className="cc-opt-name">F · Quiet status</p>
            <p className="cc-opt-note">Lowest emphasis, stays out of the way. Reads as a label until you hover, when it underlines and names the action.</p>
            <div className="cc-row2">
              <button type="button" className="cc-C">
                <span className="cc-dot" aria-hidden />
                <span className="cc-C-rest">Not complete</span>
                <span className="cc-C-hover">Mark complete</span>
              </button>
              <button type="button" className="cc-C is-complete">
                <span className="cc-dot" aria-hidden />
                <span className="cc-C-rest">Complete</span>
                <span className="cc-C-hover">Mark not complete</span>
              </button>
            </div>
          </div>
        </div>

        {/* In context — option A on the real toggle row */}
        <p className="cc-ctx-label">In context — option A on the real toggle row</p>
        <div className="cc-drawer">
          <div className="cc-row">
            <ViewToggle />
            <button type="button" className="cc-A" style={{ margin: 0 }}>
              <span className="cc-at-rest"><Circle size={13} weight="bold" />Not complete</span>
              <span className="cc-on-hover"><CheckCircle size={13} weight="fill" />Mark complete</span>
            </button>
          </div>
        </div>
      </Spec>

      {/* 2 — GREEN LINE */}
      <Spec
        n={2}
        title="The chain line goes green when complete"
        caption="The line joining the sales is one SVG stroke, so it recolours in one place. Green when your side has marked the chain complete; the normal grey otherwise. Toggle it."
      >
        <div style={{ marginBottom: 16 }}>
          <button type="button" className={`cc-switch-btn${!lineComplete ? " on" : ""}`} onClick={() => setLineComplete(false)}>Not complete</button>
          <button type="button" className={`cc-switch-btn${lineComplete ? " on" : ""}`} onClick={() => setLineComplete(true)}>Complete</button>
        </div>
        <div className="cc-card">
          <div className="cc-card-head">
            <div className="cc-thumb" aria-hidden />
            <div>
              <p className="cc-card-title">16 Deans Furlong</p>
              <p className="cc-card-sub">Tring, HP23 4AR · Sale agreed 3 months ago</p>
            </div>
            <button type="button" className={`cc-A cc-card-pill${lineComplete ? " is-complete" : ""}`} onClick={() => setLineComplete((v) => !v)}>
              {lineComplete
                ? <span className="cc-at-rest"><CheckCircle size={13} weight="fill" />Complete</span>
                : <span className="cc-at-rest"><Circle size={13} weight="bold" />Not complete</span>}
            </button>
          </div>
          <ChainStrip complete={lineComplete} />
          <div className="cc-card-foot">5 below you · 2 of 6 connected · 2 to invite</div>
        </div>
        <p className="cc-note">
          Subtle by design — the green reads as &ldquo;this one&rsquo;s settled&rdquo; at a glance across the grid, without shouting. We can
          make it bolder if you want it louder.
        </p>
      </Spec>

      {/* 3 — FILTER */}
      <Spec
        n={3}
        title="Filtering by completeness on the Chains page"
        caption="Added to the existing Filters menu. Two ways to phrase it — flip between them. (It's your own view: a chain is complete when you've marked it, so the wording is first-person.)"
      >
        <div style={{ marginBottom: 16 }}>
          <button type="button" className={`cc-switch-btn${filterVariant === "segment" ? " on" : ""}`} onClick={() => setFilterVariant("segment")}>A · Segmented</button>
          <button type="button" className={`cc-switch-btn${filterVariant === "check" ? " on" : ""}`} onClick={() => setFilterVariant("check")}>B · Checkbox</button>
        </div>
        <div className="cc-menu">
          <div className="cc-menu-label">Sort by</div>
          <div className="cc-mi"><span>Needs attention</span><Check size={13} weight="bold" style={{ color: "var(--agent-coral-deep)" }} /></div>
          <div className="cc-mi"><span>Longest chain</span></div>
          <div className="cc-mi"><span>Recently agreed</span></div>
          <div className="cc-menu-div" />
          {filterVariant === "segment" ? (
            <>
              <div className="cc-menu-label">Completeness</div>
              <div className="cc-seg3">
                <button type="button" className="on">All</button>
                <button type="button">Complete</button>
                <button type="button">Not complete</button>
              </div>
              <div className="cc-menu-div" />
            </>
          ) : (
            <div className="cc-mi"><span>Only chains I haven&rsquo;t completed</span><span className="cc-mini-box" aria-hidden /></div>
          )}
          <div className="cc-mi"><span>Only with agents to invite</span><span className="cc-mini-box" aria-hidden /></div>
        </div>
        <p className="cc-note">
          My lean: the segmented version — it lets you jump straight to the complete ones or the unfinished ones, which is
          the actual question. The checkbox is lighter but one-directional.
        </p>
      </Spec>

      <section className="cc-spec cc-ask">
        <div className="cc-spec-head"><span className="cc-num cc-num-q">·</span><h2 className="cc-spec-title">To decide</h2></div>
        <p className="cc-cap" style={{ maxWidth: 640 }}>
          Pick a button (A / B / C), say if the green line is the right loudness, and pick a filter phrasing. Then I&rsquo;ll
          build the three for real — the line and filter need the Chains list to carry each chain&rsquo;s completeness (a small
          backend add alongside the pill that already exists).
        </p>
      </section>
    </div>
  );
}

const CSS = `
.cc-wrap { max-width: 880px; margin: 0 auto; padding: 48px 22px 140px; color: var(--agent-text-primary); }
.cc-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: var(--agent-coral-deep); margin: 0 0 10px; }
.cc-h1 { font-size: 30px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 10px; }
.cc-lead { font-size: 14.5px; line-height: 1.6; color: var(--agent-text-secondary); margin: 0; max-width: 640px; }

.cc-spec { margin-top: 48px; }
.cc-spec-head { display: flex; align-items: center; gap: 11px; }
.cc-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--agent-coral-deep), color-mix(in srgb, var(--agent-coral) 72%, #fff)); }
.cc-num-q { background: var(--agent-text-muted); }
.cc-spec-title { font-size: 17px; font-weight: 750; letter-spacing: -.01em; margin: 0; }
.cc-cap { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 10px 0 18px; max-width: 700px; }
.cc-stage { background: color-mix(in srgb, var(--agent-surface-elevated) 55%, transparent); border: 1px solid var(--agent-border-subtle); border-radius: 18px; padding: 22px; }
.cc-note { font-size: 12.5px; line-height: 1.55; color: var(--agent-text-muted); margin: 14px 0 0; max-width: 680px; }

/* live-now reference */
.cc-now { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 0 0 18px; margin-bottom: 18px; border-bottom: 1px dashed var(--agent-border-default); }
.cc-now-label { font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase; color: var(--agent-text-muted); }
.cc-now-note { font-size: 12px; color: var(--agent-text-muted); }
.cc-live-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 999px; background: color-mix(in srgb, var(--agent-warning) 13%, transparent); color: var(--agent-warning); }
.cc-live-dash { width: 11px; height: 11px; border-radius: 999px; border: 1.5px dashed currentColor; }

.cc-opts { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.cc-opt { }
.cc-opt-name { font-size: 13px; font-weight: 750; margin: 0 0 3px; display: flex; align-items: center; gap: 7px; }
.cc-rec { font-size: 9.5px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: var(--agent-success); background: color-mix(in srgb, var(--agent-success) 14%, transparent); padding: 2px 6px; border-radius: 99px; }
.cc-opt-note { font-size: 11.5px; line-height: 1.5; color: var(--agent-text-muted); margin: 0 0 11px; }
.cc-row2 { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }

/* Option A — preview-on-hover pill */
.cc-A { display: inline-flex; align-items: center; font: inherit; font-size: 12px; font-weight: 700; white-space: nowrap; cursor: pointer; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--agent-border-default); background: transparent; color: var(--agent-text-secondary); transition: background .16s, box-shadow .16s, color .16s, transform .16s, border-color .16s; }
.cc-A .cc-at-rest, .cc-A .cc-on-hover { display: inline-flex; align-items: center; gap: 6px; }
.cc-A .cc-on-hover { display: none; }
.cc-A:hover { color: var(--agent-success); border-color: transparent; background: color-mix(in srgb, var(--agent-success) 11%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--agent-success) 34%, transparent), var(--agent-hover-lift); transform: translateY(-1px); }
.cc-A:hover .cc-at-rest { display: none; }
.cc-A:hover .cc-on-hover { display: inline-flex; }
.cc-A:active { transform: translateY(0); }
.cc-A.is-complete { background: color-mix(in srgb, var(--agent-success) 14%, transparent); border-color: transparent; color: var(--agent-success); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--agent-success) 22%, transparent); }
.cc-A.is-complete:hover { background: color-mix(in srgb, var(--agent-text-muted) 10%, transparent); color: var(--agent-text-secondary); box-shadow: inset 0 0 0 1px var(--agent-border-default), var(--agent-hover-lift); }

/* Option B — checkbox */
.cc-B { display: inline-flex; align-items: center; gap: 8px; font: inherit; font-size: 12px; font-weight: 650; white-space: nowrap; cursor: pointer; padding: 6px 12px 6px 10px; border-radius: 10px; border: 1px solid transparent; background: transparent; color: var(--agent-text-secondary); transition: background .16s, box-shadow .16s, color .16s, transform .16s; }
.cc-B .cc-box { width: 16px; height: 16px; border-radius: 5px; border: 1.5px solid var(--agent-border-strong); background: transparent; display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: background .16s, border-color .16s; }
.cc-B:hover { color: var(--agent-text-primary); background: var(--agent-surface-glass); box-shadow: var(--agent-hover-lift); transform: translateY(-1px); }
.cc-B:hover .cc-box { border-color: var(--agent-success); }
.cc-B.is-complete { color: var(--agent-text-primary); }
.cc-B.is-complete .cc-box { background: var(--agent-success); border-color: var(--agent-success); }

/* Option C — toggle switch */
.cc-sw { display: inline-flex; align-items: center; gap: 9px; font: inherit; font-size: 12px; font-weight: 650; white-space: nowrap; cursor: pointer; padding: 4px 2px; border: none; background: none; color: var(--agent-text-muted); transition: color .16s; }
.cc-sw-track { width: 34px; height: 20px; border-radius: 999px; background: var(--agent-border-default); position: relative; flex-shrink: 0; box-shadow: inset 0 0 0 1px rgba(var(--agent-shadow-rgb), 0.06); transition: background .18s; }
.cc-sw-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb), 0.28); transition: transform .2s cubic-bezier(.34,1.56,.64,1); }
.cc-sw:hover { color: var(--agent-text-secondary); }
.cc-sw.is-complete { color: var(--agent-text-primary); }
.cc-sw.is-complete .cc-sw-track { background: var(--agent-success); }
.cc-sw.is-complete .cc-sw-knob { transform: translateX(14px); }

/* Option D — segmented two-state */
.cc-seg2 { display: inline-flex; padding: 3px; background: rgba(var(--agent-shadow-rgb), 0.05); border-radius: 999px; }
.cc-seg2 button { font: inherit; font-size: 11.5px; font-weight: 650; color: var(--agent-text-muted); padding: 5px 12px; border: none; background: none; border-radius: 999px; cursor: pointer; transition: color .15s, background .15s; }
.cc-seg2 button:hover:not(.on) { color: var(--agent-text-secondary); }
.cc-seg2 button.on { color: #fff; background: var(--agent-success); box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb), 0.15); }
.cc-seg2 button.on.cc-seg-not { background: var(--agent-text-muted); }

/* Option E — icon only */
.cc-ico { width: 32px; height: 32px; border-radius: 9px; border: 1px solid transparent; background: transparent; color: var(--agent-text-muted); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: color .15s, background .15s, box-shadow .15s, transform .15s; }
.cc-ico:hover { color: var(--agent-success); background: var(--agent-surface-glass); box-shadow: var(--agent-hover-lift); transform: translateY(-1px); }
.cc-ico:active { transform: translateY(0); }
.cc-ico.is-complete { color: var(--agent-success); }
.cc-ico.is-complete:hover { color: var(--agent-text-secondary); }
.cc-ico-hint { font-size: 11px; color: var(--agent-text-muted); }

/* Option F — quiet status */
.cc-C { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 12.5px; font-weight: 650; white-space: nowrap; cursor: pointer; padding: 5px 4px; border: none; background: none; color: var(--agent-text-muted); transition: color .16s; }
.cc-C .cc-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--agent-border-strong); transition: background .16s; }
.cc-C.is-complete { color: var(--agent-text-secondary); }
.cc-C.is-complete .cc-dot { background: var(--agent-success); }
.cc-C .cc-C-hover { display: none; }
.cc-C:hover { color: var(--agent-coral-deep); }
.cc-C:hover .cc-dot { background: var(--agent-coral-deep); }
.cc-C.is-complete:hover { color: var(--agent-text-secondary); }
.cc-C.is-complete:hover .cc-dot { background: var(--agent-border-strong); }
.cc-C:hover .cc-C-rest { display: none; }
.cc-C:hover .cc-C-hover { display: inline; text-decoration: underline; text-underline-offset: 2px; }

/* in-context drawer row */
.cc-ctx-label, .cc-opt-name + .cc-opt-note { }
.cc-ctx-label { font-size: 11px; font-weight: 700; color: var(--agent-text-muted); margin: 22px 0 8px; }
.cc-drawer { background: color-mix(in srgb, var(--agent-surface-elevated) 70%, transparent); border: 1px solid var(--agent-border-subtle); border-radius: 14px; padding: 12px 16px; }
.cc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

/* green-line card */
.cc-switch-btn { font: inherit; font-size: 12px; font-weight: 600; color: var(--agent-text-muted); padding: 6px 13px; border: 1px solid var(--agent-border-default); background: transparent; cursor: pointer; }
.cc-switch-btn:first-child { border-radius: 8px 0 0 8px; }
.cc-switch-btn:last-child { border-radius: 0 8px 8px 0; border-left: none; }
.cc-switch-btn.on { color: var(--agent-text-primary); background: var(--agent-surface-elevated); box-shadow: inset 0 0 0 1px var(--agent-border-strong); }
.cc-card { background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-default); border-radius: 14px; padding: 16px; max-width: 460px; box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb), 0.05); }
.cc-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.cc-thumb { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; background: linear-gradient(135deg, color-mix(in srgb, var(--agent-coral) 30%, var(--agent-surface-elevated)), var(--agent-surface-glass)); }
.cc-card-title { margin: 0; font-size: 14px; font-weight: 700; }
.cc-card-sub { margin: 2px 0 0; font-size: 11.5px; color: var(--agent-text-muted); }
.cc-card-pill { margin-left: auto; }
.cc-card-foot { margin-top: 12px; font-size: 11.5px; color: var(--agent-text-muted); }

/* filter menu mock */
.cc-menu { width: 248px; padding: 7px; border-radius: 12px; background: var(--agent-surface-elevated); border: 1px solid var(--agent-border-default); box-shadow: 0 12px 30px rgba(var(--agent-shadow-rgb), 0.16); }
.cc-menu-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--agent-text-muted); padding: 4px 10px 6px; }
.cc-menu-div { height: 1px; background: var(--agent-border-subtle); margin: 6px 4px; }
.cc-mi { display: flex; align-items: center; justify-content: space-between; padding: 7px 11px; font-size: 12.5px; border-radius: 8px; cursor: pointer; }
.cc-mi:hover { background: var(--agent-hover-tint); }
.cc-mini-box { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid var(--agent-border-strong); flex-shrink: 0; }
.cc-seg3 { display: flex; gap: 0; margin: 2px 6px 4px; padding: 3px; background: rgba(var(--agent-shadow-rgb), 0.05); border-radius: 9px; }
.cc-seg3 button { flex: 1; font: inherit; font-size: 11.5px; font-weight: 600; color: var(--agent-text-muted); padding: 5px 4px; border: none; background: none; border-radius: 7px; cursor: pointer; }
.cc-seg3 button.on { color: var(--agent-text-primary); background: var(--agent-surface-elevated); box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb), 0.12); }

.cc-ask { border-top: 1px solid var(--agent-border-subtle); padding-top: 28px; }
`;

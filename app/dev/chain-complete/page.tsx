"use client";

// /dev/chain-complete — a minimal preview of the chain "Complete / Not complete"
// status pill, sitting right-aligned on the same row as the real Timeline / Map /
// Activity toggle (reusing .chain-viewswitch from globals.css). Plus a tiny live
// demo of how the status is decided. Nothing is wired to data. Blocks in prod.

import { useState } from "react";
import { notFound } from "next/navigation";
import { CheckCircle, CircleDashed } from "@phosphor-icons/react";

/* The real view toggle, reused verbatim (Timeline active, like the screenshot). */
function ViewToggle() {
  return (
    <div className="chain-viewswitch" style={{ margin: 0, "--vs-idx": 0 } as React.CSSProperties}>
      <button type="button" className="chain-vs-btn on">Timeline</button>
      <button type="button" className="chain-vs-btn">Map</button>
      <button type="button" className="chain-vs-btn">Activity</button>
    </div>
  );
}

/* The new piece: one small status pill. */
function StatusPill({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="cc-status cc-status-ok">
      <CheckCircle size={14} weight="fill" /> Complete
    </span>
  ) : (
    <span className="cc-status cc-status-no">
      <CircleDashed size={14} weight="bold" /> Not complete
    </span>
  );
}

export default function DevChainCompletePreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const [demo, setDemo] = useState(false); // the header-row state switcher
  const [top, setTop] = useState(false); // "nothing above this" confirmed on the top property
  const [fellThrough, setFellThrough] = useState(false); // a sale in the chain withdrew
  const computed = top && !fellThrough;

  return (
    <div className="cc-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <p className="cc-eyebrow">Preview · not wired up</p>
      <h1 className="cc-h1">Chain: Complete / Not complete</h1>
      <p className="cc-lead">
        One small status pill, right-aligned on the same row as the Timeline / Map / Activity toggle. That&rsquo;s the
        whole visible addition. Below it: how the status gets decided, and what&rsquo;s actually new.
      </p>

      {/* 1 — the pill on the toggle row */}
      <section className="cc-spec">
        <div className="cc-spec-head"><span className="cc-num">1</span><h2 className="cc-spec-title">On the chain toggle row</h2></div>
        <p className="cc-cap">Exactly where you pictured it. The toggle on the left is the real component; the pill is the new bit, right-aligned on the same row.</p>
        <div className="cc-drawer">
          <div className="cc-row">
            <ViewToggle />
            <StatusPill complete={demo} />
          </div>
          <div className="cc-drawer-hint">…chain cards below…</div>
        </div>
        <div className="cc-switch">
          <button type="button" className={!demo ? "on" : ""} onClick={() => setDemo(false)}>Show &ldquo;Not complete&rdquo;</button>
          <button type="button" className={demo ? "on" : ""} onClick={() => setDemo(true)}>Show &ldquo;Complete&rdquo;</button>
        </div>
      </section>

      {/* 2 — how it's decided (live) */}
      <section className="cc-spec">
        <div className="cc-spec-head"><span className="cc-num">2</span><h2 className="cc-spec-title">How it&rsquo;s decided</h2></div>
        <p className="cc-cap">
          The bottom is the anchor (chains are built up from it), so the only open question is the <strong>top</strong>:
          has it reached a seller not buying on. Complete = top confirmed, and nothing&rsquo;s fallen through. Toggle both to watch it decide.
        </p>
        <div className="cc-decide">
          <label className="cc-check">
            <input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} />
            <span><strong>Marked complete</strong> — the agent confirms the top property is the top (nothing above)</span>
          </label>
          <label className="cc-check">
            <input type="checkbox" checked={fellThrough} onChange={(e) => setFellThrough(e.target.checked)} />
            <span><strong>A sale fell through</strong> — a link in the chain withdrew (already detected today)</span>
          </label>
          <div className="cc-arrow">→</div>
          <StatusPill complete={computed} />
        </div>
        <p className="cc-note">
          Marking it complete <em>is</em> confirming the top property is the top. The add-above / add-below buttons stay
          available everywhere on the live chain, so if something turns up above, they just add it and this clears.
        </p>
      </section>

      {/* 3 — what's actually new */}
      <section className="cc-spec cc-ask">
        <div className="cc-spec-head"><span className="cc-num cc-num-q">·</span><h2 className="cc-spec-title">What&rsquo;s actually new</h2></div>
        <p className="cc-cap" style={{ maxWidth: 640 }}>
          Just two things: the agent&rsquo;s <strong>&ldquo;complete&rdquo; confirmation</strong> (one saved flag — the top property
          is the top) and <strong>this pill</strong>. The add-time Top/Middle/Bottom picker is untouched — it stays a
          throwaway convenience for hiding add buttons <em>while building</em>, and is never persisted or reused. The
          fall-through detection and the chain structure already exist. Internal only — nothing is announced to the rest of the chain.
        </p>
      </section>
    </div>
  );
}

const CSS = `
.cc-wrap { max-width: 820px; margin: 0 auto; padding: 48px 22px 140px; color: var(--agent-text-primary); }
.cc-eyebrow { font-size: 11px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; color: var(--agent-coral-deep); margin: 0 0 10px; }
.cc-h1 { font-size: 30px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 10px; }
.cc-lead { font-size: 14.5px; line-height: 1.6; color: var(--agent-text-secondary); margin: 0; max-width: 620px; }

.cc-spec { margin-top: 46px; }
.cc-spec-head { display: flex; align-items: center; gap: 11px; }
.cc-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font-size: 13px; font-weight: 800; color: #fff; background: linear-gradient(135deg, var(--agent-coral-deep), color-mix(in srgb, var(--agent-coral) 72%, #fff)); }
.cc-num-q { background: var(--agent-text-muted); }
.cc-spec-title { font-size: 17px; font-weight: 750; letter-spacing: -.01em; margin: 0; }
.cc-cap { font-size: 13px; line-height: 1.55; color: var(--agent-text-secondary); margin: 10px 0 16px; max-width: 680px; }
.cc-cap strong { color: var(--agent-text-primary); font-weight: 700; }

/* mock drawer surface */
.cc-drawer { background: color-mix(in srgb, var(--agent-surface-elevated) 60%, transparent); border: 1px solid var(--agent-border-subtle); border-radius: 16px; padding: 14px 16px 26px; }
.cc-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cc-drawer-hint { margin-top: 20px; text-align: center; font-size: 11.5px; color: var(--agent-text-muted); }

/* the status pill */
.cc-status { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 999px; white-space: nowrap; }
.cc-status-ok { background: color-mix(in srgb, var(--agent-success) 14%, transparent); color: var(--agent-success); }
.cc-status-no { background: color-mix(in srgb, var(--agent-warning) 13%, transparent); color: var(--agent-warning); }

/* state switcher */
.cc-switch { display: inline-flex; gap: 0; margin-top: 14px; padding: 3px; background: rgba(var(--agent-shadow-rgb), 0.05); border-radius: 999px; }
.cc-switch button { font: inherit; font-size: 12px; font-weight: 600; color: var(--agent-text-muted); padding: 5px 12px; border: none; background: none; border-radius: 999px; cursor: pointer; }
.cc-switch button.on { color: var(--agent-text-primary); background: var(--agent-surface-elevated); box-shadow: 0 1px 3px rgba(var(--agent-shadow-rgb), 0.14); }

/* decide demo */
.cc-decide { display: flex; flex-direction: column; gap: 10px; background: color-mix(in srgb, var(--agent-surface-elevated) 60%, transparent); border: 1px solid var(--agent-border-subtle); border-radius: 16px; padding: 18px; max-width: 480px; }
.cc-check { display: flex; align-items: flex-start; gap: 9px; font-size: 13px; color: var(--agent-text-secondary); cursor: pointer; line-height: 1.4; }
.cc-check input { margin-top: 2px; width: 16px; height: 16px; accent-color: var(--agent-coral); flex-shrink: 0; }
.cc-check strong { color: var(--agent-text-primary); }
.cc-arrow { font-size: 15px; color: var(--agent-text-muted); margin: 2px 0 0; }
.cc-note { font-size: 12.5px; line-height: 1.55; color: var(--agent-text-muted); margin: 14px 0 0; max-width: 640px; }

.cc-list { margin: 0; padding-left: 18px; }
.cc-list li { font-size: 13px; line-height: 1.7; color: var(--agent-text-secondary); }

.cc-ask { border-top: 1px solid var(--agent-border-subtle); padding-top: 28px; }
`;

"use client";

// "Connect your CRM" panel (critique #289) — the agent-facing UI. Signed off in
// /dev/crm-connect, now wired to the real request action + real demand counts and
// styled with the agency's brand palette (--agent-* tokens). Honest: "Request"
// records interest; it never claims a live connection. Logos fall back to a
// monogram tile until the real files land in public/crm-logos/<key>.svg.

import { useMemo, useState, useTransition } from "react";
import { MagnifyingGlass, Check, ArrowRight, CalendarBlank } from "@phosphor-icons/react";
import type { CrmEntry } from "@/lib/crm/catalogue";
import { otherKey } from "@/lib/crm/catalogue";
import { requestCrmConnectionAction } from "@/app/actions/crm-connect";

const POPULAR = 6;
const SUPPORT = "support@thesalesprogressor.co.uk";

function grad(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 38), g = Math.max(0, ((n >> 8) & 255) - 38), b = Math.max(0, (n & 255) - 38);
  return `linear-gradient(135deg, ${hex}, rgb(${r},${g},${b}))`;
}

function Logo({ c }: { c: CrmEntry }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="ccrm-fallback">
        <span className="ccrm-mono" style={{ background: grad(c.color) }}>{c.mono}</span>
        <span className="ccrm-fallback-name">{c.name}</span>
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="ccrm-logo" src={c.logo} alt={c.name} onError={() => setFailed(true)} />
  );
}

export function ConnectCrmPanel({ catalogue, counts, requested }: { catalogue: CrmEntry[]; counts: Record<string, number>; requested: string[] }) {
  const [reqSet, setReqSet] = useState<Set<string>>(new Set(requested));
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [, startTransition] = useTransition();

  function flash(msg: string, err = false) {
    setToast({ msg, err });
    window.clearTimeout((flash as unknown as { t?: number }).t);
    (flash as unknown as { t?: number }).t = window.setTimeout(() => setToast(null), 3600);
  }

  function request(input: { crmKey?: string; other?: string }, key: string, name: string) {
    if (reqSet.has(key)) return;
    const next = new Set(reqSet); next.add(key);
    setReqSet(next); // optimistic
    flash(`You're on the list for ${name}. We'll email you the moment it connects.`);
    startTransition(async () => {
      const res = await requestCrmConnectionAction(input);
      if (!res.ok) {
        setReqSet((s) => { const n = new Set(s); n.delete(key); return n; });
        flash("Couldn't save that just now. Please try again.", true);
      }
    });
  }

  const count = (c: CrmEntry) => (counts[c.key] ?? 0) + (reqSet.has(c.key) && !requested.includes(c.key) ? 1 : 0);
  const sorted = useMemo(() => [...catalogue].sort((a, b) => count(b) - count(a)), [catalogue, counts, reqSet]);
  const q = query.trim().toLowerCase();
  const results = q ? sorted.filter((c) => c.name.toLowerCase().includes(q)) : [];
  const popular = sorted.slice(0, POPULAR);
  const more = sorted.slice(POPULAR);

  const Tile = ({ c }: { c: CrmEntry }) => {
    const on = reqSet.has(c.key);
    const n = count(c);
    return (
      <div className={`ccrm-tile${on ? " on" : ""}`}>
        <div className="ccrm-plate"><Logo c={c} /></div>
        <div className="ccrm-tile-foot">
          <span className="ccrm-count">{n === 0 ? "Be the first to ask" : `${n} ${n === 1 ? "agency" : "agencies"}${on ? " · you're in" : ""}`}</span>
          <button type="button" className={`ccrm-btn${on ? " done" : ""}`} onClick={() => request({ crmKey: c.key }, c.key, c.name)} disabled={on}>
            {on ? (<><Check size={14} weight="bold" />Requested</>) : "Request"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="ccrm-root">
      <label className="ccrm-search">
        <MagnifyingGlass size={19} weight="regular" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find your CRM..." aria-label="Find your CRM" />
      </label>

      {q ? (
        <section>
          <div className="ccrm-sec-head"><h2 className="ccrm-sec-title">Results</h2></div>
          {results.length > 0 ? (
            <div className="ccrm-grid">{results.map((c) => <Tile key={c.key} c={c} />)}</div>
          ) : (
            <div className="ccrm-noresult">
              <div>
                <p className="ccrm-noresult-title">We don&rsquo;t list &ldquo;{query.trim()}&rdquo; yet</p>
                <p className="ccrm-noresult-sub">Request it anyway and we&rsquo;ll add it to the roadmap.</p>
              </div>
              <button type="button" className="ccrm-btn" onClick={() => { const name = query.trim(); request({ other: name }, otherKey(name), name); setQuery(""); }}>Request it</button>
            </div>
          )}
        </section>
      ) : (
        <section>
          <div className="ccrm-sec-head">
            <h2 className="ccrm-sec-title">Popular CRMs</h2>
            <button type="button" className="ccrm-viewall" onClick={() => setExpanded((e) => !e)}>
              {expanded ? "Show fewer" : "View all CRMs"} <ArrowRight size={15} weight="bold" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform .25s ease" }} />
            </button>
          </div>
          <div className="ccrm-grid">{popular.map((c) => <Tile key={c.key} c={c} />)}</div>
          <div className="ccrm-more" data-open={expanded ? "1" : undefined}>
            <div className="ccrm-grid" style={{ paddingTop: 12 }}>{more.map((c) => <Tile key={c.key} c={c} />)}</div>
          </div>
        </section>
      )}

      <a className="ccrm-concierge" href={`mailto:${SUPPORT}?subject=${encodeURIComponent("Connecting our CRM to Sales Progressor")}&body=${encodeURIComponent("Hi, we'd like help connecting our CRM to Sales Progressor so the two stay in step. Our CRM is: ")}`}>
        <span className="ccrm-concierge-ico"><CalendarBlank size={26} weight="regular" /></span>
        <div className="ccrm-concierge-body">
          <p className="ccrm-concierge-title">Don&rsquo;t want to wait?</p>
          <p className="ccrm-concierge-sub">We can help you get connected and bring your current sales into Sales Progressor today.</p>
        </div>
        <span className="ccrm-concierge-cta">Talk to our team <ArrowRight size={15} weight="bold" /></span>
      </a>

      {toast && <div className={`ccrm-toast${toast.err ? " err" : ""}`} role="status"><Check size={15} weight="bold" />{toast.msg}</div>}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.ccrm-root{ --ink:var(--agent-text-primary,#1a1a1c); --mut:var(--agent-text-muted,#6b7280); --line:var(--agent-border-subtle,rgba(20,16,10,0.1)); --card:var(--agent-surface-elevated,#fff); --accent:var(--agent-coral-deep,#E2452A); --accent-fill:var(--agent-coral,#FF6B4A); --good:#2fa36b; color:var(--ink); }
.ccrm-search{ display:flex; align-items:center; gap:12px; padding:0 18px; height:54px; background:var(--card); border:1px solid var(--line); border-radius:15px; margin-bottom:28px; color:var(--mut); transition:border-color .16s ease, box-shadow .16s ease; }
.ccrm-search:focus-within{ border-color:var(--accent); }
.ccrm-search input{ flex:1; border:none; background:none; outline:none; font:inherit; font-size:15px; color:var(--ink); }
.ccrm-search input::placeholder{ color:var(--mut); }
.ccrm-sec-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:13px; }
.ccrm-sec-title{ margin:0; font-size:17px; font-weight:700; letter-spacing:-0.01em; }
.ccrm-viewall{ display:inline-flex; align-items:center; gap:6px; border:1px solid var(--line); background:var(--card); color:var(--accent); font:inherit; font-size:13px; font-weight:650; padding:8px 14px; border-radius:11px; cursor:pointer; transition:.16s; }
.ccrm-viewall:hover{ border-color:color-mix(in srgb, var(--accent) 40%, var(--line)); }
.ccrm-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:13px; }
@media (max-width:820px){ .ccrm-grid{ grid-template-columns:repeat(2,1fr); } }
@media (max-width:560px){ .ccrm-grid{ grid-template-columns:1fr; } }
.ccrm-tile{ background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 15px 13px; display:flex; flex-direction:column; gap:15px; transition:transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease, border-color .18s ease; }
.ccrm-tile:hover{ transform:translateY(-2px); box-shadow:0 10px 24px rgba(20,18,30,0.09); border-color:color-mix(in srgb, var(--accent) 26%, var(--line)); }
.ccrm-tile.on{ border-color:color-mix(in srgb, var(--accent) 40%, var(--line)); box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent); }
.ccrm-plate{ width:100%; height:62px; background:#fff; border:1px solid rgba(0,0,0,0.05); border-radius:12px; display:flex; align-items:center; justify-content:center; padding:0 18px; overflow:hidden; }
.ccrm-logo{ max-height:34px; max-width:100%; width:auto; object-fit:contain; display:block; }
.ccrm-fallback{ display:flex; align-items:center; gap:10px; }
.ccrm-mono{ flex-shrink:0; width:36px; height:36px; border-radius:10px; display:inline-flex; align-items:center; justify-content:center; color:#fff; font-size:13px; font-weight:750; }
.ccrm-fallback-name{ font-size:15px; font-weight:700; color:#1a1a1c; letter-spacing:-0.01em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ccrm-tile-foot{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.ccrm-count{ font-size:12px; color:var(--mut); font-variant-numeric:tabular-nums; }
.ccrm-btn{ flex-shrink:0; display:inline-flex; align-items:center; gap:6px; border:1px solid var(--accent); background:transparent; color:var(--accent); font:inherit; font-size:13px; font-weight:650; padding:8px 15px; border-radius:11px; cursor:pointer; transition:.16s; }
.ccrm-btn:hover:not(:disabled){ background:var(--accent-fill); border-color:var(--accent-fill); color:#fff; }
.ccrm-btn:active:not(:disabled){ transform:scale(.96); }
.ccrm-btn:disabled{ cursor:default; }
.ccrm-btn.done{ border-color:transparent; background:color-mix(in srgb, var(--good) 14%, transparent); color:var(--good); }
.ccrm-more{ max-height:0; overflow:hidden; opacity:0; transition:max-height .45s cubic-bezier(.2,.8,.2,1), opacity .3s ease; }
.ccrm-more[data-open]{ max-height:1600px; opacity:1; }
.ccrm-noresult{ display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px; background:var(--card); border:1px dashed var(--line); border-radius:16px; }
.ccrm-noresult-title{ margin:0; font-size:14.5px; font-weight:650; }
.ccrm-noresult-sub{ margin:3px 0 0; font-size:13px; color:var(--mut); }
.ccrm-concierge{ display:flex; align-items:center; gap:15px; margin-top:26px; padding:16px 18px; border-radius:16px; text-decoration:none; color:inherit; background:var(--card); border:1px solid var(--line); transition:.18s; }
.ccrm-concierge:hover{ border-color:color-mix(in srgb, var(--accent) 32%, var(--line)); transform:translateY(-1px); }
.ccrm-concierge-ico{ flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; color:var(--mut); }
.ccrm-concierge-body{ flex:1; min-width:0; }
.ccrm-concierge-title{ margin:0; font-size:15.5px; font-weight:700; }
.ccrm-concierge-sub{ margin:3px 0 0; font-size:12.5px; color:var(--mut); }
.ccrm-concierge-cta{ flex-shrink:0; display:inline-flex; align-items:center; gap:7px; background:var(--accent-fill); color:#fff; font-size:13px; font-weight:700; padding:11px 17px; border-radius:12px; white-space:nowrap; box-shadow:0 8px 18px color-mix(in srgb, var(--accent-fill) 32%, transparent); }
.ccrm-toast{ position:fixed; left:50%; bottom:28px; transform:translateX(-50%); display:inline-flex; align-items:center; gap:9px; max-width:calc(100vw - 32px); background:var(--ink); color:var(--card); font-size:13px; font-weight:550; padding:12px 18px; border-radius:999px; box-shadow:0 14px 40px rgba(10,12,22,0.3); z-index:60; animation:ccrm-rise .32s cubic-bezier(.2,.9,.3,1); }
.ccrm-toast svg{ color:#5fe0a0; flex-shrink:0; }
.ccrm-toast.err svg{ color:#ff8a7a; }
@keyframes ccrm-rise{ from{ opacity:0; transform:translate(-50%,14px); } to{ opacity:1; transform:translate(-50%,0); } }
@media (prefers-reduced-motion: reduce){ .ccrm-tile, .ccrm-concierge, .ccrm-btn, .ccrm-more, .ccrm-toast{ transition:none; animation:none; } }
`;

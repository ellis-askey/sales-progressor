"use client";

// Polished rebuild prototype of the chasing-timing screen. Self-contained, mock
// data, dev-only (guarded by the layout). Deliberately drops the milestone codes
// from the UI and uses a SOLID schedule line (no dashes). Introduces a per-step
// + global "reaches you after N nudges" control the real form doesn't have yet.

import { useState, useRef, useEffect } from "react";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

/* ── model ───────────────────────────────────────────────────────────────── */
type Side = "vendor" | "purchaser";
type Step = {
  id: string; side: Side; stage: string; name: string; trigger: string;
  grace: number; repeat: number; dGrace: number; dRepeat: number;
  esc: number | null; enabled: boolean;
};

const STAGE_ORDER = [
  "Getting started", "Property information", "Mortgage & survey",
  "Contract & searches", "Enquiries", "Towards exchange", "Exchange & completion",
];

// [side, stage, name, trigger, defaultGrace, defaultRepeat]
const SEED: [Side, string, string, string, number, number][] = [
  ["vendor","Getting started","Seller instructs their solicitor","the sale is agreed and we're waiting on instruction",2,5],
  ["vendor","Getting started","Memorandum of sale issued","the memo hasn't gone out to all sides yet",2,4],
  ["vendor","Getting started","Welcome pack received","we're waiting for the solicitor to make contact",3,5],
  ["vendor","Getting started","ID & AML checks complete","the seller's identity checks are outstanding",3,5],
  ["vendor","Property information","Property forms received","the forms are with the seller to complete",3,5],
  ["vendor","Property information","Property forms returned","the completed forms haven't come back",4,7],
  ["vendor","Property information","Draft contract pack issued","the pack hasn't reached the buyer's solicitor",4,7],
  ["vendor","Property information","Management pack requested","leasehold only: the pack is being requested",7,10],
  ["vendor","Property information","Management pack received","leasehold only: we're waiting on the freeholder",14,10],
  ["vendor","Enquiries","Enquiries received","the buyer's questions have landed",21,7],
  ["vendor","Enquiries","Replies to enquiries provided","the seller is gathering their answers",7,5],
  ["vendor","Enquiries","Replies sent to buyer","the replies haven't gone across",4,5],
  ["vendor","Enquiries","Further enquiries received","a second round of questions has arrived",14,7],
  ["vendor","Enquiries","Additional replies provided","the follow-up answers are outstanding",7,5],
  ["vendor","Enquiries","All replies sent","some enquiries remain unanswered",5,5],
  ["vendor","Towards exchange","Contract ready to sign","the contract is with the seller",3,5],
  ["vendor","Towards exchange","Contract signed and returned","the signed contract is outstanding",3,4],
  ["vendor","Towards exchange","Seller's solicitor ready to exchange","they haven't confirmed readiness",3,4],
  ["vendor","Exchange & completion","Contracts exchanged","we're in the run-up to exchange",2,4],
  ["vendor","Exchange & completion","Sale completed","we're between exchange and completion day",2,4],
  ["purchaser","Getting started","Buyer instructs their solicitor","we're waiting on instruction",2,5],
  ["purchaser","Getting started","ID & AML checks complete","the buyer's identity checks are outstanding",3,5],
  ["purchaser","Getting started","Money on account paid","the payment to the solicitor is outstanding",3,5],
  ["purchaser","Mortgage & survey","Mortgage application submitted","mortgage only: the application is outstanding",5,7],
  ["purchaser","Mortgage & survey","Lender valuation booked","mortgage only: the valuation isn't arranged",5,7],
  ["purchaser","Mortgage & survey","Mortgage offer received","mortgage only: we're waiting on the formal offer",7,7],
  ["purchaser","Mortgage & survey","Survey arranged","the buyer hasn't booked their survey",5,7],
  ["purchaser","Mortgage & survey","Survey report received","the report hasn't come back",7,7],
  ["purchaser","Contract & searches","Contract pack received","the pack is with the buyer's solicitor",4,7],
  ["purchaser","Contract & searches","Searches ordered","searches are being submitted",5,7],
  ["purchaser","Contract & searches","Search results received","the results haven't come back",14,7],
  ["purchaser","Contract & searches","Management pack received","leasehold only: the pack is being reviewed",7,7],
  ["purchaser","Enquiries","Initial enquiries raised","first questions have gone to the seller",21,7],
  ["purchaser","Enquiries","Initial replies received","we're waiting on the seller's answers",14,7],
  ["purchaser","Enquiries","Initial replies reviewed","the solicitor hasn't reviewed them",5,5],
  ["purchaser","Enquiries","Further enquiries raised","a second round is needed",14,7],
  ["purchaser","Enquiries","Additional replies received","follow-up answers are outstanding",14,7],
  ["purchaser","Enquiries","Additional replies reviewed","the solicitor hasn't signed them off",5,5],
  ["purchaser","Enquiries","All enquiries satisfied","not everything is resolved yet",5,5],
  ["purchaser","Towards exchange","Final report received","the buyer is reviewing the report",4,5],
  ["purchaser","Towards exchange","Contract ready to sign","the contract is with the buyer",3,5],
  ["purchaser","Towards exchange","Contract signed and returned","the signed contract is outstanding",3,4],
  ["purchaser","Towards exchange","Deposit transferred","the deposit hasn't cleared",2,4],
  ["purchaser","Towards exchange","Buyer's solicitor ready to exchange","they haven't confirmed readiness",3,4],
  ["purchaser","Exchange & completion","Contracts exchanged","we're in the run-up to exchange",2,4],
  ["purchaser","Exchange & completion","Purchase completed","we're between exchange and completion day",2,4],
];

const PROFILES = [
  { key: "responsive", name: "Responsive", mult: 0.75, esc: 2, weeks: 11, dots: 5, desc: "Quicker follow-ups, for clients who usually reply to the first nudge." },
  { key: "steady",     name: "Steady",     mult: 1,    esc: 2, weeks: 12, dots: 4, desc: "Balanced for most sales, around two nudges before it reaches you." },
  { key: "gentle",     name: "Gentle",     mult: 1.35, esc: 3, weeks: 14, dots: 3, desc: "More room between nudges. The lightest touch for cautious clients." },
] as const;
type ProfileKey = (typeof PROFILES)[number]["key"];

const MIN_GRACE = 1, MIN_REPEAT = 2;
const scale = (base: number, mult: number, floor: number) => Math.max(floor, Math.round(base * mult));

/* ── stepper ─────────────────────────────────────────────────────────────── */
function Stepper({ value, onChange, min, max, big }: { value: number; onChange: (n: number) => void; min: number; max: number; big?: boolean }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <span className={`ct-stp${big ? " ct-stp-lg" : ""}`}>
      <button type="button" aria-label="decrease" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>−</button>
      <input
        inputMode="numeric" value={value}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(clamp(n)); }}
        onFocus={(e) => e.currentTarget.select()}
      />
      <button type="button" aria-label="increase" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
    </span>
  );
}

/* ── heartbeat pulse ─────────────────────────────────────────────────────────
   The schedule drawn as the file's "pulse": a flat baseline with a beat at each
   nudge (growing stronger as patience thins), a coral tracer sweeping the line,
   and an amber escalation spike handing off to a person. Canvas + rAF; palette
   read from the live agent theme tokens so it tracks light/dark. ──────────── */
function PulseSchedule({ grace, repeat, esc }: { grace: number; repeat: number; esc: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ grace, repeat, esc });
  propsRef.current = { grace, repeat, esc };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const cs = getComputedStyle(cv);
    const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    const pal = {
      ink: v("--agent-text-primary", "#2D1810"),
      faint: v("--agent-text-muted", "rgba(45,24,16,.55)"),
      coral: v("--agent-coral", "#FF8A65"),
      coralDeep: v("--agent-coral-deep", "#FF6B4A"),
      amber: v("--agent-warning", "#C97D1A"),
      line: v("--agent-border-default", "rgba(45,24,16,.10)"),
      pale: v("--agent-coral-pale", "#FFD4C2"),
    };
    const font = '"Segoe UI",system-ui,sans-serif';
    let raf = 0;

    function draw(t: number) {
      const r = cv!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv!.width !== Math.round(r.width * dpr) || cv!.height !== Math.round(r.height * dpr)) {
        cv!.width = Math.round(r.width * dpr);
        cv!.height = Math.round(r.height * dpr);
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const w = r.width, h = r.height;
      ctx!.clearRect(0, 0, w, h);

      const { grace, repeat, esc } = propsRef.current;
      const padL = 6, padR = 46, base = h * 0.62, rightX = w - padR;
      const nd: number[] = [];
      for (let i = 1; i <= esc; i++) nd.push(grace + repeat * (i - 1));
      const escDay = grace + repeat * esc, maxDay = escDay || 1;
      const X = (day: number) => padL + (day / maxDay) * (rightX - padL);
      const bw = Math.max(0.55, maxDay * 0.05); // beat half-width, in days
      const marks = nd.map((day, i) => ({ day, amp: 15 + i * 7 }));
      const emark = { day: escDay, amp: Math.min(h * 0.42, 42) };
      const all = [...marks, emark];
      // Flat baseline that raises into one clean beat at each point of contact,
      // then returns exactly to the line. A raised cosine — no dips, no tails.
      const spike = (dv: number) => {
        let s = 0;
        for (const m of all) {
          const d = Math.abs(dv - m.day);
          if (d < bw) s += m.amp * 0.5 * (1 + Math.cos((Math.PI * d) / bw));
        }
        return s;
      };
      const pts: [number, number][] = [];
      const steps = 320;
      for (let i = 0; i <= steps; i++) { const dv = (i / steps) * maxDay; pts.push([X(dv), base - spike(dv)]); }

      // baseline
      ctx!.strokeStyle = pal.line; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.moveTo(padL, base); ctx!.lineTo(rightX, base); ctx!.stroke();
      // faint resting wave (full)
      ctx!.lineWidth = 2; ctx!.strokeStyle = pal.pale;
      ctx!.beginPath(); pts.forEach((p, i) => (i ? ctx!.lineTo(p[0], p[1]) : ctx!.moveTo(p[0], p[1]))); ctx!.stroke();
      // bright tracer swept to the head (no glow — clean line)
      const period = 2800, prog = (t % period) / period, headX = padL + prog * (rightX - padL);
      ctx!.save(); ctx!.beginPath(); ctx!.rect(padL - 2, 0, headX - padL + 2, h); ctx!.clip();
      ctx!.lineWidth = 2.6; ctx!.strokeStyle = pal.coralDeep;
      ctx!.beginPath(); pts.forEach((p, i) => (i ? ctx!.lineTo(p[0], p[1]) : ctx!.moveTo(p[0], p[1]))); ctx!.stroke(); ctx!.restore();
      // head dot
      const hy = base - spike(((headX - padL) / (rightX - padL)) * maxDay);
      ctx!.fillStyle = pal.coralDeep;
      ctx!.beginPath(); ctx!.arc(headX, hy, 4, 0, 7); ctx!.fill();
      // nudge beats + labels (labels clamped so they never clip the edges)
      ctx!.textAlign = "center";
      marks.forEach((m, i) => {
        const x = X(m.day), y = base - m.amp, lx = Math.max(26, Math.min(w - 26, x));
        ctx!.fillStyle = pal.coralDeep; ctx!.beginPath(); ctx!.arc(x, y, 3, 0, 7); ctx!.fill();
        ctx!.fillStyle = pal.ink; ctx!.font = "700 12px " + font; ctx!.fillText("Day " + m.day, lx, y - 9);
        ctx!.fillStyle = pal.faint; ctx!.font = "600 10px " + font; ctx!.fillText(i === 0 ? "1st nudge" : ordinal(i + 1) + " nudge", lx, base + 16);
      });
      // escalation spike + person
      const ex = X(escDay);
      ctx!.fillStyle = pal.amber; ctx!.font = "700 12px " + font; ctx!.textAlign = "center";
      ctx!.fillText("Day " + escDay, ex, base - emark.amp - 9);
      // the agent's avatar — the app's coral-gradient circle with a white user
      // glyph (a real photo would be drawImage'd here when one exists).
      const px = Math.min(rightX + 28, w - 16), ay = base - 2, ar = 12;
      const ag = ctx!.createLinearGradient(px - ar, ay - ar, px + ar, ay + ar);
      ag.addColorStop(0, pal.coral); ag.addColorStop(1, pal.coralDeep);
      ctx!.fillStyle = ag; ctx!.beginPath(); ctx!.arc(px, ay, ar, 0, 7); ctx!.fill();
      ctx!.fillStyle = "#fff";
      ctx!.beginPath(); ctx!.arc(px, ay - 3.2, 3.4, 0, 7); ctx!.fill();
      ctx!.beginPath(); ctx!.moveTo(px - 5.6, ay + 5.6); ctx!.quadraticCurveTo(px, ay - 0.4, px + 5.6, ay + 5.6); ctx!.closePath(); ctx!.fill();
      ctx!.fillStyle = pal.faint; ctx!.font = "600 10px " + font; ctx!.textAlign = "center"; ctx!.fillText("You", px, base + 18);
    }

    const loop = (t: number) => { draw(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className="ct-pulse" aria-hidden />;
}
function ordinal(n: number) { return ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][n] || `${n}th`; }

/* ── page ────────────────────────────────────────────────────────────────── */
export default function Page() {
  const [steps, setSteps] = useState<Step[]>(() =>
    SEED.map((s, i) => ({
      id: `s${i}`, side: s[0], stage: s[1], name: s[2], trigger: s[3],
      grace: s[4], repeat: s[5], dGrace: s[4], dRepeat: s[5], esc: null, enabled: true,
    })),
  );
  const [profile, setProfile] = useState<ProfileKey>("steady");
  const [globalEsc, setGlobalEsc] = useState(2);
  const [sideFilter, setSideFilter] = useState<Side>("vendor");
  const [query, setQuery] = useState("");
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());

  const escOf = (s: Step) => (s.esc == null ? globalEsc : s.esc);
  const activeProfile = PROFILES.find((p) => p.key === profile)!;
  const stepChanged = (s: Step) =>
    s.grace !== scale(s.dGrace, activeProfile.mult, MIN_GRACE) ||
    s.repeat !== scale(s.dRepeat, activeProfile.mult, MIN_REPEAT) ||
    (s.esc != null && s.esc !== globalEsc) || !s.enabled;
  const custom = globalEsc !== activeProfile.esc || steps.some(stepChanged);
  const changedCount = steps.filter(stepChanged).length;

  function patch(id: string, p: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }
  function applyProfile(p: typeof PROFILES[number]) {
    setProfile(p.key);
    setGlobalEsc(p.esc);
    setSteps((prev) => prev.map((s) => ({
      ...s, enabled: true, esc: null,
      grace: scale(s.dGrace, p.mult, MIN_GRACE), repeat: scale(s.dRepeat, p.mult, MIN_REPEAT),
    })));
  }
  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set); next.has(key) ? next.delete(key) : next.add(key); setter(next);
  };

  // filter + group
  const q = query.trim().toLowerCase();
  const visible = steps.filter((s) => {
    if (s.side !== sideFilter) return false;
    if (q && !(`${s.name} ${s.trigger} ${s.stage}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const groups: { side: Side; stage: string; items: Step[] }[] = [];
  visible.forEach((s) => {
    let g = groups.find((x) => x.side === s.side && x.stage === s.stage);
    if (!g) { g = { side: s.side, stage: s.stage, items: [] }; groups.push(g); }
    g.items.push(s);
  });
  groups.sort((a, b) =>
    a.side !== b.side ? (a.side === "vendor" ? -1 : 1) : STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const avgWeeks = activeProfile.weeks;
  const offCount = steps.filter((s) => !s.enabled).length;
  const dirty = custom;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
      <Styles />

      {/* header */}
      <header>
        <h1 style={{ margin: 0, fontSize: 27, fontWeight: 760, letterSpacing: "-.025em" }}>How we chase each step</h1>
        <p style={{ margin: "9px 0 0", fontSize: 15, lineHeight: 1.55, color: "var(--agent-text-secondary)", maxWidth: "60ch" }}>
          Pick a rhythm and we&apos;ll follow it whenever a step is waiting on someone. Fine-tune any individual step if you
          want to. New timings apply to new sales only; files already in progress keep the schedule they began on.
        </p>
      </header>

      {/* summary */}
      <div className="ct-summary">
        <span className="ct-summary-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
        </span>
        <p>
          On {custom ? <>your <b>custom</b> rhythm</> : <>the <b>{activeProfile.name}</b> rhythm</>}, a typical sale reaches
          exchange in <b>≈{avgWeeks} weeks</b>. Every waiting step gets up to <b>{globalEsc} {globalEsc === 1 ? "nudge" : "nudges"}</b> before
          it comes to you{offCount ? <>, and <b>{offCount}</b> {offCount === 1 ? "step is" : "steps are"} set never to chase</> : null}.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>

        {/* 1 profiles */}
        <section>
          <SecHead n={1} title="Choose a rhythm" />
          <div className="ct-profiles">
            {PROFILES.map((p) => {
              const on = profile === p.key && !custom;
              return (
                <button type="button" key={p.key} className={`ct-pcard${on ? " on" : ""}`} onClick={() => applyProfile(p)}>
                  <div className="ct-pcard-top">
                    <span className="ct-pcard-name">{p.name}</span>
                    <span className="ct-tick">{on && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}</span>
                  </div>
                  <MiniPulse dots={p.dots} />
                  <div className="ct-pcard-weeks">≈{p.weeks}<span>wks</span></div>
                  <div className="ct-pcard-label">to exchange</div>
                  <p className="ct-pcard-desc">{p.desc}</p>
                </button>
              );
            })}
          </div>
          <p className="ct-note">
            {custom
              ? <>You&apos;ve tuned this from the <b>{activeProfile.name}</b> rhythm. Pick one above to snap everything back.</>
              : <>Using the <b>{activeProfile.name}</b> rhythm. Change any step below and it becomes your own.</>}
          </p>
        </section>

        {/* 2 escalation */}
        <section>
          <SecHead n={2} title="When it reaches you" />
          <div className="ct-card ct-esc">
            <span className="ct-esc-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V3h13l-2.5 4.5L17 12H4" /></svg>
            </span>
            <div className="ct-esc-body">
              <div className="ct-esc-t1">Stop chasing and flag it for you after <Stepper value={globalEsc} onChange={setGlobalEsc} min={1} max={6} big /> unanswered nudges</div>
              <div className="ct-esc-t2">Your default for every step. Reach this point and we stop nudging the client and hand the file back to you. Any step can set its own limit below.</div>
            </div>
          </div>
        </section>

        {/* 3 steps */}
        <section>
          <SecHead n={3} title="Fine-tune individual steps" optional
            right={<button type="button" className="ct-link" onClick={() => {
              const anyClosed = groups.some((g) => !openStages.has(g.side + g.stage));
              setOpenStages(anyClosed ? new Set(groups.map((g) => g.side + g.stage)) : new Set());
            }}>{groups.every((g) => openStages.has(g.side + g.stage)) && groups.length ? "Collapse all" : "Open all"}</button>} />

          <div className="ct-toolbar">
            <SidePicker value={sideFilter} onChange={setSideFilter} />
            <div className="ct-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a step: mortgage, enquiries, deposit…" />
            </div>
          </div>

          {groups.length === 0 && <div className="ct-empty">No steps match that search.</div>}

          {groups.map((g, gi) => {
            const key = g.side + g.stage;
            const open = q !== "" || openStages.has(key) || (openStages.size === 0 && gi === 0);
            const chg = g.items.filter(stepChanged).length;
            return (
              <div className={`ct-stage${open ? " open" : ""}`} key={key}>
                <button type="button" className="ct-stage-head" onClick={() => toggleSet(openStages, key, setOpenStages)}>
                  <svg className="ct-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                  <span className="ct-stitle">{g.stage}</span>
                  {chg > 0 && <span className="ct-badge">{chg} changed</span>}
                  <span className="ct-smeta">{g.items.length} steps</span>
                </button>
                <Collapse open={open}>
                  <div className="ct-stage-body">
                    {g.items.map((s) => {
                      const sOpen = openSteps.has(s.id);
                      const ch = stepChanged(s);
                      return (
                        <div className={`ct-step${ch ? " changed" : ""}${s.enabled ? "" : " off"}${sOpen ? " open" : ""}`} key={s.id}>
                          <div className="ct-step-row" onClick={() => toggleSet(openSteps, s.id, setOpenSteps)}>
                            <div className="ct-step-main">
                              <div className="ct-step-name">{ch && <span className="ct-reddot" />}{s.name}</div>
                              <div className="ct-step-sum">
                                {s.enabled
                                  ? <>First nudge in <b>{s.grace}</b> {s.grace === 1 ? "day" : "days"}, then every <b>{s.repeat}</b>, reaching you after <b>{escOf(s)}</b>.</>
                                  : <><b>Never chased</b>. This step just waits.</>}
                              </div>
                            </div>
                            <div className="ct-step-right">
                              <button type="button" role="switch" aria-checked={s.enabled} className={`ct-switch sm${s.enabled ? " on" : ""}`}
                                onClick={(e) => { e.stopPropagation(); patch(s.id, { enabled: !s.enabled }); }} />
                              <svg className="ct-edchev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                            </div>
                          </div>
                          <Collapse open={sOpen}>
                            <div className="ct-editor">
                              <div className="ct-ed-card">
                                {s.enabled ? (
                                  <>
                                    <PulseSchedule grace={s.grace} repeat={s.repeat} esc={escOf(s)} />
                                    <div className="ct-ctrls">
                                      <Ctrl label="First nudge" unit="days after it's due">
                                        <Stepper value={s.grace} onChange={(n) => patch(s.id, { grace: n })} min={0} max={30} />
                                      </Ctrl>
                                      <Ctrl label="Then repeat every" unit="days">
                                        <Stepper value={s.repeat} onChange={(n) => patch(s.id, { repeat: n })} min={1} max={30} />
                                      </Ctrl>
                                      <Ctrl label="Reaches you after" unit={s.esc == null ? `nudges · your default of ${globalEsc}` : "nudges"}>
                                        <Stepper value={escOf(s)} onChange={(n) => patch(s.id, { esc: n })} min={1} max={6} />
                                      </Ctrl>
                                    </div>
                                  </>
                                ) : (
                                  <div className="ct-off-note">Chasing is switched off for this step. Turn it back on to set a rhythm.</div>
                                )}
                              </div>
                            </div>
                          </Collapse>
                        </div>
                      );
                    })}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </section>
      </div>

      {/* save bar */}
      <div className={`ct-savebar${dirty ? " show" : ""}`}>
        <div className="ct-savebar-inner">
          <span className="ct-savebar-stat">
            {changedCount > 0 && <>You&apos;ve <b>{changedCount}</b> {changedCount === 1 ? "step" : "steps"} fine-tuned. </>}
          </span>
          <button type="button" className="ct-btn ghost" onClick={() => applyProfile(activeProfile)}>Reset</button>
          <button type="button" className="ct-btn primary">Save changes</button>
        </div>
      </div>
    </div>
  );
}

const SIDE_OPTIONS = [
  { key: "vendor" as const, label: "Seller", n: 20 },
  { key: "purchaser" as const, label: "Buyer", n: 26 },
];
// Canonical animated picker: a sliding coral pill measured with useTabIndicator
// (the same hook behind the nav rail / file tabs — ANIMATION_STANDARDS §A5).
function SidePicker({ value, onChange }: { value: Side; onChange: (v: Side) => void }) {
  const activeIdx = SIDE_OPTIONS.findIndex((o) => o.key === value);
  const { btnRefs, ind } = useTabIndicator(activeIdx);
  return (
    <div className="ct-seg">
      <span className="ct-seg-pill" aria-hidden style={ind ? { left: ind.left, width: ind.width, opacity: 1 } : { opacity: 0 }} />
      {SIDE_OPTIONS.map((o, i) => (
        <button type="button" key={o.key} ref={(el) => { btnRefs.current[i] = el; }}
          className={value === o.key ? "on" : ""} onClick={() => onChange(o.key)}>
          {o.label} <span className="ct-seg-n">{o.n}</span>
        </button>
      ))}
    </div>
  );
}

// Mini heartbeat shown on each rhythm card — the same visual language as the
// per-step pulse. More beats + tighter = Responsive; fewer + wider = Gentle.
function MiniPulse({ dots }: { dots: number }) {
  const n = Math.max(2, dots);
  const step = 80 / n;
  let d = "M0 17";
  for (let i = 0; i < n; i++) {
    const cx = 12 + i * step;
    d += ` L ${(cx - 5).toFixed(1)} 17 Q ${cx.toFixed(1)} 7 ${(cx + 5).toFixed(1)} 17`;
  }
  d += " L 104 17";
  return (
    <svg className="ct-cadence" viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden>
      <path className="ct-cad-line" d={d} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle className="ct-cad-end" cx="109" cy="17" r="3.4" />
    </svg>
  );
}

function SecHead({ n, title, optional, right }: { n: number; title: string; optional?: boolean; right?: React.ReactNode }) {
  return (
    <div className="ct-sechead">
      <p className="ct-eyebrow"><span className="ct-num">{n}</span>{title}{optional && <span className="ct-opt">· optional</span>}</p>
      {right}
    </div>
  );
}
function Ctrl({ label, unit, children }: { label: string; unit: string; children: React.ReactNode }) {
  return (
    <div className="ct-ctrl">
      <div className="ct-clab">{label}</div>
      <div className="ct-crow">{children}<span className="ct-unit">{unit}</span></div>
    </div>
  );
}
// Animated open/close via a grid-rows height transition (no JS measuring).
// Children stay mounted through the closing animation, then unmount — so the
// pulse canvas/rAF is only alive while a step is actually open.
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  return (
    <div
      className="ct-collapse"
      data-open={open ? "1" : "0"}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && !open) setMounted(false); }}
    >
      <div className="ct-collapse-inner">{mounted ? children : null}</div>
    </div>
  );
}

/* ── scoped styles ───────────────────────────────────────────────────────── */
function Styles() {
  return (
    <style>{`
    .ct-summary{display:flex;gap:15px;align-items:flex-start;padding:17px 19px;border-radius:16px;
      background:linear-gradient(180deg,var(--agent-coral-bg-tint),rgba(255,255,255,.5));border:1px solid var(--agent-border-default)}
    .ct-summary-ic{flex:none;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#fff;border:1px solid var(--agent-border-default);color:var(--agent-coral-deep)}
    .ct-summary-ic svg{width:19px;height:19px}
    .ct-summary p{margin:0;font-size:14.5px;line-height:1.55;color:var(--agent-text-secondary)}
    .ct-summary b{color:var(--agent-text-primary);font-weight:650}

    .ct-card{background:#fff;border:1px solid var(--agent-border-default);border-radius:16px;box-shadow:0 1px 2px rgba(60,40,22,.04)}

    .ct-switch{position:relative;flex:none;width:46px;height:26px;border-radius:999px;border:none;cursor:pointer;background:rgba(45,24,16,.18);transition:background .18s}
    .ct-switch::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28);transition:transform .18s}
    .ct-switch.on{background:var(--agent-coral-deep)}
    .ct-switch.on::after{transform:translateX(20px)}
    .ct-switch.sm{width:40px;height:23px}
    .ct-switch.sm::after{width:17px;height:17px}
    .ct-switch.sm.on::after{transform:translateX(17px)}
    .ct-switch:focus-visible{outline:2px solid var(--agent-coral-deep);outline-offset:2px}

    .ct-sechead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 2px 15px}
    .ct-eyebrow{margin:0;font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--agent-text-muted);display:flex;align-items:center;gap:9px}
    .ct-num{width:19px;height:19px;border-radius:999px;background:#fff;border:1px solid var(--agent-border-default);display:grid;place-items:center;font-size:11px;color:var(--agent-text-secondary)}
    .ct-opt{font-weight:500;text-transform:none;letter-spacing:0;color:var(--agent-text-muted);margin-left:2px}
    .ct-link{appearance:none;background:none;border:none;font:inherit;font-size:13.5px;font-weight:650;color:var(--agent-coral-deep);cursor:pointer;padding:5px 3px;border-radius:7px}
    .ct-link:hover{text-decoration:underline;text-underline-offset:3px}

    .ct-profiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .ct-pcard{text-align:left;cursor:pointer;background:#fff;border:1.5px solid var(--agent-border-default);border-radius:16px;padding:18px 18px;
      box-shadow:0 1px 2px rgba(60,40,22,.04);transition:transform .18s,box-shadow .18s,border-color .18s}
    .ct-pcard:hover{transform:translateY(-3px);box-shadow:0 10px 26px -16px rgba(60,40,22,.3);border-color:var(--agent-coral-pale)}
    .ct-pcard:focus-visible{outline:none;border-color:var(--agent-coral-deep)}
    /* selected = solid filled option with a tick (our standard selected state) */
    .ct-pcard.on{border-color:transparent;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 12px 26px -14px rgba(var(--agent-coral-rgb),.55)}
    .ct-pcard.on:hover{border-color:transparent;transform:translateY(-2px)}
    .ct-pcard-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .ct-pcard-name{font-size:16px;font-weight:680;letter-spacing:-.01em;color:var(--agent-text-primary)}
    .ct-pcard.on .ct-pcard-name{color:#fff}
    .ct-tick{width:22px;height:22px;border-radius:999px;display:grid;place-items:center;border:1.5px solid var(--agent-border-default);transition:.15s}
    .ct-pcard.on .ct-tick{background:#fff;border-color:#fff}
    .ct-tick svg{width:12px;height:12px;color:var(--agent-coral-deep)}
    .ct-cadence{display:block;width:100%;height:24px;margin-bottom:12px}
    .ct-cad-line{stroke:var(--agent-coral-deep)}
    .ct-cad-end{fill:var(--agent-warning)}
    .ct-pcard.on .ct-cad-line{stroke:#fff}
    .ct-pcard.on .ct-cad-end{fill:#fff}
    .ct-pcard-weeks{font-size:26px;font-weight:740;letter-spacing:-.025em;color:var(--agent-coral-deep);display:flex;align-items:baseline;gap:5px}
    .ct-pcard.on .ct-pcard-weeks{color:#fff}
    .ct-pcard-weeks span{font-size:12px;font-weight:650;color:var(--agent-text-muted);text-transform:uppercase;letter-spacing:.05em}
    .ct-pcard.on .ct-pcard-weeks span{color:rgba(255,255,255,.82)}
    .ct-pcard-label{font-size:10.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--agent-text-muted);margin-bottom:11px}
    .ct-pcard.on .ct-pcard-label{color:rgba(255,255,255,.85)}
    .ct-pcard-desc{margin:0;font-size:13px;line-height:1.5;color:var(--agent-text-secondary)}
    .ct-pcard.on .ct-pcard-desc{color:rgba(255,255,255,.92)}
    .ct-note{margin:14px 3px 0;font-size:13.5px;color:var(--agent-text-muted)}
    .ct-note b{color:var(--agent-text-secondary)}

    .ct-esc{display:flex;align-items:center;gap:18px;padding:20px 22px}
    .ct-esc-ic{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:var(--agent-coral-bg-tint);color:var(--agent-coral-deep);border:1px solid var(--agent-coral-pale)}
    .ct-esc-ic svg{width:20px;height:20px}
    .ct-esc-body{flex:1;min-width:0}
    .ct-esc-t1{font-size:15.5px;font-weight:620;display:flex;align-items:center;gap:10px;flex-wrap:wrap;letter-spacing:-.01em}
    .ct-esc-t2{font-size:13px;color:var(--agent-text-secondary);margin-top:5px;max-width:60ch;line-height:1.5}

    .ct-stp{display:inline-flex;align-items:center;background:#fff;border:1.5px solid var(--agent-border-default);border-radius:11px;overflow:hidden;box-shadow:0 1px 2px rgba(60,40,22,.04);transition:.15s;vertical-align:middle}
    .ct-stp:focus-within{border-color:var(--agent-coral-deep)}
    .ct-stp button{appearance:none;border:none;cursor:pointer;width:32px;height:36px;display:grid;place-items:center;font-size:18px;font-weight:600;line-height:1;transition:background .14s,color .14s,transform .1s;color:var(--agent-text-muted);background:transparent}
    .ct-stp button:hover:not(:disabled){color:#fff;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
    .ct-stp button:active:not(:disabled){transform:scale(.9);color:#fff;background:linear-gradient(180deg,var(--agent-coral-deep),var(--agent-coral-darker));box-shadow:inset 0 1px 0 rgba(255,255,255,.3)}
    .ct-stp button:disabled{opacity:.4;cursor:not-allowed}
    .ct-stp input{width:38px;height:36px;border:none;background:none;text-align:center;font:inherit;font-size:15.5px;font-weight:700;color:var(--agent-text-primary);padding:0;font-variant-numeric:tabular-nums}
    .ct-stp input:focus{outline:none}
    .ct-stp-lg input{width:44px;font-size:17px}

    .ct-toolbar{display:flex;align-items:center;gap:11px;margin-bottom:15px;flex-wrap:wrap}
    .ct-seg{position:relative;display:inline-flex;background:#fff;border:1px solid var(--agent-border-default);border-radius:999px;padding:3px;box-shadow:0 1px 2px rgba(60,40,22,.04)}
    .ct-seg-pill{position:absolute;top:3px;bottom:3px;left:0;z-index:0;border-radius:999px;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 6px rgba(var(--agent-coral-rgb),.28);transition:left .24s cubic-bezier(.4,.75,.3,1),width .24s cubic-bezier(.4,.75,.3,1),opacity .2s}
    .ct-seg button{position:relative;z-index:1;appearance:none;border:none;background:none;font:inherit;font-size:13.5px;font-weight:600;color:var(--agent-text-secondary);padding:7px 16px;border-radius:999px;cursor:pointer;transition:color .18s}
    .ct-seg button.on{color:#fff}
    .ct-seg button:not(.on):hover{color:var(--agent-text-primary)}
    .ct-seg-n{font-size:11px;opacity:.6;font-weight:650}
    .ct-seg button.on .ct-seg-n{opacity:.82}
    .ct-search{position:relative;flex:1;min-width:210px}
    .ct-search svg{position:absolute;left:15px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--agent-text-muted)}
    .ct-search input{width:100%;font:inherit;font-size:14px;color:var(--agent-text-primary);background:#fff;border:1px solid var(--agent-border-default);border-radius:999px;padding:11px 16px 11px 40px;box-shadow:0 1px 2px rgba(60,40,22,.04);transition:.15s}
    .ct-search input::placeholder{color:var(--agent-text-muted)}
    .ct-search input:focus{outline:none;border-color:var(--agent-coral-deep)}

    .ct-stage{background:#fff;border:1px solid var(--agent-border-default);border-radius:16px;box-shadow:0 1px 2px rgba(60,40,22,.04);margin-bottom:13px;overflow:hidden}
    .ct-stage-head{display:flex;align-items:center;gap:13px;width:100%;appearance:none;border:none;background:none;font:inherit;cursor:pointer;padding:17px 20px;text-align:left;color:inherit;transition:background .15s}
    .ct-stage-head:hover{background:var(--agent-coral-bg-tint)}
    .ct-chev{width:17px;height:17px;color:var(--agent-text-muted);transition:transform .22s;flex:none}
    .ct-stage.open .ct-chev{transform:rotate(90deg)}
    .ct-stitle{font-size:15.5px;font-weight:650;flex:1;letter-spacing:-.015em}
    .ct-smeta{font-size:12.5px;color:var(--agent-text-muted);font-weight:500}
    .ct-badge{font-size:11px;font-weight:700;color:#fff;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 6px rgba(var(--agent-coral-rgb),.28);padding:3px 10px;border-radius:999px}
    .ct-stage-body{border-top:1px solid var(--agent-border-subtle)}
    .ct-collapse{display:grid;grid-template-rows:0fr;transition:grid-template-rows .26s cubic-bezier(.4,.8,.3,1)}
    .ct-collapse[data-open="1"]{grid-template-rows:1fr}
    .ct-collapse-inner{overflow:hidden;min-height:0}

    .ct-step{border-bottom:1px solid var(--agent-border-subtle);transition:background .15s;position:relative}
    .ct-step:last-child{border-bottom:none}
    .ct-step.changed::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--agent-coral-deep)}
    .ct-step.off{opacity:.55}
    .ct-step-row{display:flex;align-items:center;gap:15px;padding:16px 20px;cursor:pointer}
    .ct-step-row:hover{background:rgba(45,24,16,.02)}
    .ct-step-main{flex:1;min-width:0}
    .ct-step-name{font-size:15px;font-weight:620;letter-spacing:-.01em;display:flex;align-items:center;gap:9px;color:var(--agent-text-primary)}
    .ct-reddot{width:6px;height:6px;border-radius:999px;background:var(--agent-coral-deep);flex:none}
    .ct-step-sum{font-size:13px;color:var(--agent-text-secondary);margin-top:3px}
    .ct-step-sum b{color:var(--agent-text-primary);font-weight:650}
    .ct-step-right{flex:none;display:flex;align-items:center;gap:13px}
    .ct-edchev{width:17px;height:17px;color:var(--agent-text-muted);transition:transform .22s}
    .ct-step.open .ct-edchev{transform:rotate(180deg)}

    .ct-editor{padding:2px 20px 20px}
    .ct-ed-card{background:var(--agent-readonly-bg,rgba(45,24,16,.022));border:1px solid var(--agent-border-subtle);border-radius:14px;padding:18px 18px 20px}
    .ct-off-note{font-size:13.5px;font-style:italic;color:var(--agent-text-muted)}

    /* heartbeat pulse canvas */
    .ct-pulse{display:block;width:100%;height:132px}

    .ct-ctrls{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
    .ct-ctrl{display:flex;flex-direction:column;gap:9px}
    .ct-clab{font-size:12px;font-weight:650;color:var(--agent-text-secondary)}
    .ct-crow{display:flex;align-items:center;gap:9px}
    .ct-unit{font-size:12.5px;color:var(--agent-text-muted);font-weight:500;line-height:1.3}

    .ct-empty{text-align:center;padding:40px;color:var(--agent-text-muted);font-size:14.5px;background:#fff;border:1px solid var(--agent-border-default);border-radius:16px}

    .ct-savebar{position:fixed;left:0;right:0;bottom:0;z-index:40;background:rgba(255,253,250,.86);backdrop-filter:blur(16px) saturate(1.3);-webkit-backdrop-filter:blur(16px) saturate(1.3);border-top:1px solid var(--agent-border-default);box-shadow:0 -10px 34px -20px rgba(60,40,22,.4);transform:translateY(130%);transition:transform .32s cubic-bezier(.3,.9,.3,1)}
    .ct-savebar.show{transform:translateY(0)}
    .ct-savebar-inner{max-width:820px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:14px}
    .ct-savebar-stat{font-size:14px;color:var(--agent-text-secondary);flex:1}
    .ct-savebar-stat b{color:var(--agent-text-primary);font-weight:680}
    .ct-btn{appearance:none;font:inherit;font-weight:650;font-size:14.5px;border-radius:12px;cursor:pointer;padding:11px 22px;transition:.15s;border:1.5px solid transparent}
    .ct-btn.ghost{background:none;border-color:var(--agent-border-default);color:var(--agent-text-secondary)}
    .ct-btn.ghost:hover{color:var(--agent-text-primary);border-color:var(--agent-text-muted)}
    .ct-btn.primary{background:var(--agent-coral-deep);color:#fff;box-shadow:0 7px 18px -7px rgba(255,107,74,.6)}
    .ct-btn.primary:hover{background:var(--agent-coral-darker);transform:translateY(-1px)}

    @media (max-width:720px){
      .ct-profiles{grid-template-columns:1fr}
      .ct-ctrls{flex-direction:column;align-items:stretch}
      .ct-step-sum{display:none}
    }
    @media (prefers-reduced-motion:reduce){*{transition:none!important}}
    `}</style>
  );
}

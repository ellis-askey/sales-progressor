"use client";

// Director / business-owner automation settings — the per-milestone client-chase
// cadence editor. Renders:
//   - (optional) master on/off toggle (hidden when a sibling grid owns it)
//   - three "rhythm" profiles that scale grace/repeat from the platform default
//   - a global "hand back after N unanswered chases" default
//   - every client-chaseable milestone, grouped into stages, each expanding into
//     an animated "pulse" schedule + First nudge / Repeat / Reaches-you controls
//     and a per-step on/off
//
// Submit calls updateAgencyChasePolicy / updateBusinessChasePolicy, which store
// this scope's overrides. Forward-only: in-flight files keep their snapshot; new
// files pick up these timings via buildChaseRuleSnapshot. Self-managed files use
// the agency's timings; outsourced files use the progression business's.

import { useState, useRef, useEffect, useTransition } from "react";
import { updateAgencyChasePolicy, updateBusinessChasePolicy } from "@/app/actions/automation";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";

type Side = "vendor" | "purchaser";

type RuleRow = {
  milestoneCode: string;
  milestoneName: string;
  side: Side;
  orderIndex: number;
  graceDays: number;
  repeatEveryDays: number;
  defaultGraceDays: number;
  defaultRepeatEveryDays: number;
  escalateAfterChases: number;
  escalateOverridden: boolean;
  enabled: boolean;
};

type Props = {
  initialChaseEmailsEnabled: boolean;
  initialRules: RuleRow[];
  initialEscalateAfter: number;
  scope?: "agency" | "business";
  showMasterToggle?: boolean;
};

const MIN_GRACE = 1;
const MIN_REPEAT = 2;
const ESC_MIN = 1;
const ESC_MAX = 6;

const PRESETS = [
  { key: "responsive", name: "Responsive", mult: 0.75, esc: 2, weeks: 11, dots: 5, desc: "Quicker follow-ups for clients who tend to respond promptly." },
  { key: "steady",     name: "Steady",     mult: 1,    esc: 2, weeks: 12, dots: 4, desc: "A balanced approach for most sales, with two reminders before it comes back to you." },
  { key: "gentle",     name: "Gentle",     mult: 1.35, esc: 3, weeks: 14, dots: 3, desc: "More time between reminders for clients who prefer a lighter touch." },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];

const scaleVal = (base: number, mult: number, floor: number) => Math.max(floor, Math.round(base * mult));

// Presentational grouping of milestone codes into stages (the DB only knows
// side + orderIndex). Any unmapped code falls into "Other steps".
const STAGE_BY_CODE: Record<string, string> = {
  VM1: "Getting started", VM2: "Getting started", VM3: "Getting started", VM4: "Getting started",
  VM5: "Property information", VM6: "Property information", VM7: "Property information", VM8: "Property information", VM9: "Property information",
  VM16: "Towards exchange", VM17: "Towards exchange",
  PM1: "Getting started", PM2: "Getting started", PM3: "Getting started", PM4: "Getting started",
  PM5: "Mortgage & survey", PM6: "Mortgage & survey", PM9: "Mortgage & survey", PM10: "Mortgage & survey", PM11: "Mortgage & survey",
  PM7: "Contract & searches", PM8: "Contract & searches", PM12: "Contract & searches", PM13: "Contract & searches",
  PM20: "Enquiries",
  PM21: "Towards exchange", PM22: "Towards exchange", PM23: "Towards exchange", PM24: "Towards exchange",
};
const STAGE_ORDER = ["Getting started", "Property information", "Mortgage & survey", "Contract & searches", "Enquiries", "Towards exchange", "Other steps"];
const stageFor = (code: string) => STAGE_BY_CODE[code] ?? "Other steps";

type EditRow = {
  code: string; name: string; side: Side; order: number;
  defGrace: number; defRepeat: number;
  grace: number; repeat: number; escOverride: number | null; enabled: boolean;
};

export function AutomationSettingsForm({ initialChaseEmailsEnabled, initialRules, initialEscalateAfter, scope = "agency", showMasterToggle = true }: Props) {
  const filesLabel = scope === "business" ? "your outsourced files" : "this agency's files";
  const toEdit = (rs: RuleRow[]): EditRow[] => rs.map((r) => ({
    code: r.milestoneCode, name: r.milestoneName, side: r.side, order: r.orderIndex,
    defGrace: r.defaultGraceDays, defRepeat: r.defaultRepeatEveryDays,
    grace: r.graceDays, repeat: r.repeatEveryDays,
    escOverride: r.escalateOverridden ? r.escalateAfterChases : null,
    enabled: r.enabled,
  }));

  const [rows, setRows] = useState<EditRow[]>(() => toEdit(initialRules));
  const [globalEsc, setGlobalEsc] = useState(initialEscalateAfter);
  const [chaseEmailsEnabled, setChaseEmailsEnabled] = useState(initialChaseEmailsEnabled);
  const [profile, setProfile] = useState<PresetKey>("steady");
  const [sideFilter, setSideFilter] = useState<Side>("vendor");
  const [query, setQuery] = useState("");
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Baseline for dirty-tracking (last saved state).
  const [baseline, setBaseline] = useState(() => JSON.stringify({ rows: toEdit(initialRules), globalEsc: initialEscalateAfter, chaseEmailsEnabled: initialChaseEmailsEnabled }));
  const current = JSON.stringify({ rows, globalEsc, chaseEmailsEnabled });
  const dirty = current !== baseline;

  const active = PRESETS.find((p) => p.key === profile)!;
  const escOf = (r: EditRow) => r.escOverride ?? globalEsc;
  const rowChanged = (r: EditRow) =>
    r.grace !== scaleVal(r.defGrace, active.mult, MIN_GRACE) ||
    r.repeat !== scaleVal(r.defRepeat, active.mult, MIN_REPEAT) ||
    r.escOverride != null || !r.enabled;
  const custom = globalEsc !== active.esc || rows.some(rowChanged);
  const changedCount = rows.filter(rowChanged).length;

  function patch(code: string, p: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.code === code ? { ...r, ...p } : r)));
  }
  function applyPreset(p: typeof PRESETS[number]) {
    setProfile(p.key);
    setGlobalEsc(p.esc);
    setRows((prev) => prev.map((r) => ({
      ...r, enabled: true, escOverride: null,
      grace: scaleVal(r.defGrace, p.mult, MIN_GRACE), repeat: scaleVal(r.defRepeat, p.mult, MIN_REPEAT),
    })));
  }
  const toggleSet = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set); next.has(key) ? next.delete(key) : next.add(key); setter(next);
  };

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const save = scope === "business" ? updateBusinessChasePolicy : updateAgencyChasePolicy;
      const result = await save({
        chaseEmailsEnabled: showMasterToggle ? chaseEmailsEnabled : undefined,
        escalateAfterChases: globalEsc,
        rules: rows.map((r) => ({
          milestoneCode: r.code,
          graceDays: r.grace,
          repeatEveryDays: r.repeat,
          escalateAfterChases: r.escOverride,
          enabled: r.enabled,
        })),
      });
      if (result.ok) {
        setBaseline(JSON.stringify({ rows, globalEsc, chaseEmailsEnabled }));
        setSavedAt(new Date());
      } else {
        setError(result.error);
      }
    });
  }

  // filter + group
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (r.side !== sideFilter) return false;
    if (q && !(`${r.name} ${r.code} ${stageFor(r.code)}`.toLowerCase().includes(q))) return false;
    return true;
  });
  const groups: { stage: string; items: EditRow[] }[] = [];
  visible.forEach((r) => {
    const stage = stageFor(r.code);
    let g = groups.find((x) => x.stage === stage);
    if (!g) { g = { stage, items: [] }; groups.push(g); }
    g.items.push(r);
  });
  groups.forEach((g) => g.items.sort((a, b) => a.order - b.order));
  groups.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));

  const sellerCount = rows.filter((r) => r.side === "vendor").length;
  const buyerCount = rows.filter((r) => r.side === "purchaser").length;
  const offCount = rows.filter((r) => !r.enabled).length;

  return (
    <div className="ct-root" style={{ display: "flex", flexDirection: "column", gap: 30 }}>
      <Styles />

      {/* summary */}
      <div className="ct-summary">
        <span className="ct-summary-ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l3 8 4-16 3 8h4" /></svg>
        </span>
        <p>
          On {custom ? <>your <b>custom</b> rhythm</> : <>the <b>{active.name}</b> rhythm</>}, a typical sale reaches
          exchange in <b>approx {active.weeks} weeks</b>. Every waiting step gets up to <b>{globalEsc} {globalEsc === 1 ? "chase" : "chases"}</b> before
          it comes to you{offCount ? <>, and <b>{offCount}</b> {offCount === 1 ? "step is" : "steps are"} set never to chase</> : null}.
        </p>
      </div>

      {showMasterToggle && (
        <section className="ct-card ct-master">
          <div>
            <h2>Send automated chase emails on {filesLabel}</h2>
            <p>When on, we send gentle chase emails on your behalf for the steps below. When off, nothing is sent, but anything waiting still shows up in your reminders.</p>
          </div>
          <button type="button" role="switch" aria-checked={chaseEmailsEnabled} className={`ct-switch${chaseEmailsEnabled ? " on" : ""}`} onClick={() => setChaseEmailsEnabled((v) => !v)} />
        </section>
      )}

      {/* 1 profiles */}
      <section>
        <SecHead n={1} title="Choose a rhythm" />
        <div className="ct-profiles">
          {PRESETS.map((p) => {
            const on = profile === p.key && !custom;
            return (
              <button type="button" key={p.key} className={`ct-pcard${on ? " on" : ""}`} onClick={() => applyPreset(p)}>
                <div className="ct-pcard-top">
                  <span className="ct-pcard-name">{p.name}</span>
                  <span className="ct-tick">{on && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>}</span>
                </div>
                <MiniPulse dots={p.dots} />
                <div className="ct-pcard-weeks"><span className="ct-wk-affix">Approx</span>{p.weeks}<span className="ct-wk-affix">weeks</span></div>
                <div className="ct-pcard-label">to exchange</div>
                <p className="ct-pcard-desc">{p.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="ct-note">
          {custom
            ? <>You&apos;ve tuned this from the <b>{active.name}</b> rhythm. Pick one above to snap everything back.</>
            : <>Using the <b>{active.name}</b> rhythm. Adjust any step below to create your own custom schedule.</>}
        </p>
      </section>

      {/* 2 escalation */}
      <section>
        <SecHead n={2} title="When to hand back to you" />
        <div className="ct-card ct-esc">
          <span className="ct-esc-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V3h13l-2.5 4.5L17 12H4" /></svg>
          </span>
          <div className="ct-esc-body">
            <div className="ct-esc-t1">Stop chasing and alert you after <Stepper value={globalEsc} onChange={setGlobalEsc} min={ESC_MIN} max={ESC_MAX} big /> unanswered reminders</div>
            <div className="ct-esc-t2">This is your default limit for each step. Once reached, we&apos;ll stop chasing and let you take over. You can set a different limit for individual steps below.</div>
          </div>
        </div>
      </section>

      {/* 3 steps */}
      <section>
        <SecHead n={3} title="Fine-tune individual steps" optional
          right={<button type="button" className="ct-link" onClick={() => {
            const everyOpen = groups.length > 0 && groups.every((g) => openStages.has(g.stage));
            setOpenStages(everyOpen ? new Set() : new Set(groups.map((g) => g.stage)));
          }}>{groups.length > 0 && groups.every((g) => openStages.has(g.stage)) ? "Collapse all" : "Open all"}</button>} />

        <div className="ct-toolbar">
          <SidePicker value={sideFilter} onChange={setSideFilter} sellerCount={sellerCount} buyerCount={buyerCount} />
          <div className="ct-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a step: mortgage, enquiries, deposit…" />
          </div>
        </div>

        {groups.length === 0 && <div className="ct-empty">No steps match that search.</div>}

        {groups.map((g, gi) => {
          const key = g.stage;
          const open = q !== "" || openStages.has(key) || (openStages.size === 0 && gi === 0);
          const chg = g.items.filter(rowChanged).length;
          return (
            <div className={`ct-stage${open ? " open" : ""}`} key={key}>
              <button type="button" className="ct-stage-head" onClick={() => toggleSet(openStages, key, setOpenStages)}>
                <svg className="ct-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                <span className="ct-stitle">{g.stage}</span>
                {chg > 0 && <span className="ct-badge">{chg} changed</span>}
                <span className="ct-smeta">{g.items.length} {g.items.length === 1 ? "step" : "steps"}</span>
              </button>
              <Collapse open={open}>
                <div className="ct-stage-body">
                  {g.items.map((s) => {
                    const sOpen = openSteps.has(s.code);
                    const ch = rowChanged(s);
                    return (
                      <div className={`ct-step${ch ? " changed" : ""}${s.enabled ? "" : " off"}${sOpen ? " open" : ""}`} key={s.code}>
                        <div className="ct-step-row" onClick={() => toggleSet(openSteps, s.code, setOpenSteps)}>
                          <div className="ct-step-main">
                            <div className="ct-step-name">{ch && <span className="ct-reddot" />}{s.name}</div>
                            <div className="ct-step-sum">
                              {s.enabled
                                ? <>First nudge in <b>{s.grace}</b> working {s.grace === 1 ? "day" : "days"}, then every <b>{s.repeat}</b>, reaching you after <b>{escOf(s)}</b>.</>
                                : <><b>Never chased</b>. This step just waits.</>}
                            </div>
                          </div>
                          <div className="ct-step-right">
                            <button type="button" role="switch" aria-checked={s.enabled} className={`ct-switch sm${s.enabled ? " on" : ""}`}
                              onClick={(e) => { e.stopPropagation(); patch(s.code, { enabled: !s.enabled }); }} />
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
                                    <Ctrl label="First nudge" unit="working days after it's due">
                                      <Stepper value={s.grace} onChange={(n) => patch(s.code, { grace: n })} min={MIN_GRACE} max={30} />
                                    </Ctrl>
                                    <Ctrl label="Then repeat every" unit="working days">
                                      <Stepper value={s.repeat} onChange={(n) => patch(s.code, { repeat: n })} min={MIN_REPEAT} max={30} />
                                    </Ctrl>
                                    <Ctrl label="Reaches you after" unit={s.escOverride == null ? `chases · your default of ${globalEsc}` : "chases"}>
                                      <Stepper value={escOf(s)} onChange={(n) => patch(s.code, { escOverride: n })} min={ESC_MIN} max={ESC_MAX} />
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

      {/* save bar */}
      <div className={`ct-savebar${dirty || error ? " show" : ""}`}>
        <div className="ct-savebar-inner">
          <span className="ct-savebar-stat">
            {error ? <span style={{ color: "#b42318" }}>{error}</span>
              : changedCount > 0 ? <>You&apos;ve <b>{changedCount}</b> {changedCount === 1 ? "step" : "steps"} fine-tuned. </>
              : dirty ? <>Unsaved changes.</>
              : savedAt ? <>Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.</>
              : null}
          </span>
          <button type="button" className="ct-btn ghost" onClick={() => applyPreset(active)} disabled={isPending}>Reset</button>
          <button type="button" className="ct-btn primary" onClick={handleSubmit} disabled={isPending || !dirty}>{isPending ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── stepper ─────────────────────────────────────────────────────────────── */
function Stepper({ value, onChange, min, max, big }: { value: number; onChange: (n: number) => void; min: number; max: number; big?: boolean }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <span className={`ct-stp${big ? " ct-stp-lg" : ""}`}>
      <button type="button" aria-label="decrease" disabled={value <= min} onClick={() => onChange(clamp(value - 1))}>−</button>
      <input inputMode="numeric" value={value}
        onChange={(e) => { const n = parseInt(e.target.value, 10); if (Number.isFinite(n)) onChange(clamp(n)); }}
        onFocus={(e) => e.currentTarget.select()} />
      <button type="button" aria-label="increase" disabled={value >= max} onClick={() => onChange(clamp(value + 1))}>+</button>
    </span>
  );
}

/* ── mini heartbeat (rhythm cards) ───────────────────────────────────────── */
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

/* ── heartbeat pulse schedule (per-step) ─────────────────────────────────── */
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
      const bw = Math.max(0.55, maxDay * 0.05);
      const marks = nd.map((day, i) => ({ day, amp: 15 + i * 7 }));
      const emark = { day: escDay, amp: Math.min(h * 0.42, 42) };
      const all = [...marks, emark];
      const spike = (dv: number) => {
        let s = 0;
        for (const m of all) {
          const dd = Math.abs(dv - m.day);
          if (dd < bw) s += m.amp * 0.5 * (1 + Math.cos((Math.PI * dd) / bw));
        }
        return s;
      };
      const pts: [number, number][] = [];
      const steps = 320;
      for (let i = 0; i <= steps; i++) { const dv = (i / steps) * maxDay; pts.push([X(dv), base - spike(dv)]); }

      ctx!.strokeStyle = pal.line; ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.moveTo(padL, base); ctx!.lineTo(rightX, base); ctx!.stroke();
      ctx!.lineWidth = 2; ctx!.strokeStyle = pal.pale;
      ctx!.beginPath(); pts.forEach((p, i) => (i ? ctx!.lineTo(p[0], p[1]) : ctx!.moveTo(p[0], p[1]))); ctx!.stroke();
      const period = 2800, prog = (t % period) / period, headX = padL + prog * (rightX - padL);
      ctx!.save(); ctx!.beginPath(); ctx!.rect(padL - 2, 0, headX - padL + 2, h); ctx!.clip();
      ctx!.lineWidth = 2.6; ctx!.strokeStyle = pal.coralDeep;
      ctx!.beginPath(); pts.forEach((p, i) => (i ? ctx!.lineTo(p[0], p[1]) : ctx!.moveTo(p[0], p[1]))); ctx!.stroke(); ctx!.restore();
      const hy = base - spike(((headX - padL) / (rightX - padL)) * maxDay);
      ctx!.fillStyle = pal.coralDeep;
      ctx!.beginPath(); ctx!.arc(headX, hy, 4, 0, 7); ctx!.fill();
      ctx!.textAlign = "center";
      marks.forEach((m, i) => {
        const x = X(m.day), y = base - m.amp, lx = Math.max(26, Math.min(w - 26, x));
        ctx!.fillStyle = pal.coralDeep; ctx!.beginPath(); ctx!.arc(x, y, 3, 0, 7); ctx!.fill();
        ctx!.fillStyle = pal.ink; ctx!.font = "700 12px " + font; ctx!.fillText("Day " + m.day, lx, y - 9);
        ctx!.fillStyle = pal.faint; ctx!.font = "600 10px " + font; ctx!.fillText(i === 0 ? "1st nudge" : ordinal(i + 1) + " nudge", lx, base + 16);
      });
      const ex = X(escDay);
      ctx!.fillStyle = pal.amber; ctx!.font = "700 12px " + font; ctx!.textAlign = "center";
      ctx!.fillText("Day " + escDay, ex, base - emark.amp - 9);
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

/* ── collapse (animated drawer) ──────────────────────────────────────────── */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => { if (open) setMounted(true); }, [open]);
  return (
    <div className="ct-collapse" data-open={open ? "1" : "0"}
      onTransitionEnd={(e) => { if (e.target === e.currentTarget && !open) setMounted(false); }}>
      <div className="ct-collapse-inner">{mounted ? children : null}</div>
    </div>
  );
}

/* ── side picker (animated sliding pill) ─────────────────────────────────── */
function SidePicker({ value, onChange, sellerCount, buyerCount }: { value: Side; onChange: (v: Side) => void; sellerCount: number; buyerCount: number }) {
  const options = [
    { key: "vendor" as const, label: "Seller", n: sellerCount },
    { key: "purchaser" as const, label: "Buyer", n: buyerCount },
  ];
  const activeIdx = options.findIndex((o) => o.key === value);
  const { btnRefs, ind } = useTabIndicator(activeIdx);
  return (
    <div className="ct-seg">
      <span className="ct-seg-pill" aria-hidden style={ind ? { left: ind.left, width: ind.width, opacity: 1 } : { opacity: 0 }} />
      {options.map((o, i) => (
        <button type="button" key={o.key} ref={(el) => { btnRefs.current[i] = el; }}
          className={value === o.key ? "on" : ""} onClick={() => onChange(o.key)}>
          {o.label} <span className="ct-seg-n">{o.n}</span>
        </button>
      ))}
    </div>
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

/* ── scoped styles ───────────────────────────────────────────────────────── */
function Styles() {
  return (
    <style>{`
    .ct-root{font-variant-numeric:tabular-nums}
    .ct-summary{display:flex;gap:15px;align-items:flex-start;padding:17px 19px;border-radius:16px;background:linear-gradient(180deg,var(--agent-coral-bg-tint),rgba(255,255,255,.5));border:1px solid var(--agent-border-default)}
    .ct-summary-ic{flex:none;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:#fff;border:1px solid var(--agent-border-default);color:var(--agent-coral-deep)}
    .ct-summary-ic svg{width:19px;height:19px}
    .ct-summary p{margin:0;font-size:14.5px;line-height:1.55;color:var(--agent-text-secondary)}
    .ct-summary b{color:var(--agent-text-primary);font-weight:650}
    .ct-card{background:#fff;border:1px solid var(--agent-border-default);border-radius:16px;box-shadow:0 1px 2px rgba(60,40,22,.04)}
    .ct-master{display:flex;align-items:center;gap:18px;padding:19px 22px}
    .ct-master h2{margin:0;font-size:16px;font-weight:680}
    .ct-master p{margin:5px 0 0;font-size:13.5px;line-height:1.5;color:var(--agent-text-secondary);max-width:58ch}
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
    .ct-pcard{text-align:left;cursor:pointer;background:#fff;border:1.5px solid var(--agent-border-default);border-radius:16px;padding:18px 18px;box-shadow:0 1px 2px rgba(60,40,22,.04);transition:transform .18s,box-shadow .18s,border-color .18s}
    .ct-pcard:hover{transform:translateY(-3px);box-shadow:0 10px 26px -16px rgba(60,40,22,.3);border-color:var(--agent-coral-pale)}
    .ct-pcard:focus-visible{outline:none;border-color:var(--agent-coral-deep)}
    .ct-pcard.on{border-color:transparent;background:linear-gradient(180deg,var(--agent-coral),var(--agent-coral-deep));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 12px 26px -14px rgba(var(--agent-coral-rgb),.55)}
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
    .ct-pcard-weeks{font-size:26px;font-weight:740;letter-spacing:-.025em;color:var(--agent-coral-deep);display:flex;align-items:baseline;gap:6px}
    .ct-pcard.on .ct-pcard-weeks{color:#fff}
    .ct-wk-affix{font-size:12.5px;font-weight:650;color:var(--agent-text-muted)}
    .ct-pcard.on .ct-wk-affix{color:rgba(255,255,255,.82)}
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
    .ct-stp input{width:38px;height:36px;border:none;background:none;text-align:center;font:inherit;font-size:15.5px;font-weight:700;color:var(--agent-text-primary);padding:0}
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
    .ct-stage-head:hover{background:rgba(45,24,16,.02)}
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
    .ct-pulse{display:block;width:100%;height:132px}
    .ct-ctrls{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
    .ct-ctrl{display:flex;flex-direction:column;gap:9px}
    .ct-clab{font-size:12px;font-weight:650;color:var(--agent-text-secondary)}
    .ct-crow{display:flex;align-items:center;gap:9px}
    .ct-unit{font-size:12.5px;color:var(--agent-text-muted);font-weight:500;line-height:1.3}
    .ct-empty{text-align:center;padding:40px;color:var(--agent-text-muted);font-size:14.5px;background:#fff;border:1px solid var(--agent-border-default);border-radius:16px}
    .ct-savebar{position:sticky;bottom:16px;z-index:20;margin-top:6px;background:rgba(255,253,250,.9);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);border:1px solid var(--agent-border-default);border-radius:14px;box-shadow:0 14px 34px -20px rgba(60,40,22,.4);opacity:0;transform:translateY(8px);pointer-events:none;transition:opacity .22s,transform .22s}
    .ct-savebar.show{opacity:1;transform:translateY(0);pointer-events:auto}
    .ct-savebar-inner{padding:13px 18px;display:flex;align-items:center;gap:14px}
    .ct-savebar-stat{font-size:14px;color:var(--agent-text-secondary);flex:1}
    .ct-savebar-stat b{color:var(--agent-text-primary);font-weight:680}
    .ct-btn{appearance:none;font:inherit;font-weight:650;font-size:14.5px;border-radius:12px;cursor:pointer;padding:11px 22px;transition:.15s;border:1.5px solid transparent}
    .ct-btn:disabled{opacity:.5;cursor:not-allowed}
    .ct-btn.ghost{background:none;border-color:var(--agent-border-default);color:var(--agent-text-secondary)}
    .ct-btn.ghost:hover:not(:disabled){color:var(--agent-text-primary);border-color:var(--agent-text-muted)}
    .ct-btn.primary{background:var(--agent-coral-deep);color:#fff;box-shadow:0 7px 18px -7px rgba(255,107,74,.6)}
    .ct-btn.primary:hover:not(:disabled){background:var(--agent-coral-darker);transform:translateY(-1px)}
    @media (max-width:720px){
      .ct-profiles{grid-template-columns:1fr}
      .ct-ctrls{flex-direction:column;align-items:stretch}
      .ct-step-sum{display:none}
    }
    @media (prefers-reduced-motion:reduce){.ct-collapse,.ct-seg-pill,.ct-savebar{transition:none}}
    `}</style>
  );
}

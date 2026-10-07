"use client";

// Director-only automation settings form. Renders:
//   - Master toggle (Agency.chaseEmailsEnabled)
//   - One row per chaseable milestone with graceDays + repeatEveryDays inputs
//
// Live "Effect" line computed client-side: chase 1 on day {grace},
// chase 2 on day {grace + repeat}, escalate after that.
//
// Submit calls updateAgencyChasePolicy, which stores this agency's own
// overrides. Settings edits are forward-only: in-flight transactions keep their
// chaseRuleSnapshot; new self-managed files pick up this agency's timings via
// buildChaseRuleSnapshot (outsourced files always use the platform default).

import { useState, useTransition } from "react";
import { updateAgencyChasePolicy } from "@/app/actions/automation";
import { RoleIcon, type Role } from "@/components/ui/RoleIcon";

type RuleRow = {
  milestoneCode: string;
  milestoneName: string;
  side: "vendor" | "purchaser";
  graceDays: number;
  repeatEveryDays: number;
  defaultGraceDays: number;
  defaultRepeatEveryDays: number;
};

type Props = {
  initialChaseEmailsEnabled: boolean;
  initialRules: RuleRow[];
};

const MIN_GRACE = 1;
const MIN_REPEAT = 2;

// Timing profiles (#228). Each scales every chase from its own platform default
// so the varied timings (enquiries wait ~4 weeks, "instruct solicitor" ~2 days)
// all tighten or loosen together. "Steady" (×1) is the platform default, so it
// also doubles as reset-to-defaults.
type PresetKey = "responsive" | "steady" | "gentle" | "custom";
const PRESETS: { key: Exclude<PresetKey, "custom">; name: string; mult: number; weeks: number; desc: string }[] = [
  { key: "responsive", name: "Responsive", mult: 0.75, weeks: 11, desc: "Tighter nudges. Hits the window when clients reply on the first chase." },
  { key: "steady",     name: "Steady",     mult: 1,    weeks: 12, desc: "Balanced for most sales. Assumes about two chases to land each step." },
  { key: "gentle",     name: "Gentle",     mult: 1.35, weeks: 14, desc: "Fewer, softer nudges. Best for clients who prefer a lighter touch." },
];

function scale(base: number, mult: number, floor: number): number {
  return Math.max(floor, Math.round(base * mult));
}

export function AutomationSettingsForm({ initialChaseEmailsEnabled, initialRules }: Props) {
  const [chaseEmailsEnabled, setChaseEmailsEnabled] = useState(initialChaseEmailsEnabled);
  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // On load: all rules at their platform default → "Steady"; any override → "Custom".
  const allAtDefault = (rs: RuleRow[]) =>
    rs.every((r) => r.graceDays === r.defaultGraceDays && r.repeatEveryDays === r.defaultRepeatEveryDays);
  const [preset, setPreset] = useState<PresetKey>(allAtDefault(initialRules) ? "steady" : "custom");
  // Baseline = the last saved state. Dirty-tracking against it lets us disable
  // Save when nothing has changed and drop the "Saved at" note the moment the
  // user starts editing again (so the label never lies).
  const [baselineEnabled, setBaselineEnabled] = useState(initialChaseEmailsEnabled);
  const [baselineRules, setBaselineRules] = useState<RuleRow[]>(initialRules);
  const dirty =
    chaseEmailsEnabled !== baselineEnabled ||
    JSON.stringify(rules) !== JSON.stringify(baselineRules);

  function updateRule(idx: number, patch: Partial<RuleRow>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setPreset("custom"); // a manual edit means the timings no longer match a profile
  }

  // Apply a profile: scale every chase from its own platform default.
  function applyPreset(key: Exclude<PresetKey, "custom">, mult: number) {
    setRules((prev) => prev.map((r) => ({
      ...r,
      graceDays: scale(r.defaultGraceDays, mult, MIN_GRACE),
      repeatEveryDays: scale(r.defaultRepeatEveryDays, mult, MIN_REPEAT),
    })));
    setPreset(key);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await updateAgencyChasePolicy({
        chaseEmailsEnabled,
        rules: rules.map((r) => ({
          milestoneCode: r.milestoneCode,
          graceDays: r.graceDays,
          repeatEveryDays: r.repeatEveryDays,
        })),
      });
      if (result.ok) {
        // Rebase so the form reads clean until the next edit.
        setBaselineEnabled(chaseEmailsEnabled);
        setBaselineRules(rules);
        setSavedAt(new Date());
      } else {
        setError(result.error);
      }
    });
  }

  // Vendor and purchaser sections rendered separately for clarity.
  const vendorRules = rules
    .map((r, idx) => ({ rule: r, idx }))
    .filter(({ rule }) => rule.side === "vendor");
  const purchaserRules = rules
    .map((r, idx) => ({ rule: r, idx }))
    .filter(({ rule }) => rule.side === "purchaser");

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <section className="glass-card rounded-[12px] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--agent-text-primary,#1A1D29)]">
              Send automated chase emails on this agency's files
            </h2>
            <p className="text-sm mt-1 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
              Master switch for the automated client-chase pipeline. When off, no chase
              emails are sent on any file in your agency. Files still appear as manual
              tasks in the team's reminders list.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={chaseEmailsEnabled}
            onClick={() => setChaseEmailsEnabled((v) => !v)}
            className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors"
            style={{
              background: chaseEmailsEnabled ? "#FF6B4A" : "rgba(15,23,42,0.20)",
            }}
          >
            <span
              className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: chaseEmailsEnabled ? "translateX(22px)" : "translateX(4px)", marginTop: 4 }}
            />
          </button>
        </div>
      </section>

      {/* Timing profile (presets) */}
      <section>
        <h3 className="text-base font-semibold text-[var(--agent-text-primary,#1A1D29)] mb-1">
          Timing profile
        </h3>
        <p className="text-sm mb-3 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
          Each profile scales every chase below to reach exchange within a target window.
          Pick one, or edit any chase and it becomes Custom.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((p) => {
            const on = preset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => applyPreset(p.key, p.mult)}
                className="text-left glass-card rounded-[12px] p-3.5 transition-all"
                style={{
                  boxShadow: on ? "0 0 0 1px #FF6B4A inset, 0 6px 18px rgba(255,107,74,0.14)" : undefined,
                  borderColor: on ? "#FF6B4A" : undefined,
                }}
                aria-pressed={on}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--agent-text-primary,#1A1D29)]">{p.name}</span>
                  {on
                    ? <span className="text-[#E8502E] text-xs font-bold">✓</span>
                    : p.key === "steady" ? <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Default</span> : null}
                </div>
                <div className="mt-1.5 text-lg font-bold tracking-tight text-[#E8502E] tabular-nums">≈ {p.weeks} wks</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">to exchange</div>
                <p className="mt-2 text-[11px] leading-snug text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">{p.desc}</p>
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-xs text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
          {preset === "custom"
            ? <><span className="font-semibold text-[#E8502E]">Custom</span> timings. Pick a profile above to refill from a preset.</>
            : <>Using the <span className="font-semibold">{PRESETS.find((p) => p.key === preset)?.name}</span> profile. Edit any chase below to switch to Custom.</>}
        </p>
      </section>

      {/* Auto-emails nudge */}
      <a
        href="/agent/automated-emails"
        className="flex items-center gap-3 rounded-[12px] p-3.5 no-underline"
        style={{ background: "rgba(61,122,184,0.07)", border: "0.5px solid rgba(61,122,184,0.22)" }}
      >
        <span className="flex-none grid place-items-center w-[30px] h-[30px] rounded-[9px]" style={{ background: "rgba(61,122,184,0.14)", color: "#3D7AB8" }} aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
        </span>
        <span className="flex-1 min-w-0 text-[12.5px] leading-snug text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
          This page sets <b className="text-[var(--agent-text-primary,#1A1D29)]">how often</b> we chase. To choose <b className="text-[var(--agent-text-primary,#1A1D29)]">which</b> emails actually send, head to Auto emails.
        </span>
        <span className="flex-none text-[12.5px] font-semibold whitespace-nowrap" style={{ color: "#3D7AB8" }}>Go to Auto emails →</span>
      </a>

      {/* Per-milestone timing */}
      <section>
        <div className="flex items-baseline justify-between gap-3 mb-1">
          <h3 className="text-base font-semibold text-[var(--agent-text-primary,#1A1D29)]">
            Every automatic chase
          </h3>
          <button
            type="button"
            onClick={() => applyPreset("steady", 1)}
            className="text-xs font-semibold underline underline-offset-2 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))] hover:text-[#E8502E]"
          >
            Reset to our defaults
          </button>
        </div>
        <p className="text-sm mb-4 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
          Each waits the grace days, nudges again every repeat gap, then escalates to you.
          Changes apply to new files only. Files already in flight keep their original schedule.
        </p>

        <RuleSection title="Vendor side" side="vendor" rows={vendorRules} updateRule={updateRule} />
        <RuleSection title="Purchaser side" side="purchaser" rows={purchaserRules} updateRule={updateRule} />
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-4 sticky bottom-4 glass-card rounded-[12px] p-4">
        <div className="text-sm">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : dirty ? (
            <span className="text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
              Changes are not saved until you click Save.
            </span>
          ) : savedAt ? (
            <span className="text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
              Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
            </span>
          ) : (
            <span className="text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
              No unsaved changes.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !dirty}
          className="px-4 py-2 rounded-md text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#FF6B4A" }}
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function RuleSection({
  title,
  side,
  rows,
  updateRule,
}: {
  title: string;
  side: Role;
  rows: { rule: RuleRow; idx: number }[];
  updateRule: (idx: number, patch: Partial<RuleRow>) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--agent-text-secondary,rgba(15,23,42,0.65))] mb-2 flex items-center gap-1.5">
        <RoleIcon role={side} size={13} />
        {title}
      </h4>
      <div className="space-y-2">
        {rows.map(({ rule, idx }) => (
          <RuleEditor key={rule.milestoneCode} rule={rule} onChange={(patch) => updateRule(idx, patch)} />
        ))}
      </div>
    </div>
  );
}

function RuleEditor({ rule, onChange }: { rule: RuleRow; onChange: (patch: Partial<RuleRow>) => void }) {
  const chase1Day = rule.graceDays;
  const chase2Day = rule.graceDays + rule.repeatEveryDays;
  return (
    <div className="glass-card rounded-[10px] p-4">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xs font-semibold text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
          {rule.milestoneCode}
        </span>
        <span className="text-sm font-semibold text-[var(--agent-text-primary,#1A1D29)]">
          {rule.milestoneName}
        </span>
      </div>
      <div className="flex items-center gap-4 mb-2 flex-wrap">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">Grace days</span>
          <input
            type="number"
            min={MIN_GRACE}
            value={rule.graceDays}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= MIN_GRACE) onChange({ graceDays: n });
            }}
            className="w-16 px-2 py-1 rounded border border-[rgba(15,23,42,0.15)] text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">Repeat days</span>
          <input
            type="number"
            min={MIN_REPEAT}
            value={rule.repeatEveryDays}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (Number.isFinite(n) && n >= MIN_REPEAT) onChange({ repeatEveryDays: n });
            }}
            className="w-16 px-2 py-1 rounded border border-[rgba(15,23,42,0.15)] text-sm"
          />
        </label>
      </div>
      <p className="text-xs text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
        Effect: chase 1 on day {chase1Day}, chase 2 on day {chase2Day}, escalate after that.
      </p>
    </div>
  );
}

"use client";

// Director-only automation settings form. Renders:
//   - Master toggle (Agency.chaseEmailsEnabled)
//   - One row per chaseable milestone with graceDays + repeatEveryDays inputs
//
// Live "Effect" line computed client-side: chase 1 on day {grace},
// chase 2 on day {grace + repeat}, escalate after that.
//
// Submit calls updateAgencyChasePolicy. Settings edits are forward-only —
// in-flight transactions keep their chaseRuleSnapshot. New transactions
// pick up the updated ReminderRule values via buildChaseRuleSnapshot.

import { useState, useTransition } from "react";
import { updateAgencyChasePolicy } from "@/app/actions/automation";

type RuleRow = {
  milestoneCode: string;
  milestoneName: string;
  side: "vendor" | "purchaser";
  graceDays: number;
  repeatEveryDays: number;
};

type Props = {
  initialChaseEmailsEnabled: boolean;
  initialRules: RuleRow[];
};

const MIN_GRACE = 1;
const MIN_REPEAT = 2;

export function AutomationSettingsForm({ initialChaseEmailsEnabled, initialRules }: Props) {
  const [chaseEmailsEnabled, setChaseEmailsEnabled] = useState(initialChaseEmailsEnabled);
  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [isPending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateRule(idx: number, patch: Partial<RuleRow>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
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
              emails are sent on any file in your agency. Files still surface as manual
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

      {/* Per-milestone timing */}
      <section>
        <h3 className="text-base font-semibold text-[var(--agent-text-primary,#1A1D29)] mb-1">
          Per-milestone chase timing
        </h3>
        <p className="text-sm mb-4 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
          Changes apply to new files only. Files already in flight keep their original schedule.
        </p>

        <RuleSection title="Vendor side" rows={vendorRules} updateRule={updateRule} />
        <RuleSection title="Purchaser side" rows={purchaserRules} updateRule={updateRule} />
      </section>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-4 sticky bottom-4 glass-card rounded-[12px] p-4">
        <div className="text-sm">
          {error ? (
            <span className="text-red-700">{error}</span>
          ) : savedAt ? (
            <span className="text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
              Saved at {savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
            </span>
          ) : (
            <span className="text-[var(--agent-text-muted,rgba(15,23,42,0.50))]">
              Changes are not saved until you click Save.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
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
  rows,
  updateRule,
}: {
  title: string;
  rows: { rule: RuleRow; idx: number }[];
  updateRule: (idx: number, patch: Partial<RuleRow>) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="mb-5">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--agent-text-secondary,rgba(15,23,42,0.65))] mb-2">
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

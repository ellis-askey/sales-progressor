"use client";

// Command Centre → Agency File → Automation.
//
// The editable version of what used to be the read-only "Automation" settings
// snapshot: every per-agency switch the Command Centre can set, in one place on
// the agency's own page. Reuses the exact server actions behind the old
// Agencies-list control tables (chase streams, weekly update, WhatsApp), with
// the same optimistic-with-rollback behaviour. Switches the agency sets itself
// (from /agent/settings/automation) stay read-only here, labelled as theirs.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAgencyChaseStreamAction, type ChaseStream } from "@/app/actions/agency-chase";
import { updateAgencyWeeklyUpdateAction } from "@/app/actions/agency-weekly-update";
import { updateAgencyWhatsAppStreamAction, type WhatsAppStream } from "@/app/actions/agency-whatsapp";

export type AutomationValues = {
  solicitorChaseEnabled: boolean;
  enquiryReplyChaseEnabled: boolean;
  enquiryRaiseChaseEnabled: boolean;
  weeklyClientUpdatesEnabled: boolean;
  whatsAppCaptureEnabled: boolean;
  whatsAppTasksEnabled: boolean;
};

export type AgencySetValues = {
  chaseEmailsEnabled: boolean;
  advisorChaseEnabled: boolean;
  chainNeighbourUpdatesEnabled: boolean;
  clientChaseEscalateAfter: number;
};

type SwitchKey = keyof AutomationValues;

const CHASE_KEYS: ChaseStream[] = ["solicitorChaseEnabled", "enquiryReplyChaseEnabled", "enquiryRaiseChaseEnabled"];
const WHATSAPP_KEYS: WhatsAppStream[] = ["whatsAppCaptureEnabled", "whatsAppTasksEnabled"];

const SWITCH_ROWS: { key: SwitchKey; label: string }[] = [
  { key: "solicitorChaseEnabled", label: "Solicitor confirmations" },
  { key: "enquiryReplyChaseEnabled", label: "Enquiries chase" },
  { key: "enquiryRaiseChaseEnabled", label: "Enquiries raise" },
  { key: "weeklyClientUpdatesEnabled", label: "Weekly client updates" },
  { key: "whatsAppCaptureEnabled", label: "WhatsApp capture" },
  { key: "whatsAppTasksEnabled", label: "WhatsApp auto to-dos" },
];

function Switch({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-40"
      style={{ background: on ? "#2563eb" : "#3f3f46" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
        style={{ transform: on ? "translateX(18px)" : "translateX(3px)" }}
      />
    </button>
  );
}

export function AgencyAutomationControls({
  agencyId,
  values,
  agencySet,
  chaseMasterOn,
}: {
  agencyId: string;
  values: AutomationValues;
  agencySet: AgencySetValues;
  chaseMasterOn: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<AutomationValues>(values);
  const [savingKey, setSavingKey] = useState<SwitchKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggle(key: SwitchKey) {
    const next = !v[key];
    setSavingKey(key);
    setError(null);
    setV((prev) => ({ ...prev, [key]: next }));
    startTransition(async () => {
      const res = (CHASE_KEYS as string[]).includes(key)
        ? await updateAgencyChaseStreamAction({ agencyId, stream: key as ChaseStream, value: next })
        : (WHATSAPP_KEYS as string[]).includes(key)
          ? await updateAgencyWhatsAppStreamAction({ agencyId, stream: key as WhatsAppStream, value: next })
          : await updateAgencyWeeklyUpdateAction({ agencyId, value: next });
      if (!res.ok) {
        setError(res.error);
        setV((prev) => ({ ...prev, [key]: !next }));
      } else {
        router.refresh();
      }
      setSavingKey((cur) => (cur === key ? null : cur));
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider">Automation</p>
        {!chaseMasterOn && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border text-red-400 bg-red-950/50 border-red-900">
            Chase master off
          </span>
        )}
      </div>

      {!chaseMasterOn && (
        <p className="text-[11px] text-red-400/80 mb-3 leading-relaxed">
          The global chase master is off, so the three chase streams below send nothing
          regardless of their setting. It lives on the Solicitor chasing page.
        </p>
      )}

      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {SWITCH_ROWS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">{label}</span>
            <Switch on={v[key]} disabled={savingKey === key} onClick={() => toggle(key)} />
          </div>
        ))}
      </div>

      {/* Switches the agency controls from its own settings. Shown for the full
          picture; editing them belongs to the agency, not the Command Centre. */}
      <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
        {[
          { label: "Client chase emails", on: agencySet.chaseEmailsEnabled },
          { label: "Advisor chase", on: agencySet.advisorChaseEnabled },
          { label: "Chain-neighbour updates", on: agencySet.chainNeighbourUpdatesEnabled },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between text-xs">
            <span className="text-neutral-400">
              {r.label}
              <span className="ml-1.5 text-[10px] text-neutral-600">agency-set</span>
            </span>
            <span className={r.on ? "text-emerald-400 font-medium" : "text-neutral-600"}>{r.on ? "On" : "Off"}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            Hand back after
            <span className="ml-1.5 text-[10px] text-neutral-600">agency-set</span>
          </span>
          <span className="text-neutral-300">{agencySet.clientChaseEscalateAfter} unanswered chases</span>
        </div>
      </div>
    </div>
  );
}

"use client";

// Command Centre → Agencies & agents → Controls tab.
//
// ONE matrix for every per-agency automation switch the Command Centre owns:
// the three chase streams, the Saturday weekly client update, and the two
// WhatsApp switches. Replaces the four stacked tables the old page grew
// (Chase control, Weekly update, WhatsApp) with a single row per agency, and
// adds per-column masters (all on / all off) that the stacked tables never had.
// Optimistic toggles with rollback, mirroring the originals. The per-agency
// view of the same switches lives on each Agency File.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import InfoTip from "@/components/command/shared/InfoTip";
import {
  updateAgencyChaseStreamAction,
  setAllAgencyChaseStreamAction,
  type ChaseStream,
} from "@/app/actions/agency-chase";
import {
  updateAgencyWeeklyUpdateAction,
  setAllWeeklyUpdatesAction,
} from "@/app/actions/agency-weekly-update";
import {
  updateAgencyWhatsAppStreamAction,
  setAllWhatsAppStreamAction,
  type WhatsAppStream,
} from "@/app/actions/agency-whatsapp";

export type ControlsRow = {
  id: string;
  name: string;
  solicitorChaseEnabled: boolean;
  enquiryReplyChaseEnabled: boolean;
  enquiryRaiseChaseEnabled: boolean;
  weeklyClientUpdatesEnabled: boolean;
  whatsAppCaptureEnabled: boolean;
  whatsAppTasksEnabled: boolean;
};

type ColumnKey = keyof Omit<ControlsRow, "id" | "name">;

const COLUMNS: { key: ColumnKey; label: string; group: "chase" | "weekly" | "whatsapp"; help: string }[] = [
  { key: "solicitorChaseEnabled", label: "Solicitor confirmations", group: "chase", help: "Chases solicitors to confirm a step is done." },
  { key: "enquiryReplyChaseEnabled", label: "Enquiries chase", group: "chase", help: "Chases whoever holds the enquiries (solicitors)." },
  { key: "enquiryRaiseChaseEnabled", label: "Enquiries raise", group: "chase", help: "Chases to get enquiries raised. Reaches buyers directly, not just solicitors." },
  { key: "weeklyClientUpdatesEnabled", label: "Weekly update", group: "weekly", help: "The Saturday 09:00 quick check-in email to clients whose file has had no email in the last 7 days. Only active files; only buyer/seller contacts with an email who haven't unsubscribed. Sends are recorded in the Messages tab and on each file's activity." },
  { key: "whatsAppCaptureEnabled", label: "WA capture", group: "whatsapp", help: "Save the agency's property-group WhatsApp messages onto the file. A kill switch: capture only starts once an agent links their WhatsApp." },
  { key: "whatsAppTasksEnabled", label: "WA to-dos", group: "whatsapp", help: "Turn dated promises made over WhatsApp into to-dos on the file. Off by default." },
];

function Toggle({ on, disabled, onClick }: { on: boolean; disabled: boolean; onClick: () => void }) {
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

export function AgencyControlsMatrix({
  agencies,
  chaseMasterOn,
  weeklyEligibleThisWeek,
}: {
  agencies: ControlsRow[];
  chaseMasterOn: boolean;
  weeklyEligibleThisWeek: number;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ControlsRow[]>(agencies);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function toggleOne(agencyId: string, key: ColumnKey) {
    const row = rows.find((r) => r.id === agencyId);
    if (!row) return;
    const next = !row[key];
    const saveKey = `${agencyId}:${key}`;
    setSavingKey(saveKey);
    setError(null);
    setRows((prev) => prev.map((r) => (r.id === agencyId ? { ...r, [key]: next } : r)));
    startTransition(async () => {
      const col = COLUMNS.find((c) => c.key === key)!;
      const res =
        col.group === "chase"
          ? await updateAgencyChaseStreamAction({ agencyId, stream: key as ChaseStream, value: next })
          : col.group === "whatsapp"
            ? await updateAgencyWhatsAppStreamAction({ agencyId, stream: key as WhatsAppStream, value: next })
            : await updateAgencyWeeklyUpdateAction({ agencyId, value: next });
      if (!res.ok) {
        setError(res.error);
        setRows((prev) => prev.map((r) => (r.id === agencyId ? { ...r, [key]: !next } : r)));
      } else {
        router.refresh();
      }
      setSavingKey((cur) => (cur === saveKey ? null : cur));
    });
  }

  function setColumn(key: ColumnKey, value: boolean) {
    const saveKey = `__col__:${key}`;
    const prev = rows;
    setSavingKey(saveKey);
    setError(null);
    setRows((p) => p.map((r) => ({ ...r, [key]: value })));
    startTransition(async () => {
      const col = COLUMNS.find((c) => c.key === key)!;
      const res =
        col.group === "chase"
          ? await setAllAgencyChaseStreamAction({ stream: key as ChaseStream, value })
          : col.group === "whatsapp"
            ? await setAllWhatsAppStreamAction({ stream: key as WhatsAppStream, value })
            : await setAllWeeklyUpdatesAction({ value });
      if (!res.ok) {
        setError(res.error);
        setRows(prev);
      } else {
        router.refresh();
      }
      setSavingKey((cur) => (cur === saveKey ? null : cur));
    });
  }

  const busy = savingKey !== null;

  return (
    <div className="space-y-3">
      {/* Masters strip */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-neutral-500">Global chase master</span>
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
              chaseMasterOn
                ? "text-emerald-400 bg-emerald-950/50 border-emerald-900"
                : "text-red-400 bg-red-950/50 border-red-900"
            }`}
          >
            {chaseMasterOn ? "ON" : "OFF"}
          </span>
          <Link href="/command/solicitor-chase" className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors">
            Change on Solicitor chasing →
          </Link>
        </div>
        <p className="text-[11.5px] text-neutral-500">
          <span className="tabular-nums font-semibold text-neutral-300">{weeklyEligibleThisWeek}</span>{" "}
          client{weeklyEligibleThisWeek === 1 ? "" : "s"} would get this Saturday&rsquo;s weekly update
          (across agencies currently on).
        </p>
      </div>

      {!chaseMasterOn && (
        <p className="text-[11.5px] text-red-400/80">
          The master is off: no agency is chased on any of the three chase streams, regardless of
          the switches below.
        </p>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* The matrix */}
      <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-900">
        <table className="w-full text-[13px] min-w-[860px] border-collapse">
          <thead>
            <tr className="bg-neutral-950/60">
              <th className="text-left px-4 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500 border-b border-neutral-800">
                Agency
              </th>
              {COLUMNS.map((c, i) => (
                <th
                  key={c.key}
                  className={`text-center px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-neutral-500 border-b border-neutral-800 whitespace-nowrap ${
                    i > 0 && COLUMNS[i - 1].group !== c.group ? "border-l border-l-neutral-800" : ""
                  }`}
                >
                  <span className="inline-flex items-center gap-1 justify-center">
                    {c.label}
                    <InfoTip label={c.label} align="right">{c.help}</InfoTip>
                  </span>
                  <span className="flex items-center justify-center gap-1.5 mt-1 normal-case tracking-normal font-sans">
                    <button
                      type="button"
                      onClick={() => setColumn(c.key, true)}
                      disabled={busy || rows.every((r) => r[c.key])}
                      className="text-[10px] font-semibold text-neutral-500 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:hover:text-neutral-500"
                    >
                      all on
                    </button>
                    <span className="text-neutral-700">·</span>
                    <button
                      type="button"
                      onClick={() => setColumn(c.key, false)}
                      disabled={busy || rows.every((r) => !r[c.key])}
                      className="text-[10px] font-semibold text-neutral-500 hover:text-blue-300 transition-colors disabled:opacity-40 disabled:hover:text-neutral-500"
                    >
                      all off
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="px-4 py-8 text-center text-sm text-neutral-500">
                  No agencies yet.
                </td>
              </tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id} className="hover:bg-neutral-950/40 transition-colors">
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={`/command/agency/${a.id}`} className="text-neutral-200 hover:text-blue-300 transition-colors">
                      {a.name}
                    </Link>
                  </td>
                  {COLUMNS.map((c, i) => (
                    <td
                      key={c.key}
                      className={`px-3 py-2.5 text-center ${
                        i > 0 && COLUMNS[i - 1].group !== c.group ? "border-l border-l-neutral-800" : ""
                      }`}
                    >
                      <div className="inline-flex justify-center">
                        <Toggle
                          on={a[c.key]}
                          disabled={savingKey === `${a.id}:${c.key}` || savingKey === `__col__:${c.key}`}
                          onClick={() => toggleOne(a.id, c.key)}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-neutral-600 leading-relaxed">
        Turn a switch off for an agency and no file of theirs runs that stream. &ldquo;Enquiries
        raise&rdquo; emails buyers directly, not just solicitors. The same switches, per agency, are
        on each Agency File.
      </p>
    </div>
  );
}

"use client";

// Command Centre "Email senders" interactive view. Pick an agency + toggle
// in-house / outsourced, and see how every outbound email resolves its From,
// Reply-to and fallback. Values come from describeSender (mirrors the resolver).

import { useState } from "react";
import {
  EMAIL_SENDERS,
  SENDER_GROUPS,
  describeSender,
  type FileType,
  type AgencyForSender,
} from "@/lib/command/email-senders";

export type AgencyOption = AgencyForSender & { id: string; modeProfile: string };

const CHIP: Record<string, { cls: string; label: string }> = {
  agency: { cls: "bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]", label: "Agency" },
  own: { cls: "bg-[#1d2d50] text-[#93c5fd] border-[#2f4a75]", label: "Own verified" },
  sp: { cls: "bg-neutral-800 text-neutral-300 border-neutral-700", label: "Sales Progressor" },
  gap: { cls: "bg-[#3a2a12] text-[#fbbf24] border-[#5a4426]", label: "SP · gap" },
};

export function EmailSendersView({ agencies }: { agencies: AgencyOption[] }) {
  const withAddr = agencies.find((a) => a.quoteSenderEmail);
  const [agencyId, setAgencyId] = useState(withAddr?.id ?? agencies[0]?.id ?? "");
  const [fileType, setFileType] = useState<FileType>("outsourced");

  const agency = agencies.find((a) => a.id === agencyId) ?? agencies[0];
  if (!agency) return <p className="text-sm text-neutral-500">No agencies found.</p>;

  const hasAddr = !!agency.quoteSenderEmail;
  const headline = describeSender(
    { id: "_", name: "Milestone", group: "", kind: "agencyPerson" },
    fileType,
    agency,
  );

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">Agency</span>
          <select
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded-md text-sm text-neutral-200 px-3 py-1.5 min-w-[220px] focus:outline-none focus:border-[#2563eb]"
          >
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.quoteSenderEmail ? "" : "  (on fallback)"}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">File type</span>
          <div className="inline-flex bg-neutral-900 border border-neutral-700 rounded-md p-0.5">
            {(["outsourced", "self_managed"] as FileType[]).map((ft) => (
              <button
                key={ft}
                onClick={() => setFileType(ft)}
                className={`text-[13px] font-semibold px-3 py-1 rounded transition-colors ${
                  fileType === ft ? "bg-[#2563eb] text-white" : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {ft === "outsourced" ? "Outsourced (we run it)" : "In-house (agency runs it)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <p className="text-[13px] text-neutral-400">
          On {fileType === "outsourced" ? "outsourced" : "in-house"} files for{" "}
          <span className="text-neutral-100 font-semibold">{agency.name}</span>,{" "}
          {hasAddr ? "agency-branded email sends from its verified address:" : "the agency has no verified address, so it uses the fallback:"}
        </p>
        <div className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-3">
          <Field k="Automated mail from" v={headline.from} mono />
          <Field k="Reply-to" v={headline.replyTo} mono />
          <Field k={hasAddr ? "If the address were removed" : "Fallback"} v={headline.fallback} mono />
        </div>
        <p className="mt-3 text-[11px] text-neutral-600">
          ⟨progressor⟩ = the assigned Sales Progressor · ⟨agency agent⟩ = the agency's own negotiator. Their name fills the slot before "at".
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[10px] uppercase tracking-widest text-neutral-600">Sends from</span>
        {(["agency", "own", "sp", "gap"] as const).map((c) => (
          <span key={c} className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${CHIP[c].cls}`}>
            {CHIP[c].label}
          </span>
        ))}
      </div>

      {/* Tables */}
      {SENDER_GROUPS.map((group) => {
        const rows = EMAIL_SENDERS.filter((e) => e.group === group && (!e.scope || e.scope === fileType));
        if (!rows.length) return null;
        return (
          <div key={group}>
            <h2 className="text-[12px] uppercase tracking-widest text-neutral-500 mb-2">{group}</h2>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                      <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800 w-[30%]">Email</th>
                      <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800 w-[12%]">From</th>
                      <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800 w-[32%]">From address</th>
                      <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800 w-[26%]">Reply-to · fallback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => {
                      const r = describeSender(e, fileType, agency);
                      const chip = CHIP[r.chip];
                      return (
                        <tr key={e.id} className={r.chip === "gap" ? "bg-[#3a2a12]/30" : ""}>
                          <td className="px-4 py-3 border-b border-neutral-800/70 align-top">
                            <span className="text-[13px] text-neutral-200 font-medium">{e.name}</span>
                            {e.note && <span className="block text-[11px] text-neutral-600 mt-0.5">{e.note}</span>}
                          </td>
                          <td className="px-4 py-3 border-b border-neutral-800/70 align-top whitespace-nowrap">
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${chip.cls}`}>{chip.label}</span>
                          </td>
                          <td className="px-4 py-3 border-b border-neutral-800/70 align-top">
                            <span className="font-mono text-[12px] text-neutral-300 break-all">{r.from}</span>
                          </td>
                          <td className="px-4 py-3 border-b border-neutral-800/70 align-top">
                            <span className="font-mono text-[12px] text-neutral-400 break-all">{r.replyTo}</span>
                            <span className="block text-[11px] text-neutral-600 mt-0.5 break-all">fallback: {r.fallback}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-600">{k}</div>
      <div className={`mt-1 text-[13px] text-neutral-200 break-all ${mono ? "font-mono" : ""}`}>{v}</div>
    </div>
  );
}

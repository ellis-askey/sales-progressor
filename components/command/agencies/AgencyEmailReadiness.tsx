"use client";

// Command Centre → Agencies & agents → Email readiness.
//
// One place to see which agencies can send from their own domain and which are
// still on the shared Sales Progressor fallback. Each row is a two-item
// checklist (sender address + domain authentication); expand it to act. The
// domain row reuses the same AgencyDomainAuth cell as /command/email-senders,
// so there is one source of truth and no reimplementation. Read-only signals
// from lib/command/agency-readiness.ts.

import { Fragment, useState } from "react";
import InfoTip from "@/components/command/shared/InfoTip";
import { AgencyDomainAuth } from "@/components/command/email-senders/AgencyDomainAuth";
import type { AgencyEmailReadiness as Row, ReadinessLevel, InboundLevel } from "@/lib/command/agency-readiness";

const LEVEL: Record<ReadinessLevel, { label: string; cls: string; rank: number }> = {
  broken: { label: "Action needed", cls: "text-red-400 bg-red-950/40 border-red-900", rank: 0 },
  not_started: { label: "Not started", cls: "text-neutral-400 bg-neutral-800 border-neutral-700", rank: 1 },
  setting_up: { label: "Setting up", cls: "text-amber-400 bg-amber-950/50 border-amber-900", rank: 2 },
  ready: { label: "Ready", cls: "text-emerald-400 bg-emerald-950/50 border-emerald-900", rank: 3 },
};

// Inbound is a separate signal from the sender+DNS readiness pill: a connected
// mailbox landing replies back on files. Kept visually distinct so it never
// folds into the overall Ready/Setting up state.
const INBOUND: Record<InboundLevel, { label: string; mark: string; color: string; pill: string }> = {
  ready: { label: "Receiving", mark: "✓", color: "#6ee7b7", pill: "text-emerald-400 bg-emerald-950/50 border-emerald-900" },
  connected_quiet: { label: "Quiet", mark: "◑", color: "#fbbf24", pill: "text-amber-400 bg-amber-950/50 border-amber-900" },
  none: { label: "Not connected", mark: "○", color: "#71717a", pill: "text-neutral-400 bg-neutral-800 border-neutral-700" },
};

function ReadinessPill({ level }: { level: ReadinessLevel }) {
  const s = LEVEL[level];
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${s.cls}`}>
      {s.label}
    </span>
  );
}

function Tick({ done, label }: { done: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: done ? "#6ee7b7" : "#71717a" }}>
      <span className="text-[13px] leading-none">{done ? "✓" : "○"}</span>
      {label}
    </span>
  );
}

export function AgencyEmailReadiness({
  rows,
  readyCount,
  total,
}: {
  rows: Row[];
  readyCount: number;
  total: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyGaps, setOnlyGaps] = useState(false);

  const sorted = [...rows].sort(
    (a, b) => LEVEL[a.level].rank - LEVEL[b.level].rank || a.name.localeCompare(b.name),
  );
  const shown = onlyGaps ? sorted.filter((r) => r.level !== "ready") : sorted;
  const gaps = total - readyCount;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <h2 className="text-[12px] uppercase tracking-widest text-neutral-500 flex items-center gap-1.5">
          Email readiness
          <InfoTip label="What email readiness means">
            Whether an agency can send mail from its own domain. Ready means the sending domain is
            authenticated (DKIM and SPF verified), so mail goes out as the agency. Until then it sends
            from the shared Sales Progressor address, which reads as less trustworthy to clients and
            hurts deliverability. Sender and domain both come from the same records the Email senders
            page uses, rechecked nightly.
          </InfoTip>
          <span className="ml-1 font-mono text-neutral-600 normal-case tracking-normal">
            {readyCount}/{total} ready
          </span>
        </h2>
        {gaps > 0 && (
          <button
            type="button"
            onClick={() => setOnlyGaps((v) => !v)}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors ${
              onlyGaps
                ? "bg-neutral-700 text-white border-neutral-600"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {onlyGaps ? "Showing gaps" : `Show ${gaps} not ready`}
          </button>
        )}
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-neutral-600">
                <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Agency</th>
                <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Setup</th>
                <th className="text-left font-semibold px-4 py-2.5 border-b border-neutral-800">Status</th>
                <th className="text-right font-semibold px-4 py-2.5 border-b border-neutral-800"></th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-neutral-500">
                    {total === 0 ? "No agencies yet." : "Every agency is email-ready."}
                  </td>
                </tr>
              ) : (
                shown.map((r) => {
                  const open = openId === r.id;
                  const dnsDone = r.domain?.status === "verified";
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setOpenId(open ? null : r.id)}
                        className="cursor-pointer hover:bg-neutral-950/40 transition-colors"
                      >
                        <td className="px-4 py-3 border-b border-neutral-800/70 text-[13px] text-neutral-200 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-2">
                            <span className={`text-neutral-600 transition-transform ${open ? "rotate-90" : ""}`}>›</span>
                            {r.name}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-neutral-800/70">
                          <span className="inline-flex items-center gap-3">
                            <Tick done={r.senderSet} label="Sender" />
                            <Tick done={dnsDone} label="DNS" />
                            <Tick done={r.inbound.level === "ready"} label="Inbound" />
                          </span>
                        </td>
                        <td className="px-4 py-3 border-b border-neutral-800/70 whitespace-nowrap">
                          <ReadinessPill level={r.level} />
                        </td>
                        <td className="px-4 py-3 border-b border-neutral-800/70 text-right whitespace-nowrap">
                          <span className="text-[11px] text-neutral-500">{open ? "Close" : "Set up"}</span>
                        </td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 border-b border-neutral-800/70 bg-neutral-950/40">
                            <div className="space-y-3 max-w-2xl">
                              {/* 1. Sender email */}
                              <div className="flex items-start gap-3">
                                <span className="text-[13px] leading-6" style={{ color: r.senderSet ? "#6ee7b7" : "#71717a" }}>
                                  {r.senderSet ? "✓" : "○"}
                                </span>
                                <div>
                                  <p className="text-[13px] font-semibold text-neutral-200">Sending address</p>
                                  {r.senderSet ? (
                                    <p className="text-[12px] text-neutral-400 font-mono break-all">{r.senderEmail}</p>
                                  ) : (
                                    <p className="text-[12px] text-neutral-500">
                                      No sending address set. Mail goes out from the shared Sales Progressor address
                                      until the domain below is authenticated, which sets this automatically.
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* 2. Domain authentication (reuses the email-senders cell) */}
                              <div className="flex items-start gap-3">
                                <span className="text-[13px] leading-6" style={{ color: dnsDone ? "#6ee7b7" : "#71717a" }}>
                                  {dnsDone ? "✓" : "○"}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <p className="text-[13px] font-semibold text-neutral-200">Domain authentication (DNS)</p>
                                    <AgencyDomainAuth
                                      agency={{ id: r.id, name: r.name, quoteSenderEmail: r.senderEmail }}
                                      initial={r.domain}
                                    />
                                  </div>
                                  <p className="text-[12px] text-neutral-500 mt-1">
                                    {dnsDone
                                      ? "DKIM and SPF verified. This agency sends from its own domain."
                                      : r.domain
                                        ? "DNS records generated. The agency needs to add them at their registrar, then check status here."
                                        : "Not started. Generate the DNS records, then send them to the agency to add at their registrar."}
                                  </p>
                                </div>
                              </div>

                              {/* 3. Inbound email (replies landing on files) */}
                              <div className="flex items-start gap-3">
                                <span className="text-[13px] leading-6" style={{ color: INBOUND[r.inbound.level].color }}>
                                  {INBOUND[r.inbound.level].mark}
                                </span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <p className="text-[13px] font-semibold text-neutral-200">
                                      Inbound email (replies land on files)
                                    </p>
                                    <span
                                      className={`text-[10px] font-mono uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${INBOUND[r.inbound.level].pill}`}
                                    >
                                      {INBOUND[r.inbound.level].label}
                                    </span>
                                  </div>
                                  <p className="text-[12px] text-neutral-500 mt-1">
                                    {r.inbound.level === "ready"
                                      ? "Connected and receiving. Recent replies are landing on files."
                                      : r.inbound.level === "connected_quiet"
                                        ? "A mailbox is connected, but no replies have landed in the last 30 days."
                                        : "No mailbox connected for this agency yet. A director or negotiator connects their inbox from their Account > Connections page."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

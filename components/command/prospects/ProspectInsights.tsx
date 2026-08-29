"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addChainStubAsProspectAction } from "@/app/actions/prospects";
import { SOURCE_LABEL, LOST_REASON_LABEL } from "@/lib/command/prospect-labels";
import type { AcquisitionFunnel, ChainLead } from "@/lib/command/prospects";

const STAGES: Array<{ key: keyof AcquisitionFunnel; label: string }> = [
  { key: "added", label: "Added" },
  { key: "contacted", label: "Contacted" },
  { key: "replied", label: "Replied" },
  { key: "interested", label: "Interested" },
  { key: "firstSale", label: "First sale" },
  { key: "active", label: "Active" },
];

const RATE_BETWEEN: Array<keyof AcquisitionFunnel> = ["contactRate", "replyRate", "interestedRate", "firstSaleRate", "activeRate"];

export function ProspectInsights({ funnel, chainLeads }: { funnel: AcquisitionFunnel; chainLeads: ChainLead[] }) {
  const max = Math.max(1, funnel.added);
  return (
    <div className="space-y-6">
      {/* Funnel */}
      <Panel title="Acquisition funnel" subtitle="How prospects move from first added to an active customer. Each prospect counts at the furthest stage it ever reached.">
        {funnel.added === 0 ? (
          <p className="text-sm text-neutral-500">No prospects yet. Add one, or pull in a chain lead below.</p>
        ) : (
          <div className="space-y-1.5">
            {STAGES.map((s, i) => {
              const count = funnel[s.key] as number;
              const rate = i > 0 ? (funnel[RATE_BETWEEN[i - 1]] as number | null) : null;
              return (
                <div key={s.key}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-0.5 pl-1">
                      <span className="text-[10px] text-neutral-600">↳</span>
                      <span className="text-[10px] text-neutral-500 tabular-nums">{rate == null ? "—" : `${rate}%`} carried through</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-xs text-neutral-400">{s.label}</div>
                    <div className="flex-1 h-6 rounded bg-neutral-900 overflow-hidden">
                      <div className="h-full bg-blue-600/40 border-r border-blue-500/50" style={{ width: `${Math.round((count / max) * 100)}%`, minWidth: count > 0 ? "2px" : "0" }} />
                    </div>
                    <div className="w-10 shrink-0 text-right text-sm font-semibold text-neutral-200 tabular-nums">{count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Metric label="Avg days to first sale" value={funnel.avgDaysToFirstSale == null ? "—" : `${funnel.avgDaysToFirstSale}`} suffix={funnel.avgDaysToFirstSale == null ? "" : " days"} />
          <Metric label="Avg follow-ups to win" value={funnel.avgFollowUpsToConvert == null ? "—" : `${funnel.avgFollowUpsToConvert}`} />
        </div>
      </Panel>

      {/* By source */}
      <Panel title="By source" subtitle="Where wins actually come from.">
        {funnel.bySource.length === 0 ? (
          <p className="text-sm text-neutral-500">No prospects yet.</p>
        ) : (
          <div className="space-y-1">
            <Row head cells={["Source", "Added", "Won", "Win rate"]} />
            {funnel.bySource.map((r) => (
              <Row key={r.source} cells={[SOURCE_LABEL[r.source], String(r.added), String(r.converted), r.added > 0 ? `${Math.round((r.converted / r.added) * 100)}%` : "—"]} />
            ))}
          </div>
        )}
      </Panel>

      {/* Lost reasons */}
      {funnel.lostReasons.length > 0 && (
        <Panel title="Why we lose" subtitle="Reasons prospects were marked lost.">
          <div className="space-y-1">
            {funnel.lostReasons.map((r) => (
              <Row key={r.reason} cells={[LOST_REASON_LABEL[r.reason] ?? r.reason, String(r.count)]} widths={["flex-1", "w-12 text-right"]} />
            ))}
          </div>
        </Panel>
      )}

      {/* Chain leads */}
      <ChainLeads leads={chainLeads} />
    </div>
  );
}

function ChainLeads({ leads }: { leads: ChainLead[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function add(chainLinkId: string) {
    setBusyId(chainLinkId); setError(null);
    start(async () => {
      const res = await addChainStubAsProspectAction(chainLinkId);
      if (!res.ok) setError(res.error);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <Panel title={`Chain leads · ${leads.length}`} subtitle="Agents invited into a chain who never claimed. They already touched the product, so they're warm. Add one to start working it as a prospect.">
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      {leads.length === 0 ? (
        <p className="text-sm text-neutral-500">No unclaimed chain invites waiting. New ones appear here automatically.</p>
      ) : (
        <div className="space-y-1.5">
          {leads.map((l) => (
            <div key={l.chainLinkId} className="flex items-center gap-3 py-1.5 border-b border-neutral-900 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-200 truncate">{l.agencyName || l.agentEmail}</div>
                <div className="text-[11px] text-neutral-500 truncate">
                  {l.agentName ? `${l.agentName} · ` : ""}{l.agentEmail}{l.propertyAddress ? ` · ${l.propertyAddress}` : ""}
                </div>
              </div>
              <span className="text-[10px] text-neutral-600 shrink-0">{l.inviteStatus.toLowerCase()}</span>
              <button
                onClick={() => add(l.chainLinkId)}
                disabled={pending && busyId === l.chainLinkId}
                className="text-xs px-2.5 py-1 rounded-md bg-blue-600/20 text-blue-300 border border-blue-600/40 hover:bg-blue-600/30 transition-colors disabled:opacity-40 shrink-0"
              >
                {pending && busyId === l.chainLinkId ? "Adding…" : "Add as prospect"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
      {subtitle && <p className="text-[12px] text-neutral-500 mt-0.5 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

function Metric({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-neutral-100 tabular-nums">{value}<span className="text-sm font-normal text-neutral-500">{suffix}</span></p>
    </div>
  );
}

function Row({ cells, head, widths }: { cells: string[]; head?: boolean; widths?: string[] }) {
  const w = widths ?? ["flex-1", "w-16 text-right", "w-16 text-right", "w-20 text-right"];
  return (
    <div className={`flex items-center gap-2 py-1 ${head ? "text-[10px] uppercase tracking-wider text-neutral-600 border-b border-neutral-800 pb-1.5" : "text-sm text-neutral-300"}`}>
      {cells.map((c, i) => <div key={i} className={`${w[i] ?? "flex-1"} ${!head && i > 0 ? "tabular-nums text-neutral-200" : ""} truncate`}>{c}</div>)}
    </div>
  );
}

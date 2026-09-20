"use client";

// All Files → Pipeline view. The whole active book laid out across the six
// conveyancing stages, each column carrying a count and the fees riding on
// it. Stage placement is derived server-side (getPipelineStageMap) from the
// milestone engine, so this component is pure presentation: group the rows
// it's handed by their stage, total the fees, render. The busiest stage is
// flagged so a log-jam shows itself before you read a card.

import Link from "next/link";
import { FileText, Files, MagnifyingGlass, ChatCircleText, ArrowsLeftRight, Key, Flame } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { DISPLAY_STAGES, type DisplayStageKey } from "@/lib/milestones/display-stages";
import type { TransactionRow } from "./TransactionTable";
import { riskLevelForRow } from "./TransactionRowView";
import { gbpCompact } from "./money";
import { useEdgeFadeMask } from "@/lib/agent/use-edge-fade";

// The board reads a few fee/price fields that aren't on the shared
// TransactionRow type but ARE present on the live rows (listTransactions
// spreads them + coerces the Decimals to numbers). Declared optional here so
// the full rows pass through without widening the shared type.
export type PipelineRow = TransactionRow & {
  purchasePrice?: number | null;
  agentFeeAmount?: number | null;
  agentFeePercent?: number | null;
  referralFee?: number | null;
  brokerReferralFee?: number | null;
  onwardBrokerReferralFee?: number | null;
  // Server-resolved display fee (pence): our progression income for internal
  // staff, the agency's own gross fee otherwise. See listTransactions.
  feePence?: number;
};

// Per-stage icon — the tinted icon-in-circle style used on the Enquiries /
// Completions section headers.
const STAGE_ICON: Record<DisplayStageKey, typeof FileText> = {
  instructed: FileText,
  draft_pack: Files,
  searches: MagnifyingGlass,
  enquiries: ChatCircleText,
  exchange: ArrowsLeftRight,
  completion: Key,
};

// The fee shown for a file, in pence. Prefer the server-resolved feePence —
// OUR progression income for internal staff, the agency's own gross fee (agent
// commission + solicitor/broker referrals) otherwise. Falls back to the
// agency-fee maths for any row predating the field. Every workspace fee display
// (strip / forecast / pipeline / map) reads this one function.
function fileFeePence(r: PipelineRow): number {
  if (typeof r.feePence === "number") return r.feePence;
  const commission =
    r.agentFeeAmount != null
      ? r.agentFeeAmount
      : r.agentFeePercent != null && r.purchasePrice != null
        ? Math.round((r.purchasePrice * r.agentFeePercent) / 100)
        : 0;
  return commission + (r.referralFee ?? 0) + (r.brokerReferralFee ?? 0) + (r.onwardBrokerReferralFee ?? 0);
}

export { fileFeePence };

function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  return { line: parts.slice(0, -2).join(", ") || parts[0], location: parts.slice(-2).join(", ") };
}

// Risk via the shared riskLevelForRow — the same score the List's Risk chip
// and the "At risk" segment use. high → "At risk", medium → "Watch".
function riskTag(r: PipelineRow): { label: string; cls: string } | null {
  const level = riskLevelForRow(r);
  if (level === "high") return { label: "At risk", cls: "risk" };
  if (level === "medium") return { label: "Watch", cls: "watch" };
  return null;
}

function riskRank(r: PipelineRow): number {
  const level = riskLevelForRow(r);
  if (level === "high") return 0;
  if (level === "medium") return 1;
  return 2;
}

export function PipelineBoard({
  transactions,
  stageByTx,
  basePath,
}: {
  transactions: PipelineRow[];
  stageByTx: Record<string, DisplayStageKey>;
  basePath: string;
}) {
  // Edge-fade the carousel: whichever side is clipped fades, and the fade drops
  // on an edge once you've scrolled fully to it (no fade over the Instructed /
  // Completion cards when you're against that side). Hook must run before the
  // empty-state early return below.
  const { ref: scrollRef, onScroll, mask } = useEdgeFadeMask();

  const active = transactions.filter((t) => t.status === "active");

  // Group into the six stages, preserving DISPLAY_STAGES order. At-risk first,
  // then by fee value descending.
  const grouped = DISPLAY_STAGES.map((stage) => {
    const files = active
      .filter((t) => (stageByTx[t.id] ?? "instructed") === stage.key)
      .sort((a, b) => riskRank(a) - riskRank(b) || fileFeePence(b) - fileFeePence(a));
    const feeTotal = files.reduce((sum, f) => sum + fileFeePence(f), 0);
    const atRisk = files.filter((f) => riskLevelForRow(f) === "high").length;
    return { ...stage, files, feeTotal, atRisk };
  });

  // Flag the busiest stage — but only when it genuinely dominates (≥3 files
  // and ≥25% of the book), so an evenly-spread board doesn't cry wolf.
  const maxCount = Math.max(...grouped.map((g) => g.files.length));
  const busyKey =
    maxCount >= 3 && maxCount >= active.length * 0.25
      ? grouped.find((g) => g.files.length === maxCount)?.key ?? null
      : null;

  if (active.length === 0) {
    return (
      <div className="agent-glass-strong pboard-empty">
        <p className="pboard-empty-t">No active files</p>
        <p className="pboard-empty-d">Files appear on the board while they&apos;re live, from instruction through to completion.</p>
      </div>
    );
  }

  return (
    <div
      className="pboard-scroll scrollbar-hide"
      ref={scrollRef}
      onScroll={onScroll}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      <div className="pboard-board">
        {grouped.map((col) => {
          const Icon = STAGE_ICON[col.key];
          const busy = col.key === busyKey;
          return (
            <div key={col.key} className={`pboard-col${busy ? " busy" : ""}`}>
              <div className="pboard-ch">
                <div className="pboard-ch-top">
                  <span className={`pboard-ic pboard-ic--${col.key}`} aria-hidden><Icon size={18} weight="regular" /></span>
                  <span className="pboard-ch-name">{col.name}</span>
                  <span className="pboard-ch-count tabnum">{col.files.length}</span>
                </div>
                <div className="pboard-ch-meta">
                  {busy ? (
                    <span className="pboard-busy">
                      <Flame size={11} weight="fill" />
                      Busiest{col.feeTotal > 0 ? ` · ${gbpCompact(col.feeTotal)}` : ""}
                    </span>
                  ) : (
                    <>
                      {col.feeTotal > 0 && <span className="pboard-fees"><b>{gbpCompact(col.feeTotal)}</b> fees</span>}
                      {col.atRisk > 0 && <span className="pboard-atrisk"><span className="d" />{col.atRisk} at risk</span>}
                    </>
                  )}
                </div>
              </div>

              <div className="pboard-cb">
                {col.files.length === 0 ? (
                  <p className="pboard-col-none">None</p>
                ) : (
                  col.files.map((f) => {
                    const { line, location } = splitAddress(f.propertyAddress);
                    const rt = riskTag(f);
                    const fee = fileFeePence(f);
                    return (
                      <Link key={f.id} href={`${basePath}/${f.id}`} className="pboard-card">
                        <div className="pboard-card-id">
                          <PropertyThumb photoUrl={f.photoUrl ?? null} size={34} />
                          <span className="pboard-card-txt">
                            <span className="pboard-card-addr">{line}</span>
                            {location && <span className="pboard-card-town">{location}</span>}
                          </span>
                        </div>
                        {(rt || fee > 0) && (
                          <div className="pboard-card-foot">
                            {rt && <span className={`pboard-pill pboard-pill--${rt.cls}`}><span className="d" />{rt.label}</span>}
                            {fee > 0 && (
                              <span className="pboard-card-fee">
                                {f.purchasePrice ? `${gbpCompact(f.purchasePrice)} · ` : ""}{gbpCompact(fee)}
                              </span>
                            )}
                          </div>
                        )}
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

// All Files → portfolio strip. One glass card split into four sections, icon
// on the left — the same layout as the Enquiries / Completions summary (see
// EnquiriesTriageList Tile + .enq-summary-*). Money-forward: how much is in
// the book and what it's worth, what's exchanging this month, and the two
// piles that need attention. The At risk / Gone quiet cells activate their
// segment; Exchanging links to the month filter.

import Link from "next/link";
import { HouseLine, CalendarBlank, Warning, ChatDots } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { fileFeePence, type PipelineRow } from "./PipelineBoard";
import { riskLevelForRow } from "./TransactionRowView";
import { gbpCompact } from "./money";
import type { FilterKey } from "./segments";

function sumFees(rows: PipelineRow[]): number {
  return rows.reduce((sum, r) => sum + fileFeePence(r), 0);
}

// A row's exchange date is the manual override if set, else the prediction.
function exchangeDateOf(r: PipelineRow): Date | null {
  const raw = (r as { overridePredictedDate?: Date | string | null }).overridePredictedDate ?? r.expectedExchangeDate;
  return raw ? new Date(raw) : null;
}

export function FilesStatStrip({
  active,
  goneQuietIds,
  monthKey,
  basePath,
  selected,
  onToggle,
}: {
  active: PipelineRow[];
  goneQuietIds: Set<string>;
  monthKey: string; // current calendar month, "YYYY-MM"
  basePath: string;
  selected: Set<FilterKey>;
  onToggle: (k: FilterKey) => void;
}) {
  const [y, m] = monthKey.split("-").map(Number);
  const exchangingThisMonth = active.filter((r) => {
    const d = exchangeDateOf(r);
    return d != null && d.getFullYear() === y && d.getMonth() === m - 1;
  });
  const atRisk = active.filter((r) => riskLevelForRow(r) === "high");
  const goneQuiet = active.filter((r) => goneQuietIds.has(r.id));

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long" });

  return (
    <GlassCard glassId="files-summary" label="All Files · summary" defaultVariant="v05" style={{ borderRadius: 14, overflow: "hidden" }}>
      <div className="fstats">
        <div className="fstat-cell">
          <span className="stat-circle stat-circle--coral" aria-hidden><HouseLine size={22} weight="regular" /></span>
          <span className="fstat-txt">
            <span className="fstat-val">{active.length.toLocaleString()}</span>
            <span className="fstat-label">In the book</span>
            <span className="fstat-sub">{gbpCompact(sumFees(active))} fees</span>
          </span>
        </div>

        <Link href={`${basePath}?exchanging=${monthKey}`} className="fstat-cell fstat-cell--link">
          <span className="stat-circle stat-circle--info" aria-hidden><CalendarBlank size={22} weight="regular" /></span>
          <span className="fstat-txt">
            <span className="fstat-val">{exchangingThisMonth.length.toLocaleString()}</span>
            <span className="fstat-label">Exchanging {monthLabel}</span>
            <span className="fstat-sub">{gbpCompact(sumFees(exchangingThisMonth))} fees</span>
          </span>
        </Link>

        <button
          type="button"
          className={`fstat-cell fstat-cell--btn${selected.has("risk") ? " on" : ""}`}
          onClick={() => onToggle("risk")}
        >
          <span className="stat-circle stat-circle--danger" aria-hidden><Warning size={22} weight="fill" /></span>
          <span className="fstat-txt">
            <span className="fstat-val">{atRisk.length.toLocaleString()}</span>
            <span className="fstat-label">At risk</span>
            <span className="fstat-sub">{gbpCompact(sumFees(atRisk))} fees</span>
          </span>
        </button>

        <button
          type="button"
          className={`fstat-cell fstat-cell--btn${selected.has("quiet") ? " on" : ""}`}
          onClick={() => onToggle("quiet")}
        >
          <span className="stat-circle stat-circle--warning" aria-hidden><ChatDots size={22} weight="regular" /></span>
          <span className="fstat-txt">
            <span className="fstat-val">{goneQuiet.length.toLocaleString()}</span>
            <span className="fstat-label">Gone quiet</span>
            <span className="fstat-sub">{gbpCompact(sumFees(goneQuiet))} fees</span>
          </span>
        </button>
      </div>
    </GlassCard>
  );
}

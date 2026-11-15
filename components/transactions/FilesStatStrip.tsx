"use client";

// All Files → portfolio summary. Four individual glass cards via the shared
// StatCards primitive (components/ui/StatCards.tsx). Money-forward: how much is
// in the book and what it's worth, what's exchanging this month, and the two
// piles that need attention. The At risk / Gone quiet cards toggle their
// segment filter; Exchanging links to the month filter.

import { HouseLine, CalendarBlank, Warning, ChatDots } from "@phosphor-icons/react";
import { StatCards, type StatCardSpec } from "@/components/ui/StatCards";
import { fileFeePence, type PipelineRow } from "./PipelineBoard";
import { riskLevelForRow } from "./TransactionRowView";
import { gbpFull } from "./money";
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

  const cards: StatCardSpec[] = [
    {
      key: "active",
      icon: <HouseLine size={22} weight="regular" />,
      tone: "coral",
      value: active.length.toLocaleString(),
      label: "Active sales",
      sub: `${gbpFull(sumFees(active))} fees`,
    },
    {
      key: "exchanging",
      icon: <CalendarBlank size={22} weight="regular" />,
      tone: "info",
      value: exchangingThisMonth.length.toLocaleString(),
      label: `Exchanging ${monthLabel}`,
      sub: `${gbpFull(sumFees(exchangingThisMonth))} fees`,
      href: `${basePath}?exchanging=${monthKey}`,
      caret: true,
      ariaLabel: `Exchanging ${monthLabel} — filter to this month`,
    },
    {
      key: "risk",
      icon: <Warning size={22} weight="fill" />,
      tone: "danger",
      value: atRisk.length.toLocaleString(),
      label: "At risk",
      sub: `${gbpFull(sumFees(atRisk))} fees`,
      onClick: () => onToggle("risk"),
      active: selected.has("risk"),
      ariaLabel: "Toggle at-risk filter",
    },
    {
      key: "quiet",
      icon: <ChatDots size={22} weight="regular" />,
      tone: "warning",
      value: goneQuiet.length.toLocaleString(),
      label: "Gone quiet",
      sub: `${gbpFull(sumFees(goneQuiet))} fees`,
      onClick: () => onToggle("quiet"),
      active: selected.has("quiet"),
      ariaLabel: "Toggle gone-quiet filter",
    },
  ];

  return <StatCards cards={cards} ariaLabel="All Files summary" />;
}

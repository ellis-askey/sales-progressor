"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle } from "@phosphor-icons/react";
import { SectionDisclosure } from "@/components/ui/SectionDisclosure";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }
function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

export type CompletedFileRow = {
  id: string;
  propertyAddress: string;
  completionDateIso: string | null;
  exchangedAtIso?: string | null;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  purchasers: string[];
  agencyName?: string | null;
  assignedUserName?: string | null;
  photoUrl?: string | null;
};

const PREVIEW_COUNT = 3;

// Collapsed-by-default history of completed files. Shows the 3 most recent when
// opened, with "show all" for the rest — so a busy agency never gets an endless
// page.
export function CompletedSection({ files }: { files: CompletedFileRow[] }) {
  // Promoted (open by default): completions are the payoff, not a buried archive.
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const rowTag = useGlassTag("completions-completed-row", "Completions · completed row");
  if (files.length === 0) return null;

  const totalFee = files.reduce((s, f) => s + (f.agentFeeAmount ?? 0), 0);
  const shown = showAll ? files : files.slice(0, PREVIEW_COUNT);

  return (
    <SectionDisclosure
      label={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <CheckCircle size={15} weight="fill" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
          Completed
        </span>
      }
      count={files.length}
      right={
        totalFee > 0
          ? <span className="agent-acc-summary">{fmt(totalFee / 100)} fees</span>
          : <span className="agent-acc-summary" style={{ opacity: 0.55 }}>Fees TBC</span>
      }
      open={open}
      onToggle={() => setOpen((o) => !o)}
      glassId="completions-completed-bar"
      glassLabel="Completions · completed bar"
    >
      {shown.map((f) => (
        <Link
          key={f.id}
          href={`/agent/transactions/${f.id}`}
          className={`glass-card agent-hover-row block px-5 py-3.5 border border-white/20 ${rowTag.className}`}
          {...rowTag.props}
          style={{ textDecoration: "none" }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <PropertyThumb photoUrl={f.photoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <p className="text-[14px] font-semibold truncate" style={{ color: "var(--agent-text-primary)" }}>{f.propertyAddress}</p>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span className="text-xs font-semibold" style={{ color: "var(--agent-success)" }}>
                    Completed{f.completionDateIso ? ` ${fmtDate(f.completionDateIso)}` : ""}
                  </span>
                  {daysBetween(f.exchangedAtIso, f.completionDateIso) != null && (
                    <div style={{ fontSize: 10, color: "var(--agent-text-muted)", marginTop: 1 }}>
                      Exchange to keys in {daysBetween(f.exchangedAtIso, f.completionDateIso)} days
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                {f.purchasePrice != null && <span className="text-sm" style={{ color: "var(--agent-text-secondary)", fontWeight: 600 }}>{fmt(f.purchasePrice / 100)}</span>}
                {f.agentFeeAmount != null && <span className="text-sm" style={{ color: "var(--agent-coral, #c2410c)", fontWeight: 600 }}>Fee {fmt(f.agentFeeAmount / 100)}</span>}
              </div>
              {(f.purchasers.length > 0 || f.assignedUserName || f.agencyName) && (
                <p className="text-xs" style={{ color: "var(--agent-text-muted)", marginTop: 1 }}>
                  {[f.purchasers.join(", "), f.assignedUserName, f.agencyName].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
        </Link>
      ))}
      {files.length > PREVIEW_COUNT && (
        <button className="agent-link" style={{ fontSize: 12, fontWeight: 600, marginTop: -2 }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show fewer" : `Show all ${files.length}`}
        </button>
      )}
    </SectionDisclosure>
  );
}

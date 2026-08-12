"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretDown, CheckCircle } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { PropertyThumb } from "@/components/ui/PropertyThumb";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }
function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export type CompletedFileRow = {
  id: string;
  propertyAddress: string;
  completionDateIso: string | null;
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
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  if (files.length === 0) return null;

  const totalValue = files.reduce((s, f) => s + (f.purchasePrice ?? 0), 0);
  const shown = showAll ? files : files.slice(0, PREVIEW_COUNT);

  return (
    <GlassCard glassId="completions-completed" label="Completions · Completed history" defaultVariant="v05" style={{ overflow: "hidden", borderRadius: "var(--agent-radius-xl)" }}>
      <div
        className="agent-acc-hdr"
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((o) => !o); } }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <CheckCircle size={16} weight="fill" style={{ color: "var(--agent-success)", flexShrink: 0 }} />
          <span className="text-xs font-bold uppercase tracking-[0.07em]" style={{ color: "var(--agent-text-secondary)" }}>
            Completed ({files.length})
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {totalValue > 0 && <span className="agent-acc-summary">{fmt(totalValue / 100)}</span>}
          <CaretDown style={{ width: 14, height: 14, color: "var(--agent-text-muted)", transition: "transform 200ms", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
        </div>
      </div>

      <div className={`agent-acc${open ? " open" : ""}`}>
        <div className="agent-acc-in">
          <div className="agent-acc-body">
            <div className="space-y-2">
              {shown.map((f) => (
                <Link
                  key={f.id}
                  href={`/agent/transactions/${f.id}`}
                  className="glass-card agent-hover-row block px-5 py-3.5 border border-white/20"
                  style={{ textDecoration: "none" }}
                >
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <PropertyThumb photoUrl={f.photoUrl} size={44} />
                    <div className="min-w-0 flex-1">
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <p className="text-[15px] font-bold truncate" style={{ color: "var(--agent-text-primary)" }}>{f.propertyAddress}</p>
                        <span className="text-xs font-semibold" style={{ color: "var(--agent-success)", flexShrink: 0 }}>
                          Completed{f.completionDateIso ? ` ${fmtDate(f.completionDateIso)}` : ""}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 2 }}>
                        {f.purchasePrice != null && <span className="text-sm" style={{ color: "var(--agent-text-secondary)", fontWeight: 600 }}>{fmt(f.purchasePrice / 100)}</span>}
                        {f.agentFeeAmount != null && <span className="text-sm" style={{ color: "var(--agent-coral, #c2410c)", fontWeight: 700 }}>Fee {fmt(f.agentFeeAmount / 100)}</span>}
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
            </div>
            {files.length > PREVIEW_COUNT && (
              <button className="agent-link" style={{ fontSize: 12, fontWeight: 600, marginTop: 10 }} onClick={() => setShowAll((s) => !s)}>
                {showAll ? "Show fewer" : `Show all ${files.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

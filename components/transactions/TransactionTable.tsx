import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { calculateRiskScore, RISK_CONFIG } from "@/lib/services/risk";
import type { TransactionStatus } from "@prisma/client";

type HealthRaw = {
  pendingOverdueTasks: number;
  escalatedTasks: number;
  lastActivityAt: Date | null;
  nextChaseLabel: string | null;
  nextActionLabel: string | null;
  nextMilestoneLabel: string | null;
  daysStuckOnMilestone: number | null;
  onTrack?: "on_track" | "at_risk" | "off_track" | "unknown";
};

type TransactionRow = {
  id: string;
  propertyAddress: string;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  createdAt: Date;
  assignedUser: { id: string; name: string } | null;
  health?: HealthRaw;
  serviceType?: "self_managed" | "outsourced" | null;
  agentUser?: { id: string; name: string } | null;
};

function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

function ExchangeCountdown({ date }: { date: Date }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);

  if (days < 0) return (
    <div>
      <p className="text-xs font-semibold text-red-500">{Math.abs(days)}d overdue</p>
      <p className="text-xs text-slate-900/40">{formatDate(date)}</p>
    </div>
  );
  if (days === 0) return (
    <div>
      <p className="text-xs font-semibold text-amber-500">Today</p>
      <p className="text-xs text-slate-900/40">{formatDate(date)}</p>
    </div>
  );
  if (days <= 21) return (
    <div>
      <p className="text-xs font-semibold text-amber-600">{days} days</p>
      <p className="text-xs text-slate-900/40">{formatDate(date)}</p>
    </div>
  );
  return (
    <div>
      <p className="text-sm text-slate-900/70">{formatDate(date)}</p>
      <p className="text-xs text-slate-900/40">{days}d away</p>
    </div>
  );
}

function RiskBadge({ raw }: { raw: HealthRaw }) {
  const risk = calculateRiskScore({
    onTrack: raw.onTrack ?? "unknown",
    escalatedTaskCount: raw.escalatedTasks,
    overdueTaskCount: raw.pendingOverdueTasks,
    daysSinceLastActivity: raw.lastActivityAt
      ? Math.floor((Date.now() - new Date(raw.lastActivityAt).getTime()) / 86400000)
      : null,
    daysStuckOnMilestone: raw.daysStuckOnMilestone,
  });
  const cfg = RISK_CONFIG[risk.level];
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className={`text-xs font-medium ${cfg.color}`}>
        {risk.level === "high" ? "High" : risk.level === "medium" ? "Medium" : "Low"}
      </span>
    </div>
  );
}

export function TransactionTable({ transactions, basePath = "/transactions" }: { transactions: TransactionRow[]; basePath?: string }) {
  const sorted = [...transactions].sort((a, b) => {
    if (!a.health || !b.health) return 0;
    const riskOrder = { high: 0, medium: 1, low: 2 };
    const ra = calculateRiskScore({
      onTrack: a.health.onTrack ?? "unknown",
      escalatedTaskCount: a.health.escalatedTasks,
      overdueTaskCount: a.health.pendingOverdueTasks,
      daysSinceLastActivity: a.health.lastActivityAt
        ? Math.floor((Date.now() - new Date(a.health.lastActivityAt).getTime()) / 86400000)
        : null,
      daysStuckOnMilestone: a.health.daysStuckOnMilestone,
    }).level;
    const rb = calculateRiskScore({
      onTrack: b.health.onTrack ?? "unknown",
      escalatedTaskCount: b.health.escalatedTasks,
      overdueTaskCount: b.health.pendingOverdueTasks,
      daysSinceLastActivity: b.health.lastActivityAt
        ? Math.floor((Date.now() - new Date(b.health.lastActivityAt).getTime()) / 86400000)
        : null,
      daysStuckOnMilestone: b.health.daysStuckOnMilestone,
    }).level;
    return riskOrder[ra] - riskOrder[rb];
  });

  return (
    <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
      {/* Header */}
      <div className="grid border-b border-white/20 bg-white/10"
           style={{ gridTemplateColumns: "4px minmax(0,1fr) 160px 160px 110px 120px" }}>
        <div />
        {["Property", "Assigned To", "Exchange Target", "Status", "Risk"].map((col) => (
          <div key={col} className="px-4 py-3 text-xs font-semibold text-slate-900/40 uppercase tracking-wide">
            {col}
          </div>
        ))}
      </div>

      {sorted.map((tx, i) => {
        const { line, location } = splitAddress(tx.propertyAddress);
        const initials = tx.assignedUser?.name
          .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        const health = tx.health ?? null;

        return (
          <Link
            key={tx.id}
            href={`${basePath}/${tx.id}`}
            className={`grid items-center hover:bg-white/20 transition-colors group ${
              i !== sorted.length - 1 ? "border-b border-white/15" : ""
            }`}
            style={{ gridTemplateColumns: "4px minmax(0,1fr) 160px 160px 110px 120px" }}
          >
            {/* Risk stripe */}
            <div className={`self-stretch ${
              tx.health
                ? (() => {
                    const r = calculateRiskScore({
                      onTrack: tx.health.onTrack ?? "unknown",
                      escalatedTaskCount: tx.health.escalatedTasks,
                      overdueTaskCount: tx.health.pendingOverdueTasks,
                      daysSinceLastActivity: tx.health.lastActivityAt
                        ? Math.floor((Date.now() - new Date(tx.health.lastActivityAt).getTime()) / 86400000)
                        : null,
                      daysStuckOnMilestone: tx.health.daysStuckOnMilestone,
                    });
                    return r.level === "high" ? "bg-red-500" : r.level === "medium" ? "bg-amber-400" : "bg-emerald-500";
                  })()
                : "bg-emerald-500"
            }`} />

            {/* Property + next action */}
            <div className="px-4 py-3.5 min-w-0">
              <p className="text-sm font-semibold text-slate-900/90 truncate leading-snug group-hover:text-blue-600 transition-colors">
                {line}
              </p>
              {location && <p className="text-xs text-slate-900/40 mt-0.5 truncate">{location}</p>}
              {health?.nextActionLabel && (
                <p className="text-xs text-orange-600 mt-1 truncate font-semibold">
                  → {health.nextActionLabel}
                </p>
              )}
              {tx.serviceType && (
                <span className={`inline-flex mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                  tx.serviceType === "outsourced"
                    ? "bg-indigo-50/70 text-indigo-500 border-indigo-100"
                    : "bg-slate-100/60 text-slate-400 border-slate-200/40"
                }`}>
                  {tx.serviceType === "outsourced" ? "Outsourced" : "Self-managed"}
                </span>
              )}
            </div>

            {/* Assigned to */}
            <div className="px-4 py-3.5">
              {tx.assignedUser ? (
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-white">{initials}</span>
                  </div>
                  <span className="text-sm text-slate-900/70 truncate">{tx.assignedUser.name}</span>
                </div>
              ) : (
                <span className="text-sm text-slate-900/30 italic">Unassigned</span>
              )}
            </div>

            {/* Exchange target */}
            <div className="px-4 py-3.5">
              {tx.expectedExchangeDate ? (
                <ExchangeCountdown date={tx.expectedExchangeDate} />
              ) : (
                <span className="text-sm text-slate-900/30">—</span>
              )}
            </div>

            {/* Status */}
            <div className="px-4 py-3.5">
              <StatusBadge status={tx.status} />
            </div>

            {/* Risk */}
            <div className="px-4 py-3.5">
              {tx.health ? <RiskBadge raw={tx.health} /> : <span className="text-slate-900/30 text-xs">—</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

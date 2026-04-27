"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { calculateRiskScore } from "@/lib/services/risk";
import { ExchangeTargetCell } from "@/components/transactions/ExchangeTargetCell";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import type { TransactionStatus, UserRole } from "@prisma/client";

type SortKey = "exchange" | "property" | "status" | "risk" | "lastActive";
type SortDir = "asc" | "desc";

export type HealthRaw = {
  pendingOverdueTasks: number;
  escalatedTasks: number;
  lastActivityAt: Date | null;
  nextChaseLabel?: string | null;
  nextActionLabel: string | null;
  nextMilestoneLabel: string | null;
  daysStuckOnMilestone: number | null;
  onTrack?: "on_track" | "at_risk" | "off_track" | "unknown";
};

export type TransactionRow = {
  id: string;
  propertyAddress: string;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  createdAt: Date;
  assignedUser: { id: string; name: string } | null;
  health?: HealthRaw;
  serviceType?: "self_managed" | "outsourced" | null;
  agentUser?: { id: string; name: string; role?: UserRole } | null;
  contacts?: { id: string; name: string; roleType: string }[];
};

function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

function firstNameLastInitial(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  director: "Director",
  negotiator: "Negotiator",
  sales_progressor: "Progressor",
  admin: "Admin",
};

type LastActiveResult = {
  primary: string;
  secondary: string | null;
  tone: "normal" | "amber" | "red" | "muted";
  stale: boolean;
};

function fmtLastActive(date: Date | null, createdAt: Date): LastActiveResult {
  if (!date) {
    const daysSinceCreation = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
    const secondary = daysSinceCreation > 0
      ? new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
      : null;
    return { primary: "Just added", secondary, tone: "muted", stale: false };
  }
  const d = new Date(date);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  const exactDate = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  if (days === 0) {
    const timeStr = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return { primary: `Today, ${timeStr}`, secondary: null, tone: "normal", stale: false };
  }
  if (days === 1) return { primary: "Yesterday", secondary: null, tone: "normal", stale: false };
  if (days < 7)  return { primary: `${days} days ago`, secondary: exactDate, tone: "normal", stale: false };
  if (days < 14) return { primary: `${days} days ago`, secondary: exactDate, tone: "amber",  stale: false };
  if (days < 30) return { primary: `${days} days ago`, secondary: exactDate, tone: "red",    stale: false };
  return           { primary: `${days} days ago`, secondary: exactDate, tone: "red",    stale: true  };
}

function VendorBuyerLine({ contacts }: { contacts?: { name: string; roleType: string }[] }) {
  const vendor = contacts?.find((c) => c.roleType === "vendor");
  const buyer  = contacts?.find((c) => c.roleType === "purchaser");
  if (!vendor && !buyer) {
    return <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(180,87,9,0.40)" }}>Names not set</p>;
  }
  return (
    <p className="text-xs text-slate-900/40 mt-0.5 truncate">
      {"Vendor: "}
      {vendor ? firstNameLastInitial(vendor.name) : <span className="text-slate-900/25">not set</span>}
      {" · Buyer: "}
      {buyer ? firstNameLastInitial(buyer.name) : <span className="text-slate-900/25">not set</span>}
    </p>
  );
}

const STATUS_ORDER: TransactionStatus[] = ["active", "on_hold", "completed", "withdrawn", "draft"];

function riskScore(tx: TransactionRow): number {
  if (!tx.health) return 0;
  return calculateRiskScore({
    onTrack: tx.health.onTrack ?? "unknown",
    escalatedTaskCount: tx.health.escalatedTasks,
    overdueTaskCount: tx.health.pendingOverdueTasks,
    daysSinceLastActivity: tx.health.lastActivityAt
      ? Math.floor((Date.now() - new Date(tx.health.lastActivityAt).getTime()) / 86400000)
      : null,
    daysStuckOnMilestone: tx.health.daysStuckOnMilestone,
  }).score;
}

function applySortDir(n: number, dir: SortDir) { return dir === "asc" ? n : -n; }

function sortTransactions(rows: TransactionRow[], key: SortKey, dir: SortDir): TransactionRow[] {
  return [...rows].sort((a, b) => {
    switch (key) {
      case "exchange": {
        const da = a.expectedExchangeDate ? new Date(a.expectedExchangeDate).getTime() : null;
        const db = b.expectedExchangeDate ? new Date(b.expectedExchangeDate).getTime() : null;
        if (da === null && db === null) return a.propertyAddress.localeCompare(b.propertyAddress);
        if (da === null) return 1;
        if (db === null) return -1;
        return applySortDir(da - db, dir);
      }
      case "property":
        return applySortDir(a.propertyAddress.localeCompare(b.propertyAddress), dir);
      case "status": {
        const ia = STATUS_ORDER.indexOf(a.status);
        const ib = STATUS_ORDER.indexOf(b.status);
        return applySortDir(ia - ib, dir);
      }
      case "risk":
        return applySortDir(riskScore(b) - riskScore(a), dir); // desc = highest risk first
      case "lastActive": {
        const la = a.health?.lastActivityAt ? new Date(a.health.lastActivityAt).getTime() : 0;
        const lb = b.health?.lastActivityAt ? new Date(b.health.lastActivityAt).getTime() : 0;
        return applySortDir(la - lb, dir); // asc = oldest activity first = stalest at top
      }
      default: return 0;
    }
  });
}

function SortChevron({ col, active, dir }: { col: SortKey; active: SortKey; dir: SortDir }) {
  const isActive = col === active;
  const up = isActive && dir === "asc";
  return (
    <span className={`inline-flex flex-col ml-1 -space-y-0.5 opacity-0 group-hover/hdr:opacity-100 transition-opacity ${isActive ? "opacity-100" : ""}`}>
      <svg width="7" height="5" viewBox="0 0 7 5" className={up || !isActive ? (isActive && up ? "text-slate-900/70" : "text-slate-900/25") : "text-slate-900/25"} fill="currentColor">
        <path d="M3.5 0L7 5H0z" />
      </svg>
      <svg width="7" height="5" viewBox="0 0 7 5" className={!up || !isActive ? (!isActive ? "text-slate-900/25" : "text-slate-900/70") : "text-slate-900/25"} fill="currentColor">
        <path d="M3.5 5L0 0h7z" />
      </svg>
    </span>
  );
}

export function TransactionTable({
  transactions,
  basePath = "/transactions",
  showOwner = false,
}: {
  transactions: TransactionRow[];
  basePath?: string;
  showOwner?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("exchange");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = sortTransactions(transactions, sortKey, sortDir);

  // Column order: stripe | property | assigned to | exchange target | status | risk | last active | [owner]
  const gridCols = showOwner
    ? "4px minmax(0,1fr) 160px 160px 110px 120px 100px 130px"
    : "4px minmax(0,1fr) 160px 160px 110px 120px 100px";
  const headers = showOwner
    ? ["Property", "Assigned To", "Exchange Target", "Status", "Risk", "Last active", "Owner"]
    : ["Property", "Assigned To", "Exchange Target", "Status", "Risk", "Last active"];

  return (
    <div className="glass-card" style={{ clipPath: "inset(0 round 20px)" }}>
      {/* Header — desktop only */}
      <div className="hidden md:grid border-b border-white/20 bg-white/10" style={{ gridTemplateColumns: gridCols }}>
        <div />
        {(
          [
            { label: "Property",        key: "property"   as SortKey | null },
            { label: "Assigned To",     key: null },
            { label: "Exchange Target", key: "exchange"   as SortKey | null },
            { label: "Status",          key: "status"     as SortKey | null },
            { label: "Risk",            key: "risk"       as SortKey | null },
            { label: "Last active",     key: "lastActive" as SortKey | null },
            ...(showOwner ? [{ label: "Owner", key: null }] : []),
          ] as { label: string; key: SortKey | null }[]
        ).map(({ label, key }) =>
          key ? (
            <button
              key={label}
              onClick={() => handleSort(key)}
              className="px-4 py-3 text-xs font-semibold text-slate-900/40 uppercase tracking-wide text-left flex items-center group/hdr hover:text-slate-900/60 transition-colors"
            >
              {label}
              <SortChevron col={key} active={sortKey} dir={sortDir} />
            </button>
          ) : (
            <div key={label} className="px-4 py-3 text-xs font-semibold text-slate-900/40 uppercase tracking-wide">
              {label}
            </div>
          )
        )}
      </div>

      {sorted.map((tx, i) => {
        const { line, location } = splitAddress(tx.propertyAddress);
        const initials = tx.assignedUser?.name
          .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
        const health = tx.health ?? null;
        const lastActive = fmtLastActive(health?.lastActivityAt ?? null, tx.createdAt);

        const riskStripe = tx.health
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
          : "bg-emerald-500";

        const serviceTag = tx.serviceType ? (
          <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            tx.serviceType === "outsourced"
              ? "bg-indigo-50/70 text-indigo-500 border-indigo-100"
              : "bg-slate-100/60 text-slate-400 border-slate-200/40"
          }`}>
            {tx.serviceType === "outsourced" ? "With progressor" : "Self-progressed"}
          </span>
        ) : null;

        const divider = i !== sorted.length - 1 ? "border-b border-white/15" : "";

        const assignedText = tx.assignedUser?.name
          ?? (tx.serviceType === "outsourced" ? "Awaiting assignment"
            : tx.agentUser?.name ?? "Unassigned");
        const assignedMuted = !tx.assignedUser && tx.serviceType === "outsourced";

        return (
          <div key={tx.id}>

            {/* ── Mobile card (hidden md+) ─────────────────────────────── */}
            <Link
              href={`${basePath}/${tx.id}`}
              className={`flex md:hidden hover:bg-white/20 active:bg-white/30 transition-colors ${divider}`}
            >
              <div className={`w-1 self-stretch flex-shrink-0 ${riskStripe}`} />
              <div className="flex-1 px-4 py-4 min-w-0 space-y-2">
                {/* Address + tag */}
                <div>
                  <div className="flex items-start gap-2 min-w-0">
                    <p className="text-sm font-semibold text-slate-900/90 leading-snug flex-1 min-w-0">
                      {line}
                    </p>
                    {serviceTag}
                  </div>
                  {location && <p className="text-xs text-slate-900/40 mt-0.5">{location}</p>}
                  <VendorBuyerLine contacts={tx.contacts} />
                </div>

                {/* Status + Risk + Last active */}
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={tx.status} />
                  {tx.health && <RiskBadgeWithPopover raw={tx.health} />}
                  <span className={`text-xs font-medium ${
                    lastActive.tone === "red"   ? "text-red-500" :
                    lastActive.tone === "amber" ? "text-amber-600" :
                    lastActive.tone === "muted" ? "text-slate-900/30" :
                    "text-slate-900/55"
                  }`}>
                    Last: {lastActive.primary}
                    {lastActive.stale && (
                      <span className="ml-1 text-[9px] font-semibold px-1 py-0.5 rounded bg-red-50 text-red-500 border border-red-100">
                        Stale
                      </span>
                    )}
                  </span>
                </div>

                {/* Exchange target */}
                <div>
                  <ExchangeTargetCell
                    transactionId={tx.id}
                    expectedExchangeDate={tx.expectedExchangeDate}
                    createdAt={tx.createdAt}
                  />
                </div>

                {/* Assigned */}
                <p className={`text-xs ${assignedMuted ? "font-medium" : "text-slate-900/55"}`}
                   style={assignedMuted ? { color: "rgba(180,87,9,0.65)" } : undefined}>
                  Assigned: {assignedText}
                </p>

                {/* Owner — director only */}
                {showOwner && tx.agentUser && (
                  <p className="text-xs text-slate-900/55">
                    Owner: {tx.agentUser.name}
                    {tx.agentUser.role && ` · ${ROLE_LABEL[tx.agentUser.role] ?? tx.agentUser.role}`}
                  </p>
                )}
              </div>
            </Link>

            {/* ── Desktop row (hidden below md) ───────────────────────── */}
            <Link
              href={`${basePath}/${tx.id}`}
              className={`hidden md:grid items-center hover:bg-white/20 active:bg-white/30 transition-colors group ${divider}`}
              style={{ gridTemplateColumns: gridCols }}
            >
              {/* Risk stripe */}
              <div className={`self-stretch ${riskStripe}`} />

              {/* Property + vendor/buyer names */}
              <div className="px-4 py-3.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-semibold text-slate-900/90 truncate leading-snug group-hover:text-blue-600 transition-colors flex-1 min-w-0">
                    {line}
                  </p>
                  {serviceTag}
                </div>
                {location && <p className="text-xs text-slate-900/40 mt-0.5 truncate">{location}</p>}
                <VendorBuyerLine contacts={tx.contacts} />
                {health?.nextActionLabel && (
                  <p className="text-xs text-orange-600 mt-1 truncate font-semibold">
                    → {health.nextActionLabel}
                  </p>
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
                ) : tx.serviceType === "outsourced" ? (
                  <span className="text-xs font-medium" style={{ color: "rgba(180,87,9,0.65)" }}>Awaiting assignment</span>
                ) : tx.agentUser ? (
                  <span className="text-sm text-slate-900/50 truncate">{tx.agentUser.name}</span>
                ) : (
                  <span className="text-sm text-slate-900/30 italic">Unassigned</span>
                )}
              </div>

              {/* Exchange target */}
              <div className="px-4 py-3.5">
                <ExchangeTargetCell
                  transactionId={tx.id}
                  expectedExchangeDate={tx.expectedExchangeDate}
                  createdAt={tx.createdAt}
                />
              </div>

              {/* Status */}
              <div className="px-4 py-3.5">
                <StatusBadge status={tx.status} />
              </div>

              {/* Risk */}
              <div className="px-4 py-3.5">
                {tx.health ? <RiskBadgeWithPopover raw={tx.health} /> : <span className="text-slate-900/30 text-xs">—</span>}
              </div>

              {/* Last active */}
              <div className="px-4 py-3.5">
                <p className={`text-xs font-medium leading-snug ${
                  lastActive.tone === "red"    ? "text-red-500" :
                  lastActive.tone === "amber"  ? "text-amber-600" :
                  lastActive.tone === "muted"  ? "text-slate-900/30" :
                  "text-slate-900/65"
                }`}>
                  {lastActive.primary}
                </p>
                {lastActive.secondary && (
                  <p className="text-[10px] text-slate-900/30 mt-0.5">{lastActive.secondary}</p>
                )}
                {lastActive.stale && (
                  <span className="inline-block mt-0.5 text-[9px] font-semibold px-1 py-0.5 rounded bg-red-50 text-red-500 border border-red-100 leading-none">
                    Stale
                  </span>
                )}
              </div>

              {/* Owner (director-only) */}
              {showOwner && (
                <div className="px-4 py-3.5">
                  {tx.agentUser ? (
                    <>
                      <span className="text-sm text-slate-900/70 truncate block">{tx.agentUser.name}</span>
                      {tx.agentUser.role && (
                        <span className="text-[10px] text-slate-900/35 mt-0.5 block">
                          {ROLE_LABEL[tx.agentUser.role] ?? tx.agentUser.role}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-slate-900/25">—</span>
                  )}
                </div>
              )}
            </Link>

          </div>
        );
      })}
    </div>
  );
}

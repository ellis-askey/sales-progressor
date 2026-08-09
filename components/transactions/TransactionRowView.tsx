"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { calculateRiskScore } from "@/lib/services/risk";
import { ExchangeTargetCell } from "@/components/transactions/ExchangeTargetCell";
import { RiskBadgeWithPopover } from "@/components/transactions/RiskBadgeWithPopover";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { RoleIcon } from "@/components/ui/RoleIcon";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import type { TransactionStatus, UserRole } from "@prisma/client";

export type HealthRaw = {
  pendingOverdueTasks: number;
  escalatedTasks: number;
  lastActivityAt: Date | null;
  // Variant B IA (2026-05-13): derived from latest milestone / outbound message
  // server-side. lastActivityLabel is the human-readable verb; lastActivityType
  // tags the source ("milestone" / "chase" / "note" / "inbound" / "email" /
  // "sms" / "whatsapp" / "comm"). null fields fall back to a generic "Active"
  // chip client-side.
  lastActivityType?: string | null;
  lastActivityLabel?: string | null;
  nextChaseLabel?: string | null;
  nextActionLabel: string | null;
  nextMilestoneLabel: string | null;
  daysStuckOnMilestone: number | null;
  onTrack?: "on_track" | "at_risk" | "off_track" | "unknown" | "on_hold";
};

export type TransactionRow = {
  id: string;
  propertyAddress: string;
  // Signed property-photo URL (or null). Signed upstream in the page via
  // getSignedUrlMap. Shown as a thumbnail to the left of the address.
  photoUrl?: string | null;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  createdAt: Date;
  assignedUser: { id: string; name: string } | null;
  health?: HealthRaw;
  serviceType?: "self_managed" | "outsourced" | null;
  agentUser?: { id: string; name: string; role?: UserRole } | null;
  contacts?: { id: string; name: string; roleType: string }[];
  // Agency name shown for internal staff (admin / sales_progressor). Optional —
  // only present when listTransactions is called with a scope param.
  agency?: { id: string; name: string } | null;
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

/* Activity state — drives the verb-chip colour. Moving / Stalled / Stale
 * thresholds match the Variant B preview and the Activity filter chip.
 * Used by both the row chip and the filter logic in TransactionListWithSearch. */
export type ActivityState = "moving" | "stalled" | "stale";

export function activityStateFor(date: Date | null | undefined): ActivityState | null {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days < 7)  return "moving";
  if (days < 14) return "stalled";
  return "stale";
}

function relTime(date: Date): string {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)  return `${days}d ago`;
  if (days < 14) return "1w ago";
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const ACTIVITY_TONE: Record<ActivityState, { bg: string; fg: string; dot: string }> = {
  moving:  { bg: "rgba(var(--agent-success-rgb), 0.10)", fg: "var(--agent-success)",  dot: "var(--agent-success)"  },
  stalled: { bg: "rgba(var(--agent-warning-rgb), 0.12)", fg: "var(--agent-warning)",  dot: "var(--agent-warning)"  },
  stale:   { bg: "rgba(var(--agent-danger-rgb),  0.10)", fg: "var(--agent-danger)",   dot: "var(--agent-danger)"   },
};

/* ActivityVerbChip — Variant B headline cell. Verb + relative time + colour
 * tied to activityStateFor(). Hover/focus shows a 3-entry log preview via
 * portal'd .agent-dropdown-in / .agent-dropdown-out. Falls back to generic
 * "Active Nd ago" when no derived verb (no signal). */
function ActivityVerbChip({ tx, mobile = false }: { tx: TransactionRow; mobile?: boolean }) {
  const lastAt = tx.health?.lastActivityAt ?? null;
  const verb = tx.health?.lastActivityLabel ?? null;
  const state = activityStateFor(lastAt);
  const { theme } = usePortalTheme();

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  if (!lastAt) {
    return (
      <span style={{
        fontSize: 11, color: "var(--agent-text-muted)",
        display: "inline-flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(0,0,0,0.18)" }} />
        Just added
      </span>
    );
  }

  const tone = state ? ACTIVITY_TONE[state] : ACTIVITY_TONE.moving;
  const labelText = verb ? `${verb} · ${relTime(lastAt)}` : `Active ${relTime(lastAt)}`;

  function show() {
    if (ref.current) {
      const r0 = ref.current.getBoundingClientRect();
      setPos({ top: r0.bottom + 4, left: r0.left });
    }
    setClosing(false);
    setOpen(true);
  }
  function hide() {
    setOpen((wasOpen) => { if (wasOpen) setClosing(true); return false; });
  }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        tabIndex={0}
        style={{
          background: tone.bg, color: tone.fg,
          fontSize: mobile ? 12 : 11, fontWeight: 600,
          padding: mobile ? "3px 10px" : "3px 9px",
          borderRadius: 99,
          display: "inline-flex", alignItems: "center", gap: 6,
          cursor: "default", whiteSpace: "nowrap",
          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone.dot, flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{labelText}</span>
      </span>
      {(open || closing) && pos && typeof document !== "undefined" && createPortal(
        <div
          data-theme={theme}
          className={closing ? "agent-dropdown-out" : "agent-dropdown-in"}
          onAnimationEnd={() => { if (closing) setClosing(false); }}
          style={{
            position: "fixed", top: pos.top, left: pos.left, zIndex: 9999,
            background: "rgba(255,255,255,0.97)", borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)", border: "1px solid rgba(0,0,0,0.07)",
            padding: "10px 14px", minWidth: 240, maxWidth: 320,
            pointerEvents: "none",
          }}
        >
          <p style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--agent-text-muted)" }}>
            Recent activity
          </p>
          <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
            <li style={{ fontSize: 12, color: "var(--agent-text-primary)" }}>
              {verb ?? "Active"}
              <span style={{ color: "var(--agent-text-muted)" }}> · {relTime(lastAt)}</span>
            </li>
            {tx.health?.nextActionLabel && (
              <li style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>
                Next: {tx.health.nextActionLabel}
              </li>
            )}
            {tx.health?.daysStuckOnMilestone !== null && tx.health?.daysStuckOnMilestone !== undefined && (
              <li style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
                {tx.health.daysStuckOnMilestone}d since last milestone
              </li>
            )}
          </ul>
        </div>,
        document.body
      )}
    </>
  );
}

function VendorBuyerLine({ contacts }: { contacts?: { name: string; roleType: string }[] }) {
  const vendor = contacts?.find((c) => c.roleType === "vendor");
  const buyer  = contacts?.find((c) => c.roleType === "purchaser");
  if (!vendor && !buyer) {
    return <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(var(--agent-warning-rgb), 0.40)" }}>Names not set</p>;
  }
  return (
    <p className="text-xs text-slate-900/40 mt-0.5 truncate" style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <RoleIcon role="vendor" size={11} />
      <span>Vendor: {vendor ? firstNameLastInitial(vendor.name) : <span className="text-slate-900/25">not set</span>}</span>
      <span style={{ color: "var(--agent-text-muted)" }}>·</span>
      <RoleIcon role="purchaser" size={11} />
      <span>Buyer: {buyer ? firstNameLastInitial(buyer.name) : <span className="text-slate-900/25">not set</span>}</span>
    </p>
  );
}

export function TransactionRowView({
  tx,
  basePath = "/agent/transactions",
  isLast = false,
  showAgencyColumn = false,
  showAssignedToColumn = true,
}: {
  tx: TransactionRow;
  basePath?: string;
  isLast?: boolean;
  showAgencyColumn?: boolean;
  showAssignedToColumn?: boolean;
}) {
  // Column order: [stripe] Property | Last activity | Exchange target | Status | [Assigned-to] | [Agency] | Risk
  // showAssignedToColumn=false for negotiator/sales_progressor (they only see their own files).
  // showAgencyColumn=true for internal staff only.
  const gridCols = (() => {
    if (showAgencyColumn  && showAssignedToColumn)  return "4px minmax(0,1fr) 220px 160px 110px 160px 140px 120px";
    if (showAgencyColumn  && !showAssignedToColumn) return "4px minmax(0,1fr) 220px 160px 110px 140px 120px";
    if (!showAgencyColumn && showAssignedToColumn)  return "4px minmax(0,1fr) 220px 160px 110px 160px 120px";
    return                                                  "4px minmax(0,1fr) 220px 160px 110px 120px";
  })();

  const { line, location } = splitAddress(tx.propertyAddress);
  const initials = tx.assignedUser?.name
    .split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const health = tx.health ?? null;

  const riskStripeColor = tx.health
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
        return r.level === "high" ? "var(--agent-danger)" : r.level === "medium" ? "var(--agent-warning)" : "var(--agent-success)";
      })()
    : "var(--agent-success)";

  // SP: showAgencyColumn=true, showAssignedToColumn=false → hide tag (all rows are outsourced, tag is noise)
  // Admin: showAgencyColumn=true, showAssignedToColumn=true → neutral platform labels
  // Agent: showAgencyColumn=false → original agent-centric labels
  const serviceTag = (() => {
    if (!tx.serviceType) return null;
    if (showAgencyColumn && !showAssignedToColumn) return null;
    const label = (showAgencyColumn && showAssignedToColumn)
      ? (tx.serviceType === "outsourced" ? "Outsourced" : "Self-managed")
      : (tx.serviceType === "outsourced" ? "Our team" : "You");
    return (
      <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
        tx.serviceType === "outsourced"
          ? "bg-indigo-50/70 text-indigo-500 border-indigo-100"
          : "bg-slate-100/60 text-slate-400 border-slate-200/40"
      }`}>
        {label}
      </span>
    );
  })();

  const divider = !isLast ? "0.5px solid var(--agent-border-subtle)" : undefined;

  const assignedText = tx.assignedUser?.name
    ?? (tx.serviceType === "outsourced" ? "Awaiting assignment"
      : tx.agentUser?.name ?? "Unassigned");
  const assignedMuted = !tx.assignedUser && tx.serviceType === "outsourced";

  return (
    <div>
      {/* ── Mobile card (hidden md+) ─────────────────────────────── */}
      <Link
        href={`${basePath}/${tx.id}`}
        className="flex md:hidden agent-hover-row"
        style={{ textDecoration: "none", borderBottom: divider }}
      >
        <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: riskStripeColor }} />
        <div className="flex-1 px-4 py-4 min-w-0 space-y-2">
          <div className="flex items-center gap-3">
            <PropertyThumb photoUrl={tx.photoUrl} size={44} />
            <div className="min-w-0 flex-1">
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35 }}>{line}</p>
              {location && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{location}</p>}
              {showAgencyColumn && tx.agency?.name && (
                <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 500, color: "var(--agent-text-muted)" }}>{tx.agency.name}</p>
              )}
              <VendorBuyerLine contacts={tx.contacts} />
            </div>
          </div>

          {/* Verb chip — top of the badges row on mobile (Variant B mobile design) */}
          <div className="flex items-center gap-2 flex-wrap">
            <ActivityVerbChip tx={tx} mobile />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={tx.status} />
            {tx.health && <RiskBadgeWithPopover raw={tx.health} />}
          </div>

          <div>
            <ExchangeTargetCell
              transactionId={tx.id}
              expectedExchangeDate={tx.expectedExchangeDate}
              createdAt={tx.createdAt}
            />
          </div>
          <div>
            <p style={{
              margin: 0, fontSize: 11,
              fontWeight: assignedMuted ? 500 : 400,
              color: assignedMuted ? "var(--agent-warning)" : "var(--agent-text-secondary)",
            }}>
              Assigned: {assignedText}
            </p>
            {serviceTag && <div className="mt-1">{serviceTag}</div>}
          </div>
        </div>
      </Link>

      {/* ── Desktop row (hidden below md) ─────────────────────────
       * Column order: [stripe] Property | Last activity | Exchange target |
       *   Status | Assigned-to | Risk
       * Row link = entire row navigates. Activity chip's popover is
       * pointer-events:none so it does not intercept the row link.
       */}
      <Link
        href={`${basePath}/${tx.id}`}
        className="hidden md:grid items-center agent-hover-row group"
        style={{ gridTemplateColumns: gridCols, textDecoration: "none", borderBottom: divider }}
      >
        <div style={{ alignSelf: "stretch", background: riskStripeColor }} />

        {/* Property */}
        <div className="px-4 py-3.5 min-w-0 flex items-center gap-3">
          <PropertyThumb photoUrl={tx.photoUrl} size={44} />
          <div className="min-w-0 flex-1">
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} className="agent-group-link transition-colors">
              {line}
            </p>
            {location && <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{location}</p>}
            <VendorBuyerLine contacts={tx.contacts} />
            {health?.nextActionLabel && (
              <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--agent-coral-deep)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                → {health.nextActionLabel}
              </p>
            )}
          </div>
        </div>

        {/* Last activity — verb chip */}
        <div className="px-4 py-3.5">
          <ActivityVerbChip tx={tx} />
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

        {/* Assigned-to — hidden for roles that only see their own files (negotiator, sales_progressor) */}
        {showAssignedToColumn && (
          <div className="px-4 py-3.5">
            {tx.assignedUser ? (
              <div className="flex items-center gap-2">
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--agent-coral-deep)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "white" }}>{initials}</span>
                </div>
                <span style={{ fontSize: 13, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.assignedUser.name}</span>
              </div>
            ) : tx.serviceType === "outsourced" ? (
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--agent-warning)" }}>Awaiting assignment</span>
            ) : tx.agentUser ? (
              <span style={{ fontSize: 13, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.agentUser.name}</span>
            ) : (
              <span style={{ fontSize: 13, fontStyle: "italic", color: "var(--agent-text-muted)" }}>Unassigned</span>
            )}
            {serviceTag && <div className="mt-1">{serviceTag}</div>}
          </div>
        )}

        {/* Agency — additive column for internal staff; not rendered for agents */}
        {showAgencyColumn && (
          <div className="px-4 py-3.5">
            <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
              {tx.agency?.name ?? "—"}
            </span>
          </div>
        )}

        {/* Risk */}
        <div className="px-4 py-3.5">
          {tx.health ? <RiskBadgeWithPopover raw={tx.health} /> : <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>—</span>}
        </div>
      </Link>
    </div>
  );
}

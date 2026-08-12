"use client";

import { PropertyThumb } from "@/components/ui/PropertyThumb";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

function fmtDate(d: string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function timeSinceExchange(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Exchanged today";
  if (days === 1) return "Exchanged yesterday";
  return `Exchanged ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${days} days ago`;
}

function computeDays(iso: string | null): { label: string; color: string } {
  if (!iso) return { label: "", color: "var(--agent-text-muted)" };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  const rel = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  let label = "";
  let color = "var(--agent-text-muted)";
  if (rel < 0)        { label = `${Math.abs(rel)} days overdue`; color = "var(--agent-danger)"; }
  else if (rel === 0) { label = "today";    color = "var(--agent-warning)"; }
  else if (rel === 1) { label = "tomorrow"; color = "var(--agent-warning)"; }
  else if (rel <= 7)  { label = `in ${rel} days`; color = "var(--agent-warning)"; }
  else                { label = `in ${rel} days`; }
  return { label, color };
}

export const GROUP_STYLES = {
  overdue:   { dotColor: "var(--agent-danger)",  label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dotColor: "var(--agent-warning)", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dotColor: "var(--agent-info)",    label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dotColor: "#94a3b8",              label: "text-slate-900/60", border: "border-white/20"      },
  no_date:   { dotColor: "#cbd5e1",              label: "text-slate-900/40", border: "border-white/15"      },
} as const;

export type CompletionFileRow = {
  id: string;
  propertyAddress: string;
  purchasePrice: number | null;
  agentFeeAmount: number | null;
  purchasers: string[];
  assignedUserName: string | null;
  exchangedAtIso: string | null;
  completionDateIso: string | null;
  vendorSolicitorName: string | null;
  purchaserSolicitorName: string | null;
  agencyName?: string | null;
  photoUrl?: string | null;
};

// Action buttons live inside the row's <Link>, so every click must stop the
// link from firing. This wrapper does that once.
function ActionButton({ onClick, primary, children }: { onClick: () => void; primary?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
      className={primary ? "agent-btn-color-primary" : "agent-link"}
      style={primary
        ? { fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "none", cursor: "pointer" }
        : { fontSize: 12, fontWeight: 600 }}
    >
      {children}
    </button>
  );
}

export function CompletionFileRowView({
  file,
  groupKey,
  onSetDate,
  onComplete,
}: {
  file: CompletionFileRow;
  groupKey: keyof typeof GROUP_STYLES;
  onSetDate?: () => void;
  onComplete?: () => void;
}) {
  const s = GROUP_STYLES[groupKey];
  const hasNeitherSol = !file.vendorSolicitorName && !file.purchaserSolicitorName;
  const exchangeLine = timeSinceExchange(file.exchangedAtIso);
  const { label: daysLabel, color: daysColor } = computeDays(file.completionDateIso);

  // Right-hand date + countdown block.
  const DateBlock = () => (
    <div className="text-right" style={{ flexShrink: 0 }}>
      <p className={`text-sm font-bold mb-0.5 ${file.completionDateIso ? s.label : "text-slate-900/40"}`}>
        {fmtDate(file.completionDateIso)}
      </p>
      {daysLabel && <p className="text-xs font-semibold" style={{ color: daysColor }}>{daysLabel}</p>}
    </div>
  );

  const solLine = hasNeitherSol
    ? <span style={{ color: "var(--agent-warning)" }}>No solicitors on file</span>
    : <>{file.vendorSolicitorName ?? "not set"}{"  ↔  "}{file.purchaserSolicitorName ?? "not set"}</>;

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <PropertyThumb photoUrl={file.photoUrl} size={48} />

      <div className="min-w-0 flex-1">
        {/* Line 1: address + date/countdown */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <p className="text-[15px] font-bold mb-0.5 truncate" style={{ color: "var(--agent-text-primary)" }}>{file.propertyAddress}</p>
          <DateBlock />
        </div>

        {/* Line 2: the money — sale muted, fee emphasised */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10, marginBottom: 2 }}>
          {file.purchasePrice != null && <span className="text-sm" style={{ color: "var(--agent-text-secondary)", fontWeight: 600 }}>{fmt(file.purchasePrice / 100)}</span>}
          {file.agentFeeAmount != null && (
            <span className="text-sm" style={{ color: "var(--agent-coral, #c2410c)", fontWeight: 700 }}>Fee {fmt(file.agentFeeAmount / 100)}</span>
          )}
        </div>

        {/* Line 3 (quiet): buyers · exchange · solicitors · agency */}
        <p className="text-xs" style={{ color: "var(--agent-text-muted)" }}>
          {file.purchasers.length > 0 && <>{file.purchasers.join(", ")}</>}
          {file.purchasers.length > 0 && exchangeLine && " · "}
          {exchangeLine}
          {file.assignedUserName && <> · {file.assignedUserName}</>}
          {file.agencyName && <> · {file.agencyName}</>}
        </p>
        <p className="text-xs truncate" style={{ color: "var(--agent-text-muted)", marginTop: 1 }}>{solLine}</p>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
          {onComplete && <ActionButton onClick={onComplete} primary>Mark completed</ActionButton>}
          {onSetDate && <ActionButton onClick={onSetDate}>{file.completionDateIso ? "Change date" : "Set date"}</ActionButton>}
        </div>
      </div>
    </div>
  );
}

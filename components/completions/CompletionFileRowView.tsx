"use client";

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
  else if (rel === 1) { label = "tomorrow"; }
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

const SET_DATE_STYLE = {
  fontSize: 12,
  color: "var(--agent-text-muted)",
  border: "1px solid var(--agent-border-subtle)",
  borderRadius: 6,
  padding: "3px 8px",
  whiteSpace: "nowrap" as const,
  display: "inline-block",
};

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
};

export function CompletionFileRowView({
  file,
  groupKey,
  onSetDate,
}: {
  file: CompletionFileRow;
  groupKey: keyof typeof GROUP_STYLES;
  onSetDate?: () => void;
}) {
  const s = GROUP_STYLES[groupKey];
  const isNoDate = groupKey === "no_date";
  const hasNeitherSol = !file.vendorSolicitorName && !file.purchaserSolicitorName;
  const exchangeLine = timeSinceExchange(file.exchangedAtIso);
  const { label: daysLabel, color: daysColor } = computeDays(file.completionDateIso);

  const DateBlock = () =>
    isNoDate ? (
      <button
        style={{ ...SET_DATE_STYLE, cursor: "pointer", background: "none" }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onSetDate?.(); }}
      >
        Set date
      </button>
    ) : (
      <div className="text-right">
        <p className={`text-sm font-bold mb-0.5 ${s.label}`}>{fmtDate(file.completionDateIso)}</p>
        {daysLabel && <p className="text-xs" style={{ color: daysColor }}>{daysLabel}</p>}
      </div>
    );

  return (
    <>
      {/* Desktop layout */}
      <div className="hidden md:flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-slate-900/90 mb-1 truncate">{file.propertyAddress}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1">
            {file.purchasePrice && <span className="text-sm text-slate-900/50">{fmt(file.purchasePrice / 100)}</span>}
            {/* OLD: color: "rgba(15,23,42,0.7)" */}
            {file.agentFeeAmount && <span className="text-sm font-medium" style={{ color: "var(--agent-text-primary)" }}>Fee: {fmt(file.agentFeeAmount / 100)}</span>}
            {file.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {file.purchasers.join(", ")}</span>}
            {/* OLD: "Progressor: {file.assignedUserName}" */}
            {file.assignedUserName && <span className="text-sm text-slate-900/50">Handled by: {file.assignedUserName}</span>}
            {file.agencyName && <span className="text-sm text-slate-900/50">Agency: {file.agencyName}</span>}
          </div>
          {/* OLD: <p className="text-xs text-slate-900/40 mb-0.5">{timeSinceExchange(file.exchangedAtIso)}</p> — always rendered */}
          {exchangeLine && <p className="text-xs text-slate-900/40 mb-0.5">{exchangeLine}</p>}
          {hasNeitherSol ? (
            /* OLD: color: "#b45309", text: "No solicitors set" */
            <p className="text-xs" style={{ color: "var(--agent-warning)" }}>No solicitors on file</p>
          ) : (
            <p className="text-xs text-slate-900/40 truncate">
              Vendor sol: {file.vendorSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}
              {" · "}
              Purchaser sol: {file.purchaserSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}
            </p>
          )}
        </div>
        <div className="flex-shrink-0 self-start">
          <DateBlock />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex md:hidden flex-col gap-1">
        <p className="text-[15px] font-bold text-slate-900/90 leading-snug">{file.propertyAddress}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {file.purchasePrice && <span className="text-sm text-slate-900/50">{fmt(file.purchasePrice / 100)}</span>}
          {/* OLD: color: "rgba(15,23,42,0.7)" */}
          {file.agentFeeAmount && <span className="text-sm font-medium" style={{ color: "var(--agent-text-primary)" }}>Fee: {fmt(file.agentFeeAmount / 100)}</span>}
          {file.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {file.purchasers.join(", ")}</span>}
          {/* OLD: "Progressor: {file.assignedUserName}" */}
          {file.assignedUserName && <span className="text-sm text-slate-900/50">Handled by: {file.assignedUserName}</span>}
          {file.agencyName && <span className="text-sm text-slate-900/50">Agency: {file.agencyName}</span>}
        </div>
        {/* OLD: <p className="text-xs text-slate-900/40">{timeSinceExchange(file.exchangedAtIso)}</p> — always rendered */}
        {exchangeLine && <p className="text-xs text-slate-900/40">{exchangeLine}</p>}
        {hasNeitherSol ? (
          /* OLD: color: "#b45309", text: "No solicitors set" */
          <p className="text-xs" style={{ color: "var(--agent-warning)" }}>No solicitors on file</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-slate-900/40">Vendor sol: {file.vendorSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}</p>
            <p className="text-xs text-slate-900/40">Purchaser sol: {file.purchaserSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}</p>
          </div>
        )}
        <div className="flex justify-end mt-1">
          <DateBlock />
        </div>
      </div>
    </>
  );
}

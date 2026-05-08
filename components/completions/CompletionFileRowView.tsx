"use client";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }

function fmtDate(d: string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function timeSinceExchange(iso: string | null): string {
  if (!iso) return "Exchange date not recorded";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Exchanged today";
  if (days === 1) return "Exchanged yesterday";
  return `Exchanged ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${days} days ago`;
}

export const GROUP_STYLES = {
  overdue:   { dot: "bg-red-500",   label: "text-red-600",      border: "border-red-200/40"   },
  this_week: { dot: "bg-amber-500", label: "text-amber-600",    border: "border-amber-200/40" },
  next_week: { dot: "bg-blue-500",  label: "text-blue-600",     border: "border-blue-200/40"  },
  later:     { dot: "bg-slate-400", label: "text-slate-900/60", border: "border-white/20"      },
  no_date:   { dot: "bg-slate-300", label: "text-slate-900/40", border: "border-white/15"      },
} as const;

const SET_DATE_STYLE = {
  fontSize: 12, color: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(15,23,42,0.15)", borderRadius: 6,
  padding: "3px 8px", whiteSpace: "nowrap" as const, display: "inline-block",
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
  daysRel: number | null;
  daysLabel: string;
  daysColor: string;
};

export function CompletionFileRowView({
  file,
  groupKey,
}: {
  file: CompletionFileRow;
  groupKey: keyof typeof GROUP_STYLES;
}) {
  const s = GROUP_STYLES[groupKey];
  const isNoDate = groupKey === "no_date";
  const hasNeitherSol = !file.vendorSolicitorName && !file.purchaserSolicitorName;

  const DateBlock = () =>
    isNoDate ? (
      <span style={SET_DATE_STYLE}>Set date →</span>
    ) : (
      <div className="text-right">
        <p className={`text-sm font-bold mb-0.5 ${s.label}`}>{fmtDate(file.completionDateIso)}</p>
        {file.daysLabel && <p className="text-xs" style={{ color: file.daysColor }}>{file.daysLabel}</p>}
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
            {file.agentFeeAmount && <span className="text-sm font-medium" style={{ color: "rgba(15,23,42,0.7)" }}>Fee: {fmt(file.agentFeeAmount / 100)}</span>}
            {file.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {file.purchasers.join(", ")}</span>}
            {file.assignedUserName && <span className="text-sm text-slate-900/50">Progressor: {file.assignedUserName}</span>}
          </div>
          <p className="text-xs text-slate-900/40 mb-0.5">{timeSinceExchange(file.exchangedAtIso)}</p>
          {hasNeitherSol ? (
            <p className="text-xs" style={{ color: "#b45309" }}>No solicitors set</p>
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
          {file.agentFeeAmount && <span className="text-sm font-medium" style={{ color: "rgba(15,23,42,0.7)" }}>Fee: {fmt(file.agentFeeAmount / 100)}</span>}
          {file.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {file.purchasers.join(", ")}</span>}
          {file.assignedUserName && <span className="text-sm text-slate-900/50">Progressor: {file.assignedUserName}</span>}
        </div>
        <p className="text-xs text-slate-900/40">{timeSinceExchange(file.exchangedAtIso)}</p>
        {hasNeitherSol ? (
          <p className="text-xs" style={{ color: "#b45309" }}>No solicitors set</p>
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

import Link from "next/link";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr";
import { requireSession } from "@/lib/session";
import { getAgentCompletions, resolveAgentVisibility } from "@/lib/services/agent";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }
function fmtCompact(pence: number) {
  const pounds = pence / 100;
  if (pounds >= 1_000_000) return "£" + (pounds / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  return "£" + pounds.toLocaleString("en-GB");
}
function fmtDate(d: Date | string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
function fmtShortDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
function timeSinceExchange(exchangedAt: Date | null): string {
  if (!exchangedAt) return "Exchange date not recorded";
  const d = new Date(exchangedAt);
  const days = Math.round((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "Exchanged today";
  if (days === 1) return "Exchanged yesterday";
  return `Exchanged ${fmtShortDate(d)} · ${days} days ago`;
}

const GROUP_STYLES = {
  overdue:   { dot: "bg-red-500",   label: "text-red-600",      badge: "bg-red-50/60 text-red-600",    border: "border-red-200/40",  statColor: "#dc2626" },
  this_week: { dot: "bg-amber-500", label: "text-amber-600",    badge: "bg-amber-50/60 text-amber-600", border: "border-amber-200/40", statColor: "#d97706" },
  next_week: { dot: "bg-blue-500",  label: "text-blue-600",     badge: "bg-blue-50/60 text-blue-600",   border: "border-blue-200/40",  statColor: "#3b82f6" },
  later:     { dot: "bg-slate-400", label: "text-slate-900/60", badge: "", border: "border-white/20",  statColor: "rgba(15,23,42,0.5)" },
  no_date:   { dot: "bg-slate-300", label: "text-slate-900/40", badge: "", border: "border-white/15", statColor: "rgba(15,23,42,0.4)" },
} as const;

const STAT_LABELS: Record<string, string> = {
  overdue:   "overdue",
  this_week: "this week",
  next_week: "next week",
  later:     "later",
  no_date:   "no date",
};

const groups = [
  { key: "overdue"   as const, label: "Overdue" },
  { key: "this_week" as const, label: "Completing this week" },
  { key: "next_week" as const, label: "Completing next week" },
  { key: "later"     as const, label: "Later" },
  { key: "no_date"   as const, label: "No completion date set" },
];

const SET_DATE_STYLE: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(15,23,42,0.45)",
  border: "1px solid rgba(15,23,42,0.15)",
  borderRadius: 6,
  padding: "3px 8px",
  whiteSpace: "nowrap",
  display: "inline-block",
};

export default async function AgentCompletionsPage() {
  const session = await requireSession();
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);
  const files = await getAgentCompletions(vis);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7  = new Date(today); in7.setDate(today.getDate() + 7);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);

  function urgencyFor(date: Date | null) {
    if (!date) return "no_date";
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (d < today) return "overdue";
    if (d < in7)   return "this_week";
    if (d < in14)  return "next_week";
    return "later";
  }

  const counts = { overdue: 0, this_week: 0, next_week: 0, later: 0, no_date: 0 };
  for (const f of files) counts[urgencyFor(f.completionDate)]++;

  const statSegments = (["overdue", "this_week", "next_week", "later", "no_date"] as const)
    .filter((k) => counts[k] > 0)
    .map((k) => ({ key: k, label: STAT_LABELS[k], count: counts[k], color: GROUP_STYLES[k].statColor, anchor: `#section-${k}` }));

  const totalValue = files.reduce((sum, f) => sum + (f.purchasePrice ?? 0), 0);
  const filesWithPrice = files.filter((f) => f.purchasePrice).length;

  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>Completions</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Files that have exchanged and are heading to completion.</p>

          {/* Stat row — wraps to 2 lines on narrow screens; each anchor is ≥44px tall for touch */}
          {statSegments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", rowGap: 0, marginTop: 10 }}>
              {statSegments.map((s, i) => (
                <span key={s.key} style={{ display: "flex", alignItems: "center" }}>
                  {i > 0 && <span style={{ color: "rgba(15,23,42,0.2)", margin: "0 8px" }}>·</span>}
                  <a href={s.anchor} style={{ fontSize: 12, color: s.color, fontWeight: 500, textDecoration: "none", minHeight: 44, display: "flex", alignItems: "center" }}>
                    {s.count} {s.label}
                  </a>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-8 py-5 md:py-7 space-y-7">

        {/* Empty state */}
        {files.length === 0 && (
          <div className="text-center py-16">
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <ClockCountdown size={40} weight="thin" style={{ color: "rgba(15,23,42,0.2)" }} />
            </div>
            <p className="text-base font-medium text-slate-900/50 mb-2">No files awaiting completion</p>
            <p className="text-sm text-slate-900/40 mb-1">Once a file exchanges, it'll appear here as it heads toward completion.</p>
            <p className="text-sm text-slate-900/30">We'll track target dates, days remaining, and surface anything that drifts past its date.</p>
          </div>
        )}

        {/* Pipeline total */}
        {files.length > 0 && (
          <p style={{ fontSize: 13, color: "rgba(15,23,42,0.45)", margin: 0, flexWrap: "wrap" }}>
            {files.length} file{files.length !== 1 ? "s" : ""}{filesWithPrice > 0 ? ` · ${fmtCompact(totalValue)} awaiting completion` : ""}
          </p>
        )}

        {/* ── Groups ───────────────────────────────────────────────────────── */}
        {groups.map(({ key, label }) => {
          const group = files.filter((f) => urgencyFor(f.completionDate) === key);
          if (group.length === 0) return null;
          const s = GROUP_STYLES[key];

          const groupValue = group.reduce((sum, f) => sum + (f.purchasePrice ?? 0), 0);
          const missingPriceCount = group.filter((f) => !f.purchasePrice).length;

          return (
            <div key={key} id={`section-${key}`}>
              {/* Group header — wraps on narrow screens */}
              <div className="flex items-center gap-2.5 mb-3 flex-wrap">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                <p className={`text-xs font-bold uppercase tracking-[0.07em] ${s.label} flex-1`}>
                  {label} ({group.length})
                </p>
                {groupValue > 0 && (
                  <p className="text-xs text-slate-900/40 font-medium tabular-nums">{fmt(groupValue / 100)}</p>
                )}
              </div>
              {missingPriceCount > 0 && groupValue > 0 && (
                <p className="text-xs text-slate-900/30 mb-2 -mt-1">({missingPriceCount} file{missingPriceCount !== 1 ? "s" : ""} with no price)</p>
              )}

              <div className="space-y-2">
                {group.map((f) => {
                  const daysRel = f.completionDate
                    ? Math.round((new Date(f.completionDate).setHours(0, 0, 0, 0) - today.getTime()) / 86400000)
                    : null;

                  let daysLabel = "";
                  let daysColor = "rgba(15,23,42,0.4)";
                  if (daysRel !== null) {
                    if (daysRel < 0)       { daysLabel = `${Math.abs(daysRel)} days overdue`; daysColor = "#dc2626"; }
                    else if (daysRel === 0) { daysLabel = "today";    daysColor = "#d97706"; }
                    else if (daysRel === 1) { daysLabel = "tomorrow"; }
                    else                   { daysLabel = `in ${daysRel} days`; }
                  }

                  const hasNeitherSol = !f.vendorSolicitorName && !f.purchaserSolicitorName;
                  const isNoDate = key === "no_date";

                  // Date/days block — reused in both desktop-right and mobile-bottom positions
                  const DateBlock = () => isNoDate ? (
                    <span style={SET_DATE_STYLE}>Set date →</span>
                  ) : (
                    <div className="text-right">
                      <p className={`text-sm font-bold mb-0.5 ${s.label}`}>{fmtDate(f.completionDate)}</p>
                      {daysLabel && <p className="text-xs" style={{ color: daysColor }}>{daysLabel}</p>}
                    </div>
                  );

                  return (
                    <Link
                      key={f.id}
                      href={`/agent/transactions/${f.id}`}
                      className={`glass-card block px-5 py-4 border ${s.border} hover:shadow-md transition-shadow`}
                      style={{ textDecoration: "none" }}
                    >
                      {/* ── Desktop layout: left info + right date ────────────── */}
                      <div className="hidden md:flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-bold text-slate-900/90 mb-1 truncate">{f.propertyAddress}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mb-1">
                            {f.purchasePrice && <span className="text-sm text-slate-900/50">{fmt(f.purchasePrice / 100)}</span>}
                            {f.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {f.purchasers.join(", ")}</span>}
                            {f.assignedUserName && <span className="text-sm text-slate-900/50">Progressor: {f.assignedUserName}</span>}
                          </div>
                          <p className="text-xs text-slate-900/40 mb-0.5">{timeSinceExchange(f.exchangedAt)}</p>
                          {hasNeitherSol ? (
                            <p className="text-xs" style={{ color: "#b45309" }}>No solicitors set</p>
                          ) : (
                            <p className="text-xs text-slate-900/40 truncate">
                              Vendor sol: {f.vendorSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}
                              {" · "}
                              Purchaser sol: {f.purchaserSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 self-start">
                          <DateBlock />
                        </div>
                      </div>

                      {/* ── Mobile layout: full-width stack ──────────────────── */}
                      <div className="flex md:hidden flex-col gap-1">
                        <p className="text-[15px] font-bold text-slate-900/90 leading-snug">{f.propertyAddress}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          {f.purchasePrice && <span className="text-sm text-slate-900/50">{fmt(f.purchasePrice / 100)}</span>}
                          {f.purchasers.length > 0 && <span className="text-sm text-slate-900/50">Purchaser: {f.purchasers.join(", ")}</span>}
                          {f.assignedUserName && <span className="text-sm text-slate-900/50">Progressor: {f.assignedUserName}</span>}
                        </div>
                        <p className="text-xs text-slate-900/40">{timeSinceExchange(f.exchangedAt)}</p>
                        {hasNeitherSol ? (
                          <p className="text-xs" style={{ color: "#b45309" }}>No solicitors set</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-slate-900/40">Vendor sol: {f.vendorSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}</p>
                            <p className="text-xs text-slate-900/40">Purchaser sol: {f.purchaserSolicitorName ?? <span style={{ fontStyle: "italic" }}>not set</span>}</p>
                          </div>
                        )}
                        {/* Date/days at bottom-right on mobile */}
                        <div className="flex justify-end mt-1">
                          <DateBlock />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

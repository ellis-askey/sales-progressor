import { requireSession } from "@/lib/session";
import { getAgentCompletions } from "@/lib/services/agent";

function fmt(n: number) { return "£" + n.toLocaleString("en-GB"); }
function fmtDate(d: Date | string | null) {
  if (!d) return "No date set";
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

const GROUP_STYLES = {
  overdue:   { dot: "bg-red-500",    label: "text-red-600",   badge: "bg-red-50/60 text-red-600",   border: "border-red-200/40" },
  this_week: { dot: "bg-amber-500",  label: "text-amber-600", badge: "bg-amber-50/60 text-amber-600", border: "border-amber-200/40" },
  next_week: { dot: "bg-blue-500",   label: "text-blue-600",  badge: "bg-blue-50/60 text-blue-600",  border: "border-blue-200/40" },
  later:     { dot: "bg-slate-400",  label: "text-slate-900/60", badge: "", border: "border-white/20" },
  no_date:   { dot: "bg-slate-300",  label: "text-slate-900/40", badge: "", border: "border-white/15" },
} as const;

export default async function AgentCompletionsPage() {
  const session = await requireSession();
  const files = await getAgentCompletions(session.user.id);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const in7 = new Date(today); in7.setDate(today.getDate() + 7);
  const in14 = new Date(today); in14.setDate(today.getDate() + 14);

  function urgencyFor(date: Date | null) {
    if (!date) return "no_date";
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    if (d < today) return "overdue";
    if (d < in7) return "this_week";
    if (d < in14) return "next_week";
    return "later";
  }

  const groups = [
    { key: "overdue"   as const, label: "Overdue" },
    { key: "this_week" as const, label: "Completing this week" },
    { key: "next_week" as const, label: "Completing next week" },
    { key: "later"     as const, label: "Later" },
    { key: "no_date"   as const, label: "No completion date set" },
  ];

  return (
    <>
      <div className="glass-panel-dark relative overflow-hidden">
        <div className="relative px-8 pt-6 pb-7">
          <p className="glass-section-label text-label-secondary-on-dark mb-4">Agent Portal</p>
          <h1 className="text-2xl font-bold text-white leading-tight tracking-tight">Completions</h1>
          <p className="text-sm text-slate-400 mt-1">Your files that have exchanged and are working towards completion.</p>
        </div>
      </div>

      <div className="px-8 py-7 space-y-7">

      {files.length === 0 && (
        <div className="text-center py-16">
          <p className="text-base text-slate-900/50 mb-1">No files awaiting completion</p>
          <p className="text-sm text-slate-900/40">Exchanged files will appear here.</p>
        </div>
      )}

      {groups.map(({ key, label }) => {
        const group = files.filter((f) => urgencyFor(f.completionDate) === key);
        if (group.length === 0) return null;
        const s = GROUP_STYLES[key];
        return (
          <div key={key}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
              <p className={`text-xs font-bold uppercase tracking-[0.07em] ${s.label}`}>
                {label} ({group.length})
              </p>
            </div>
            <div className="space-y-2">
              {group.map((f) => (
                <div key={f.id} className={`glass-card px-5 py-4 border ${s.border}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-slate-900/90 mb-1 truncate">{f.propertyAddress}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                        {f.purchasePrice && (
                          <span className="text-sm text-slate-900/50">{fmt(f.purchasePrice / 100)}</span>
                        )}
                        {f.purchasers.length > 0 && (
                          <span className="text-sm text-slate-900/50">Purchaser: {f.purchasers.join(", ")}</span>
                        )}
                        {f.assignedUserName && (
                          <span className="text-sm text-slate-900/50">Progressor: {f.assignedUserName}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-bold mb-0.5 ${s.label}`}>{fmtDate(f.completionDate)}</p>
                      {f.completionDate && (
                        <p className="text-xs text-slate-900/40">
                          {Math.round((new Date(f.completionDate).getTime() - Date.now()) / 86400000)} days
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      </div>
    </>
  );
}

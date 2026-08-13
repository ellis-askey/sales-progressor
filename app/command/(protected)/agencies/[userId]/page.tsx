import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgentDetail } from "@/lib/command/usage";

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}
function fmtHoursShort(seconds: number): string {
  const h = seconds / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  const m = Math.round(seconds / 60);
  return m > 0 ? `${m}m` : "0";
}
function fmtRelative(d: Date | null): string {
  if (!d) return "never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days >= 2) return `${days} days ago`;
  if (days === 1) return "yesterday";
  const hrs = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (hrs >= 1) return `${hrs}h ago`;
  return "just now";
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}
const AV_COLORS = ["#8b9dff", "#34d399", "#e0a44a", "#f0716f", "#c084fc", "#38bdf8"];
function avColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AV_COLORS[h % AV_COLORS.length];
}

export default async function AgentDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const a = await getAgentDetail(userId);
  if (!a) notFound();

  const maxWeek = Math.max(1, ...a.weeksSeconds);
  const maxFile = Math.max(1, ...a.files.map((f) => f.seconds));

  return (
    <div className="space-y-6">
      <Link href="/command/agencies" className="text-xs text-neutral-500 hover:text-neutral-300 inline-flex items-center gap-1">
        ← Agencies &amp; agents
      </Link>

      {/* header */}
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-neutral-950" style={{ background: avColor(a.name) }}>
          {initials(a.name)}
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-neutral-100 leading-tight">{a.name}</h1>
          <p className="text-sm text-neutral-400 capitalize">{a.role} · {a.agencyName}</p>
        </div>
      </div>

      {/* summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { k: "Total time on files", v: fmtHoursShort(a.totalSeconds), d: "all time, engaged" },
          { k: "Sessions", v: String(a.sessionCount), d: "file opens" },
          { k: "Logins · 7d", v: String(a.logins7d), d: "last 7 days" },
          { k: "Last active", v: fmtRelative(a.lastActive), d: "any action" },
        ].map((t) => (
          <div key={t.k} className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3">
            <div className="text-[10.5px] font-mono uppercase tracking-wider text-neutral-500">{t.k}</div>
            <div className="text-xl font-semibold tracking-tight mt-1 tabular-nums text-neutral-100">{t.v}</div>
            <div className="text-[11.5px] text-neutral-500 mt-0.5">{t.d}</div>
          </div>
        ))}
      </div>

      {/* weekly trend */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Time on the platform, last 12 weeks</h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-5">
          <div className="flex items-end gap-1.5 h-24">
            {a.weeksSeconds.map((s, i) => {
              const zero = s === 0;
              const h = zero ? 3 : Math.max(6, Math.round((s / maxWeek) * 96));
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5" title={fmtDuration(s)}>
                  <div className="w-full rounded-sm" style={{ height: `${h}px`, background: zero ? "#242428" : "#3b82f6", opacity: zero ? 1 : 0.85 }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-neutral-600 mt-2">
            <span>12 weeks ago</span><span>this week</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* files worked */}
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Files they&rsquo;ve spent time on</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            {a.files.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500 text-center">No time recorded on any file yet.</p>
            ) : (
              a.files.map((f) => (
                <Link
                  key={f.transactionId}
                  href={`/command/files?tx=${f.transactionId}`}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800 last:border-b-0 hover:bg-neutral-950/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-neutral-200 truncate">{f.address}</div>
                    <div className="text-[11px] text-neutral-600">{f.sessions} session{f.sessions !== 1 ? "s" : ""} · last {fmtRelative(f.lastActivity)}</div>
                  </div>
                  <span className="flex-1 max-w-[90px] h-[5px] rounded bg-neutral-800 overflow-hidden hidden sm:block">
                    <i className="block h-full rounded bg-blue-500/80" style={{ width: `${(f.seconds / maxFile) * 100}%` }} />
                  </span>
                  <span className="text-xs tabular-nums text-neutral-100 font-semibold w-14 text-right">{fmtDuration(f.seconds)}</span>
                </Link>
              ))
            )}
          </div>
        </section>

        {/* recent activity */}
        <section>
          <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">Recent activity</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            {a.recent.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500 text-center">Nothing logged yet.</p>
            ) : (
              a.recent.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800 last:border-b-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-neutral-200">{e.label}</div>
                    {e.address && <div className="text-[11px] text-neutral-600 truncate">{e.address}</div>}
                  </div>
                  <span className="text-[11px] text-neutral-500 whitespace-nowrap">{fmtRelative(e.at)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

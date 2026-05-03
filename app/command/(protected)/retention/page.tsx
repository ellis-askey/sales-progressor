import { commandDb } from "@/lib/command/prisma";
import { parseMode, parseAgencies, modeProfileScope } from "@/lib/command/scope";
import Link from "next/link";

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; agency?: string }>;
}) {
  const sp = await searchParams;
  const mode = parseMode(sp.mode);
  const agencyIds = parseAgencies(sp.agency);
  const userScope = modeProfileScope(mode, agencyIds);

  const now = new Date();
  const since30 = new Date(now);
  since30.setUTCDate(since30.getUTCDate() - 30);
  const since60 = new Date(now);
  since60.setUTCDate(since60.getUTCDate() - 60);

  const [current30, previous30] = await Promise.all([
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since30, lte: now }, ...userScope },
      _sum: { uniqueActiveUsers: true, logins: true, signups: true },
      _avg: { uniqueActiveUsers: true },
    }),
    commandDb.dailyMetric.aggregate({
      where: { date: { gte: since60, lt: since30 }, ...userScope },
      _sum: { uniqueActiveUsers: true, logins: true, signups: true },
    }),
  ]);

  function pctChange(curr: number | null, prev: number | null): string {
    if (!prev || prev === 0 || curr === null) return "—";
    const v = Math.round(((curr - prev) / prev) * 100);
    return v >= 0 ? `+${v}%` : `${v}%`;
  }
  function pctColor(curr: number | null, prev: number | null): string {
    if (!prev || prev === 0 || curr === null) return "text-neutral-600";
    return curr >= prev ? "text-emerald-400" : "text-red-400";
  }

  const c = current30._sum;
  const p = previous30._sum;

  const cards = [
    { label: "Unique active users", curr: c.uniqueActiveUsers ?? 0, prev: p.uniqueActiveUsers ?? 0 },
    { label: "Logins",              curr: c.logins ?? 0,            prev: p.logins ?? 0 },
    { label: "Signups",             curr: c.signups ?? 0,           prev: p.signups ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-neutral-100">Retention</h1>

      {/* 30-day engagement summary */}
      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Engagement — last 30 days vs prior 30 days
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card) => (
            <div key={card.label} className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4">
              <p className="text-xs text-neutral-400 mb-1">{card.label}</p>
              <p className="text-2xl font-bold text-white tabular-nums">{card.curr.toLocaleString()}</p>
              <p className={`text-xs tabular-nums mt-0.5 ${pctColor(card.curr, card.prev)}`}>
                {pctChange(card.curr, card.prev)} vs prev 30d
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pointer to cohort data */}
      <section>
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-5 py-4 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-neutral-300">Signup cohort retention</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Weekly cohort data (Wk 1 / 2 / 4 / 8 / 12 retention) lives in the Growth tab.
            </p>
          </div>
          <Link
            href="/command/growth"
            className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors shrink-0"
          >
            Go to Growth →
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-3">
          Coming in PR 48
        </h2>
        <div className="bg-neutral-900 border border-dashed border-neutral-700 rounded-xl px-5 py-6 text-center">
          <p className="text-xs text-neutral-500">
            Power user fingerprints · drop-off analysis · time-between-sessions · feature usage heatmap
          </p>
        </div>
      </section>
    </div>
  );
}

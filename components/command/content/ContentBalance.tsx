import { InsightCard } from "@/components/command/ui/primitives";
import type { ContentBalance as Balance } from "@/lib/command/content/balance";

// Content balance display (docs/active/content-brand/SPEC.md, Phase 2.2). The
// recent mix across pillars, with a repetition warning and the pillars you've
// been quiet on. Presentational and server-safe.

export function ContentBalance({ balance }: { balance: Balance }) {
  if (!balance.enoughData) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-8 text-center">
        <p className="text-sm text-neutral-300 font-medium">Not enough published posts yet</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
          Once a few posts are out, we&rsquo;ll show the recent mix across your pillars here and flag when it&rsquo;s
          getting repetitive. {balance.consideredCount > 0 ? `${balance.consideredCount} so far.` : ""}
        </p>
      </div>
    );
  }

  const max = Math.max(1, ...balance.window.map((s) => s.count));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <p className="mb-3 text-[11px] text-neutral-600">Across your last {balance.consideredCount} published posts</p>
        <div className="space-y-1.5">
          {balance.window.map((s) => (
            <div key={s.pillarId} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-[12px] text-neutral-400">{s.label}</div>
              <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-950 border border-neutral-800">
                {s.count > 0 && (
                  <div
                    className="h-full bg-blue-600/40 border-r border-blue-500/50"
                    style={{ width: `${Math.round((s.count / max) * 100)}%`, minWidth: 2 }}
                  />
                )}
              </div>
              <div className="w-8 shrink-0 text-right text-[13px] font-semibold tabular-nums text-neutral-200">
                {s.count || <span className="text-neutral-700">0</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {balance.warning && <InsightCard tone="watch">{balance.warning}</InsightCard>}

      {balance.underused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-neutral-600">Quiet lately</span>
          {balance.underused.map((label) => (
            <span key={label} className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-400">
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

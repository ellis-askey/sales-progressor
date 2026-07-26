import Link from "next/link";
import type { HubPipelineStages } from "@/lib/services/hub";
import styles from "./pipeline-at-a-glance.module.css";

type Stage = {
  id: string;
  label: string;
  count: number;
  filterHref: string | null;
  meta?: string;
};

export function PipelineAtAGlance({ stages }: { stages: HubPipelineStages }) {
  const rows: Stage[] = [
    { id: "new", label: "New", count: stages.new.count, filterHref: "/agent/transactions?stage=new", meta: stages.new.newThisWeek ? `${stages.new.newThisWeek} new this week` : undefined },
    { id: "legals", label: "Legals", count: stages.legals.count, filterHref: "/agent/transactions?stage=legals", meta: stages.legals.medianDaysInLegals ? `${stages.legals.medianDaysInLegals}d median` : undefined },
    { id: "ready", label: "Ready", count: stages.ready.count, filterHref: "/agent/transactions?stage=ready", meta: stages.ready.overdueToExchange ? `${stages.ready.overdueToExchange} overdue` : undefined },
    { id: "exchanging", label: "Exchanged", count: stages.exchanging.count, filterHref: "/agent/transactions?stage=exchanging", meta: stages.exchanging.completingThisWeek ? `${stages.exchanging.completingThisWeek} this week` : undefined },
    { id: "completed", label: "Completed", count: stages.completed.count, filterHref: "/agent/transactions?stage=completed", meta: stages.completed.medianDaysToComplete ? `${stages.completed.medianDaysToComplete}d avg` : undefined },
  ];

  const totalActive = stages.new.count + stages.legals.count + stages.ready.count + stages.exchanging.count;
  const total = totalActive || 1;

  return (
    <section className={styles.section}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.label}>Pipeline at a glance</div>
          <div className={styles.sub}>Where every active file sits right now</div>
        </div>
        <div className={styles.grid}>
          {rows.map((s, i) => {
            const shareOfPipeline = s.id === "completed" ? 0 : (s.count / total);
            return (
              <Link
                key={s.id}
                href={s.filterHref ?? "/agent/transactions"}
                className={styles.stage}
                data-stage={s.id}
                data-empty={s.count === 0 ? "true" : "false"}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={styles.stageDot} data-stage={s.id} />
                <div className={styles.stageCount}>{s.count}</div>
                <div className={styles.stageLabel}>{s.label}</div>
                {s.count > 0 && (
                  <div className={styles.stageBar}>
                    <div
                      className={styles.stageBarFill}
                      data-stage={s.id}
                      style={{ width: s.id === "completed" ? "100%" : `${Math.max(6, shareOfPipeline * 100)}%` }}
                    />
                  </div>
                )}
                {s.meta && <div className={styles.stageMeta}>{s.meta}</div>}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

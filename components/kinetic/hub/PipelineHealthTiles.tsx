import styles from "./pipeline-health-tiles.module.css";

type PipelineHealthProps = {
  activeFiles: number;
  newThisMonth: number;
  exchangingSoon: number;
  exchangingThisWeek: number;
  next30Days: number;
  needAttention: number;
  escalated: number;
  overdue: number;
  pipelineValuePence: number;
  closingThisMonthPence: number;
};

function fmtCurrency(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000_000) return `£${(p / 1_000_000_000).toFixed(2)}bn`;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  if (p >= 1_000) return `£${(p / 1_000).toFixed(0)}k`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}

export function PipelineHealthTiles(p: PipelineHealthProps) {
  return (
    <section className={styles.grid}>
      {/* Active files */}
      <div className={styles.tile} data-tint="cyan">
        <div className={styles.label}>Active files</div>
        <div className={styles.value}>{p.activeFiles.toLocaleString()}</div>
        <div className={styles.contextLine}>
          {p.newThisMonth > 0 ? `${p.newThisMonth} new this month` : "No new files this month"}
        </div>
      </div>

      {/* Exchanging soon */}
      <div className={styles.tile} data-tint="magenta">
        <div className={styles.label}>Exchanging soon</div>
        <div className={styles.value}>{p.exchangingSoon.toLocaleString()}</div>
        <div className={styles.contextLine}>
          {p.exchangingThisWeek > 0
            ? `${p.exchangingThisWeek} this week · ${p.next30Days} in 30 days`
            : `${p.next30Days} in the next 30 days`}
        </div>
      </div>

      {/* Need attention */}
      <div className={styles.tile} data-tint={p.needAttention > 0 ? "warning" : "quiet"}>
        <div className={styles.label}>Need attention</div>
        <div className={styles.value}>{p.needAttention.toLocaleString()}</div>
        <div className={styles.contextLine}>
          {p.needAttention === 0
            ? "Nothing overdue. Nice work."
            : `${p.escalated} escalated · ${p.overdue} overdue`}
        </div>
      </div>

      {/* Pipeline value */}
      <div className={styles.tile} data-tint="value">
        <div className={styles.label}>Pipeline value</div>
        <div className={styles.value}>{fmtCurrency(p.pipelineValuePence)}</div>
        <div className={styles.contextLine}>
          {p.closingThisMonthPence > 0
            ? `${fmtCurrency(p.closingThisMonthPence)} closing this month`
            : "No completions closing this month"}
        </div>
      </div>
    </section>
  );
}

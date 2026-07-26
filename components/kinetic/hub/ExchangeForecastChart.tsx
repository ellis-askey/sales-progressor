import type { WeekBucket } from "@/lib/services/hub";
import styles from "./exchange-forecast-chart.module.css";

export function ExchangeForecastChart({ forecast }: { forecast: WeekBucket[] }) {
  const total = forecast.reduce((s, w) => s + w.count, 0);
  const thisWeek = forecast[0]?.count ?? 0;
  const max = Math.max(...forecast.map((w) => w.count), 1);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.label}>Exchange forecast</div>
          <div className={styles.sub}>Next 4 weeks · your pipeline</div>
        </div>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{thisWeek}</span>
            <span className={styles.summaryLabel}>this week</span>
          </div>
          <div className={styles.summarySep} />
          <div className={styles.summaryItem}>
            <span className={styles.summaryValue}>{total}</span>
            <span className={styles.summaryLabel}>in 30 days</span>
          </div>
        </div>
      </div>

      <div className={styles.chartWrap}>
        <div className={styles.chart}>
          {forecast.map((week, i) => {
            const heightPct = week.count === 0 ? 8 : 25 + (week.count / max) * 75;
            return (
              <div
                key={i}
                className={styles.column}
                data-current={week.isCurrentWeek ? "true" : "false"}
                data-empty={week.count === 0 ? "true" : "false"}
              >
                <div className={styles.barCount}>{week.count > 0 ? week.count : ""}</div>
                <div
                  className={styles.bar}
                  data-current={week.isCurrentWeek ? "true" : "false"}
                  data-empty={week.count === 0 ? "true" : "false"}
                  style={{ height: `${heightPct}%`, animationDelay: `${i * 80}ms` }}
                />
                <div className={styles.weekLabel}>{week.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

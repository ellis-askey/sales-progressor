import type { HubWins } from "@/lib/services/hub";
import styles from "./wins-panel.module.css";

export function WinsPanel({ wins }: { wins: HubWins }) {
  const delta = wins.exchangesThisMonth - wins.exchangesLastMonth;
  const completionsDelta = wins.completionsThisMonth - wins.completionsLastMonth;
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.label}>Wins this month</div>
        <div className={styles.sub}>You're moving fast</div>
      </div>
      <div className={styles.mainRow}>
        <div className={styles.big}>
          <div className={styles.bigValue}>{wins.exchangesThisMonth}</div>
          <div className={styles.bigLabel}>Exchanges</div>
          {wins.exchangesLastMonth > 0 && (
            <div className={styles.bigDelta} data-positive={delta >= 0}>
              {delta >= 0 ? "+" : ""}{delta} vs last month
            </div>
          )}
          {wins.exchangesLastMonth === 0 && wins.exchangesThisMonth > 0 && (
            <div className={styles.bigDelta} data-positive="true">First this window</div>
          )}
        </div>
        <div className={styles.subStack}>
          <div className={styles.subStat}>
            <span className={styles.subStatLabel}>Completions</span>
            <span className={styles.subStatValue}>{wins.completionsThisMonth}</span>
            {wins.completionsLastMonth > 0 && (
              <span className={styles.subStatDelta} data-positive={completionsDelta >= 0}>
                {completionsDelta >= 0 ? "+" : ""}{completionsDelta}
              </span>
            )}
          </div>
          <div className={styles.subStat}>
            <span className={styles.subStatLabel}>Steps confirmed</span>
            <span className={styles.subStatValue}>{wins.stepsConfirmedThisWeek}</span>
            <span className={styles.subStatMeta}>this week</span>
          </div>
          <div className={styles.subStat}>
            <span className={styles.subStatLabel}>New files</span>
            <span className={styles.subStatValue}>{wins.newFilesThisMonth}</span>
            <span className={styles.subStatMeta}>this month</span>
          </div>
        </div>
      </div>
      {wins.fastestExchangeDays !== null && wins.fastestExchangeAddress && (
        <div className={styles.fastestCard}>
          <div className={styles.fastestLabel}>Fastest exchange this month</div>
          <div className={styles.fastestRow}>
            <div className={styles.fastestDays}>{wins.fastestExchangeDays}<span>d</span></div>
            <div className={styles.fastestAddress}>{wins.fastestExchangeAddress}</div>
          </div>
        </div>
      )}
    </div>
  );
}

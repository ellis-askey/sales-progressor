import styles from "./kinetic-mini-stat.module.css";

export function KineticMiniStat({
  label,
  value,
  suffix,
  bars,
  contextLine,
  caption,
}: {
  label: string;
  value: number;
  suffix?: string;
  bars: number[];
  contextLine?: string;
  caption?: string;
}) {
  const max = bars.length > 0 ? Math.max(...bars, 1) : 1;
  return (
    <div className={styles.panel}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>
        {value.toLocaleString()}
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {bars.length > 0 && (
        <div className={styles.bars}>
          {bars.map((v, i) => {
            const heightPct = 20 + (v / max) * 80;
            const isLast = i === bars.length - 1;
            return (
              <div
                key={i}
                className={styles.bar}
                data-highlighted={isLast}
                style={{ height: `${heightPct}%`, animationDelay: `${300 + i * 55}ms` }}
              />
            );
          })}
        </div>
      )}
      {contextLine && (
        <div className={styles.contextLine}>{contextLine}</div>
      )}
      {caption && (
        <div className={styles.caption}>{caption}</div>
      )}
    </div>
  );
}

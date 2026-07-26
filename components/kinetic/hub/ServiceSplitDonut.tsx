import styles from "./service-split-donut.module.css";

export function ServiceSplitDonut({
  selfManaged,
  outsourced,
  isInternal,
}: {
  selfManaged: number;
  outsourced: number;
  isInternal: boolean;
}) {
  const total = selfManaged + outsourced;
  const pctOutsourced = total > 0 ? Math.round((outsourced / total) * 100) : 0;
  const pctSelf = 100 - pctOutsourced;

  // SVG donut geometry
  const size = 140;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const outsourcedLen = (pctOutsourced / 100) * circ;
  const selfLen = (pctSelf / 100) * circ;

  // Hours saved: same rough estimate legacy uses (2.5 hrs per outsourced file)
  const hoursSaved = Math.round(outsourced * 2.5);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.label}>Service split</div>
        <div className={styles.sub}>Self-managed vs outsourced</div>
      </div>
      <div className={styles.body}>
        <div className={styles.donutWrap}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <defs>
              <linearGradient id="donut-outsourced" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="100%" stopColor="#FF3BC8" />
              </linearGradient>
              <linearGradient id="donut-self" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#4AFFB3" />
                <stop offset="100%" stopColor="#00E5A6" />
              </linearGradient>
            </defs>
            {/* Base track */}
            <circle cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
            {/* Outsourced arc */}
            {outsourced > 0 && (
              <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="url(#donut-outsourced)"
                strokeWidth={stroke}
                strokeDasharray={`${outsourcedLen} ${circ}`}
                strokeDashoffset={0}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.35))" }} />
            )}
            {/* Self-managed arc */}
            {selfManaged > 0 && (
              <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="url(#donut-self)"
                strokeWidth={stroke}
                strokeDasharray={`${selfLen} ${circ}`}
                strokeDashoffset={-outsourcedLen}
                strokeLinecap="round"
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{ filter: "drop-shadow(0 0 6px rgba(74,255,179,0.35))" }} />
            )}
          </svg>
          <div className={styles.donutCentre}>
            <div className={styles.donutPct}>{pctOutsourced}<span>%</span></div>
            <div className={styles.donutCaption}>outsourced</div>
          </div>
        </div>
        <div className={styles.legend}>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} data-kind="outsourced" />
            <span className={styles.legendLabel}>Outsourced to us</span>
            <span className={styles.legendValue}>{outsourced}</span>
          </div>
          <div className={styles.legendRow}>
            <span className={styles.legendDot} data-kind="self" />
            <span className={styles.legendLabel}>Self-managed</span>
            <span className={styles.legendValue}>{selfManaged}</span>
          </div>
          {!isInternal && hoursSaved > 0 && (
            <div className={styles.hoursSaved}>
              <span className={styles.hoursSavedLabel}>Hours you didn&rsquo;t chase</span>
              <span className={styles.hoursSavedValue}>~{hoursSaved}h this month</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

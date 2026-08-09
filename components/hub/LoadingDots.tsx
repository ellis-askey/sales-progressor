// Three pulsating dots for hub loading placeholders. Server-safe (no
// client hooks). Styling lives in LoadingDots.module.css — reduced-motion
// swaps the pulse for a fixed mid-opacity so it still reads as "loading"
// without any motion.

import styles from "./LoadingDots.module.css";

export function LoadingDots({ label = "Loading" }: { label?: string }) {
  return (
    <div className={styles.wrap} role="status" aria-live="polite" aria-label={label}>
      <span aria-hidden className={styles.dot} />
      <span aria-hidden className={styles.dot} />
      <span aria-hidden className={styles.dot} />
    </div>
  );
}

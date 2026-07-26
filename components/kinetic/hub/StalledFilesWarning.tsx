import Link from "next/link";
import styles from "./stalled-files-warning.module.css";

export function StalledFilesWarning({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link href="/agent/transactions?filter=stalled" className={styles.wrap}>
      <div className={styles.row}>
        <span className={styles.dot} />
        <span className={styles.text}>
          <strong>{count}</strong> file{count === 1 ? "" : "s"} need chasing —
          nothing logged in 14+ days
        </span>
        <span className={styles.arrow}>→</span>
      </div>
    </Link>
  );
}

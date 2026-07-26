import Link from "next/link";
import type { HubUnassignedFile, HubRelistAck } from "@/lib/services/hub";
import styles from "./internal-only-cards.module.css";

export function InternalOnlyCards({
  isInternal,
  unassignedFiles,
  relistsToAcknowledge,
}: {
  isInternal: boolean;
  unassignedFiles: HubUnassignedFile[];
  relistsToAcknowledge: HubRelistAck[];
}) {
  if (!isInternal) return null;
  if (unassignedFiles.length === 0 && relistsToAcknowledge.length === 0) return null;

  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        {unassignedFiles.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.label}>Unassigned files</div>
            <div className={styles.value}>{unassignedFiles.length}</div>
            <div className={styles.rows}>
              {unassignedFiles.slice(0, 4).map((f) => (
                <Link
                  key={f.id}
                  href={`/agent/transactions/${f.id}`}
                  className={styles.row}
                >
                  <span className={styles.rowAddress}>{f.propertyAddress}</span>
                  <span className={styles.rowMeta}>{f.agencyName}</span>
                </Link>
              ))}
              {unassignedFiles.length > 4 && (
                <div className={styles.moreLine}>+ {unassignedFiles.length - 4} more</div>
              )}
            </div>
          </div>
        )}

        {relistsToAcknowledge.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.label}>New buyers to acknowledge</div>
            <div className={styles.value}>{relistsToAcknowledge.length}</div>
            <div className={styles.rows}>
              {relistsToAcknowledge.slice(0, 4).map((r) => (
                <Link
                  key={r.transactionId}
                  href={`/agent/transactions/${r.transactionId}`}
                  className={styles.row}
                >
                  <span className={styles.rowAddress}>{r.propertyAddress}</span>
                  <span className={styles.rowMeta}>{r.newBuyerName}</span>
                </Link>
              ))}
              {relistsToAcknowledge.length > 4 && (
                <div className={styles.moreLine}>+ {relistsToAcknowledge.length - 4} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

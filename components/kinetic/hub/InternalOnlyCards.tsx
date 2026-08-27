import Link from "next/link";
import type { HubUnassignedFile, HubRelistAck, HubChainSetupPending } from "@/lib/services/hub";
import { assignWaitBadge } from "@/lib/hub/assign-wait";
import styles from "./internal-only-cards.module.css";

const AMBER = "#b45309";
const RED = "#b91c1c";

export function InternalOnlyCards({
  isInternal,
  unassignedFiles,
  relistsToAcknowledge,
  chainSetupPending,
}: {
  isInternal: boolean;
  unassignedFiles: HubUnassignedFile[];
  relistsToAcknowledge: HubRelistAck[];
  chainSetupPending: HubChainSetupPending[];
}) {
  if (!isInternal) return null;
  if (
    unassignedFiles.length === 0 &&
    relistsToAcknowledge.length === 0 &&
    chainSetupPending.length === 0
  ) return null;

  // Waiting badge per unassigned file + how many have breached the 48h SLA.
  const unassignedWithWait = unassignedFiles.map((f) => ({ ...f, wait: assignWaitBadge(f.waitingSince) }));
  const overSlaCount = unassignedWithWait.filter((f) => f.wait.level !== "ok").length;
  const anyRed = unassignedWithWait.some((f) => f.wait.level === "red");

  return (
    <section className={styles.section}>
      <div className={styles.grid}>
        {unassignedWithWait.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.label}>Unassigned files</div>
            <div className={styles.value}>{unassignedWithWait.length}</div>
            {overSlaCount > 0 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: anyRed ? RED : AMBER, marginTop: 2, marginBottom: 2 }}>
                {overSlaCount} waiting over 48h
              </div>
            )}
            <div className={styles.rows}>
              {unassignedWithWait.slice(0, 4).map((f) => (
                <Link
                  key={f.id}
                  href={`/agent/transactions/${f.id}`}
                  className={styles.row}
                >
                  <span className={styles.rowAddress}>{f.propertyAddress}</span>
                  <span className={styles.rowMeta}>
                    {f.agencyName ? `${f.agencyName} · ` : ""}
                    <span style={{ fontWeight: f.wait.level === "ok" ? 400 : 700, color: f.wait.level === "red" ? RED : f.wait.level === "amber" ? AMBER : "inherit" }}>
                      {f.wait.text}
                    </span>
                  </span>
                </Link>
              ))}
              {unassignedWithWait.length > 4 && (
                <div className={styles.moreLine}>+ {unassignedWithWait.length - 4} more</div>
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

        {chainSetupPending.length > 0 && (
          <div className={styles.panel}>
            <div className={styles.label}>Chain setup pending</div>
            <div className={styles.value}>{chainSetupPending.length}</div>
            <div className={styles.rows}>
              {chainSetupPending.slice(0, 4).map((c) => (
                <Link
                  key={c.transactionId}
                  href={`/agent/transactions/${c.transactionId}`}
                  className={styles.row}
                >
                  <span className={styles.rowAddress}>{c.propertyAddress}</span>
                  <span className={styles.rowMeta}>{c.newBuyerName ?? c.agencyName ?? "New buyer"}</span>
                </Link>
              ))}
              {chainSetupPending.length > 4 && (
                <div className={styles.moreLine}>+ {chainSetupPending.length - 4} more</div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

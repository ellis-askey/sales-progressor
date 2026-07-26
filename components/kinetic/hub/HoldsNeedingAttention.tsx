"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ExpiredHoldItem } from "@/lib/services/hub";
import { reactivateFile } from "@/app/actions/automation";
import styles from "./holds-needing-attention.module.css";

function daysAgo(d: Date): number {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
}

export function HoldsNeedingAttention({ items }: { items: ExpiredHoldItem[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const visible = items.filter((i) => !dismissed.has(i.transactionId));
  if (visible.length === 0) return null;

  function takeOffHold(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await reactivateFile(id);
      if (res.ok) {
        setDismissed((prev) => { const next = new Set(prev); next.add(id); return next; });
      }
      setBusyId(null);
    });
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.label}>Holds needing attention</div>
        <div className={styles.sub}>
          {visible.length} file{visible.length === 1 ? "" : "s"} were meant to come off hold by now
        </div>
      </div>
      <div className={styles.list}>
        {visible.map((h) => {
          const days = daysAgo(h.plannedEndAt);
          const busy = busyId === h.transactionId;
          return (
            <div key={h.transactionId} className={styles.row}>
              <div className={styles.rowInfo}>
                <Link href={`/agent/transactions/${h.transactionId}`} className={styles.address}>
                  {h.propertyAddress}
                </Link>
                <div className={styles.meta}>
                  Was due back {days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}
                  {h.agencyName && <> · {h.agencyName}</>}
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => takeOffHold(h.transactionId)}
                  disabled={busy}
                >
                  {busy ? "Resuming…" : "Take off hold"}
                </button>
                <Link href={`/agent/transactions/${h.transactionId}`} className={styles.btnSecondary}>
                  Open to extend
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

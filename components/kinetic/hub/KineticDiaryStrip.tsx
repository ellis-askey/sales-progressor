import Link from "next/link";
import type { DiaryItem } from "@/lib/services/hub";
import styles from "./kinetic-diary-strip.module.css";

const KIND_META: Record<DiaryItem["type"], { label: string; icon: string; tint: string }> = {
  exchange:   { label: "Exchange today",   icon: "⇌", tint: "cyan" },
  completion: { label: "Completion today", icon: "✓", tint: "success" },
};

export function KineticDiaryStrip({ items }: { items: DiaryItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.strip}>
      <span className={styles.stripLabel}>Today</span>
      <div className={styles.chips}>
        {items.map((item) => {
          const meta = KIND_META[item.type];
          return (
            <Link
              key={`${item.type}-${item.transactionId}`}
              href={`/agent/transactions/${item.transactionId}`}
              className={styles.chip}
              data-tint={meta.tint}
            >
              <span className={styles.chipIcon}>{meta.icon}</span>
              <span className={styles.chipLabel}>{meta.label}</span>
              <span className={styles.chipAddress}>{item.address}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

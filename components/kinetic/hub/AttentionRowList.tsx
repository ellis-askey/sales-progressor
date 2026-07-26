import Link from "next/link";
import type { HubAttentionItem } from "@/lib/services/hub";
import styles from "./attention-row-list.module.css";

const STATUS_LABEL: Record<string, string> = {
  escalated: "Escalated",
  overdue: "Overdue",
  due_today: "Due today",
};

// Turn a reminder name into a short reason line. HubAttentionItem carries
// the reminder rule name (e.g. "Chase: buyer's solicitor searches") — we
// strip the "Chase:" prefix, prepend the urgency verb.
function reasonFor(item: HubAttentionItem): string {
  const label = item.reminderName.replace(/^Chase:\s*/i, "");
  if (item.urgency === "escalated") return `${label} · needs a chase today`;
  if (item.urgency === "overdue") {
    const days = Math.floor((Date.now() - new Date(item.nextDueDate).getTime()) / 86400000);
    return days > 0 ? `${label} · ${days} day${days === 1 ? "" : "s"} overdue` : label;
  }
  return `${label} · due today`;
}

export function AttentionRowList({ items }: { items: HubAttentionItem[] }) {
  return (
    <div className={styles.panel}>
      {items.map((item, i) => (
        <Link
          key={item.id}
          href={`/agent/transactions/${item.transaction.id}?tab=reminders`}
          className={styles.row}
          style={{ animationDelay: `${120 + i * 70}ms` }}
        >
          <span className={styles.dot} data-status={item.urgency} />
          <div className={styles.meta}>
            <div className={styles.top}>
              <span className={styles.status} data-status={item.urgency}>
                {STATUS_LABEL[item.urgency] ?? item.urgency}
              </span>
              <span className={styles.sep}>·</span>
              <span className={styles.address}>{item.transaction.propertyAddress}</span>
            </div>
            <div className={styles.reason}>{reasonFor(item)}</div>
          </div>
          <span className={styles.arrow}>→</span>
        </Link>
      ))}
    </div>
  );
}

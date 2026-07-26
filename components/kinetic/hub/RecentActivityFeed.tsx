import Link from "next/link";
import type { RecentActivity } from "@/lib/services/hub";
import styles from "./recent-activity-feed.module.css";

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function iconFor(kind: string, description: string): { symbol: string; tint: string } {
  if (kind === "milestone") return { symbol: "✓", tint: "success" };
  const d = description.toLowerCase();
  if (d.includes("whatsapp")) return { symbol: "◉", tint: "whatsapp" };
  if (d.includes("call")) return { symbol: "☏", tint: "call" };
  if (d.includes("sms") || d.includes("text")) return { symbol: "≡", tint: "sms" };
  return { symbol: "✉", tint: "email" };
}

// Note: the underlying service returns a single most-recent activity today.
// The panel is shaped as a feed so when the service is expanded to return
// N items (a natural next enhancement), this component picks it up
// without a redesign.
export function RecentActivityFeed({ activity }: { activity: NonNullable<RecentActivity> }) {
  const icon = iconFor(activity.kind, activity.description);
  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.label}>Latest activity</div>
        <div className={styles.sub}>Most recent movement across your pipeline</div>
      </div>
      <div className={styles.feed}>
        <Link href={`/agent/transactions/${activity.transactionId}`} className={styles.row}>
          <span className={styles.icon} data-tint={icon.tint}>{icon.symbol}</span>
          <div className={styles.body}>
            <div className={styles.description}>{activity.description}</div>
            <div className={styles.meta}>
              <span className={styles.context}>{activity.context}</span>
              <span className={styles.time}>{timeAgo(activity.at)}</span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

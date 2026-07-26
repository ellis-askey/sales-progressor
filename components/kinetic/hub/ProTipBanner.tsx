import Link from "next/link";
import styles from "./pro-tip-banner.module.css";

type Signal = {
  chasesQuietFiles: number;
  clientSilentFiles: number;
  needAssignCount: number;
  chainSetupPendingCount: number;
  holdsExpiredCount: number;
  escalatedCount: number;
};

// Pick the strongest tip we can offer given real signals. Falls back to a
// generic encouragement when there's nothing worth flagging.
function pickTip(s: Signal): { message: React.ReactNode; href?: string } {
  if (s.holdsExpiredCount > 0) {
    return {
      message: (
        <>
          {s.holdsExpiredCount} file{s.holdsExpiredCount === 1 ? "" : "s"} came off hold and hasn&rsquo;t
          been picked up yet. Resume or extend from the top of this page.
        </>
      ),
    };
  }
  if (s.escalatedCount > 0) {
    return {
      message: (
        <>
          {s.escalatedCount} file{s.escalatedCount === 1 ? "" : "s"} escalated and waiting.
          A quick chase or reassign now stops the drift.
        </>
      ),
      href: "/agent/work-queue",
    };
  }
  if (s.chasesQuietFiles > 0) {
    return {
      message: (
        <>
          {s.chasesQuietFiles} file{s.chasesQuietFiles === 1 ? " hasn't" : "s haven't"} had an update
          in 14+ days. A quick chase now could keep your pipeline moving.
        </>
      ),
      href: "/agent/transactions?filter=stalled",
    };
  }
  if (s.clientSilentFiles > 0) {
    return {
      message: (
        <>
          {s.clientSilentFiles} client{s.clientSilentFiles === 1 ? "" : "s"} were using
          the portal and have gone quiet in the last week. Worth a personal nudge.
        </>
      ),
    };
  }
  if (s.needAssignCount > 0) {
    return {
      message: (
        <>
          {s.needAssignCount} outsourced file{s.needAssignCount === 1 ? "" : "s"} still need a
          progressor. Assign to keep the SLA clean.
        </>
      ),
    };
  }
  if (s.chainSetupPendingCount > 0) {
    return {
      message: (
        <>
          {s.chainSetupPendingCount} chain{s.chainSetupPendingCount === 1 ? " is" : "s are"} started
          but not fully invited. Sending the invites unlocks two-way progress visibility.
        </>
      ),
    };
  }
  return {
    message: <>Nothing pressing right now. Good time to review upcoming exchanges or check in with your solicitors.</>,
  };
}

export function ProTipBanner(props: { signals: Signal }) {
  const tip = pickTip(props.signals);
  const inner = (
    <div className={styles.banner}>
      <div className={styles.icon}>💡</div>
      <div className={styles.body}>
        <div className={styles.label}>Pro tip</div>
        <div className={styles.message}>{tip.message}</div>
      </div>
      {tip.href && <div className={styles.arrow}>→</div>}
    </div>
  );
  return tip.href ? (
    <Link href={tip.href} className={styles.link}>{inner}</Link>
  ) : (
    <div className={styles.link}>{inner}</div>
  );
}

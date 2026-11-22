import styles from "./AnimatedClock.module.css";

// Canonical animated clock icon. Drop it inside ANY canonical button (or link):
// its hand sweeps on hover / keyboard-focus via one shared rule in the stylesheet
// beside it — the animation belongs to the icon, not the button, so there is no
// bespoke per-button class. Replaces the hand-rolled rem-clock-btn (reminders
// snooze) and chase-resched-btn (hub reschedule), which each reproduced this
// exact SVG + the rem-tick animation. Matches the shipped clock byte-for-byte
// (r=8.5 face, 12→3 o'clock tick, sweeping minute hand).
export function AnimatedClock({ size = 13, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8.5" />
      <line x1="12" y1="12" x2="15" y2="12" />
      <g className={styles.hand}>
        <line x1="12" y1="12" x2="12" y2="6.5" />
      </g>
    </svg>
  );
}

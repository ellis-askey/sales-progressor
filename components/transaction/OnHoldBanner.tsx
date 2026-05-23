// Calm amber-tinted banner shown at the top of the transaction-detail page
// while a file is on hold. Renders nothing when the file is not on hold —
// caller decides visibility based on PropertyTransaction.status.

export function OnHoldBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div
      className="rounded-[12px] p-4 mb-4 flex items-start gap-3"
      style={{
        background: "rgba(251, 191, 36, 0.10)",
        border: "1px solid rgba(251, 191, 36, 0.30)",
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-[var(--agent-text-primary,#1A1D29)]">
          This file is on hold.
        </p>
        <p className="text-xs mt-0.5 text-[var(--agent-text-secondary,rgba(15,23,42,0.65))]">
          All automation is frozen — no client emails, no agent reminders, no escalations. Reactivate the file to resume.
        </p>
      </div>
    </div>
  );
}

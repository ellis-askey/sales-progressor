import type { BusinessStatus } from "@/lib/command/businesses";

// At-a-glance health pill for a progression business. Command Centre palette:
// solid surfaces, hairline borders, no glass. Shared by the list + the drill.
const STATUS: Record<BusinessStatus, { label: string; cls: string }> = {
  live:           { label: "Paying",         cls: "text-emerald-300 bg-emerald-950/50 border-emerald-900/60" },
  no_card:        { label: "No card yet",    cls: "text-neutral-400 bg-neutral-800/60 border-neutral-700" },
  payment_failed: { label: "Payment failed", cls: "text-amber-300 bg-amber-950/50 border-amber-900/60" },
  blocked:        { label: "Blocked",        cls: "text-red-300 bg-red-950/50 border-red-900/60" },
};

export function BusinessStatusPill({ status }: { status: BusinessStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}

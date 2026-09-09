import { claimClass as resolveClaim, type ClaimTone } from "@/lib/command/content/brand-taxonomy";

// Shared claim-class badge (docs/active/content-brand/SPEC.md). Verified fact /
// opinion / inference / unverified, rendered identically everywhere a claim is
// shown. Server- and client-safe.

const TONE_CLASS: Record<ClaimTone, string> = {
  good: "border-emerald-900/60 bg-emerald-950/30 text-emerald-300",
  info: "border-blue-900/60 bg-blue-950/30 text-blue-300",
  watch: "border-amber-900/60 bg-amber-950/30 text-amber-300",
  bad: "border-red-900/60 bg-red-950/30 text-red-300",
};

export function ClaimBadge({ id }: { id: string }) {
  const { label, tone } = resolveClaim(id);
  return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TONE_CLASS[tone]}`}>{label}</span>;
}

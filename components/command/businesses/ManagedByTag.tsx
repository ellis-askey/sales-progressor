import { Building2 } from "lucide-react";

// Small inline tag shown against an agency or file that an external progression
// business handles. Command Centre palette (blue accent, hairline border).
export function ManagedByTag({ businessName }: { businessName: string }) {
  return (
    <span
      title={`Managed by ${businessName}`}
      className="inline-flex items-center gap-1 align-middle max-w-[160px] rounded border border-blue-900/50 bg-blue-950/40 px-1.5 py-0.5 text-[10px] font-medium text-blue-300"
    >
      <Building2 className="w-2.5 h-2.5 flex-shrink-0" strokeWidth={2} />
      <span className="truncate">{businessName}</span>
    </span>
  );
}

"use client";

import { useState, useTransition } from "react";
import { toggleProviderFirmServiceType } from "@/app/actions/provider-firms";
import { Check } from "lucide-react";

type ServiceType = { id: string; label: string; description: string | null };

export function ServiceTypeSelector({
  providerId,
  allServiceTypes,
  selectedIds,
}: {
  providerId: string;
  allServiceTypes: ServiceType[];
  selectedIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  function toggle(id: string) {
    // Optimistic flip so clicking feels instant
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    startTransition(async () => {
      const r = await toggleProviderFirmServiceType(providerId, id);
      if (!r.ok) {
        // Roll back on error
        setSelected(new Set(selected));
      }
    });
  }

  if (allServiceTypes.length === 0) {
    return (
      <p className="text-[12px] text-[#737373]">
        No active service types defined for this kind yet. Add some in{" "}
        <a href="/command/providers/service-types" className="text-[#93c5fd] hover:underline">
          Manage service types
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      {allServiceTypes.map((s) => {
        const isSelected = selected.has(s.id);
        return (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            disabled={pending}
            className={`w-full text-left px-2.5 py-2 rounded border transition-colors disabled:cursor-not-allowed ${
              isSelected
                ? "bg-[#1d2d50] border-[#2563eb]/40 text-[#93c5fd]"
                : "bg-[#0a0a0a] border-[#262626] text-[#d4d4d4] hover:border-[#404040]"
            }`}
          >
            <div className="flex items-start gap-2">
              <div
                className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center ${
                  isSelected ? "bg-[#2563eb] border-[#2563eb]" : "border-[#404040]"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
              </div>
              <div className="flex-1">
                <p className={`text-[12px] font-semibold ${isSelected ? "text-[#bfdbfe]" : "text-[#fafafa]"}`}>
                  {s.label}
                </p>
                {s.description && (
                  <p className="text-[11px] text-[#737373] mt-0.5">{s.description}</p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

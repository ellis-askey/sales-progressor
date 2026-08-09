"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createServiceType } from "@/app/actions/provider-service-types";

export function NewServiceTypeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("50");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = label.trim() && !pending;

  function submit() {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const r = await createServiceType({
        kind: "surveyor",
        label,
        description: description || null,
        sortOrder: parseInt(sortOrder, 10) || 50,
        active: true,
      });
      if (r.ok) {
        setLabel("");
        setDescription("");
        setSortOrder("50");
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="border border-[#262626] rounded-md bg-[#0f0f0f] p-3">
      <div className="space-y-2.5">
        <div className="grid grid-cols-[1fr_100px] gap-2.5">
          <div>
            <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
              Label <span className="text-[#fca5a5]">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Level 2 HomeBuyer report"
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] placeholder:text-[#404040]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
              Sort
            </label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              min={0}
              max={999}
              className="w-full bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] font-mono"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-[#525252] uppercase tracking-widest mb-1">
            Description (one line shown under the label on the client picker)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full bg-[#0a0a0a] border border-[#262626] rounded px-2.5 py-1.5 text-[13px] text-[#fafafa] focus:outline-none focus:border-[#2563eb] resize-none placeholder:text-[#404040]"
            placeholder="Plain-English description of what this service covers"
          />
        </div>

        {error && <p className="text-[11px] text-[#fca5a5]">{error}</p>}

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-[#525252]">Kind defaults to surveyor.</p>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="px-3 py-1 rounded text-[12px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: canSubmit ? "#2563eb" : "#404040" }}
          >
            {pending ? "Adding…" : "Add service type"}
          </button>
        </div>
      </div>
    </div>
  );
}

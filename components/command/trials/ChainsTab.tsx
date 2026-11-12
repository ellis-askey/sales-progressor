"use client";

// Trial cockpit → Chains tab (critique #299). Every neighbour chain stub on the
// agency's ACTIVE files' chains, with its contact completeness, editable inline
// so TSP can fill the gaps from the Command Centre. Saves via
// saveChainStubContactAction (superadmin-gated).

import { useState, useTransition } from "react";
import { saveChainStubContactAction, type StubContactField } from "@/app/actions/trial-chains";
import { Section, CardEmpty } from "@/components/command/ui/primitives";
import type { TrialChains } from "@/lib/command/trial-cockpit";

function EditableCell({
  linkId, field, initial, placeholder, type = "text",
}: {
  linkId: string;
  field: StubContactField;
  initial: string | null;
  placeholder: string;
  type?: "text" | "email" | "tel";
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [state, setState] = useState<"idle" | "saving" | "ok" | "err">("idle");
  const [, start] = useTransition();

  function commit() {
    const trimmed = value.trim();
    if (trimmed === saved.trim()) return; // unchanged
    setState("saving");
    start(async () => {
      try {
        await saveChainStubContactAction({ linkId, field, value: trimmed });
        setSaved(trimmed);
        setState("ok");
        setTimeout(() => setState((s) => (s === "ok" ? "idle" : s)), 1500);
      } catch {
        setState("err");
      }
    });
  }

  const filled = value.trim().length > 0;
  const ring =
    state === "err" ? "border-red-800 focus:border-red-600"
    : filled ? "border-transparent hover:border-neutral-700"
    : "border-amber-900/40 hover:border-amber-800/60"; // gaps stand out

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        placeholder={placeholder}
        className={`w-full bg-transparent px-2 py-1 text-sm rounded border ${ring} text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:border-blue-600 transition-colors ${state === "saving" ? "opacity-60" : ""}`}
      />
      {state === "ok" && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-400">saved</span>}
      {state === "err" && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-red-400">retry</span>}
    </div>
  );
}

export function ChainsTab({ chains }: { chains: TrialChains }) {
  const { stubs, totalStubs, completeStubs } = chains;
  const pct = totalStubs > 0 ? Math.round((completeStubs / totalStubs) * 100) : 0;

  if (totalStubs === 0) {
    return (
      <Section title="Chain contacts" tip="Neighbour properties on this agency's active-file chains that aren't on the platform yet.">
        <CardEmpty>No chain stubs on any active file yet. As chains are built, their neighbour links show here to complete.</CardEmpty>
      </Section>
    );
  }

  return (
    <Section
      title={`Chain contacts · ${totalStubs}`}
      subtitle="Neighbour properties on this agency's active-file chains. Fill in the gaps here and it saves straight onto the chain."
      tip="Only unclaimed stubs (neighbours not yet on the platform). Edits write back to the chain link live."
    >
      {/* Completeness bar */}
      <div className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
        <div className="flex items-baseline justify-between text-xs text-neutral-400">
          <span><span className="text-neutral-200 font-medium tabular-nums">{completeStubs}</span> of {totalStubs} have full contact details</span>
          <span className="tabular-nums text-neutral-500">{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(1, pct)}%` }} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-900 text-left text-[11px] uppercase tracking-wider text-neutral-500">
              <th className="px-3 py-2 font-medium">Neighbour property</th>
              <th className="px-3 py-2 font-medium">On chain with</th>
              <th className="px-3 py-2 font-medium">Agency</th>
              <th className="px-3 py-2 font-medium">Agent name</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/70">
            {stubs.map((s) => (
              <tr key={s.linkId} className="bg-neutral-950/40">
                <td className="px-3 py-2 align-top text-neutral-200 max-w-[220px]">
                  {s.stubAddress || <span className="text-neutral-600 italic">no address</span>}
                </td>
                <td className="px-3 py-2 align-top text-[11px] text-neutral-500 max-w-[180px]">
                  {s.onChainWith.length === 0 ? "-"
                    : s.onChainWith.length === 1 ? s.onChainWith[0]
                    : `${s.onChainWith[0]} +${s.onChainWith.length - 1}`}
                </td>
                <td className="px-2 py-1.5 align-top min-w-[150px]"><EditableCell linkId={s.linkId} field="agencyName" initial={s.agencyName} placeholder="Agency" /></td>
                <td className="px-2 py-1.5 align-top min-w-[150px]"><EditableCell linkId={s.linkId} field="agentName" initial={s.agentName} placeholder="Name" /></td>
                <td className="px-2 py-1.5 align-top min-w-[190px]"><EditableCell linkId={s.linkId} field="agentEmail" initial={s.agentEmail} placeholder="Email" type="email" /></td>
                <td className="px-2 py-1.5 align-top min-w-[140px]"><EditableCell linkId={s.linkId} field="agentPhone" initial={s.agentPhone} placeholder="Phone" type="tel" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

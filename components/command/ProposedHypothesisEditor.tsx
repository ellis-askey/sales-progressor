"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateExperimentHypothesisAction } from "@/app/actions/command-centre";

const PLACEHOLDER = "Promoted from signal. Add hypothesis here.";

export function ProposedHypothesisEditor({ experimentId, hypothesis }: { experimentId: string; hypothesis: string }) {
  const router = useRouter();
  const isPlaceholder = hypothesis.trim() === PLACEHOLDER;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(isPlaceholder ? "" : hypothesis);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await updateExperimentHypothesisAction(experimentId, value);
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="mt-1 space-y-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          placeholder="If we change X, then Y will improve."
          className="w-full text-xs bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2.5 py-1.5 placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
        />
        <div className="flex items-center gap-2">
          <button onClick={save} disabled={pending || !value.trim()} className="text-xs px-2.5 py-1 rounded-md bg-blue-950 text-blue-400 border border-blue-900 hover:bg-blue-900 transition-colors disabled:opacity-40">
            {pending ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-300 transition-colors">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <p className="text-xs mt-1">
      {isPlaceholder ? (
        <span className="text-amber-500/90">No hypothesis yet.</span>
      ) : (
        <span className="text-neutral-400">{hypothesis}</span>
      )}
      <button onClick={() => setEditing(true)} className="ml-2 text-neutral-500 hover:text-neutral-300 underline decoration-neutral-700">
        {isPlaceholder ? "Add one" : "Edit"}
      </button>
    </p>
  );
}

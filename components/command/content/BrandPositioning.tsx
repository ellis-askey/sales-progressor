"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBrandProfileAction } from "@/app/actions/brand";

// Brand positioning (docs/active/content-brand/SPEC.md, Phase 1.2). A short,
// editable statement of who Ellis is publicly. Manually refined now; the
// strategist layer (Phase 2) will propose refinements from real response data.

type Profile = {
  primaryIdentity: string;
  credibility: string;
  personality: string;
  associations: string;
  desiredReputation: string;
  targetAudiences: string[];
};

const FIELDS: Array<{ key: keyof Profile; label: string; hint: string; placeholder: string }> = [
  { key: "primaryIdentity", label: "Primary identity", hint: "Who you are, in one line.", placeholder: "Founder building technology around the real problems inside UK property transactions." },
  { key: "credibility", label: "Why you're credible", hint: "What earns you the right to speak.", placeholder: "Actually worked in estate agency and sales progression, not commenting from outside." },
  { key: "personality", label: "Public personality", hint: "How you come across.", placeholder: "Direct, practical, curious, occasionally funny, willing to call out bad process without being performatively controversial." },
  { key: "associations", label: "What you want to be known for", hint: "The association to build.", placeholder: "Making the sales process clearer, faster, more connected and less archaic." },
  { key: "desiredReputation", label: "Desired reputation", hint: "Where this is heading.", placeholder: "The person estate agents trust on how the transaction actually works." },
];

const EMPTY: Profile = {
  primaryIdentity: "",
  credibility: "",
  personality: "",
  associations: "",
  desiredReputation: "",
  targetAudiences: [],
};

export function BrandPositioning({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile>(profile ?? EMPTY);

  const hasProfile = profile != null && FIELDS.some((f) => (profile[f.key] as string)?.trim());

  function save() {
    const fd = new FormData();
    FIELDS.forEach((f) => fd.set(f.key, (draft[f.key] as string) ?? ""));
    fd.set("targetAudiences", draft.targetAudiences.join("\n"));
    startTransition(async () => {
      const res = await saveBrandProfileAction(fd);
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="block text-[12px] font-medium text-neutral-300">{f.label}</label>
            <p className="mb-1 text-[11px] text-neutral-600">{f.hint}</p>
            <textarea
              value={(draft[f.key] as string) ?? ""}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              rows={2}
              placeholder={f.placeholder}
              className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-700 focus:border-blue-600/50 focus:outline-none"
            />
          </div>
        ))}
        <div>
          <label className="block text-[12px] font-medium text-neutral-300">Who you want to reach</label>
          <p className="mb-1 text-[11px] text-neutral-600">One audience per line.</p>
          <textarea
            value={draft.targetAudiences.join("\n")}
            onChange={(e) => setDraft({ ...draft, targetAudiences: e.target.value.split("\n") })}
            rows={3}
            placeholder={"Estate agency owners\nBranch managers\nSales progressors\nProperty-tech people"}
            className="w-full resize-y rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-700 focus:border-blue-600/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={() => {
              setDraft(profile ?? EMPTY);
              setEditing(false);
            }}
            className="rounded-lg border border-neutral-700 px-3 py-2 text-[13px] text-neutral-400 transition-colors hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            Save positioning
          </button>
        </div>
      </div>
    );
  }

  if (!hasProfile) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/40 px-5 py-8 text-center">
        <p className="text-sm text-neutral-300 font-medium">Set your positioning</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] text-neutral-600">
          A short, honest statement of who you are publicly and what you want to be known for. Everything the content
          engine suggests is checked against this.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-500"
        >
          Set positioning
        </button>
      </div>
    );
  }

  const audiences = (profile as Profile).targetAudiences ?? [];
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          {FIELDS.filter((f) => (profile as Profile)[f.key]).map((f) => (
            <div key={f.key}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{f.label}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-200">{(profile as Profile)[f.key] as string}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-[12px] text-neutral-400 transition-colors hover:text-neutral-200"
        >
          Edit
        </button>
      </div>
      {audiences.length > 0 && (
        <div className="mt-4 border-t border-neutral-800 pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Who you want to reach</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {audiences.map((a) => (
              <span key={a} className="rounded-full border border-neutral-700 bg-neutral-800/60 px-2 py-0.5 text-[11px] text-neutral-300">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

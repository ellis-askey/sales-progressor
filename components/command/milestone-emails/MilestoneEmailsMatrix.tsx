"use client";

// components/command/milestone-emails/MilestoneEmailsMatrix.tsx
//
// Command Centre milestone-email matrix. Pick tenure + method + side + step,
// see the exact email that would send (filled with example values), and edit
// it. A saved edit is a scenario-scoped override that applies from the next
// send — narrow to the chosen scenario, or broaden to all tenures / methods.

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, RotateCcw, AlertTriangle } from "lucide-react";

type StepMeta = {
  code: string;
  label: string;
  sides: string[];
  mortgageOnly: boolean;
  leaseholdOnly: boolean;
};
type Copy = {
  subject: string;
  heroLabel: string;
  opening: string;
  whatHappened: string;
  whatNext: string | null;
  action: string | null;
};
type Resolved =
  | {
      exists: true;
      source: "default" | "override";
      matchedTenure: string | null;
      matchedMethod: string | null;
      raw: Copy;
      base: Copy;
      preview: Copy;
    }
  | { exists: false };

type Side = "vendor" | "purchaser" | "vendorAgent" | "progressor";

const SIDE_OPTIONS: { value: Side; label: string }[] = [
  { value: "purchaser", label: "Buyer" },
  { value: "vendor", label: "Seller" },
  { value: "vendorAgent", label: "Seller's agent" },
  { value: "progressor", label: "Internal" },
];

const scopeLabel = (t: string | null, m: string | null) => {
  const parts: string[] = [];
  parts.push(t && t !== "any" ? t : "all tenures");
  parts.push(m && m !== "any" ? (m === "mortgage" ? "mortgage" : "cash") : "all methods");
  return parts.join(" · ");
};

function voiceWarnings(draft: Copy): string[] {
  const w: string[] = [];
  const prose: [string, string | null][] = [
    ["Opening", draft.opening],
    ["What happened", draft.whatHappened],
    ["What next", draft.whatNext],
  ];
  const emDash = String.fromCharCode(0x2014);
  for (const [label, val] of prose) {
    if (!val) continue;
    if (val.includes(emDash)) w.push(`${label}: remove the em dash (use a comma or full stop).`);
    if (val.includes("!")) w.push(`${label}: no exclamation marks in client copy.`);
  }
  return w;
}

export function MilestoneEmailsMatrix({ steps }: { steps: StepMeta[] }) {
  const [side, setSide] = useState<Side>("purchaser");
  const [tenure, setTenure] = useState<"freehold" | "leasehold">("freehold");
  const [method, setMethod] = useState<"mortgage" | "cash">("mortgage");

  const stepsForSide = steps.filter((s) => s.sides.includes(side));
  const [code, setCode] = useState<string>(stepsForSide[0]?.code ?? "");

  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Copy | null>(null);
  const [tenureScope, setTenureScope] = useState<"this" | "any">("this");
  const [methodScope, setMethodScope] = useState<"this" | "any">("this");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const step = steps.find((s) => s.code === code);

  // Keep a valid step selected when the side changes.
  useEffect(() => {
    if (!stepsForSide.some((s) => s.code === code)) {
      setCode(stepsForSide[0]?.code ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  const load = useCallback(async () => {
    if (!code) {
      setResolved(null);
      return;
    }
    setLoading(true);
    setEditing(false);
    try {
      const res = await fetch(
        `/api/command/milestone-emails/resolve?code=${encodeURIComponent(code)}&side=${side}&tenure=${tenure}&method=${method}`
      );
      if (res.ok) setResolved(await res.json());
    } finally {
      setLoading(false);
    }
  }, [code, side, tenure, method]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit() {
    if (!resolved || !resolved.exists) return;
    setDraft({ ...resolved.raw });
    setTenureScope("this");
    setMethodScope("this");
    setEditing(true);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/command/milestone-emails/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          side,
          tenure: tenureScope === "this" ? tenure : "any",
          purchaseType: methodScope === "this" ? method : "any",
          ...draft,
        }),
      });
      if (res.ok) {
        setEditing(false);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!resolved || !resolved.exists || resolved.source !== "override") return;
    setResetting(true);
    try {
      await fetch("/api/command/milestone-emails/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          side,
          tenure: resolved.matchedTenure ?? "any",
          purchaseType: resolved.matchedMethod ?? "any",
        }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  const scenarioWarning =
    step && step.mortgageOnly && method === "cash"
      ? "This step only happens for buyers with a mortgage, so it wouldn't send to a cash buyer."
      : step && step.leaseholdOnly && tenure === "freehold"
        ? "This step only happens on a leasehold sale, so it wouldn't send on a freehold file."
        : null;

  const warnings = draft ? voiceWarnings(draft) : [];

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
        <Field label="Side">
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as Side)}
            className="rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100"
          >
            {SIDE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tenure">
          <Segmented
            value={tenure}
            onChange={(v) => setTenure(v as "freehold" | "leasehold")}
            options={[
              { value: "freehold", label: "Freehold" },
              { value: "leasehold", label: "Leasehold" },
            ]}
          />
        </Field>

        <Field label="Method">
          <Segmented
            value={method}
            onChange={(v) => setMethod(v as "mortgage" | "cash")}
            options={[
              { value: "mortgage", label: "Mortgage" },
              { value: "cash", label: "Cash" },
            ]}
          />
        </Field>

        <Field label="Step">
          <select
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="min-w-[280px] rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100"
          >
            {stepsForSide.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} · {s.label}
                {s.mortgageOnly ? " (mortgage only)" : ""}
                {s.leaseholdOnly ? " (leasehold only)" : ""}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {scenarioWarning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-[13px] text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {scenarioWarning}
        </div>
      )}

      {/* Preview / editor */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : !resolved ? null : !resolved.exists ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
          This step doesn&apos;t send an email to the {SIDE_OPTIONS.find((o) => o.value === side)?.label}.
        </div>
      ) : editing && draft ? (
        <Editor
          draft={draft}
          setDraft={setDraft}
          tenure={tenure}
          method={method}
          tenureScope={tenureScope}
          methodScope={methodScope}
          setTenureScope={setTenureScope}
          setMethodScope={setMethodScope}
          warnings={warnings}
          saving={saving}
          onSave={save}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Preview
          resolved={resolved}
          onEdit={startEdit}
          onReset={reset}
          resetting={resetting}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex w-fit rounded-lg border border-neutral-800 bg-neutral-900 p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors ${
            value === o.value
              ? "bg-blue-950/60 text-blue-200 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.4)]"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Preview({
  resolved,
  onEdit,
  onReset,
  resetting,
}: {
  resolved: Extract<Resolved, { exists: true }>;
  onEdit: () => void;
  onReset: () => void;
  resetting: boolean;
}) {
  const p = resolved.preview;
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        {resolved.source === "override" ? (
          <span className="rounded-full border border-blue-900 bg-blue-950/50 px-2.5 py-0.5 text-[11px] font-medium text-blue-300">
            Edited · applies to {scopeLabel(resolved.matchedTenure, resolved.matchedMethod)}
          </span>
        ) : (
          <span className="rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400">
            Default copy
          </span>
        )}
        <div className="flex items-center gap-2">
          {resolved.source === "override" && (
            <button
              onClick={onReset}
              disabled={resetting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-[13px] font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resetting ? "Resetting…" : "Reset to default"}
            </button>
          )}
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-blue-500"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>

      {/* Email preview */}
      <div className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950">
        <div className="border-b border-neutral-800 px-4 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-neutral-600">Subject</p>
          <p className="text-sm text-neutral-100">{p.subject}</p>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-neutral-600">{p.heroLabel}</p>
          <p className="text-sm text-neutral-300">{p.opening}</p>
          <p className="text-sm leading-relaxed text-neutral-200">{p.whatHappened}</p>
          {p.whatNext && <p className="text-sm leading-relaxed text-neutral-300">{p.whatNext}</p>}
          {p.action && (
            <span className="inline-block rounded-md bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white">
              {p.action}
            </span>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-neutral-600">
        Preview fills the blanks (address, dates, surveyor) with example values.
      </p>
    </div>
  );
}

function Editor({
  draft,
  setDraft,
  tenure,
  method,
  tenureScope,
  methodScope,
  setTenureScope,
  setMethodScope,
  warnings,
  saving,
  onSave,
  onCancel,
}: {
  draft: Copy;
  setDraft: (c: Copy) => void;
  tenure: string;
  method: string;
  tenureScope: "this" | "any";
  methodScope: "this" | "any";
  setTenureScope: (v: "this" | "any") => void;
  setMethodScope: (v: "this" | "any") => void;
  warnings: string[];
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (k: keyof Copy, v: string) => setDraft({ ...draft, [k]: v });

  return (
    <div className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-5">
      <EditorField label="Subject" value={draft.subject} onChange={(v) => set("subject", v)} />
      <EditorField label="Hero label" value={draft.heroLabel} onChange={(v) => set("heroLabel", v)} />
      <EditorField label="Opening" value={draft.opening} onChange={(v) => set("opening", v)} rows={2} />
      <EditorField
        label="What happened"
        value={draft.whatHappened}
        onChange={(v) => set("whatHappened", v)}
        rows={4}
      />
      <EditorField
        label="What next"
        value={draft.whatNext ?? ""}
        onChange={(v) => set("whatNext", v)}
        rows={3}
        hint="Leave blank for no follow-up paragraph."
      />
      <EditorField
        label="Button label"
        value={draft.action ?? ""}
        onChange={(v) => set("action", v)}
        hint="Leave blank for the default button."
      />

      <p className="text-[11px] text-neutral-600">
        Blanks like {"{address}"} are filled per file when the email sends. Leave them in.
      </p>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2">
          {warnings.map((w, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[12px] text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {/* Scope */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          This edit applies to
        </p>
        <div className="flex flex-wrap gap-4">
          <Segmented
            value={tenureScope}
            onChange={(v) => setTenureScope(v as "this" | "any")}
            options={[
              { value: "this", label: `${tenure} only` },
              { value: "any", label: "All tenures" },
            ]}
          />
          <Segmented
            value={methodScope}
            onChange={(v) => setMethodScope(v as "this" | "any")}
            options={[
              { value: "this", label: `${method === "mortgage" ? "Mortgage" : "Cash"} only` },
              { value: "any", label: "All methods" },
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-[13px] font-medium text-neutral-200 hover:bg-neutral-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EditorField({
  label,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </span>
      {rows ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />
      )}
      {hint && <span className="mt-1 block text-[11px] text-neutral-600">{hint}</span>}
    </label>
  );
}

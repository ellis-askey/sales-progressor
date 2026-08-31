"use client";

// components/command/email-templates/PlatformEmailTemplatesEditor.tsx
//
// Command Centre editor for Sales Progressor's OWN defaults on the four Tier-2
// client emails. One generic form driven by CC_EMAIL_TEMPLATES field specs, in
// the Command Centre dark register. Editing here sets the default every agency
// inherits (they can still override it in their own account). No row = the
// built-in code default.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Plus, X } from "lucide-react";
import {
  CC_EMAIL_TEMPLATES,
  CC_TOKENS_NOTE,
  type CcVariantSpec,
  type TemplateFieldSpec,
} from "@/lib/agency-email/cc-editor-spec";

type Content = Record<string, string | string[]>;

export function PlatformEmailTemplatesEditor() {
  return (
    <div className="space-y-8">
      {CC_EMAIL_TEMPLATES.map((tpl) => (
        <div key={tpl.key} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
          <h2 className="text-base font-semibold text-neutral-100">{tpl.label}</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">{tpl.blurb}</p>
          <div className="mt-4 space-y-4">
            {tpl.variants.map((v) => (
              <VariantEditor key={`${v.templateKey}:${v.variant}`} spec={v} />
            ))}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-neutral-600">{CC_TOKENS_NOTE}</p>
    </div>
  );
}

function VariantEditor({ spec }: { spec: CcVariantSpec }) {
  const [content, setContent] = useState<Content | null>(null);
  const [source, setSource] = useState<"custom" | "default">("default");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/command/email-templates/resolve?templateKey=${encodeURIComponent(spec.templateKey)}&variant=${encodeURIComponent(spec.variant)}`,
      );
      if (res.ok) {
        const d = (await res.json()) as { source: "custom" | "default"; effective: Content };
        setContent(d.effective);
        setSource(d.source);
      }
    } finally {
      setLoading(false);
    }
  }, [spec.templateKey, spec.variant]);

  useEffect(() => {
    load();
  }, [load]);

  function setField(key: string, value: string | string[]) {
    setContent((c) => (c ? { ...c, [key]: value } : c));
  }

  async function save() {
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch("/api/command/email-templates/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: spec.templateKey, variant: spec.variant, content }),
      });
      if (res.ok) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1800);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      await fetch("/api/command/email-templates/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateKey: spec.templateKey, variant: spec.variant }),
      });
      await load();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {spec.label && <span className="text-sm font-medium text-neutral-200">{spec.label}</span>}
          {source === "custom" ? (
            <span className="rounded-full border border-blue-900 bg-blue-950/50 px-2 py-0.5 text-[10px] font-medium text-blue-300">Edited default</span>
          ) : (
            <span className="rounded-full border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">Built-in default</span>
          )}
          {savedFlash && <span className="text-[11px] text-emerald-400">Saved</span>}
        </div>
        {source === "custom" && (
          <button
            onClick={reset}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-[12px] font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            {resetting ? "Resetting…" : "Reset to built-in"}
          </button>
        )}
      </div>

      {loading || !content ? (
        <div className="flex items-center gap-2 py-3 text-[13px] text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-3">
          {spec.fields.map((f) => (
            <Field key={f.key} field={f} value={content[f.key]} onChange={(v) => setField(f.key, v)} />
          ))}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-blue-600 px-3.5 py-1.5 text-[13px] font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save default"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ field, value, onChange }: { field: TemplateFieldSpec; value: string | string[] | undefined; onChange: (v: string | string[]) => void }) {
  const labelEl = (
    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-neutral-500">{field.label}</span>
  );
  const hintEl = field.hint ? <span className="mt-1 block text-[11px] text-neutral-600">{field.hint}</span> : null;

  if (field.kind === "list") {
    const items = Array.isArray(value) ? value : [];
    return (
      <div>
        {labelEl}
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <textarea
                value={item}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                rows={2}
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-[13px] text-neutral-100 focus:border-neutral-500 focus:outline-none"
              />
              <button
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label="Remove"
                className="mt-1 shrink-0 rounded-md border border-neutral-700 bg-neutral-800 p-1.5 text-neutral-400 hover:bg-neutral-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => onChange([...items, ""])}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1 text-[12px] font-medium text-neutral-200 hover:bg-neutral-700"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
        {hintEl}
      </div>
    );
  }

  const str = typeof value === "string" ? value : "";
  return (
    <label className="block">
      {labelEl}
      {field.kind === "textarea" ? (
        <textarea
          value={str}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-[13px] text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />
      ) : (
        <input
          value={str}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1.5 text-[13px] text-neutral-100 focus:border-neutral-500 focus:outline-none"
        />
      )}
      {hintEl}
    </label>
  );
}

"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { renderSpecimenAction, type RenderResult } from "./actions";
import { DEFAULT_SCENARIO, type Scenario, type EmailCategory } from "@/lib/command/email-catalogue/scenario";
import type { SpecimenMeta } from "@/lib/command/email-catalogue/registry";

const CATEGORY_ORDER: EmailCategory[] = ["client", "solicitor", "agent", "internal", "chain", "platform"];
const CATEGORY_LABEL: Record<EmailCategory, string> = {
  client: "Client (buyer / seller)",
  solicitor: "Solicitor",
  agent: "Agent",
  internal: "Internal",
  chain: "Chain",
  platform: "Platform",
};

// Representative codes for the milestone picker.
const MILESTONE_CODES = ["VM3", "VM7", "VM18", "VM19", "PM5", "PM9", "PM14", "PM25", "PM26"];

const ACCENT = "#2563eb";
const BORDER = "#262626";

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={{
              background: active ? ACCENT : "transparent",
              color: active ? "#fff" : "#a3a3a3",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="text-[13px] text-neutral-200 font-mono break-words">{value}</div>
    </div>
  );
}

export function EmailCatalogue({ specimens }: { specimens: SpecimenMeta[] }) {
  const [selectedId, setSelectedId] = useState<string>(specimens[0]?.id ?? "");
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = useMemo(() => specimens.find((s) => s.id === selectedId), [specimens, selectedId]);

  const grouped = useMemo(() => {
    const map = new Map<EmailCategory, SpecimenMeta[]>();
    for (const s of specimens) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c)! }));
  }, [specimens]);

  useEffect(() => {
    if (!selectedId) return;
    startTransition(async () => {
      const r = await renderSpecimenAction(selectedId, scenario);
      setResult(r);
    });
  }, [selectedId, scenario]);

  const has = (axis: string) => selected?.axes.includes(axis as never) ?? false;

  return (
    <div>
      <div className="mb-1 text-[22px] font-semibold text-neutral-100">Email catalogue</div>
      <p className="mb-6 text-[13px] text-neutral-400 max-w-2xl">
        Every email the portal can send, rendered from the real builders under the scenario you pick.
        Change the file type to see exactly how the sender and signature switch between self-managed and
        outsourced. Preview data only, nothing is sent.
      </p>

      <div className="flex gap-6" style={{ minHeight: 640 }}>
        {/* Left — specimen list */}
        <div className="w-72 shrink-0 space-y-5">
          {grouped.map((g) => (
            <div key={g.category}>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500">
                {CATEGORY_LABEL[g.category]}
              </div>
              <div className="space-y-1">
                {g.items.map((s) => {
                  const active = s.id === selectedId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="w-full text-left px-3 py-2 rounded-md transition-colors"
                      style={{
                        background: active ? "#15233f" : "transparent",
                        border: `1px solid ${active ? ACCENT : "transparent"}`,
                      }}
                    >
                      <div className="text-[13px] text-neutral-100">{s.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right — scenario + render */}
        <div className="flex-1 min-w-0">
          {/* Scenario toolbar */}
          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 rounded-lg mb-4"
            style={{ background: "#111", border: `1px solid ${BORDER}` }}
          >
            {has("fileType") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">File</span>
                <Seg
                  value={scenario.fileType}
                  onChange={(v) => setScenario((s) => ({ ...s, fileType: v }))}
                  options={[
                    { value: "self_managed", label: "Self-managed" },
                    { value: "outsourced", label: "Outsourced" },
                  ]}
                />
              </label>
            )}
            {has("side") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Side</span>
                <Seg
                  value={scenario.side}
                  onChange={(v) => setScenario((s) => ({ ...s, side: v }))}
                  options={[
                    { value: "vendor", label: "Vendor" },
                    { value: "purchaser", label: "Buyer" },
                  ]}
                />
              </label>
            )}
            {has("theme") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Brand</span>
                <Seg
                  value={scenario.theme}
                  onChange={(v) => setScenario((s) => ({ ...s, theme: v }))}
                  options={[
                    { value: "coral", label: "Coral" },
                    { value: "custom", label: "Custom" },
                  ]}
                />
              </label>
            )}
            {has("milestoneCode") && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-500">Milestone</span>
                <select
                  value={scenario.milestoneCode}
                  onChange={(e) => setScenario((s) => ({ ...s, milestoneCode: e.target.value }))}
                  className="px-2 py-1.5 text-[12px] rounded-md text-neutral-200"
                  style={{ background: "#0a0a0a", border: `1px solid ${BORDER}` }}
                >
                  {MILESTONE_CODES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!selected?.axes.length && (
              <span className="text-[11px] text-neutral-500">This email doesn&apos;t vary by scenario.</span>
            )}
          </div>

          {/* Identity strip */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg mb-4"
            style={{ background: "#111", border: `1px solid ${BORDER}` }}
          >
            <Field label="From" value={result?.ok ? result.from : "…"} />
            <Field label="Reply-to" value={result?.ok ? result.replyTo : "…"} />
            <Field label="Signature" value={result?.ok ? result.signature : "…"} />
            <Field label="Brand theme" value={result?.ok ? result.themeLabel : "…"} />
          </div>

          {selected && (
            <p className="mb-3 text-[12px] text-neutral-500">
              <span className="text-neutral-300">Fires:</span> {selected.trigger}
            </p>
          )}

          {/* Render */}
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <div
              className="px-4 py-2.5 text-[12px] text-neutral-300 flex items-center justify-between"
              style={{ background: "#141414", borderBottom: `1px solid ${BORDER}` }}
            >
              <span>
                <span className="text-neutral-500">Subject:</span>{" "}
                {result?.ok ? result.subject : pending ? "Rendering…" : ""}
              </span>
              {pending && <span className="text-neutral-500">…</span>}
            </div>
            {result && !result.ok ? (
              <div className="p-6 text-[13px] text-red-400" style={{ background: "#fff" }}>
                Could not render: {result.error}
              </div>
            ) : (
              <iframe
                title="email-preview"
                sandbox=""
                srcDoc={result?.ok ? result.html : ""}
                style={{ width: "100%", height: 720, background: "#fff", border: "none", display: "block" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

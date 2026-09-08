"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { renderSpecimenAction, type RenderResult } from "./actions";
import { DEFAULT_SCENARIO, type Scenario, type EmailCategory } from "@/lib/command/email-catalogue/scenario";
import type { SpecimenMeta } from "@/lib/command/email-catalogue/registry";

const CATEGORY_ORDER: EmailCategory[] = ["client", "solicitor", "provider", "agent", "internal", "perfected"];
const CATEGORY_LABEL: Record<EmailCategory, string> = {
  client: "Client (buyer / seller)",
  solicitor: "Solicitor",
  provider: "Surveyor firms",
  agent: "Agent notifications",
  internal: "Internal",
  perfected: "Agent-facing (signed off)",
  chain: "Chain",
  platform: "Platform",
};

const MILESTONE_CODES = ["VM3", "VM7", "VM18", "VM19", "PM5", "PM9", "PM14", "PM25", "PM26"];
const STORAGE_KEY = "email-catalogue-reviewed-v1";

const ACCENT = "#2563eb";
const BORDER = "#262626";
const GREEN = "#22c55e";

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
            style={{ background: active ? ACCENT : "transparent", color: active ? "#fff" : "#a3a3a3" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// One identity row: the resolved example, plus the rule + fallback behind it.
function IdRow({ label, value, rule, fallback }: { label: string; value: string; rule: string; fallback?: string }) {
  return (
    <div className="py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">{label}</div>
      <div className="text-[13px] text-neutral-100 font-mono break-words mb-1.5">{value}</div>
      <div className="text-[12px] text-neutral-400 leading-relaxed">
        <span className="text-neutral-500">Rule:</span> {rule}
      </div>
      {fallback && (
        <div className="text-[12px] text-neutral-400 leading-relaxed mt-0.5">
          <span className="text-neutral-500">Fallback:</span> {fallback}
        </div>
      )}
    </div>
  );
}

export function EmailCatalogue({ specimens }: { specimens: SpecimenMeta[] }) {
  const [selectedId, setSelectedId] = useState<string>(specimens[0]?.id ?? "");
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());

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

  // Load the reviewed set from localStorage (per-browser, for your own tracking).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setReviewed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
  }, []);

  function toggleReviewed(id: string) {
    setReviewed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  useEffect(() => {
    if (!selectedId) return;
    startTransition(async () => {
      const r = await renderSpecimenAction(selectedId, scenario);
      setResult(r);
    });
  }, [selectedId, scenario]);

  const has = (axis: string) => selected?.axes.includes(axis as never) ?? false;
  const isReviewed = selectedId ? reviewed.has(selectedId) : false;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <div className="text-[22px] font-semibold text-neutral-100">Email catalogue</div>
        <div className="text-[12px] text-neutral-400">
          Reviewed <span className="text-neutral-100 font-semibold">{reviewed.size}</span> / {specimens.length}
        </div>
      </div>
      <p className="mb-6 text-[13px] text-neutral-400 max-w-2xl">
        Every email the portal can send, rendered from the real builders under the scenario you pick.
        Tick each one once you&apos;ve reviewed and OK&apos;d it. Preview data only, nothing is sent.
      </p>

      <div className="flex gap-6" style={{ minHeight: 640 }}>
        {/* Left — specimen list */}
        <div className="w-72 shrink-0 space-y-5">
          {grouped.map((g) => (
            <div key={g.category}>
              <div className="mb-2 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                <span>{CATEGORY_LABEL[g.category]}</span>
                <span className="text-neutral-600">{g.items.filter((s) => reviewed.has(s.id)).length}/{g.items.length}</span>
              </div>
              <div className="space-y-1">
                {g.items.map((s) => {
                  const active = s.id === selectedId;
                  const done = reviewed.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className="w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2"
                      style={{ background: active ? "#15233f" : "transparent", border: `1px solid ${active ? ACCENT : "transparent"}` }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 text-[9px]"
                        style={{ background: done ? GREEN : "transparent", border: done ? "none" : `1px solid ${BORDER}`, color: "#0a0a0a" }}
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className="text-[13px] text-neutral-100">{s.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right — scenario + render */}
        <div className="flex-1 min-w-0">
          {/* Header: name + Reviewed toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-[15px] font-semibold text-neutral-100">{selected?.name}</div>
            <button
              onClick={() => selectedId && toggleReviewed(selectedId)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors"
              style={{
                background: isReviewed ? "rgba(34,197,94,0.12)" : "#111",
                border: `1px solid ${isReviewed ? GREEN : BORDER}`,
                color: isReviewed ? GREEN : "#a3a3a3",
              }}
            >
              <span
                className="w-4 h-4 rounded flex items-center justify-center text-[10px]"
                style={{ background: isReviewed ? GREEN : "transparent", border: isReviewed ? "none" : `1px solid ${BORDER}`, color: "#0a0a0a" }}
              >
                {isReviewed ? "✓" : ""}
              </span>
              {isReviewed ? "Reviewed & OK'd" : "Mark reviewed"}
            </button>
          </div>

          {/* Scenario toolbar */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 rounded-lg mb-4" style={{ background: "#111", border: `1px solid ${BORDER}` }}>
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
            {!selected?.axes.length && <span className="text-[11px] text-neutral-500">This email doesn&apos;t vary by scenario.</span>}
          </div>

          {/* Identity panel — example + rule + fallback */}
          <div className="px-4 pb-3 rounded-lg mb-4" style={{ background: "#111", border: `1px solid ${BORDER}` }}>
            <IdRow
              label="From"
              value={result?.ok ? result.from : "…"}
              rule={result?.ok ? result.fromRule : ""}
              fallback={result?.ok ? result.fromFallback : undefined}
            />
            <IdRow label="Reply-to" value={result?.ok ? result.replyTo : "…"} rule={result?.ok ? result.replyToRule : ""} />
            <div className="grid grid-cols-2 gap-4 py-3" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Signature</div>
                <div className="text-[13px] text-neutral-200">{result?.ok ? result.signature : "…"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Brand theme</div>
                <div className="text-[13px] text-neutral-200">{result?.ok ? result.themeLabel : "…"}</div>
              </div>
            </div>
          </div>

          {selected && (
            <p className="mb-3 text-[12px] text-neutral-500">
              <span className="text-neutral-300">Fires:</span> {selected.trigger}
            </p>
          )}

          {/* Render */}
          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${BORDER}` }}>
            <div className="px-4 py-2.5 text-[12px] text-neutral-300 flex items-center justify-between" style={{ background: "#141414", borderBottom: `1px solid ${BORDER}` }}>
              <span>
                <span className="text-neutral-500">Subject:</span> {result?.ok ? result.subject : pending ? "Rendering…" : ""}
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

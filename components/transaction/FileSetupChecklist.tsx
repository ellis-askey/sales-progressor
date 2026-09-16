"use client";

// File setup tab — a free-pick accordion of the file's own details. Each row
// expands in place: the light items (photo, sale details, target date) are
// edited right here; the relational ones (contacts, solicitors, broker, chain)
// open where they live on the file. Nothing auto-advances — the agent picks the
// order.
//
// This is about how COMPLETE the file's information is, not how far the sale has
// progressed — the copy leans on that distinction on purpose. The "why" line on
// each item is the nudge: the more of this that's done, the smoother the sale.

import { useState } from "react";
import { Check, ArrowRight, CaretDown } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { useTabContext } from "@/components/transaction/TabContext";
import { HeroSaleFields } from "@/components/transaction/HeroSaleFields";
import { HeroExchangeCell } from "@/components/transaction/HeroExchangeCell";
import { PhotoSetupCard } from "@/components/transaction/PhotoSetupCard";
import type { FileSetupSummary, FileSetupItem, FileSetupValues } from "@/lib/services/file-setup";

function ProgressRing({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
      <svg width={52} height={52} viewBox="0 0 52 52" aria-hidden>
        <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={5} />
        <circle
          cx={26} cy={26} r={r} fill="none"
          stroke="var(--agent-coral)" strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
      </svg>
      <span className="absolute text-[13px] font-bold tabular-nums text-slate-900">{pct}%</span>
    </span>
  );
}

function InlineEditor({ itemKey, values }: { itemKey: string; values: FileSetupValues }) {
  if (itemKey === "photo") {
    return <PhotoSetupCard transactionId={values.transactionId} photoUrl={values.photoUrl} />;
  }
  if (itemKey === "details") {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <HeroSaleFields
          transactionId={values.transactionId}
          purchasePrice={values.purchasePrice}
          purchaseType={values.purchaseType}
          tenure={values.tenure}
          isShareOfFreehold={values.isShareOfFreehold}
          exchanged={values.exchanged}
        />
      </div>
    );
  }
  if (itemKey === "date") {
    return (
      <HeroExchangeCell
        transactionId={values.transactionId}
        predictedDate={values.predictedDate}
        overrideDate={values.overrideDate}
      />
    );
  }
  return null;
}

export function FileSetupChecklist({ summary }: { summary: FileSetupSummary | null }) {
  const { setActiveTab } = useTabContext();
  const [openKey, setOpenKey] = useState<string | null>(null);

  function jump(tab: string | null, anchor: string | null) {
    if (tab) setActiveTab(tab);
    if (!anchor) return;
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Two frames so the target tab has committed to visible before we scroll.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector(anchor);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        el.classList.add("agent-row-flash");
        window.setTimeout(() => el.classList.remove("agent-row-flash"), 750);
      }),
    );
  }

  if (!summary || summary.totalCount === 0 || !summary.values) {
    return (
      <GlassCard glassId="file-setup" label="File setup" defaultVariant="v25" style={{ borderRadius: 12, padding: 20 }}>
        <p className="text-sm text-slate-900/60">Nothing else to set up.</p>
      </GlassCard>
    );
  }

  const { items, values, doneCount, totalCount, remaining, pct } = summary;
  const complete = doneCount === totalCount;

  return (
    <GlassCard glassId="file-setup" label="File setup" defaultVariant="v25" style={{ borderRadius: 12, padding: 20 }}>
      {/* header */}
      <div className="flex items-center gap-4">
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-slate-900">File setup</h2>
          <p className="text-[13px] text-slate-900/55 mt-0.5">
            Everything this file needs to be ready for progression.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-semibold text-slate-900 tabular-nums">{doneCount} of {totalCount}</div>
          {remaining > 0 ? (
            <div className="text-[12px] text-slate-900/55 mt-0.5">about {remaining} min left</div>
          ) : (
            <div className="text-[12px] font-medium text-emerald-700 mt-0.5">All done</div>
          )}
        </div>
      </div>

      {complete && (
        <p className="text-[13px] font-medium text-emerald-700 mt-4 rounded-xl bg-emerald-500/10 px-4 py-3">
          File setup complete. Everything needed to progress this sale is on file.
        </p>
      )}

      {/* rows */}
      <div className="mt-4 flex flex-col gap-2">
        {items.map((item: FileSetupItem) => {
          const open = openKey === item.key;
          return (
            <div
              key={item.key}
              className={`rounded-xl border transition-colors ${
                open ? "border-black/10 bg-white/60" : "border-black/[0.06] bg-white/30 hover:bg-white/50"
              }`}
            >
              <button
                onClick={() => setOpenKey(open ? null : item.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              >
                {item.done ? (
                  <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-emerald-500/15 text-emerald-700">
                    <Check size={15} weight="bold" aria-hidden />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border-2 border-slate-900/20 shrink-0" aria-hidden />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-[14px] font-semibold ${item.done ? "text-slate-900/60" : "text-slate-900"}`}>
                    {item.label}
                  </span>
                  {item.done && item.valueSummary && (
                    <span className="block text-[12.5px] text-slate-900/55 truncate">{item.valueSummary}</span>
                  )}
                </span>
                {!item.done && !open && (
                  <span className="text-[12.5px] font-medium text-[var(--agent-coral-deep)] shrink-0">
                    {item.inline ? "Set up" : "Open"}
                  </span>
                )}
                <CaretDown
                  size={15}
                  weight="bold"
                  aria-hidden
                  className={`shrink-0 text-slate-900/40 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open && (
                <div className="px-3 pb-3.5 pt-1">
                  <p className="text-[12.5px] text-slate-900/55 mb-1">{item.description}</p>
                  <p className="text-[12px] text-slate-900/45 mb-3 italic">{item.why}</p>
                  {item.inline ? (
                    <div className="rounded-lg bg-black/[0.02] px-3 py-3">
                      <InlineEditor itemKey={item.key} values={values} />
                    </div>
                  ) : (
                    <button
                      onClick={() => jump(item.tab, item.anchor)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--agent-coral)] text-[var(--agent-text-on-coral)] text-[13px] font-semibold px-3.5 py-2 hover:brightness-95 transition"
                    >
                      {item.done ? "View on file" : "Take me there"}
                      <ArrowRight size={14} weight="bold" aria-hidden />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

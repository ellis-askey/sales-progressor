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

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Check, ArrowRight, CaretDown } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/glass/GlassCard";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
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
        <circle cx={26} cy={26} r={r} fill="none" stroke="var(--agent-border-subtle)" strokeWidth={5} />
        <circle
          cx={26} cy={26} r={r} fill="none"
          stroke="var(--agent-coral)" strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 26 26)"
          style={{ transition: "stroke-dashoffset 500ms ease" }}
        />
      </svg>
      <span className="absolute text-[13px] font-bold tabular-nums text-[var(--agent-text-primary)]">{pct}%</span>
    </span>
  );
}

function InlineEditor({ itemKey, values }: { itemKey: string; values: FileSetupValues }) {
  if (itemKey === "photo") {
    return <PhotoSetupCard transactionId={values.transactionId} photoUrl={values.photoUrl} />;
  }
  if (itemKey === "details") {
    return (
      <div className="flex items-center gap-x-6 gap-y-2 max-[542px]:flex-col max-[542px]:items-center max-[542px]:gap-y-2.5 max-[542px]:w-full">
        <HeroSaleFields
          transactionId={values.transactionId}
          purchasePrice={values.purchasePrice}
          purchaseType={values.purchaseType}
          tenure={values.tenure}
          isShareOfFreehold={values.isShareOfFreehold}
          hasManagementPack={values.hasManagementPack}
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

// Asymmetric collapse: open snaps instantly (no animation), close animates the
// height down (grid-rows 0fr/1fr, the app's canonical slide). Children stay
// mounted through the closing transition, then unmount. Matches the feedback
// "no animation on open but animate the collapse".
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [rows, setRows] = useState(open ? "1fr" : "0fr");
  const [anim, setAnim] = useState(false);
  const prev = useRef(open);

  useEffect(() => {
    if (open === prev.current) return;
    prev.current = open;
    if (open) {
      // Instant open — no transition.
      setAnim(false);
      setMounted(true);
      setRows("1fr");
    } else {
      // Animated close — keep children mounted, ease the rows to 0 two frames
      // later so the transition reliably fires from the open height.
      setAnim(true);
      setRows("1fr");
      requestAnimationFrame(() => requestAnimationFrame(() => setRows("0fr")));
    }
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: rows,
        transition: anim ? "grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
      }}
      onTransitionEnd={() => { if (!open) setMounted(false); }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

export function FileSetupChecklist({ summary }: { summary: FileSetupSummary | null }) {
  const { setActiveTab } = useTabContext();
  const [openKey, setOpenKey] = useState<string | null>(null);
  // One Design Lab row drives every section row (shared glassId). When a variant
  // is picked, drop the base surface utilities so the glass owns the surface.
  const rowTag = useGlassTag("file-setup-row", "File setup · section row", { light: "cs-b7c9ec28", dark: "v04" });
  // The inline-editor container (sale details / target date / photo). Pickable
  // in the Design Lab; keeps its current subtle surface until a variant is set.
  const inlineTag = useGlassTag("file-setup-inline", "File setup · sale details box");

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
        <p className="text-sm text-[var(--agent-text-secondary)]">Nothing else to set up.</p>
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
          <h2 className="text-base font-semibold text-[var(--agent-text-primary)]">File setup</h2>
          <p className="text-[13px] text-[var(--agent-text-secondary)] mt-0.5">
            Everything this file needs to be ready for progression.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-semibold text-[var(--agent-text-primary)] tabular-nums">{doneCount} of {totalCount}</div>
          {remaining > 0 ? (
            <div className="text-[12px] text-[var(--agent-text-secondary)] mt-0.5">est. {remaining} min{remaining === 1 ? "" : "s"} left</div>
          ) : (
            <div className="text-[12px] font-medium text-[var(--agent-success)] mt-0.5">All done</div>
          )}
        </div>
      </div>

      {complete && (
        <p className="text-[13px] font-medium text-[var(--agent-success)] mt-4 rounded-xl bg-emerald-500/10 px-4 py-3">
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
              {...rowTag.props}
              className={`rounded-xl border transition-colors ${rowTag.className} ${
                rowTag.picked
                  ? ""
                  : open
                  ? "border-[var(--agent-border-default)] bg-[var(--agent-surface-glass)]"
                  : "border-[var(--agent-border-subtle)] bg-[var(--agent-surface-subtle)] hover:bg-[var(--agent-surface-glass)]"
              }`}
            >
              <button
                onClick={() => setOpenKey(open ? null : item.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              >
                {item.done ? (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white"
                    style={{
                      background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(16,185,129,0.30)",
                    }}
                  >
                    <Check size={15} weight="bold" aria-hidden />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border-2 border-[var(--agent-border-strong)] shrink-0" aria-hidden />
                )}
                <span className="flex-1 min-w-0">
                  <span className={`block text-[14px] font-semibold ${item.done ? "text-[var(--agent-text-secondary)]" : "text-[var(--agent-text-primary)]"}`}>
                    {item.label}
                  </span>
                  {item.done && item.valueSummary && (
                    <span className="block text-[12.5px] text-[var(--agent-text-secondary)] truncate">{item.valueSummary}</span>
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
                  className={`shrink-0 text-[var(--agent-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              <Collapse open={open}>
                <div className={`px-3 pt-1 ${item.inline && item.key === "details" ? "pb-2.5" : "pb-3.5"}`}>
                  {item.inline && item.key === "details" ? (
                    // Sale details: the three cells sit right-aligned on the
                    // description row, vertically centred (like the "Take me there"
                    // rows), with no container box. Under 542px they stack + centre
                    // (HeroSaleFields switches each cell to a compact "Label: value").
                    <div className="flex flex-col gap-2.5 min-[543px]:flex-row min-[543px]:items-center min-[543px]:gap-5">
                      <div className="flex-1 min-w-0 max-[542px]:text-center">
                        <p className="text-[12.5px] text-[var(--agent-text-secondary)] mb-1">{item.description}</p>
                        <p className="text-[12px] text-[var(--agent-text-muted)] italic">{item.why}</p>
                      </div>
                      <div className="shrink-0 max-[542px]:w-full">
                        <InlineEditor itemKey={item.key} values={values} />
                      </div>
                    </div>
                  ) : item.inline ? (
                    <>
                      <p className="text-[12.5px] text-[var(--agent-text-secondary)] mb-1">{item.description}</p>
                      <p className="text-[12px] text-[var(--agent-text-muted)] mb-3 italic">{item.why}</p>
                      <div
                        {...inlineTag.props}
                        className={`rounded-lg px-3 py-3 ${inlineTag.className} ${inlineTag.picked ? "" : "bg-[var(--agent-surface-subtle)]"}`}
                      >
                        <InlineEditor itemKey={item.key} values={values} />
                      </div>
                    </>
                  ) : (
                    // Text left, action right, vertically centred on one row;
                    // under 600px the button drops to its own bottom row, right-
                    // aligned (was bottom-left).
                    <div className="flex flex-col gap-3 min-[600px]:flex-row min-[600px]:items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] text-[var(--agent-text-secondary)] mb-1">{item.description}</p>
                        <p className="text-[12px] text-[var(--agent-text-muted)] italic">{item.why}</p>
                      </div>
                      <div className="flex justify-end shrink-0">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => jump(item.tab, item.anchor)}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          {item.done ? "View on file" : "Take me there"}
                          <ArrowRight size={14} weight="bold" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Collapse>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

"use client";

// Exchange dates passed — split out of the unified AttentionCard (Ellis,
// 2026-09-18) so the Needs-your-attention card is reminders-only. Same drawer
// anatomy as the other hub row-group cards: collapsible header (shade hover),
// flush rows with a warning accent bar, lift hover, capped list with Show all.
//
// Rows are the synthetic "xovr-…" items from getHubAttentionItems (a file
// whose predicted exchange date passed while the file went quiet). No per-row
// pill: the whole card is "dates passed", so the subtext carries the specifics
// (which date, how far past). Actions reuse ExchangeOverdueActions verbatim
// (Set a new date / Recalibrate / Snooze); resolve-style actions remove the
// row in place.

import { useState } from "react";
import Link from "next/link";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { NotePencil, CaretDown } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { GlassCard } from "@/components/glass/GlassCard";
import { ExchangeOverdueActions } from "@/components/hub/ExchangeOverdueActions";
import type { HubAttentionItem } from "@/lib/services/hub";

type Item = HubAttentionItem & { photoUrl: string | null };

const INITIAL_VISIBLE = 6;

function fmtShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function passedLine(item: Item): string {
  if (!item.exchangeDate) return "The expected exchange date has passed.";
  const days = Math.max(1, Math.floor((Date.now() - new Date(item.exchangeDate).getTime()) / 86400000));
  return `Expected to exchange ${fmtShortDate(item.exchangeDate)} · ${days} ${days === 1 ? "day" : "days"} past`;
}

export function ExchangeOverdueCard({ items: initialItems }: { items: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [collapsed, setCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (items.length === 0) return null;

  const shown = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const hiddenCount = items.length - shown.length;

  return (
    <GlassCard glassId="hub-attention" label="Hub · Exchange dates passed" defaultVariant="v27" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="agent-hover-ctl"
        style={{ width: "100%", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, border: "none", borderBottom: collapsed ? "none" : "0.5px solid var(--agent-border-subtle)", cursor: "pointer", textAlign: "left" }}
      >
        <span aria-hidden style={{ color: "var(--agent-warning)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <NotePencil size={24} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="agent-card-title-emphasis" style={{ margin: 0 }}>Exchange dates passed</span>
            <span
              style={{
                fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px",
                borderRadius: 999, background: "rgba(var(--agent-warning-rgb),0.12)",
                color: "var(--agent-warning)", display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {items.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {items.length === 1 ? "1 file is past its expected exchange date" : `${items.length} files are past their expected exchange dates`}. Set a new date, recalibrate the estimate, or snooze while you chase.
          </span>
        </span>
        <span aria-hidden style={{ color: "var(--agent-text-muted)", display: "flex", alignItems: "center", transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)", flexShrink: 0 }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* Collapsible body */}
      <div className={`agent-acc${collapsed ? "" : " open"}`}>
        <div className="agent-acc-in">
          <div ref={listRef}>
            {shown.map((item, i) => (
              <div
                key={item.id}
                style={{ borderLeft: "3px solid var(--agent-warning)", borderTop: i > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined }}
              >
                <div className="agent-hover-row" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 20px 12px 17px" }}>
                  <PropertyThumb photoUrl={item.photoUrl} />
                  <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                    <Link
                      href={`/agent/transactions/${item.transaction.id}`}
                      className="hover:underline"
                      style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {item.transaction.propertyAddress}
                    </Link>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {passedLine(item)}
                    </p>
                  </div>
                  <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                    <ExchangeOverdueActions
                      transactionId={item.transaction.id}
                      address={item.transaction.propertyAddress}
                      onDone={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                    />
                  </div>
                </div>
              </div>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="agent-link"
                style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}
              >
                Show all ({items.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

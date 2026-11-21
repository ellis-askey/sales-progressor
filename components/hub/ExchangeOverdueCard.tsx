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
import { NotePencil, ArrowRight } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { HubCard } from "@/components/hub/HubCard";
import { HubRow } from "@/components/hub/HubRow";
import { ExchangeOverdueActions } from "@/components/hub/ExchangeOverdueActions";
import type { HubAttentionItem } from "@/lib/services/hub";

type Item = HubAttentionItem & { photoUrl: string | null };

const INITIAL_VISIBLE = 6;

function fmtShortDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// Split into the two halves so the mobile relayout can stack them (no dot)
// beside the button; desktop rejoins them with the dot under the address.
function passedParts(item: Item): { date: string | null; past: string } {
  if (!item.exchangeDate) return { date: null, past: "The expected exchange date has passed." };
  const days = Math.max(1, Math.floor((Date.now() - new Date(item.exchangeDate).getTime()) / 86400000));
  return { date: `Expected to exchange ${fmtShortDate(item.exchangeDate)}`, past: `${days} ${days === 1 ? "day" : "days"} past` };
}

// First line + town/postcode (last two comma parts), matching the hub's other
// address splits. Kept inline per the grandfathered per-component pattern.
function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

export function ExchangeOverdueCard({ items: initialItems, defaultCollapsed = false }: { items: Item[]; defaultCollapsed?: boolean }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [showAll, setShowAll] = useState(false);
  const [listRef] = useAutoAnimate<HTMLDivElement>();

  if (items.length === 0) return null;

  const shown = showAll ? items : items.slice(0, INITIAL_VISIBLE);
  const hiddenCount = items.length - shown.length;

  return (
    <HubCard
      glassId="hub-attention"
      label="Hub · Exchange dates passed"
      icon={<NotePencil size={24} weight="regular" />}
      iconColor="var(--agent-warning)"
      title={<><span style={{ color: "var(--agent-warning)", fontWeight: 700 }}>{items.length}</span> exchange date{items.length !== 1 ? "s" : ""} passed</>}
      subtitle="Update the date, recalculate the estimate or snooze while you chase."
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((c) => !c)}
      bodyRef={listRef}
    >
            {shown.map((item, i) => (
              <HubRow
                key={item.id}
                accent="var(--agent-warning)"
                separated={i > 0}
                thumb={
                  <Link href={`/agent/transactions/${item.transaction.id}`} className="hub-thumb-link" aria-label={`Open ${item.transaction.propertyAddress}`}>
                    <PropertyThumb photoUrl={item.photoUrl} />
                  </Link>
                }
                tail={
                  <>
                    {/* Mobile meta: the displaced context line, stacked (no dot),
                        sitting to the left of the button. Hidden on desktop. */}
                    {(() => { const m = passedParts(item); return (
                      <span className="hub-r-meta-m" style={{ fontSize: 11, color: "var(--agent-text-secondary)", minWidth: 0 }}>
                        {m.date && <span>{m.date}</span>}
                        <span>{m.past}</span>
                      </span>
                    ); })()}
                    <div className="hub-r-actions" style={{ flexShrink: 0 }}>
                      <ExchangeOverdueActions
                        transactionId={item.transaction.id}
                        address={item.transaction.propertyAddress}
                        readyToExchange={item.readyToExchange ?? false}
                        onDone={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                      />
                    </div>
                  </>
                }
              >
                <Link
                  href={`/agent/transactions/${item.transaction.id}`}
                  className="hub-addr"
                  style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", minWidth: 0 }}
                >
                  {/* Desktop: full address on one line. Mobile (≤450px): first
                      line + town/postcode stacked (CSS toggles the spans). */}
                  <span className="hub-addr-full">{item.transaction.propertyAddress}</span>
                  {(() => { const a = splitAddress(item.transaction.propertyAddress); return (<>
                    <span className="hub-addr-line">{a.line}</span>
                    {a.location && <span className="hub-addr-loc">{a.location}</span>}
                  </>); })()}
                </Link>
                {/* Desktop meta: under the address, dot-joined. */}
                <p className="hub-r-meta-d" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--agent-text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(() => { const m = passedParts(item); return m.date ? `${m.date} · ${m.past}` : m.past; })()}
                </p>
              </HubRow>
            ))}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="agent-link"
                style={{ width: "100%", padding: "10px 20px", fontSize: 12, fontWeight: 600, textAlign: "center", background: "transparent", border: "none", borderTop: "0.5px solid var(--agent-border-subtle)", cursor: "pointer" }}
              >
                Show all ({items.length}) <ArrowRight size={12} weight="bold" className="agent-arrow-i" />
              </button>
            )}
    </HubCard>
  );
}

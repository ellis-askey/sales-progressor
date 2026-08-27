"use client";

// Hub card: files with a client-supplied mortgage-offer expiry coming up (or
// recently lapsed). Read-only surfacing of the same dates the property-file
// Overview card shows, so a lapsing offer is visible without opening every
// file. Rows link straight to the file. Tones match the file card: red once
// expired, amber within 21 days, neutral slate otherwise.
//
// Surface lives on the hub at /agent/hub. The parent server component fetches
// via getUpcomingMortgageExpiries(vis) and passes the list down. Empty list →
// renders nothing (opt-in by presence). The stepped bell/push alerts are fired
// separately by the morning-digest cron; this is the at-a-glance list.

import { useState } from "react";
import Link from "next/link";
import { Bank, HouseLine, CalendarBlank, CaretDown } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/Pill";

export type MortgageExpiryCardItem = {
  transactionId: string;
  propertyAddress: string;
  side: "buyer" | "seller_onward";
  // Possessive client label ("Ben and Molly's"), or a generic fallback.
  clientLabel: string;
  // ISO date string (serialised from the server Date).
  expiryDate: string;
};

function daysUntil(iso: string): number {
  const then = new Date(iso).setHours(0, 0, 0, 0);
  const now = new Date().setHours(0, 0, 0, 0);
  return Math.round((then - now) / 86400000);
}

function tone(days: number): { color: string; label: string } {
  if (days < 0) return { color: "#DC2626", label: days === -1 ? "Expired yesterday" : `Expired ${-days} days ago` };
  if (days === 0) return { color: "#DC2626", label: "Expires today" };
  if (days <= 21) return { color: "#B45309", label: days === 1 ? "Expires tomorrow" : `${days} days away` };
  return { color: "var(--agent-text-muted)", label: `${days} days away` };
}

const ACCENT = "#B45309";

export function MortgageExpiryCard({ items }: { items: MortgageExpiryCardItem[] }) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  return (
    <div
      className="agent-reveal-in"
      style={{
        background: "var(--agent-surface-elevated)",
        borderRadius: 14,
        border: "0.5px solid rgba(15,23,42,0.08)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Header — icon badge + title + count chip, chevron toggles body */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        style={{
          width: "100%", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
          background: "transparent", border: "none",
          borderBottom: collapsed ? "none" : "0.5px solid rgba(15,23,42,0.08)",
          cursor: "pointer", textAlign: "left",
        }}
      >
        <span aria-hidden style={{
          width: 34, height: 34, borderRadius: 999, background: "rgba(180,83,9,0.10)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ACCENT,
        }}>
          <Bank size={17} weight="bold" />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>
              Mortgage offers expiring
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: "0 5px", borderRadius: 999,
              background: "rgba(15,23,42,0.06)", color: "var(--agent-text-secondary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {items.length}
            </span>
          </span>
          <span style={{ display: "block", fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2, lineHeight: 1.4 }}>
            {items.length === 1
              ? "1 client's mortgage offer is nearing its expiry."
              : `${items.length} client mortgage offers are nearing their expiry.`}
          </span>
        </span>
        <span aria-hidden style={{
          color: "var(--agent-text-muted)", display: "flex", alignItems: "center",
          transition: "transform 180ms ease", transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
        }}>
          <CaretDown size={14} weight="bold" />
        </span>
      </button>

      {/* Rows */}
      {!collapsed && (
        <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => {
            const days = daysUntil(item.expiryDate);
            const t = tone(days);
            const whose = `${item.clientLabel} ${item.side === "seller_onward" ? "onward offer" : "offer"}`;
            const dateStr = new Date(item.expiryDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
            return (
              <div key={`${item.transactionId}-${item.side}`} style={{
                position: "relative", borderRadius: 10, background: "rgba(180,83,9,0.035)",
                border: "0.5px solid rgba(15,23,42,0.06)", borderLeft: `3px solid ${t.color}`,
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <span aria-hidden style={{
                    width: 30, height: 30, borderRadius: 999, background: "rgba(180,83,9,0.10)",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: ACCENT, marginTop: 1,
                  }}>
                    <HouseLine size={15} weight="bold" />
                  </span>
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <Link href={`/agent/transactions/${item.transactionId}`} style={{
                      fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", textDecoration: "none",
                    }}>
                      {item.propertyAddress}
                    </Link>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>{whose}</p>
                  </div>
                  <Pill glass tone={days <= 21 ? "danger" : "muted"} size="md" style={{ flexShrink: 0 }}>
                    {t.label}
                  </Pill>
                </div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 5, marginTop: 10,
                  fontSize: 11, color: "var(--agent-text-muted)",
                }}>
                  <CalendarBlank size={12} />
                  Offer expires {dateStr}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

// components/transactions/ForecastStrip.tsx
// Exchange forecast strip — active transactions grouped by upcoming exchange
// month. Polished to canonical standard during /agent/dashboard merge into
// /agent/transactions (2026-05-12).
//
// Visual contract:
//   - agent-glass-strong outer, var(--agent-radius-xl), overflow hidden
//   - agent-card-hdr header (canonical), agent-card-title "Exchange forecast"
//   - Count folded into agent-card-subtitle (no separate pill)
//   - Per-month: agent-eyebrow label, token-driven file count, token divider
//   - Per-file row: agent-hover-row + typography matching TransactionRowView
//   - Service chip: "You" / "Our team" matching TransactionRowView.serviceTag
//     exactly (vocabulary AND colour parity)
//
// Collapsed-glimpse pattern (2026-05-12):
//   - First 2 files per month always visible
//   - Remaining files wrapped in canonical .agent-acc / .agent-acc-in
//   - "+ N more" link expands inline; "Show less" collapses
//   - Each month toggles independently

import { useState } from "react";
import Link from "next/link";
import type { ForecastMonth } from "@/lib/services/transactions";

const VISIBLE_PER_MONTH = 2;

function splitAddress(address: string): { line: string; location: string } {
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length <= 1) return { line: address, location: "" };
  const line = parts.slice(0, -2).join(", ") || parts[0];
  const location = parts.slice(-2).join(", ");
  return { line, location };
}

type Props = {
  months: ForecastMonth[];
  basePath?: string;
};

type Tx = ForecastMonth["transactions"][number];

function FileRow({ tx, basePath, withDivider }: { tx: Tx; basePath: string; withDivider: boolean }) {
  const { line, location } = splitAddress(tx.propertyAddress);
  return (
    <Link
      href={`${basePath}/${tx.id}`}
      className="agent-hover-row"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "10px 4px",
        borderTop: withDivider ? "0.5px solid var(--agent-border-subtle)" : undefined,
        textDecoration: "none",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 14, fontWeight: 600,
          color: "var(--agent-text-primary)",
          lineHeight: 1.35,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {line}
        </p>
        {location && (
          <p style={{
            margin: "2px 0 0", fontSize: 11,
            color: "var(--agent-text-muted)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {location}
          </p>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {tx.serviceType && (
          // Vocabulary + colour parity with TransactionRowView.serviceTag
          // (Stage 3 voice fix: "Self-progressed"→"You", "With progressor"→"Our team")
          <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            tx.serviceType === "outsourced"
              ? "bg-indigo-50/70 text-indigo-500 border-indigo-100"
              : "bg-slate-100/60 text-slate-400 border-slate-200/40"
          }`}>
            {tx.serviceType === "outsourced" ? "Our team" : "You"}
          </span>
        )}
        <span style={{
          fontSize: 11, color: "var(--agent-text-muted)",
        }}>
          {new Date(tx.forecastDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
        </span>
      </div>
    </Link>
  );
}

export function ForecastStrip({ months, basePath = "/transactions" }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (months.length === 0) return null;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const totalFiles = months.reduce((n, m) => n + m.transactions.length, 0);
  const subtitle = totalFiles === 1
    ? "1 active file exchanging in the next 3 months"
    : `${totalFiles} active files exchanging in the next 3 months`;

  return (
    <div
      className="agent-glass-strong"
      style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}
    >
      {/* Header — canonical agent-card-hdr */}
      <div className="agent-card-hdr">
        <div>
          <p className="agent-card-title">Exchange forecast</p>
          <p className="agent-card-subtitle">{subtitle}</p>
        </div>
      </div>

      {months.map((month, mi) => {
        const isCurrent = month.month === thisMonth && month.year === thisYear;
        const key = `${month.year}-${month.month}`;
        const isOpen = !!expanded[key];
        const visible = month.transactions.slice(0, VISIBLE_PER_MONTH);
        const hidden = month.transactions.slice(VISIBLE_PER_MONTH);
        const hasMore = hidden.length > 0;

        return (
          <div
            key={key}
            style={{
              padding: "14px 20px 16px",
              borderTop: mi > 0 ? "0.5px solid var(--agent-border-subtle)" : undefined,
            }}
          >
            {/* Month section header — agent-eyebrow + "This month" coral chip + file count */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span
                className="agent-eyebrow"
                style={isCurrent ? { color: "var(--agent-coral-deep)" } : undefined}
              >
                {month.label}
              </span>
              {isCurrent && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  padding: "1px 8px", borderRadius: 99,
                  color: "var(--agent-coral-deep)",
                  background: "var(--agent-coral-bg-tint)",
                  border: "1px solid rgba(var(--agent-coral-base-rgb), 0.30)",
                }}>
                  This month
                </span>
              )}
              <span style={{
                marginLeft: "auto",
                fontSize: 11, color: "var(--agent-text-muted)",
              }}>
                {month.transactions.length} {month.transactions.length === 1 ? "file" : "files"}
              </span>
            </div>

            {/* Always-visible rows */}
            <div>
              {visible.map((tx, i) => (
                <FileRow key={tx.id} tx={tx} basePath={basePath} withDivider={i > 0} />
              ))}
            </div>

            {hasMore && (
              <>
                {/* Hidden rows — canonical agent-acc accordion */}
                <div className={`agent-acc${isOpen ? " open" : ""}`}>
                  <div className="agent-acc-in">
                    {hidden.map((tx) => (
                      <FileRow key={tx.id} tx={tx} basePath={basePath} withDivider />
                    ))}
                  </div>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [key]: !s[key] }))}
                  className="agent-link agent-link-muted"
                  style={{
                    marginTop: 8,
                    padding: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11,
                  }}
                  aria-expanded={isOpen}
                >
                  {isOpen ? "Show less" : `+ ${hidden.length} more`}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

"use client";

// "Needs attention" panel — actionable delivery problems, compact and
// prioritised (bounced → blocked → failed → errored → deferred). Actions are
// link-only and always safe: update the contact (fix a bad address) or open
// the file. No send/retry here — those would risk a double-send and live on
// the pending row (PR 4) behind the atomic guard.

import Link from "next/link";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import { deliveryStatusMeta } from "./deliveryStatus";
import type { NeedsAttention, NeedsAttentionItem, IssueStatus } from "@/lib/services/automated-emails-overview";

const STATUS_ORDER: IssueStatus[] = ["bounced", "blocked", "failed", "errored", "deferred"];

export function NeedsAttentionPanel({ data }: { data: NeedsAttention }) {
  if (data.total === 0) {
    return (
      <GlassCard
        glassId="auto-emails-attention"
        label="Auto emails · Needs attention"
        defaultVariant="v05"
        style={{ padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" }}
      >
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs attention</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>
          No delivery issues. Every automated email in this period reached its recipient or is still in transit.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      glassId="auto-emails-attention"
      label="Auto emails · Needs attention"
      defaultVariant="v05"
      style={{ padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs attention</h2>
          <Pill tone="danger" size="sm">{data.total}</Pill>
        </div>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>
          Across {data.affectedFiles} {data.affectedFiles === 1 ? "transaction" : "transactions"}
        </span>
      </div>

      {/* Breakdown by status */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {STATUS_ORDER.filter((s) => data.byStatus[s] > 0).map((s) => {
          const meta = deliveryStatusMeta(s);
          return (
            <Pill key={s} tone={meta.tone} size="sm" outline>
              {data.byStatus[s]} {meta.label}
            </Pill>
          );
        })}
      </div>

      {/* Highest-priority affected files */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.items.map((item) => (
          <IssueRow key={`${item.source}-${item.emailId}`} item={item} />
        ))}
      </div>
    </GlassCard>
  );
}

function IssueRow({ item }: { item: NeedsAttentionItem }) {
  const meta = deliveryStatusMeta(item.status);
  const role = asRole(item.recipientRole);
  const fileHref = `/agent/transactions/${item.transactionId}`;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingBottom: 10,
        borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.08))",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Pill tone={meta.tone} size="sm">{meta.label}</Pill>
        <Link
          href={fileHref}
          className="agent-link"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
        >
          {item.transactionAddress}
        </Link>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>
        {issueLine(item)}
      </p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
          {role && <RoleIcon role={role} size={11} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.recipientEmail || item.recipientName}
          </span>
          {item.count > 1 && <span style={{ fontWeight: 600, color: "var(--agent-text-secondary)" }}>×{item.count}</span>}
        </span>
        <span style={{ display: "inline-flex", gap: 10, flexShrink: 0 }}>
          {(item.status === "bounced" || item.status === "blocked") && (
            <Link href={fileHref} className="agent-link" style={{ fontSize: 11, fontWeight: 600 }}>
              {item.status === "bounced" ? "Update email" : "Update contact"}
            </Link>
          )}
          <Link href={fileHref} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>
            View file
          </Link>
        </span>
      </div>
    </div>
  );
}

function issueLine(item: NeedsAttentionItem): string {
  const who = roleName(item);
  switch (item.status) {
    case "bounced": return `${who} email bounced${item.reason ? `: ${item.reason}` : ""}`;
    case "blocked": return `${who} email blocked${item.reason ? `: ${item.reason}` : ""}`;
    case "deferred": return `Repeatedly deferred (${item.deferredCount} attempts)`;
    case "failed": return `Send failed${item.reason ? `: ${item.reason}` : ""}`;
    case "errored": return item.reason ?? "Send errored";
  }
}

function roleName(item: NeedsAttentionItem): string {
  const r = asRole(item.recipientRole);
  return r ? roleLabel(r) : "Recipient";
}

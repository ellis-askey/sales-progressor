"use client";

// "Needs attention" panel — actionable problems as typed cards, prioritised
// (bounced → blocked → missing → failed → errored → deferred). Each card reads
// as a plain-English situation ("We can't reach the seller", "Missing buyer
// email") with one safe, specific action. Actions are link-only and never risk
// a double-send: fix the contact (bad or absent address) or open the file. No
// send/retry here — those live on the pending row (PR 4) behind the atomic guard.

import Link from "next/link";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import type { PillProps } from "@/components/ui/Pill";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";
import type { NeedsAttention, NeedsAttentionItem, IssueStatus } from "@/lib/services/automated-emails-overview";

type Tone = NonNullable<PillProps["tone"]>;

const STATUS_ORDER: IssueStatus[] = ["bounced", "blocked", "missing", "failed", "errored", "deferred"];

// Issue-status vocabulary for this panel. Distinct from the delivery-status map
// (deliveryStatus.ts) because it includes "missing" — a setup gap, not a
// SendGrid delivery event.
const ISSUE_META: Record<IssueStatus, { label: string; tone: Tone }> = {
  bounced:  { label: "Bounced",  tone: "danger" },
  blocked:  { label: "Blocked",  tone: "danger" },
  missing:  { label: "Missing",  tone: "warning" },
  failed:   { label: "Failed",   tone: "danger" },
  errored:  { label: "Errored",  tone: "danger" },
  deferred: { label: "Deferred", tone: "warning" },
};

const CARD_STYLE = { padding: "18px 20px", borderRadius: "var(--agent-radius-xl)" } as const;

export function NeedsAttentionPanel({ data }: { data: NeedsAttention }) {
  if (data.total === 0) {
    return (
      <GlassCard glassId="auto-emails-attention" label="Auto emails · Needs attention" defaultVariant="v05" style={CARD_STYLE}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs attention</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--agent-text-secondary)" }}>
          Nothing needs you. Every automated email reached its recipient or is still in transit, and every active file has the contacts we need.
        </p>
      </GlassCard>
    );
  }

  return (
    <GlassCard glassId="auto-emails-attention" label="Auto emails · Needs attention" defaultVariant="v05" style={CARD_STYLE}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>Needs attention</h2>
          <Pill glass tone="danger" size="sm">{data.total}</Pill>
        </div>
        <span style={{ fontSize: 12, color: "var(--agent-text-muted)" }}>
          Across {data.affectedFiles} {data.affectedFiles === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Breakdown by status */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {STATUS_ORDER.filter((s) => data.byStatus[s] > 0).map((s) => (
          <Pill key={s} tone={ISSUE_META[s].tone} size="sm" outline>
            {data.byStatus[s]} {ISSUE_META[s].label}
          </Pill>
        ))}
      </div>

      {/* Highest-priority affected files, as typed cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.items.map((item) => (
          <IssueCard key={`${item.source}-${item.status}-${item.emailId}`} item={item} />
        ))}
      </div>
    </GlassCard>
  );
}

function IssueCard({ item }: { item: NeedsAttentionItem }) {
  const fileHref = `/agent/transactions/${item.transactionId}`;
  const role = asRole(item.recipientRole);
  const cta = ctaFor(item);

  return (
    <div style={{ display: "flex", gap: 12, paddingBottom: 12, borderBottom: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.08))" }}>
      <span
        aria-hidden="true"
        style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center",
          background: iconBg(item.status), color: iconColor(item.status),
        }}
      >
        {iconFor(item)}
      </span>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <b style={{ fontSize: 13.5, fontWeight: 650, color: "var(--agent-text-primary)" }}>{headline(item)}</b>
          {countChip(item)}
        </div>
        <Link
          href={fileHref}
          className="agent-link"
          style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-secondary)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {item.transactionAddress}
        </Link>
        <p style={{ margin: "3px 0 8px", fontSize: 12, color: "var(--agent-text-muted)" }}>{descLine(item)}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {cta && (
            <Link href={fileHref} className="agent-btn-color-primary" style={{ fontSize: 12, fontWeight: 600, padding: "5px 11px", borderRadius: 8, textDecoration: "none" }}>
              {cta}
            </Link>
          )}
          <Link href={fileHref} className="agent-link agent-link-muted" style={{ fontSize: 12 }}>View file</Link>
        </div>
      </div>
    </div>
  );
}

// ── Copy derivations ─────────────────────────────────────────────────────────

function who(item: NeedsAttentionItem): string {
  const r = asRole(item.recipientRole);
  if (r === "vendor") return "seller";
  if (r === "purchaser") return "buyer";
  if (r === "solicitor") return "solicitor";
  return r ? roleLabel(r).toLowerCase() : "recipient";
}

function headline(item: NeedsAttentionItem): string {
  switch (item.status) {
    case "bounced":
    case "blocked": return `We can't reach the ${who(item)}`;
    case "missing": return `Missing ${who(item)} email`;
    case "failed": return item.recipientRole === "solicitor" ? "Solicitor chase failed" : "Send failed";
    case "deferred": return "Repeatedly deferred";
    case "errored": return "Send errored";
  }
}

function descLine(item: NeedsAttentionItem): string {
  switch (item.status) {
    case "bounced": return item.count > 1 ? `${item.count} emails bounced. Chasing paused until it's fixed.` : "The last email bounced. Chasing paused until it's fixed.";
    case "blocked": return "Their mail server is blocking us. Chasing paused until it's fixed.";
    case "missing": return "Add an email address so we can start chasing.";
    case "failed": return item.recipientRole === "solicitor" ? "The solicitor's email address is failing." : "The last send failed.";
    case "deferred": return `Their mail server keeps deferring us (${item.deferredCount} attempts).`;
    case "errored": return item.reason ?? "The last send errored.";
  }
}

function ctaFor(item: NeedsAttentionItem): string | null {
  switch (item.status) {
    case "bounced":
    case "blocked": return "Update email";
    case "missing": return "Add email";
    case "failed": return item.recipientRole === "solicitor" ? "Review contacts" : "Update email";
    case "deferred":
    case "errored": return null;
  }
}

function countChip(item: NeedsAttentionItem): ReactNode {
  if ((item.status === "bounced" || item.status === "blocked" || item.status === "failed") && item.count > 1) {
    return <Pill tone="danger" size="sm" outline>{item.count} failed</Pill>;
  }
  if (item.status === "missing") return <Pill tone="warning" size="sm" outline>1 file</Pill>;
  return null;
}

// ── Icon family ──────────────────────────────────────────────────────────────

function iconFor(item: NeedsAttentionItem): ReactNode {
  if (item.status === "missing") {
    const role = asRole(item.recipientRole);
    return role ? <RoleIcon role={role} size={17} /> : <UserGlyph />;
  }
  if (item.recipientRole === "solicitor") return <ScaleGlyph />;
  return <MailGlyph />;
}

function iconBg(status: IssueStatus): string {
  return status === "missing" ? "var(--agent-warning-bg)" : "var(--agent-danger-bg)";
}
function iconColor(status: IssueStatus): string {
  return status === "missing" ? "var(--agent-warning)" : "var(--agent-danger)";
}

function MailGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
}
function ScaleGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v18M7 7l-4 6a4 4 0 0 0 8 0zM17 7l-4 6a4 4 0 0 0 8 0zM5 21h14" /></svg>;
}
function UserGlyph() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

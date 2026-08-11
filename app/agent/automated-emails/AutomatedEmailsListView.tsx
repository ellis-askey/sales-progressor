"use client";

// Client view for the automated emails feed. Operational, not an inbox:
//   - Toolbar: search (address / recipient / email / subject) + filters
//     (email type, recipient role, delivery status, from-date), all URL-driven
//     and applied server-side (permission-safe).
//   - Tab segment-pill row: Pending / Activity (30d) / Issues / Upcoming (14d).
//   - Director "All agency / Mine only" pill + file-filter pill.
//   - Compact, scannable rows grouped by day (TODAY · N EMAILS); responsive
//     (property + subject lead on mobile, metadata drops underneath).
//   - Each row opens the right-side EmailDetailDrawer.
//   - "Load more" grows the page via ?limit.
//
// All state lives in the URL so deep-links and the back button work.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailRow, EmailListTab } from "@/lib/services/automated-emails-list";
import { EmailDetailDrawer } from "@/components/automated-emails/EmailDetailDrawer";
import { UpcomingView } from "@/components/automated-emails/UpcomingView";
import { deliveryStatusMeta } from "@/components/automated-emails/deliveryStatus";
import type { UpcomingForecast } from "@/lib/services/automated-emails-upcoming";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { RoleIcon, asRole, roleLabel } from "@/components/ui/RoleIcon";

type Props = {
  rows: EmailRow[];
  counts: { pending: number; sentLast7d: number; sentLast30d: number; errored: number };
  tab: EmailListTab;
  mineOnly: boolean;
  fileId?: string;
  fileLabel: string | null;
  showMineToggle: boolean;
  hasMore: boolean;
  forecast?: UpcomingForecast | null;
};

const TABS: { value: EmailListTab; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Activity (30d)" },
  { value: "errored", label: "Issues" },
  { value: "upcoming", label: "Upcoming (14d)" },
];

const ROLE_OPTIONS = [
  { value: "", label: "All recipients" },
  { value: "vendor", label: "Seller" },
  { value: "purchaser", label: "Buyer" },
  { value: "solicitor", label: "Solicitor" },
  { value: "broker", label: "Broker" },
];
const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "delivered", label: "Delivered" },
  { value: "sent", label: "Sent" },
  { value: "pending", label: "Pending" },
  { value: "deferred", label: "Deferred" },
  { value: "bounced", label: "Bounced" },
  { value: "blocked", label: "Blocked" },
  { value: "errored", label: "Errored" },
];
const CATEGORY_OPTIONS = [
  { value: "", label: "All types" },
  { value: "chase", label: "Chase" },
  { value: "notification", label: "Notification" },
];
const FILTER_KEYS = ["q", "category", "role", "status", "from"];

function countForTab(t: EmailListTab, counts: Props["counts"], rows: EmailRow[], activeTab: EmailListTab, forecast?: UpcomingForecast | null): number | null {
  if (t === "pending") return counts.pending;
  if (t === "sent") return counts.sentLast30d;
  if (t === "errored") return counts.errored;
  if (forecast) return forecast.predictedTotal;
  return t === activeTab ? rows.length : null;
}

function dayKey(d: Date | null | undefined): string {
  if (!d) return "no-date";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function dayLabel(d: Date | null | undefined): string {
  if (!d) return "No date";
  const k = dayKey(d);
  if (k === dayKey(new Date())) return "Today";
  if (k === dayKey(new Date(Date.now() - 86400000))) return "Yesterday";
  if (k === dayKey(new Date(Date.now() + 86400000))) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function timeLabel(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
}
function rowTime(row: EmailRow): Date | null {
  return row.status === "pending" || row.status === "upcoming" ? row.scheduledFor : row.status === "errored" ? row.errorAt : row.sentAt;
}

function groupByDay(rows: EmailRow[]): { key: string; label: string; rows: EmailRow[] }[] {
  const groups = new Map<string, { label: string; rows: EmailRow[] }>();
  for (const r of rows) {
    const d = rowTime(r);
    const k = dayKey(d);
    if (!groups.has(k)) groups.set(k, { label: dayLabel(d), rows: [] });
    groups.get(k)!.rows.push(r);
  }
  return Array.from(groups.entries()).map(([key, g]) => ({ key, label: g.label, rows: g.rows }));
}

export function AutomatedEmailsListView(props: Props) {
  const { rows, counts, tab, mineOnly, fileId, fileLabel, showMineToggle, hasMore, forecast } = props;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<EmailRow | null>(null);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("q") ?? "");

  const current = {
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "",
    role: searchParams.get("role") ?? "",
    status: searchParams.get("status") ?? "",
    from: searchParams.get("from") ?? "",
    limit: searchParams.get("limit") ?? "",
  };
  const anyFilter = FILTER_KEYS.some((k) => searchParams.get(k));

  // Build an href from the current params with overrides applied. Changing a
  // tab or filter resets the "load more" page size.
  function hrefWith(overrides: Record<string, string | null>, resetLimit = true): string {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null || v === "") p.delete(k); else p.set(k, v);
    }
    if (resetLimit && !("limit" in overrides)) p.delete("limit");
    return `/agent/automated-emails?${p.toString()}`;
  }
  const go = (overrides: Record<string, string | null>) => router.push(hrefWith(overrides));

  const grouped = useMemo(() => (tab === "pending" ? null : groupByDay(rows)), [rows, tab]);

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Email views">
        {TABS.map((t) => {
          const n = countForTab(t.value, counts, rows, tab, t.value === "upcoming" ? forecast : null);
          return (
            <Link
              key={t.value}
              href={hrefWith({ tab: t.value })}
              role="tab"
              aria-selected={t.value === tab}
              className={`agent-segment-pill agent-segment-pill-sm${t.value === tab ? " on" : ""}`}
            >
              {t.label}{n !== null ? ` · ${n}` : ""}
            </Link>
          );
        })}
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); go({ q: searchDraft.trim() || null }); }}
          style={{ flex: "1 1 220px", minWidth: 0, display: "flex", gap: 6 }}
        >
          <input
            type="search"
            className="agent-input agent-input-sm"
            placeholder="Search address, recipient, email, subject"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            aria-label="Search emails"
            style={{ flex: 1, minWidth: 0 }}
          />
        </form>
        <select className="agent-input agent-input-sm" aria-label="Email type" value={current.category} onChange={(e) => go({ category: e.target.value || null })}>
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="agent-input agent-input-sm" aria-label="Recipient role" value={current.role} onChange={(e) => go({ role: e.target.value || null })}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="agent-input agent-input-sm" aria-label="Delivery status" value={current.status} onChange={(e) => go({ status: e.target.value || null })}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" className="agent-input agent-input-sm" aria-label="From date" value={current.from} onChange={(e) => go({ from: e.target.value || null })} />
        {anyFilter && (
          <button type="button" className="agent-link agent-link-muted" style={{ fontSize: 12 }} onClick={() => { setSearchDraft(""); go({ q: null, category: null, role: null, status: null, from: null }); }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Director toggle + file filter pill */}
      {(showMineToggle || fileId) && (
        <div className="flex flex-wrap items-center gap-2">
          {showMineToggle && (
            <div style={{ display: "flex", gap: 4 }}>
              <Link href={hrefWith({ mine: null })} className={`agent-segment-pill agent-segment-pill-sm${!mineOnly ? " on" : ""}`}>All agency</Link>
              <Link href={hrefWith({ mine: "1" })} className={`agent-segment-pill agent-segment-pill-sm${mineOnly ? " on" : ""}`}>Mine only</Link>
            </div>
          )}
          {fileId && fileLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--agent-text-secondary)", background: "var(--agent-surface-glass)", border: "0.5px solid rgba(15,23,42,0.10)", borderRadius: 8, padding: "4px 10px" }}>
              <span>Filtered to: {fileLabel}</span>
              <Link href={hrefWith({ fileId: null })} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear</Link>
            </div>
          )}
        </div>
      )}

      {/* Feed */}
      {tab === "upcoming" && forecast ? (
        <UpcomingView forecast={forecast} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={emptyTitle(tab, anyFilter || !!fileId)}
          description={emptyDescription(tab, anyFilter || !!fileId)}
          compact
        />
      ) : (
        <div className="space-y-4">
          {grouped ? (
            grouped.map((g) => (
              <div key={g.key}>
                <p className="agent-eyebrow" style={{ marginBottom: 6 }}>{g.label} · {g.rows.length} {g.rows.length === 1 ? "email" : "emails"}</p>
                <div className="space-y-1">
                  {g.rows.map((r) => <CompactRow key={`${r.source}-${r.id}`} row={r} onOpen={setSelected} />)}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1">
              {rows.map((r) => <CompactRow key={`${r.source}-${r.id}`} row={r} onOpen={setSelected} />)}
            </div>
          )}

          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 4 }}>
              <button
                type="button"
                className="agent-segment-pill agent-segment-pill-sm"
                onClick={() => go({ limit: String((Number(current.limit) || 200) + 200) })}
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}

      <EmailDetailDrawer row={selected} onClose={() => setSelected(null)} onChanged={() => router.refresh()} />
    </div>
  );
}

function CompactRow({ row, onOpen }: { row: EmailRow; onOpen: (row: EmailRow) => void }) {
  const meta = deliveryStatusMeta(row.deliveryStatus);
  const role = asRole(row.recipientRole);
  const t = rowTime(row);
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="agent-email-feed-row w-full text-left flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
      style={{ padding: "8px 10px", borderRadius: 8, border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))", background: "var(--agent-surface-glass, transparent)" }}
    >
      <span className="hidden sm:block" style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums", width: 42, flexShrink: 0 }}>
        {timeLabel(t)}
      </span>
      <CategoryChip category={row.category} />
      <div className="min-w-0 flex-1">
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.transactionAddress}
        </span>
        <span style={{ fontSize: 12, color: "var(--agent-text-secondary)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {row.subject}
        </span>
      </div>
      <span className="hidden md:inline-flex" style={{ alignItems: "center", gap: 4, fontSize: 11, color: "var(--agent-text-muted)", minWidth: 0, maxWidth: 160 }}>
        {role && <RoleIcon role={role} size={11} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.recipientName}{role ? ` · ${roleLabel(role)}` : ""}</span>
      </span>
      <span style={{ flexShrink: 0 }}>
        {row.status === "upcoming"
          ? <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>{dayLabel(t)}{row.chaseNumber ? ` · chase ${row.chaseNumber}/2` : ""}</span>
          : <Pill tone={meta.tone} size="sm">{meta.label}</Pill>}
      </span>
    </button>
  );
}

function CategoryChip({ category }: { category: "chase" | "notification" }) {
  const style = category === "chase" ? { background: "#ffedd5", color: "#9a3412" } : { background: "#dbeafe", color: "#1e40af" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.04em", flexShrink: 0, ...style }}>
      {category}
    </span>
  );
}

function emptyTitle(tab: EmailListTab, filtered: boolean): string {
  if (filtered) return "No matching emails";
  switch (tab) {
    case "pending": return "No emails waiting to send";
    case "sent": return "No automated email activity in this period";
    case "errored": return "No delivery issues";
    case "upcoming": return "No automated emails currently predicted in the next 14 days";
  }
}
function emptyDescription(tab: EmailListTab, filtered: boolean): string | undefined {
  if (filtered) return "Try clearing the search or filters.";
  if (tab === "errored") return "Everything sent is delivered or still in transit.";
  return undefined;
}

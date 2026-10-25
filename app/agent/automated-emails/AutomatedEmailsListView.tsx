"use client";

// Client view for the automated emails page (upgrade phase 2) — four sections:
//   Outbox   — the landing schedule: sent today, still to go, next 14 days
//              (queued + predicted, with true-to-send previews for predictions).
//   History  — everything sent in the last 30 days, grouped by day.
//   Problems — the ONE unified problems list (same number as the banner),
//              led by missing-email setup gaps.
//   Insights — per-file coverage, chase performance and email health.
//
// Toolbar: search + filters (type, recipient, delivery state, from-date), all
// URL-driven and applied server-side (permission-safe). Director "All agency /
// Mine only" pill + file-filter pill. Rows open the EmailDetailDrawer. All
// state lives in the URL so deep-links and the back button work.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailRow } from "@/lib/services/automated-emails-list";
import { EmailDetailDrawer } from "@/components/automated-emails/EmailDetailDrawer";
import { OutboxView } from "@/components/automated-emails/OutboxView";
import { FilesView } from "@/components/automated-emails/FilesView";
import { ChasePerformanceView } from "@/components/automated-emails/ChasePerformanceView";
import { EmailHealthView } from "@/components/automated-emails/EmailHealthView";
import { CompactRow, groupByDay } from "@/components/automated-emails/EmailFeedRow";
import type { UpcomingForecast } from "@/lib/services/automated-emails-upcoming";
import type { FileAutomationRow } from "@/lib/services/automated-emails-coverage";
import type { ChasePerformance, EmailHealth } from "@/lib/services/automated-emails-analytics";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { asRole, roleLabel } from "@/components/ui/RoleIcon";
import { BySaleView } from "@/components/automated-emails/BySaleView";
import type { Cockpit } from "@/lib/services/automated-emails-cockpit";

export type FeedTab = "sale" | "outbox" | "history" | "problems" | "insights";

type Props = {
  rows: EmailRow[];            // the active feed: outbox → queued, history → sent, problems → problem emails
  sentTodayRows: EmailRow[];   // outbox only — what actually went today
  counts: { pending: number; sentLast7d: number; sentLast30d: number; errored: number };
  tab: FeedTab;
  // The "By sale" cockpit (internal-only). showBySale gates the tab; cockpit is
  // the assembled data, present only on the sale tab.
  cockpit?: Cockpit | null;
  showBySale?: boolean;
  mineOnly: boolean;
  fileId?: string;
  fileLabel: string | null;
  showMineToggle: boolean;
  hasMore: boolean;
  // ONE problems number (truth pass): the Problems tab wears the same figure
  // as the banner and the Needs-attention panel.
  needsTotal: number;
  // Missing-email setup gaps — not email rows, so the Problems tab renders
  // them as their own strip above the problem emails.
  missingItems: { id: string; name: string; role: string; transactionId: string; address: string }[];
  forecast?: UpcomingForecast | null;
  fileRows?: FileAutomationRow[] | null;
  chasePerformance?: ChasePerformance | null;
  emailHealth?: EmailHealth | null;
};

// "By sale" is prepended only for internal staff (showBySale).
const BASE_TABS: { value: FeedTab; label: string }[] = [
  { value: "outbox", label: "Schedule" },
  { value: "history", label: "History (30d)" },
  { value: "problems", label: "Problems" },
  { value: "insights", label: "Insights" },
];

// The CSV export route keeps the original view vocabulary.
const EXPORT_TAB: Record<FeedTab, string> = {
  sale: "pending",
  outbox: "pending",
  history: "sent",
  problems: "errored",
  insights: "files",
};

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

// Every countable tab shows its number on every load.
function countForTab(t: FeedTab, counts: Props["counts"], needsTotal: number, forecast?: UpcomingForecast | null): number | null {
  if (t === "outbox") return counts.pending + (forecast?.predictedTotal ?? 0);
  if (t === "history") return counts.sentLast30d;
  if (t === "problems") return needsTotal;
  return null; // insights
}

export function AutomatedEmailsListView(props: Props) {
  const { rows, sentTodayRows, counts, tab, cockpit, showBySale, mineOnly, fileId, fileLabel, showMineToggle, hasMore, needsTotal, missingItems, forecast, fileRows, chasePerformance, emailHealth } = props;
  const TABS = showBySale ? [{ value: "sale" as FeedTab, label: "By sale" }, ...BASE_TABS] : BASE_TABS;
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

  // Export the current view (tab + filters) as CSV via the scope-safe route.
  function exportHref(): string {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", EXPORT_TAB[tab]);
    p.delete("limit");
    return `/api/agent/automated-emails/export?${p.toString()}`;
  }

  const grouped = useMemo(() => (tab === "history" || tab === "problems" ? groupByDay(rows) : null), [rows, tab]);

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Email views">
        {TABS.map((t) => {
          const n = countForTab(t.value, counts, needsTotal, forecast);
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

      {/* Toolbar: search + filters — hidden on Insights and the By-sale cockpit
          (neither filters the per-email feed). */}
      {tab !== "insights" && tab !== "sale" && (
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
        {/* .agent-input defaults to width:100%, which stacked every control on
            its own full-width row — the filter bar reads as ONE compact row
            now, wrapping only when it genuinely runs out of space. */}
        <select className="agent-input agent-input-sm" aria-label="Email type" value={current.category} onChange={(e) => go({ category: e.target.value || null })} style={{ width: "auto", flex: "0 1 auto" }}>
          {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="agent-input agent-input-sm" aria-label="Recipient role" value={current.role} onChange={(e) => go({ role: e.target.value || null })} style={{ width: "auto", flex: "0 1 auto" }}>
          {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="agent-input agent-input-sm" aria-label="Delivery status" value={current.status} onChange={(e) => go({ status: e.target.value || null })} style={{ width: "auto", flex: "0 1 auto" }}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" className="agent-input agent-input-sm" aria-label="From date" value={current.from} onChange={(e) => go({ from: e.target.value || null })} style={{ width: 150, flex: "0 1 auto" }} />
        {anyFilter && (
          <button type="button" className="agent-link agent-link-muted" style={{ fontSize: 12 }} onClick={() => { setSearchDraft(""); go({ q: null, category: null, role: null, status: null, from: null }); }}>
            Clear filters
          </button>
        )}
        <a
          href={exportHref()}
          download
          className="agent-btn agent-btn-sm agent-btn-ghost-bordered autoemails-export"
          // .autoemails-export drops the auto margin when the toolbar has
          // wrapped (narrow widths) so Export doesn't sit orphaned on its own
          // right-aligned line.
          style={{ marginLeft: "auto", gap: 6, textDecoration: "none" }}
          aria-label="Export current view as CSV"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
          Export
        </a>
      </div>
      )}

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
            <Pill glass tone="muted" size="sm" style={{ gap: 6 }}>
              Filtered to: {fileLabel}
              <Link href={hrefWith({ fileId: null })} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Clear</Link>
            </Pill>
          )}
        </div>
      )}

      {/* Feed */}
      {tab === "sale" ? (
        cockpit ? <BySaleView cockpit={cockpit} /> : <EmptyState title="Nothing to show yet" description="When files start chasing, they appear here." compact />
      ) : tab === "outbox" ? (
        <OutboxView
          sentToday={sentTodayRows}
          pending={rows}
          forecast={forecast ?? null}
          filtersActive={anyFilter || !!fileId}
          onOpen={setSelected}
        />
      ) : tab === "insights" ? (
        <div className="space-y-6">
          <section>
            <p className="agent-eyebrow" style={{ marginBottom: 8 }}>Files</p>
            <FilesView rows={fileRows ?? []} />
          </section>
          <section>
            <p className="agent-eyebrow" style={{ marginBottom: 8 }}>Chase performance</p>
            {chasePerformance ? <ChasePerformanceView data={chasePerformance} /> : <EmptyState title="No chase performance yet" compact />}
          </section>
          <section>
            <p className="agent-eyebrow" style={{ marginBottom: 8 }}>Email health</p>
            {emailHealth ? <EmailHealthView data={emailHealth} /> : <EmptyState title="No automated email activity in this period" compact />}
          </section>
        </div>
      ) : rows.length === 0 && !(tab === "problems" && missingItems.length > 0) ? (
        <EmptyState
          title={emptyTitle(tab, anyFilter || !!fileId)}
          description={emptyDescription(tab, anyFilter || !!fileId)}
          compact
        />
      ) : (
        <div className="space-y-4">
          {/* Missing-email setup gaps lead the Problems tab: they're problems
              with no email row (nothing was ever queued), so they'd otherwise
              be invisible here while still counting in the tab's number. */}
          {tab === "problems" && missingItems.length > 0 && (
            <div>
              <p className="agent-eyebrow" style={{ marginBottom: 6 }}>
                Missing email addresses · {missingItems.length} {missingItems.length === 1 ? "person" : "people"}
              </p>
              <div className="space-y-1">
                {missingItems.map((m) => (
                  <div
                    key={m.id}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: "var(--agent-radius-md, 8px)", border: "0.5px solid var(--agent-border-subtle, rgba(15,23,42,0.07))", background: "var(--agent-surface-glass)" }}
                  >
                    <Pill tone="warning" size="sm" outline>Missing</Pill>
                    <span style={{ fontSize: 12.5, fontWeight: 650, color: "var(--agent-text-primary)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.name}{asRole(m.role) ? ` · ${roleLabel(asRole(m.role)!)}` : ""}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--agent-text-muted)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {m.address}
                    </span>
                    <Link href={`/agent/transactions/${m.transactionId}`} className="agent-link" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                      Add email
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

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

function emptyTitle(tab: FeedTab, filtered: boolean): string {
  if (filtered) return "No matching emails";
  switch (tab) {
    case "sale": return "Nothing to show yet";
    case "outbox": return "Nothing sent today and nothing scheduled";
    case "history": return "No automated email activity in this period";
    case "problems": return "No problems";
    case "insights": return "No insights yet";
  }
}
function emptyDescription(tab: FeedTab, filtered: boolean): string | undefined {
  if (filtered) return "Try clearing the search or filters.";
  if (tab === "problems") return "Everything sent is delivered or still in transit, and every contact we need has an email address.";
  return undefined;
}

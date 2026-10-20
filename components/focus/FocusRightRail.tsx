"use client";

// Focus → right rail (founder only). Two cards that keep us on top of the two
// things that quietly stall a sale:
//   1. Enquiries needing you — the three most urgent open loops, worst first.
//   2. Searches outstanding longest — ordered but not yet back, oldest first.
// Both scoped to TSP's own book by the page's data feed.

import Link from "next/link";
import { ArrowRight, MagnifyingGlass, ChatCircleDots } from "@phosphor-icons/react";
import type { FocusEnquiry, FocusSearch } from "@/lib/services/focus";

type EnquiryTone = "danger" | "warning" | "info" | "muted";

// Severity of an open enquiry, carried straight onto the "Quiet N days" colour
// (instead of the old pill). Escalating / gone-dark read red, needs-you amber.
function enquiryTone(e: FocusEnquiry): EnquiryTone {
  if (e.stalled) return "danger";
  if (e.needsAttention) return "warning";
  if (e.stage === "hold") return "info";
  if (e.stage === "escalate" || e.stage === "escalated") return "danger";
  return "muted";
}

const TONE_COLOR: Record<EnquiryTone, string> = {
  danger: "var(--agent-danger)",
  warning: "var(--agent-warning)",
  info: "var(--agent-info)",
  muted: "var(--agent-text-muted)",
};

function daysLabel(n: number): string {
  if (n <= 0) return "today";
  if (n === 1) return "1 day";
  return `${n} days`;
}

// Age colour lands on the "Ordered N days ago" subtext itself: red once genuinely
// overdue, amber as it approaches, plain otherwise.
function searchAgeStyle(days: number): { color: string; fontWeight: number } | undefined {
  if (days >= 21) return { color: "var(--agent-danger)", fontWeight: 600 };
  if (days >= 14) return { color: "var(--agent-warning)", fontWeight: 600 };
  return undefined;
}

export function FocusRightRail({
  enquiries, openEnquiryCount, searches, searchCount,
}: {
  enquiries: FocusEnquiry[]; openEnquiryCount: number; searches: FocusSearch[]; searchCount: number;
}) {
  return (
    <aside className="fr">
      <style>{CSS}</style>

      {/* ── Enquiries needing you ─────────────────────────────── */}
      <section className="fr-card">
        <header className="fr-hd">
          <span className="fr-hd-ic"><ChatCircleDots size={16} weight="bold" /></span>
          <h2>Enquiries needing you</h2>
          <Link href="/agent/enquiries" className="fr-all">All {openEnquiryCount} <ArrowRight size={11} weight="bold" /></Link>
        </header>

        {enquiries.length === 0 ? (
          <p className="fr-empty">No open enquiries. Nothing waiting on a reply.</p>
        ) : (
          <ul className="fr-list">
            {enquiries.map((e) => {
              const tone = enquiryTone(e);
              return (
                <li key={e.transactionId}>
                  <Link href={`/agent/transactions/${e.transactionId}`} className="fr-row">
                    <span className="fr-row-main">
                      <span className="fr-row-title">{e.address}</span>
                      <span className="fr-row-subline">
                        <span className="fr-row-sub">With {e.solicitorName ?? e.withLabel.toLowerCase()}</span>
                        <span className="fr-row-quiet" style={{ color: TONE_COLOR[tone] }}>
                          Quiet {e.quietDays} {e.quietDays === 1 ? "day" : "days"}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Searches outstanding longest ──────────────────────── */}
      <section className="fr-card">
        <header className="fr-hd">
          <span className="fr-hd-ic"><MagnifyingGlass size={16} weight="bold" /></span>
          <h2>Searches outstanding longest</h2>
          {searchCount > searches.length && <span className="fr-count">{searchCount}</span>}
        </header>

        {searches.length === 0 ? (
          <p className="fr-empty">No searches outstanding. Every ordered search is back.</p>
        ) : (
          <ul className="fr-list">
            {searches.map((s) => (
              <li key={s.transactionId}>
                <Link href={`/agent/transactions/${s.transactionId}`} className="fr-row">
                  <span className="fr-row-main">
                    <span className="fr-row-title">{s.address}</span>
                    <span className="fr-row-sub" style={searchAgeStyle(s.daysAgo)}>Ordered {daysLabel(s.daysAgo)} ago</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

const CSS = `
.fr { display:flex; flex-direction:column; gap:14px; position:sticky; top:12px; }
.fr-card { padding:4px 0 6px; border-radius:16px; background:var(--agent-surface-elevated); border:1px solid var(--agent-border-default); box-shadow:0 1px 2px rgba(45,24,16,0.03),0 6px 20px rgba(45,24,16,0.045); overflow:hidden; }
.fr-hd { display:flex; align-items:center; gap:9px; padding:13px 15px 11px; border-bottom:1px solid var(--agent-border-subtle); }
.fr-hd-ic { color:var(--agent-coral-deep); display:grid; place-items:center; flex-shrink:0; }
.fr-hd h2 { margin:0; font-size:13px; font-weight:750; letter-spacing:-0.01em; color:var(--agent-text-primary); flex:1; min-width:0; }
.fr-all { display:inline-flex; align-items:center; gap:3px; font-size:11.5px; font-weight:650; color:var(--agent-coral-deep); text-decoration:none; flex-shrink:0; transition:gap .14s; }
.fr-all:hover { gap:6px; }
.fr-count { font-size:11px; font-weight:700; color:var(--agent-text-muted); background:var(--agent-surface-subtle); border-radius:99px; padding:1px 8px; flex-shrink:0; }

.fr-list { list-style:none; margin:0; padding:5px; display:flex; flex-direction:column; gap:2px; }
.fr-row { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:10px; text-decoration:none; transition:background .14s; }
.fr-row:hover { background:var(--agent-surface-subtle); }
.fr-row-main { min-width:0; flex:1; }
.fr-row-title { display:block; font-size:12.5px; font-weight:650; color:var(--agent-text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color .14s; }
.fr-row:hover .fr-row-title { color:var(--agent-coral-deep); }
.fr-row-sub { display:block; font-size:11px; color:var(--agent-text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:1px; }
.fr-row-subline { display:flex; align-items:baseline; justify-content:space-between; gap:10px; margin-top:2px; }
.fr-row-subline .fr-row-sub { margin-top:0; flex:1; min-width:0; }
.fr-row-quiet { flex-shrink:0; font-size:11px; font-weight:650; white-space:nowrap; font-variant-numeric:tabular-nums; }

.fr-empty { margin:0; padding:20px 16px; font-size:12.5px; color:var(--agent-text-muted); line-height:1.5; }
/* Only sticky as a sidebar in the two-column layout; stacked below 1000px. */
@media (max-width:999px){ .fr { position:static; } }
`;

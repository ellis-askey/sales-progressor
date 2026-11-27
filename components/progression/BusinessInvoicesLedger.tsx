"use client";

// The business's client-invoice ledger (billing suite Phase 2): every invoice
// it has issued, with status (paid / awaiting / overdue), headline stats, a
// re-download, and mark paid/unpaid. Current-month drafts are sent from each
// client's page (Send invoice); this is the record of what's gone out.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { setClientInvoicePaidAction } from "@/app/actions/progression-clients";
import { RowActionsMenu, type RowAction } from "@/components/account/chrome/RowActionsMenu";
import type { LedgerInvoice, LedgerStats, LedgerStatus } from "@/lib/progression/client-invoice-list";

function money(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
const STATUS_LABEL: Record<LedgerStatus, string> = { sent: "Awaiting payment", paid: "Paid", overdue: "Overdue", void: "Void" };
const STATUS_TONE: Record<LedgerStatus, "info" | "success" | "danger" | "muted"> = { sent: "info", paid: "success", overdue: "danger", void: "muted" };

export function BusinessInvoicesLedger({ invoices, stats }: { invoices: LedgerInvoice[]; stats: LedgerStats }) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function setPaid(id: string, paid: boolean) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await setClientInvoicePaidAction(id, paid);
        if (res.ok) { toast.success(paid ? "Marked as paid" : "Marked as unpaid"); router.refresh(); }
        else toast.error(res.error);
      } catch { toast.error("Couldn't update. Try again."); }
      finally { setBusyId(null); }
    });
  }

  return (
    <div className="bil">
      <div className="bil-stats">
        <Stat label="Outstanding" value={money(stats.outstandingPence)} sub={`${stats.outstandingCount} invoice${stats.outstandingCount === 1 ? "" : "s"}`} />
        <Stat label="Overdue" value={money(stats.overduePence)} sub={`${stats.overdueCount} invoice${stats.overdueCount === 1 ? "" : "s"}`} tone={stats.overduePence > 0 ? "danger" : undefined} />
        <Stat label="Paid this month" value={money(stats.paidThisMonthPence)} sub="This calendar month" tone="success" />
      </div>

      {invoices.length === 0 ? (
        <div className="bil-empty">
          <p className="bil-empty-t">No invoices sent yet</p>
          <p className="bil-empty-s">Open a client and choose <strong>Send invoice</strong> to raise their first one. Every invoice you send shows here with its status.</p>
        </div>
      ) : (
        <div className="bil-list">
          {invoices.map((inv) => {
            const actions: RowAction[] = [
              { label: "Download PDF", onClick: () => window.open(`/api/agent/business/invoices/${inv.id}/pdf`, "_blank") },
              inv.status === "paid"
                ? { label: "Mark as unpaid", onClick: () => setPaid(inv.id, false) }
                : { label: "Mark as paid", onClick: () => setPaid(inv.id, true) },
            ];
            return (
              <div key={inv.id} className="bil-row" data-busy={busyId === inv.id || undefined}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="bil-row-top">
                    <span className="bil-row-client">{inv.agencyName}</span>
                    <StatusChip tone={STATUS_TONE[inv.status]} label={STATUS_LABEL[inv.status]} />
                  </div>
                  <div className="bil-row-meta">{inv.number} · {inv.periodLabel} · issued {fmtDate(inv.issuedAt)}{inv.status === "paid" ? ` · paid ${fmtDate(inv.paidAt)}` : inv.dueAt ? ` · due ${fmtDate(inv.dueAt)}` : ""}</div>
                </div>
                <div className="bil-row-amt">{money(inv.totalPence)}</div>
                <RowActionsMenu items={actions} label={`Actions for ${inv.agencyName} ${inv.number}`} />
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .bil-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 18px; }
        .bil-stat { background: var(--agent-surface-elevated, #fff); border: 1px solid var(--agent-border-subtle); border-radius: 16px; padding: 15px 17px; box-shadow: var(--agent-shadow-sm, 0 1px 2px rgba(16,24,40,0.04)); }
        .bil-stat-l { font-size: 12px; font-weight: 600; color: var(--agent-text-muted); }
        .bil-stat-v { font-size: 21px; font-weight: 800; margin-top: 6px; letter-spacing: -0.01em; }
        .bil-stat-s { font-size: 11.5px; color: var(--agent-text-muted); margin-top: 2px; }
        .bil-list { background: var(--agent-surface-elevated, #fff); border: 1px solid var(--agent-border-subtle); border-radius: 16px; overflow: hidden; }
        .bil-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-top: 0.5px solid var(--agent-border-subtle); }
        .bil-row:first-child { border-top: none; }
        .bil-row[data-busy] { opacity: 0.55; }
        .bil-row-top { display: flex; align-items: center; gap: 8px; }
        .bil-row-client { font-size: 14px; font-weight: 700; color: var(--agent-text-primary); }
        .bil-row-meta { font-size: 11.5px; color: var(--agent-text-muted); margin-top: 3px; }
        .bil-row-amt { font-size: 14px; font-weight: 700; white-space: nowrap; color: var(--agent-text-primary); }
        .bil-empty { text-align: center; padding: 48px 24px; background: var(--agent-surface-elevated, #fff); border: 1px solid var(--agent-border-subtle); border-radius: 16px; }
        .bil-empty-t { margin: 0; font-size: 15px; font-weight: 700; color: var(--agent-text-primary); }
        .bil-empty-s { margin: 6px auto 0; font-size: 13px; color: var(--agent-text-muted); line-height: 1.55; max-width: 42ch; }
        @media (max-width: 680px) { .bil-stats { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "success" | "danger" }) {
  const color = tone === "success" ? "var(--agent-success, #1F8A4A)" : tone === "danger" ? "var(--agent-danger, #C73E3E)" : "var(--agent-text-primary)";
  return (
    <div className="bil-stat">
      <div className="bil-stat-l">{label}</div>
      <div className="bil-stat-v" style={{ color }}>{value}</div>
      <div className="bil-stat-s">{sub}</div>
    </div>
  );
}

function StatusChip({ tone, label }: { tone: "info" | "success" | "danger" | "muted"; label: string }) {
  const map = {
    success: { background: "rgba(31,138,74,0.12)", color: "var(--agent-success, #1F8A4A)" },
    danger: { background: "rgba(199,62,62,0.12)", color: "var(--agent-danger, #C73E3E)" },
    info: { background: "rgba(37,99,235,0.12)", color: "#2563EB" },
    muted: { background: "var(--agent-hover-shade, rgba(0,0,0,0.06))", color: "var(--agent-text-muted)" },
  }[tone];
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", ...map }}>{label}</span>;
}

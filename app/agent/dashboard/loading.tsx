import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";

export default function DashboardLoading() {
  return (
    <>
      <PageHeader title="My Files" subtitle="All property files assigned to you.">
        <Link
          href="/agent/transactions/new"
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ textDecoration: "none" }}
        >
          <Plus size={14} weight="bold" />
          New sale
        </Link>
        <div className="agent-skeleton" style={{ height: 32, width: 168, borderRadius: 8 }} />
      </PageHeader>

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-5">
        {/* Filter tab bar */}
        <div style={{
          display: "flex", gap: 4, padding: 4,
          borderRadius: 12,
          background: "rgba(255,255,255,0.40)",
          overflowX: "auto",
        }}>
          {[48, 40, 68, 86, 80].map((w, i) => (
            <div key={i} className="agent-skeleton" style={{ height: 32, width: w, borderRadius: 8, flexShrink: 0 }} />
          ))}
        </div>

        {/* Transaction list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <TransactionSkeleton key={i} />
          ))}
        </div>
      </div>
    </>
  );
}

function TransactionSkeleton() {
  return (
    <div className="glass-card" style={{ padding: "14px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="agent-skeleton" style={{ height: 14, width: "62%", borderRadius: 6, marginBottom: 7 }} />
          <div className="agent-skeleton" style={{ height: 11, width: "38%", borderRadius: 6 }} />
        </div>
        <div className="agent-skeleton" style={{ height: 22, width: 58, borderRadius: 99, flexShrink: 0 }} />
      </div>
    </div>
  );
}

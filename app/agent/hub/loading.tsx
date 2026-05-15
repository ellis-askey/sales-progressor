import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";

function loadingGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
}

export default function HubLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

      <PageHeader title={loadingGreeting()} subtitle="Here's what matters today.">
        <Link
          href="/agent/transactions/new-v2"
          className="agent-btn agent-btn-primary agent-btn-sm"
          style={{ textDecoration: "none" }}
        >
          <Plus size={14} weight="bold" />
          New sale
        </Link>
        <div className="agent-skeleton" style={{ height: 32, width: 168, borderRadius: 8 }} />
      </PageHeader>

      {/* Content area */}
      <div className="hub-content-pad" style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* 1. Needs Attention */}
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="agent-skeleton" style={{ height: 13, width: 160, borderRadius: 6, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 11, width: 220, borderRadius: 6 }} />
            </div>
            <div className="agent-skeleton" style={{ height: 11, width: 80, borderRadius: 6 }} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              padding: "13px 20px 13px 17px",
              borderLeft: "3px solid var(--agent-border-subtle)",
              borderTop: i > 1 ? "0.5px solid var(--agent-border-subtle)" : undefined,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6, marginBottom: 5 }} />
                <div className="agent-skeleton" style={{ height: 11, width: 140, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ height: 22, width: 60, borderRadius: 99 }} />
            </div>
          ))}
        </div>

        {/* 2. Pipeline Health + Momentum */}
        <div className="hub-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>

          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 20 }}>
              <div className="agent-skeleton" style={{ height: 11, width: 110, borderRadius: 6, marginBottom: 6 }} />
              <div className="agent-skeleton" style={{ height: 12, width: 200, borderRadius: 6 }} />
            </div>
            <div className="hub-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[120, 80, 70, 110].map((w, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div className="agent-skeleton" style={{ height: 26, width: w, borderRadius: 6 }} />
                  <div className="agent-skeleton" style={{ height: 11, width: 60, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="agent-glass" style={{ padding: "20px 24px", display: "flex", flexDirection: "column" }}>
            <div className="agent-skeleton" style={{ height: 11, width: 80, borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 12, width: 160, borderRadius: 6, marginBottom: 16 }} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div className="agent-skeleton" style={{ width: 100, height: 100, borderRadius: "50%" }} />
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12, marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="agent-skeleton" style={{ height: 12, width: 72, borderRadius: 6 }} />
                  <div className="agent-skeleton" style={{ height: 12, width: 80, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Exchange Forecast + Service Split */}
        <div className="hub-grid-half" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div className="agent-skeleton" style={{ height: 11, width: 130, borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 12, width: 210, borderRadius: 6, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 70, marginBottom: 12 }}>
              {[45, 65, 80, 50, 35].map((h, i) => (
                <div key={i} className="agent-skeleton" style={{ flex: 1, height: h, borderRadius: 3 }} />
              ))}
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <div className="agent-skeleton" style={{ height: 12, width: 70, borderRadius: 6 }} />
                  <div className="agent-skeleton" style={{ height: 12, width: 80, borderRadius: 6 }} />
                </div>
              ))}
            </div>
          </div>

          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div className="agent-skeleton" style={{ height: 11, width: 100, borderRadius: 6, marginBottom: 6 }} />
            <div className="agent-skeleton" style={{ height: 12, width: 190, borderRadius: 6, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 14 }}>
              <div className="agent-skeleton" style={{ width: 80, height: 80, borderRadius: "50%", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div className="agent-skeleton" style={{ width: 10, height: 10, borderRadius: 2 }} />
                      <div className="agent-skeleton" style={{ height: 12, width: 90, borderRadius: 6 }} />
                    </div>
                    <div className="agent-skeleton" style={{ height: 12, width: 30, borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 10 }}>
              <div className="agent-skeleton" style={{ height: 12, width: "65%", borderRadius: 6 }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

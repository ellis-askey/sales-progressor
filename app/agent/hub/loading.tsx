import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";

function loadingGreeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 17 ? "Good afternoon." : "Good evening.";
}

// Bespoke domain composer per Skeleton.tsx's contract — encodes the
// hub-grid layout knowledge that isn't a primitive concern. Inner rows
// wrap the canonical Skeleton primitive (mirrors PanelSkeletons.tsx
// from Wave A4 of Surface 1).
type BarStyle = {
  width: string | number;
  height: number;
  mt?: number;
  mb?: number;
  radius?: number | string;
  flex?: number;
};

function Bar({ width, height, mt = 0, mb = 0, radius = 6, flex }: BarStyle) {
  return (
    <Skeleton
      variant="block"
      width={width}
      height={height}
      style={{
        borderRadius: radius,
        marginTop: mt,
        marginBottom: mb,
        display: "block",
        ...(flex !== undefined && { flex }),
      }}
    />
  );
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
        <Bar width={168} height={32} radius={8} />
      </PageHeader>

      {/* Content area */}
      <div className="hub-content-pad" style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* 1. Needs Attention */}
        <div className="agent-glass-strong" style={{ borderRadius: "var(--agent-radius-xl)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--agent-border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <Bar width={160} height={13} mb={6} />
              <Bar width={220} height={11} />
            </div>
            <Bar width={80} height={11} />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              padding: "13px 20px 13px 17px",
              borderLeft: "3px solid var(--agent-border-subtle)",
              borderTop: i > 1 ? "0.5px solid var(--agent-border-subtle)" : undefined,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <Bar width={200} height={12} mb={5} />
                <Bar width={140} height={11} />
              </div>
              <Bar width={60} height={22} radius={99} />
            </div>
          ))}
        </div>

        {/* 2. Pipeline Health + Momentum */}
        <div className="hub-grid-main" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>

          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <div style={{ marginBottom: 20 }}>
              <Bar width={110} height={11} mb={6} />
              <Bar width={200} height={12} />
            </div>
            <div className="hub-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[120, 80, 70, 110].map((w, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <Bar width={w} height={26} />
                  <Bar width={60} height={11} />
                </div>
              ))}
            </div>
          </div>

          <div className="agent-glass" style={{ padding: "20px 24px", display: "flex", flexDirection: "column" }}>
            <Bar width={80} height={11} mb={6} />
            <Bar width={160} height={12} mb={16} />
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Skeleton variant="circle" width={100} style={{ display: "block" }} />
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 12, marginTop: 12, display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <Bar width={72} height={12} />
                  <Bar width={80} height={12} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Exchange Forecast + Service Split */}
        <div className="hub-grid-half" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <Bar width={130} height={11} mb={6} />
            <Bar width={210} height={12} mb={16} />
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 70, marginBottom: 12 }}>
              {[45, 65, 80, 50, 35].map((h, i) => (
                <Bar key={i} width="auto" height={h} radius={3} flex={1} />
              ))}
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1].map((i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                  <Bar width={70} height={12} />
                  <Bar width={80} height={12} />
                </div>
              ))}
            </div>
          </div>

          <div className="agent-glass" style={{ padding: "20px 24px" }}>
            <Bar width={100} height={11} mb={6} />
            <Bar width={190} height={12} mb={16} />
            <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 14 }}>
              <Skeleton variant="circle" width={80} style={{ display: "block", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {[0, 1].map((i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Bar width={10} height={10} radius={2} />
                      <Bar width={90} height={12} />
                    </div>
                    <Bar width={30} height={12} />
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 10 }}>
              <Bar width="65%" height={12} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

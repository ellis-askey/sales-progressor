import { PageHeader } from "@/components/layout/PageHeader";

export default function NewSaleLoading() {
  return (
    <div>
      <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
      <div className="px-4 md:px-8 pt-2 pb-8">
        <div className="new-sale-two-col">
          <div className="new-sale-form-col">
            <div className="agent-glass-strong" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div className="agent-skeleton" style={{ width: 180, height: 20, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ width: 260, height: 14, borderRadius: 6 }} />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="agent-skeleton" style={{ width: "80%", height: 40, borderRadius: 8 }} />
              </div>
              <div className="agent-skeleton" style={{ width: "60%", height: 40, borderRadius: 8 }} />
              <div className="agent-skeleton" style={{ width: 160, height: 14, borderRadius: 6 }} />
            </div>
          </div>
          <div className="new-sale-right-col">
            <div className="agent-glass-strong" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="agent-skeleton" style={{ width: 120, height: 16, borderRadius: 6 }} />
              <div className="agent-skeleton" style={{ width: "100%", height: 38, borderRadius: 8 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                <div className="agent-skeleton" style={{ width: 180, height: 13, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ width: 160, height: 13, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ width: 200, height: 13, borderRadius: 6 }} />
                <div className="agent-skeleton" style={{ width: 150, height: 13, borderRadius: 6 }} />
              </div>
              <div className="agent-skeleton" style={{ width: 130, height: 11, borderRadius: 6 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

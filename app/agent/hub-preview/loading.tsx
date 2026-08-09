import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function HubPreviewLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title="Hub" subtitle="Preview surface." />
      <div className="hub-content-pad" style={{ padding: "8px 32px 24px" }}>
        <LoadingCard label="Loading hub preview" />
      </div>
    </div>
  );
}

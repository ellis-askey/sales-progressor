import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function AnalyticsPreviewLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title="Analytics" subtitle="Preview surface." />
      <div className="px-4 py-5 sm:px-8">
        <LoadingCard label="Loading analytics preview" minHeight={220} />
      </div>
    </div>
  );
}

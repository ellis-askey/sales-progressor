import { PageHeader } from "@/components/layout/PageHeader";

export default function AnalyticsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title="Analytics" subtitle="Performance and revenue across your pipeline." />
      <div className="px-4 py-5 sm:px-8">
      </div>
    </div>
  );
}

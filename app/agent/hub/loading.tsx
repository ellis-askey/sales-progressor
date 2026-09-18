// Instant-shell route fallback for the Hub (2026-09-18): the greeting bar
// and section silhouettes appear immediately; the live sections stream in
// over them. Replaces the old deliberately-empty loader - the founder's
// direction is "land on the page and watch it fill", not a blank pause.
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionSkeleton } from "@/components/loading/PageSkeletons";

export default function HubLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PageHeader title={" "} subtitle={" "} />
      <div
        className="hub-content-pad"
        style={{ padding: "8px 32px 24px", display: "flex", flexDirection: "column", gap: 20 }}
      >
        <SectionSkeleton minHeight={140} rows={2} label="Loading your hub" />
        <SectionSkeleton minHeight={220} rows={4} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          <SectionSkeleton minHeight={200} rows={3} />
          <SectionSkeleton minHeight={200} rows={3} />
        </div>
      </div>
    </div>
  );
}

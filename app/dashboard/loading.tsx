import { SpLoadingShell } from "@/components/layout/SpLoadingShell";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function DashboardLoading() {
  return (
    <SpLoadingShell>
      <div className="max-w-7xl mx-auto px-8 py-7">
        <LoadingCard label="Loading dashboard" minHeight={240} />
      </div>
    </SpLoadingShell>
  );
}

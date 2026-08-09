import { SpLoadingShell } from "@/components/layout/SpLoadingShell";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function TasksLoading() {
  return (
    <SpLoadingShell>
      <div className="max-w-7xl mx-auto px-8 py-7">
        <LoadingCard label="Loading tasks" minHeight={220} />
      </div>
    </SpLoadingShell>
  );
}

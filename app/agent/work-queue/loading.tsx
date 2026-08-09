import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function WorkQueueLoading() {
  return (
    <>
      <PageHeader title="Reminders" subtitle="What needs chasing, today and ahead." />
      <div className="px-4 py-4 sm:px-8">
        <LoadingCard label="Loading reminders" minHeight={200} />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function CommsLoading() {
  return (
    <>
      <PageHeader title="Updates" subtitle="What's happened across your files." />
      <div className="px-4 py-4 sm:px-8">
        <LoadingCard label="Loading updates" minHeight={200} />
      </div>
    </>
  );
}

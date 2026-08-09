import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function CompletionsLoading() {
  return (
    <>
      <PageHeader title="Completions" subtitle="Exchanged files, tracking to completion." />
      <div className="px-4 py-4 sm:px-8">
        <LoadingCard label="Loading completions" minHeight={200} />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function TodoLoading() {
  return (
    <>
      <PageHeader title="To-Do" subtitle="Your notes, plus anything you've flagged to your progressor." />
      <div className="px-4 py-4 sm:px-8">
        <LoadingCard label="Loading your to-do list" minHeight={180} />
      </div>
    </>
  );
}

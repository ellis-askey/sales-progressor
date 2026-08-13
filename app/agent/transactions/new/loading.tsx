import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function NewSaleLoading() {
  return (
    <div>
      <PageHeader title="New sale" subtitle="Drop your memo of sale to get started, or fill in manually." />
      <div className="px-4 md:px-8 pt-2 pb-8">
        <LoadingCard label="Loading" minHeight={200} />
      </div>
    </div>
  );
}

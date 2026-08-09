import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function AgentLoading() {
  return (
    <>
      <PageHeader title="Loading" subtitle=" " />
      <div className="px-4 md:px-8 py-2 md:py-4">
        <LoadingCard />
      </div>
    </>
  );
}

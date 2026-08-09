/* Loading state for /agent/transactions. Header title is role-dependent
 * ("All Files" director / "My Files" negotiator) and can't be determined
 * pre-fetch, so we render a neutral "Loading" title. The real page swaps
 * in with the correct heading once role + files resolve. */

import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingCard } from "@/components/loading/LoadingCard";

export default function TransactionListLoading() {
  return (
    <>
      <PageHeader title="Loading" subtitle=" " />
      <div className="px-4 py-4 sm:px-8">
        <LoadingCard label="Loading your files" minHeight={220} />
      </div>
    </>
  );
}

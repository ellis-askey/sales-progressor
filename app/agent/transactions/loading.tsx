/* Loading state for /agent/transactions. Header title is role-dependent
 * ("All Files" director / "My Files" negotiator) and can't be determined
 * pre-fetch, so we render a neutral "Loading" title. The real page swaps
 * in with the correct heading once role + files resolve. */

import { PageHeader } from "@/components/layout/PageHeader";

export default function TransactionListLoading() {
  return (
    <>
      <PageHeader title={" "} subtitle={" "} />
      <div className="px-4 py-4 sm:px-8">
      </div>
    </>
  );
}

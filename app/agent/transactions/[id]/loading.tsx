// Route-level fallback for the file page. Phase 3 perceived-performance
// (2026-09-18, PERF-06): a file-shaped skeleton instead of the old
// full-viewport LoadingCard bubble — navigation into a file paints the
// file's silhouette immediately, and cold deep-links get an early shell
// flush. This is deliberately the only route-level loader left in the
// agent app (see FilePageSkeleton's docstring for why).
import { FilePageSkeleton } from "@/components/transaction/PanelSkeletons";

export default function AgentTransactionLoading() {
  return <FilePageSkeleton />;
}

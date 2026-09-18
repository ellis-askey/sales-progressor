// Instant-shell route fallback (2026-09-18): navigation commits to this
// page immediately and its silhouette appears in place; real content swaps
// in as it arrives. Most rail clicks never show this at all - the rail
// fully prefetches its destinations - so this covers cold visits, hard
// refreshes and deep links.
import { RailPageSkeleton } from "@/components/loading/PageSkeletons";

export default function Loading() {
  return <RailPageSkeleton title={"Partner"} variant={"list"} rows={5} />;
}

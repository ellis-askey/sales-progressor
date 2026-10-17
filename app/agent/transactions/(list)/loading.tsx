// Instant-shell route fallback. Navigation commits immediately and the page
// TITLE paints in place; the body stays quiet (no skeleton) until the real
// content blooms in. Most rail clicks never show this — the rail prefetches —
// so it covers cold visits, hard refreshes and deep links.
import { RailPageSkeleton } from "@/components/loading/PageSkeletons";

export default function Loading() {
  return <RailPageSkeleton title={"My Files"} variant={"table"} rows={8} />;
}

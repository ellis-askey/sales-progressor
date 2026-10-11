import { notFound } from "next/navigation";
import { SoldForGame } from "./SoldForGame";

// PARKED (2026-10-11): dev-only prototype of the "Sold for…?" loading game,
// originally destined for the new-sale SubmissionOverlay wait. That wait got
// fixed, so there's currently nowhere slow enough to need it — kept intact for
// a future home. Fully playable here. 404 in production (same prod-block
// convention as the rest of /dev).
export default function SoldForDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SoldForGame />;
}

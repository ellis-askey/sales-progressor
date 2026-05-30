import { PreviewClient } from "./PreviewClient";

// Throwaway preview route. Lets Ellis click through four graphic directions
// of the welcome modal + tour and pick one. Nothing here is wired to prod —
// the live modal keeps its current visuals until a direction is chosen.
// Delete this folder once a direction is picked.
export default function OnboardingTourPreviewPage() {
  return <PreviewClient />;
}

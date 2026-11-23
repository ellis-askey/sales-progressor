// A file's position along the six conveyancing stages. Thin wrapper over the
// canonical StageBar (components/ui/StageBar.tsx) so consumers keep importing
// JourneyBar. Hovering the bar reveals the full journey (see JourneyHover in
// TransactionRowView). Fed by the file's board stage. See display-stages.ts.

import { StageBar } from "@/components/ui/StageBar";
import type { DisplayStageKey } from "@/lib/milestones/display-stages";

export function JourneyBar({ stage, complete }: { stage: DisplayStageKey; complete?: boolean }) {
  return <StageBar stage={stage} complete={complete} />;
}

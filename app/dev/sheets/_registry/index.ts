// The assembled catalogue. Each type lives in its own file so adding a new
// drawer/modal/notice to the QA harness is a one-file edit. Order here sets
// the section order on the page.

import type { SheetEntry } from "./types";
import { DESIGN_BENCH_ENTRIES } from "./design-bench";
import { DRAWER_ENTRIES } from "./drawers";
import { MODAL_ENTRIES } from "./modals";
import { NOTIFICATION_ENTRIES } from "./notifications";

export const REGISTRY: SheetEntry[] = [
  ...DESIGN_BENCH_ENTRIES,
  ...DRAWER_ENTRIES,
  ...MODAL_ENTRIES,
  ...NOTIFICATION_ENTRIES,
];

// Fail loud in dev if two entries share an id (would corrupt verification).
const seen = new Set<string>();
for (const e of REGISTRY) {
  if (seen.has(e.id)) {
    // eslint-disable-next-line no-console
    console.error(`[dev/sheets] duplicate registry id: ${e.id}`);
  }
  seen.add(e.id);
}

export type { SheetEntry } from "./types";

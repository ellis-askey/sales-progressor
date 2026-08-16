import { getMilestoneCopy } from "@/lib/portal-copy";
import { getDefaultUpdateCore } from "@/lib/updates-copy";

// The milestone list for the Command Centre "Milestone updates" editor. Every
// code that has update copy, both sides, in flow order (includes the hidden
// enquiry sub-steps VM11-15 / PM15-19 per founder request).

export type UpdateStep = { code: string; label: string; side: "vendor" | "purchaser" };

const VENDOR_ORDER = [
  "VM1", "VM2", "VM3", "VM4", "VM5", "VM6", "VM7", "VM8", "VM9", "VM10",
  "VM11", "VM12", "VM13", "VM14", "VM15", "VM16", "VM17", "VM18", "VM21", "VM19", "VM20",
];
const PURCHASER_ORDER = [
  "PM1", "PM2", "PM3", "PM4", "PM5", "PM6", "PM11", "PM9", "PM10", "PM7", "PM8",
  "PM12", "PM13", "PM14", "PM15", "PM16", "PM17", "PM18", "PM19", "PM20", "PM21",
  "PM22", "PM23", "PM24", "PM25", "PM26", "PM27",
];

export function buildUpdateStepList(): UpdateStep[] {
  const mk = (codes: string[], side: "vendor" | "purchaser"): UpdateStep[] =>
    codes
      .filter((c) => getDefaultUpdateCore(c) !== null)
      .map((c) => ({ code: c, label: getMilestoneCopy(c).label, side }));
  return [...mk(PURCHASER_ORDER, "purchaser"), ...mk(VENDOR_ORDER, "vendor")];
}

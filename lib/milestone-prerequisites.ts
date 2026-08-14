// Canonical direct-prerequisite map — no server imports, safe for client bundles.
// Mirrors DIRECT_PREREQUISITES in lib/services/milestones.ts (import from here instead).
//
// Enquiries rework (docs/active/enquiries-stage-rework-SPEC.md): the per-round
// enquiry sub-steps (buyer PM15-19, seller VM11-15) are retired — see
// RETIRED_ENQUIRY_CODES below. PM20 "satisfied" now depends directly on PM14
// "raised" (no phantom intermediate chain), and a new seller-side mirror VM21
// "enquiries satisfied" depends on VM10 "received".
export const DIRECT_PREREQUISITES: Record<string, string[]> = {
  VM3:  ["VM1"],
  VM4:  ["VM3"],
  VM5:  ["VM4"],
  VM6:  ["VM5"],
  VM7:  ["VM6"],
  VM9:  ["VM8"],
  VM10: ["VM7"],
  VM21: ["VM10"],
  VM16: ["VM7"],
  VM17: ["VM16"],
  VM19: ["VM18"],
  VM20: ["VM19"],
  PM3:  ["PM1"],
  PM4:  ["PM1"],
  PM6:  ["PM5"],
  PM7:  ["PM4"],
  PM8:  ["PM7"],
  PM10: ["PM9"],
  PM11: ["PM6"],
  PM12: ["VM9"],
  PM13: ["PM8"],
  PM14: ["PM7"],
  PM20: ["PM14"],
  PM21: ["PM20"],
  PM22: ["PM21"],
  PM23: ["PM22"],
  PM24: ["PM23"],
  PM26: ["PM25"],
  PM27: ["PM26"],
};

// The enquiry sub-steps collapsed away by the enquiries rework. Their
// MilestoneDefinition rows still exist (hard-deleted in a later stage so
// existing files' completion rows don't orphan), but they no longer gate
// exchange, carry weight, or act as prerequisites. New files never create
// them, and every display list filters them out.
export const RETIRED_ENQUIRY_CODES: ReadonlySet<string> = new Set([
  "PM15", "PM16", "PM17", "PM18", "PM19",
  "VM11", "VM12", "VM13", "VM14", "VM15",
]);

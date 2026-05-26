// Canonical milestone section grouping for vendor + purchaser sides.
// Used by:
//   - components/milestones/MilestonePanel.tsx (agent file Steps tab)
//   - app/admin/migrate/MigrateSaleForm.tsx (admin migration form)
// Keeping the section definitions in one place means a re-grouping or new
// section only needs to be added here.
//
// Section labels match the agent file's Steps tab grouping; colours live
// alongside in MilestonePanel (SECTION_COLORS) and stay there since the
// migration form doesn't use the colour palette.

export const VENDOR_SECTIONS: { label: string; codes: string[] }[] = [
  { label: "Onboarding",            codes: ["VM1","VM2","VM3","VM4","VM5","VM6"] },
  { label: "Conveyancing",          codes: ["VM7","VM8","VM9","VM10","VM11","VM12","VM13","VM14","VM15","VM16","VM17"] },
  { label: "Exchange & Completion", codes: ["VM18","VM19","VM20"] },
];

export const PURCHASER_SECTIONS: { label: string; codes: string[] }[] = [
  { label: "Onboarding",            codes: ["PM1","PM2","PM3","PM4"] },
  { label: "Finances",              codes: ["PM5","PM6","PM11","PM9","PM10"] },
  { label: "Conveyancing",          codes: ["PM7","PM8","PM12","PM13","PM14","PM15","PM16","PM17","PM18","PM19","PM20","PM21","PM22","PM23","PM24"] },
  { label: "Exchange & Completion", codes: ["PM25","PM26","PM27"] },
];

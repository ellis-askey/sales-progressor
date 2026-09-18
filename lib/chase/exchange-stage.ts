// Milestone codes from "all enquiries satisfied" onward, where it is
// appropriate for chase or client-facing copy to mention exchange or completion.
// Before this (instruction, forms, ID, searches, enquiries), talking about
// exchange is premature and reads as wrong to clients. Gate exchange language on
// this set. See docs/active/keep-other-side-posted/00-spec.md §11.
export const EXCHANGE_STAGE_CODES = new Set<string>([
  "VM15", "VM16", "VM17", "VM18", "VM19", "VM20",
  "PM20", "PM21", "PM22", "PM23", "PM24", "PM25", "PM26", "PM27",
]);

export function exchangeTalkAllowed(codes: Array<string | null | undefined>): boolean {
  return codes.some((c) => !!c && EXCHANGE_STAGE_CODES.has(c));
}

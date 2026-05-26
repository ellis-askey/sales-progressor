// When the user manually marks a milestone Not Required, certain downstream
// milestones cascade — they're also marked N/R automatically. Pure data
// module, no server imports — safe for both server (markNotRequiredWith
// Cascade in lib/services/milestones.ts) and client (MilestonePanel
// optimistic cascade so the downstream rows vanish the moment the user
// confirms N/R, without waiting for the server roundtrip).
//
// Single source of truth. Adding a new cascade pair means editing this
// file and nothing else.
//
// Current pairs:
//   PM9 (Survey booking) Not Required → PM10 (Survey report) also N/R

export const NR_CASCADE: Record<string, string[]> = {
  PM9: ["PM10"],
};

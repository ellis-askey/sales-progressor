// The five "who is this for" email audience buckets + their labels. This is the
// canonical, PURE definition (no prisma, no server-only) so it is safe to import
// from both the send pipeline (lib/email/*) and the Command Centre catalogue UI.
// The on/off state lives in lib/email/bucket-toggles.ts (server-only).
//
// NOT under lib/command — the send pipeline must be able to import it (Law 8).

export type AudienceBucket =
  | "platform_admin" // password reset, verification, domain auth — always on, locked
  | "tsp_outsourced" // client-facing emails on files WE progress
  | "free_agency" // emails for self-managed agencies (their client + lifecycle emails)
  | "progression_invite" // invites an external business sends (client agent + teammate + welcome)
  | "external_progression"; // client-facing emails on files an EXTERNAL business progresses

export const AUDIENCE_LABEL: Record<AudienceBucket, string> = {
  platform_admin: "TSP admin",
  tsp_outsourced: "TSP outsourced sales",
  free_agency: "Free-agency emails",
  progression_invite: "Progression-business invites",
  external_progression: "External progression",
};

export const AUDIENCE_BUCKETS: AudienceBucket[] = [
  "platform_admin",
  "tsp_outsourced",
  "free_agency",
  "progression_invite",
  "external_progression",
];

// Buckets whose emails can never be switched off (the product breaks without them).
export const LOCKED_BUCKETS: ReadonlySet<AudienceBucket> = new Set<AudienceBucket>(["platform_admin"]);

// Which bucket a file-driven email lands in, from who runs the file.
//  - no progression business            -> self-managed agency  -> free_agency
//  - progression business, isTsp         -> we progress it       -> tsp_outsourced
//  - progression business, external      -> outside firm         -> external_progression
export function fileBucket(ctx: { progressionBusinessId: string | null; isTsp: boolean }): AudienceBucket {
  if (!ctx.progressionBusinessId) return "free_agency";
  return ctx.isTsp ? "tsp_outsourced" : "external_progression";
}

// Invite-to-move feature flag (docs/active/invite-to-move/SPEC.md, D5).
//
// When OFF (default), the negotiator invite keeps today's behaviour: it hard-
// stops on an email that already has an account. When ON, an existing account
// is instead sent a "move to this agency" invite it can accept. Ships dark so
// it can be switched on deliberately, exactly like SIGNUP_JOIN_REQUESTS_ENABLED.
export function moveInvitesEnabled(): boolean {
  return process.env.MOVE_INVITES_ENABLED === "true";
}

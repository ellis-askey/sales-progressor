// Progression-businesses feature flag (docs/active/progression-businesses/).
//
// When OFF (default), the external progression-business surfaces stay dark:
// business onboarding, client management, and create-sale-for-client. It gates
// ONLY those new entry points. The security boundary (access scope), the
// identity resolver, and notes enforcement are NOT gated by this flag — they
// are data-driven and inert until an external progressionBusinessId actually
// exists — so the system is hardened before the flag is ever switched on.
// Ships dark, exactly like MOVE_INVITES_ENABLED / SIGNUP_JOIN_REQUESTS_ENABLED.
export function progressionBusinessesEnabled(): boolean {
  return process.env.PROGRESSION_BUSINESSES_ENABLED === "true";
}

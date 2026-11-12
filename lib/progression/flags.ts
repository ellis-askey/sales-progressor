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

// Outsourced-sunset master switch (docs/active/outsourced-sunset/). TSP is winding
// down its OWN done-for-you progression. When this is OFF, a new agent can no longer
// hand a sale to TSP's team: the agent->TSP new-intake path (new-sale "Send to us"
// and the file-page "Switch to TSP" handover) is closed. The replacement is an
// introduction to an external progression business.
//
// "Gate, don't delete": the outsourced code stays in place, wrapped behind this flag;
// reverting is a flag flip, no rework. It defaults ON (absent / anything but the exact
// string "false" = today's behaviour, byte-identical), so the gate is INERT until
// OUTSOURCED_INTAKE_ENABLED=false is set — matching the gate-don't-delete plan.
//
// Scope is deliberately narrow. It gates ONLY new agent->TSP intake (and, in a later
// commit, the outsourced marketing copy). It NEVER gates: internal servicing of the
// existing book (the assigned-progressor workflow, billing-at-exchange for in-flight
// files), the access-scope security boundary, or the external progression-business
// model (£59/£39/£5) — which TSP keeps and grows. External-progressor routing
// (a non-null progressionBusinessId) stays open regardless of this flag.
export function outsourcedIntakeEnabled(): boolean {
  return process.env.OUTSOURCED_INTAKE_ENABLED !== "false";
}

// Collection switch for business->TSP billing (Arc B4). When OFF (default), the
// billing is DARK: the bill is computed + shown, the £5/sale is accrued, but no
// Stripe customer/subscription is created and no money is taken. Flip ON (plus the
// STRIPE_PRICE_BUSINESS_* env vars) to start charging — exactly like the agency
// BILLING_AUTO_ISSUE_ENABLED switch. Nothing charges until this is true.
export function progressionBillingCollectEnabled(): boolean {
  return process.env.PROGRESSION_BILLING_COLLECT === "true";
}

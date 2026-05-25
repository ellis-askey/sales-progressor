// PR 6 verification — pricing acknowledgement gate.
//
// Walks the state machine in lib/billing/payment-method-state.ts:
//
//   1. Empty TermsVersion table → state = "pending".
//      Proves the PR 6 ship state: no terms row, form blocked, no
//      disclosure rendered, no card-form access.
//
//   2. Insert an obviously-fake throwaway TermsVersion row (visible "DO
//      NOT USE" markers so a human reading staging knows this is a test
//      artefact) → state = "disclosure" with the fake body.
//      Proves the gate unlocks when terms exist + reads body from DB.
//
//   3. Record an acknowledgement via the helper (mimicking the API
//      endpoint's logic) → state = "card_form".
//      Proves the row is written with denormalised name/email and the
//      state transitions cleanly.
//
//   4. The PricingAcknowledgement row has the expected shape:
//      acknowledgedByName + acknowledgedByEmail as strings; FK to
//      TermsVersion pointing at the fake row; FK to User set; timestamp.
//
//   5. Re-running getPaymentMethodState is idempotent — still card_form,
//      no extra rows written.
//
//   6. Insert a SECOND TermsVersion (newer effectiveFrom) → state drops
//      back to "disclosure" because the agency hasn't acknowledged the
//      NEW terms. Proves terms revisions force fresh acknowledgement
//      (FK targets a different TermsVersion.id).
//
//   7. CLEANUP: delete fake TermsVersion rows + all PR6 test data.
//      Confirms staging TermsVersion table returns to EMPTY (0 rows)
//      so prod and staging are aligned — no placeholder ever sticks.
//
// The Stripe Customer creation + SetupIntent flow is NOT exercised here
// (no fake Stripe calls); that's a browser smoke test against staging
// when Stripe test keys are wired. State machine + acknowledgement +
// /api/billing/setup-intent guard logic is what's testable in script.
//
// Run: npx ts-node --transpile-only --compiler-options
//        '{"module":"CommonJS","moduleResolution":"node","baseUrl":".",
//          "paths":{"@/*":["./*"]}}'
//        --require tsconfig-paths/register
//        scripts/verify-pr6-acknowledgement-gate-staging.ts

// Set placeholder Stripe env vars so isStripeConfigured() returns true and
// the state machine can be observed transitioning across the
// terms/acknowledgement states (the real focus of this PR). The verifier
// makes no actual Stripe API calls — Stripe Customer creation + SetupIntent
// flow is browser-tested separately. Placeholders chosen with obvious
// "VERIFY-FAKE" prefix so they'd never accidentally be used as real keys.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_VERIFY_FAKE_pr6";
process.env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "pk_test_VERIFY_FAKE_pr6";

import { PrismaClient } from "@prisma/client";
import { getPaymentMethodState } from "../lib/billing/payment-method-state";
import { recordAcknowledgement, hasAcknowledged, getActiveTermsVersion } from "../lib/billing/acknowledgement";

const p = new PrismaClient();
const TEST_PREFIX = "PR6-VERIFY-";
const FAKE_TERMS_TAG_1 = "PR6-VERIFY-throwaway-v1-DO-NOT-USE";
const FAKE_TERMS_TAG_2 = "PR6-VERIFY-throwaway-v2-DO-NOT-USE";
const FAKE_TERMS_BODY = "[THROWAWAY TEST ROW — DO NOT USE — created by scripts/verify-pr6-acknowledgement-gate-staging.ts. If you are reading this in production, something has gone wrong and you should delete this row.]";

async function cleanup() {
  // Children before parents — and clean by BOTH our agency prefix and the
  // fake terms tags so a partial prior run can't leave orphans.
  await p.pricingAcknowledgement.deleteMany({
    where: {
      OR: [
        { agency: { name: { startsWith: TEST_PREFIX } } },
        { termsVersion: { versionTag: { startsWith: TEST_PREFIX } } },
      ],
    },
  });
  await p.termsVersion.deleteMany({ where: { versionTag: { startsWith: TEST_PREFIX } } });
  await p.user.deleteMany({ where: { agency: { name: { startsWith: TEST_PREFIX } } } });
  await p.agency.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
}

function divider(label: string): void {
  console.log("");
  console.log(`── ${label} ${"─".repeat(Math.max(0, 70 - label.length))}`);
}

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

async function main() {
  await cleanup();

  try {
    // Setup: one fresh test agency + user (director) to act as the
    // acknowledging session subject.
    const agency = await p.agency.create({
      data: {
        name: `${TEST_PREFIX}agency`,
        firstSubmissionAt: new Date("2025-01-01"),
        // Defensive: ensure no leftover stripeCustomerId from earlier run
        stripeCustomerId: null,
      },
    });
    const user = await p.user.create({
      data: {
        name: "PR6 Test Director",
        email: `${TEST_PREFIX}director@example.test`,
        password: "x",
        role: "director",
        agencyId: agency.id,
      },
    });

    // ─── Scenario 1 ────────────────────────────────────────────────────
    divider("1. Empty TermsVersion → state = pending");
    const beforeTermsCount = await p.termsVersion.count();
    const state1 = await getPaymentMethodState(agency.id);
    console.log(`  TermsVersion rows in DB before insert: ${beforeTermsCount}`);
    console.log(`  state.kind: ${state1.kind}`);
    check("baseline: 0 TermsVersion rows (staging clean)", beforeTermsCount === 0);
    check("state = 'pending' when no terms exist", state1.kind === "pending");

    // ─── Scenario 2 ────────────────────────────────────────────────────
    divider("2. Insert fake TermsVersion → state = disclosure (body from DB)");
    const fakeTerms1 = await p.termsVersion.create({
      data: {
        versionTag: FAKE_TERMS_TAG_1,
        bodySections: [{ heading: "Throwaway", body: FAKE_TERMS_BODY }],
        // Past timestamp so getActiveTermsVersion (filters effectiveFrom
        // <= now()) immediately considers it active. Leaves headroom for
        // scenario 6's "newer" row.
        effectiveFrom: new Date(Date.now() - 2000),
      },
    });
    const state2 = await getPaymentMethodState(agency.id);
    console.log(`  state.kind: ${state2.kind}`);
    console.log(`  state.terms?.versionTag: ${state2.kind === "disclosure" ? state2.terms.versionTag : "n/a"}`);
    console.log(`  state.terms?.sections[0].body[:80]: ${state2.kind === "disclosure" ? state2.terms.sections[0].body.slice(0, 80) + "…" : "n/a"}`);
    check("state = 'disclosure' once a terms row exists", state2.kind === "disclosure");
    if (state2.kind === "disclosure") {
      check("disclosure renders FROM the DB row, not hardcoded copy",
        state2.terms.sections[0]?.body === FAKE_TERMS_BODY);
      check("disclosure tag = the seeded fake tag",
        state2.terms.versionTag === FAKE_TERMS_TAG_1);
    }

    // ─── Scenario 3 ────────────────────────────────────────────────────
    divider("3. Record acknowledgement → state transitions to card_form");
    await recordAcknowledgement({
      agencyId: agency.id,
      userId: user.id,
      userName: user.name!,
      userEmail: user.email!,
      termsVersionId: fakeTerms1.id,
    });
    const state3 = await getPaymentMethodState(agency.id);
    console.log(`  state.kind after acknowledgement: ${state3.kind}`);
    check("state = 'card_form' after acknowledgement", state3.kind === "card_form");
    if (state3.kind === "card_form") {
      check("card_form still carries the active terms reference",
        state3.terms.id === fakeTerms1.id);
    }

    // ─── Scenario 4 ────────────────────────────────────────────────────
    divider("4. PricingAcknowledgement row shape: denormalised name/email + FK to user + tag");
    const ackRow = await p.pricingAcknowledgement.findFirst({
      where: { agencyId: agency.id, termsVersionId: fakeTerms1.id },
      include: { termsVersion: { select: { versionTag: true } }, acknowledgedBy: { select: { id: true } } },
    });
    console.log(`  acknowledgedByName:  ${ackRow?.acknowledgedByName}`);
    console.log(`  acknowledgedByEmail: ${ackRow?.acknowledgedByEmail}`);
    console.log(`  acknowledgedByUserId: ${ackRow?.acknowledgedByUserId}`);
    console.log(`  termsVersion.versionTag (via FK): ${ackRow?.termsVersion.versionTag}`);
    console.log(`  acknowledgedAt: ${ackRow?.acknowledgedAt.toISOString()}`);
    check("row written with denormalised name string", ackRow?.acknowledgedByName === user.name);
    check("row written with denormalised email string", ackRow?.acknowledgedByEmail === user.email);
    check("FK to user set", ackRow?.acknowledgedByUserId === user.id);
    check("FK to TermsVersion resolves to the fake tag we inserted",
      ackRow?.termsVersion.versionTag === FAKE_TERMS_TAG_1);
    check("acknowledgedAt is recent (within 60s)",
      ackRow !== null && (Date.now() - ackRow!.acknowledgedAt.getTime()) < 60_000);

    // ─── Scenario 5 ────────────────────────────────────────────────────
    divider("5. getPaymentMethodState is idempotent — no extra ack rows on repeat reads");
    const ackCountBefore = await p.pricingAcknowledgement.count({ where: { agencyId: agency.id } });
    await getPaymentMethodState(agency.id);
    await getPaymentMethodState(agency.id);
    const ackCountAfter = await p.pricingAcknowledgement.count({ where: { agencyId: agency.id } });
    check("ack count unchanged after repeated state reads",
      ackCountBefore === ackCountAfter, `before=${ackCountBefore} after=${ackCountAfter}`);

    // ─── Scenario 6 ────────────────────────────────────────────────────
    divider("6. Insert NEWER TermsVersion → state drops to disclosure (revision forces re-ack)");
    const fakeTerms2 = await p.termsVersion.create({
      data: {
        versionTag: FAKE_TERMS_TAG_2,
        bodySections: [{ heading: "Throwaway v2", body: FAKE_TERMS_BODY + " (v2 revision)" }],
        // Strictly later than v1 (which was now-2000ms) but still in the
        // past so getActiveTermsVersion considers it active. v2 wins via
        // ORDER BY effectiveFrom DESC.
        effectiveFrom: new Date(Date.now() - 500),
      },
    });
    const state6 = await getPaymentMethodState(agency.id);
    console.log(`  state.kind after revision: ${state6.kind}`);
    console.log(`  state.terms?.versionTag: ${state6.kind === "disclosure" ? state6.terms.versionTag : "n/a"}`);
    check("state = 'disclosure' against the NEW version", state6.kind === "disclosure");
    if (state6.kind === "disclosure") {
      check("active terms = v2 (newer effectiveFrom wins)",
        state6.terms.id === fakeTerms2.id);
    }
    const ackedV2 = await hasAcknowledged(agency.id, fakeTerms2.id);
    check("agency has NOT acknowledged v2 yet", ackedV2 === false);
    const ackedV1Still = await hasAcknowledged(agency.id, fakeTerms1.id);
    check("agency's v1 acknowledgement still on record (history preserved)",
      ackedV1Still === true);
  } finally {
    divider("Cleanup");
    await cleanup();
    const finalTermsCount = await p.termsVersion.count();
    const remainingActive = await getActiveTermsVersion();
    console.log(`  TermsVersion rows after cleanup: ${finalTermsCount}`);
    console.log(`  getActiveTermsVersion(): ${remainingActive === null ? "null (correct — table genuinely empty)" : "NON-NULL — leak!"}`);
    // Final guard: confirm we left staging in the same state we found it.
    if (finalTermsCount !== 0) {
      console.log(`  ✗ LEAK: ${finalTermsCount} TermsVersion rows remain — investigate before commit`);
      failures++;
    } else {
      console.log("  ✓ staging TermsVersion empty — no placeholder rows leaked");
    }
    await p.$disconnect();
  }

  console.log("");
  if (failures === 0) {
    console.log("✓ All scenarios passed");
    process.exit(0);
  } else {
    console.log(`✗ ${failures} check(s) failed`);
    process.exit(1);
  }
}

void main();

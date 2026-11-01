import { computeAnchorDate } from "@/lib/services/chase-anchor";

// The Migrate Sale feature keeps each historical milestone's REAL completedAt
// but must never chase a client/solicitor about a step that happened before the
// file was imported. computeAnchorDate floors a migrated file's chase anchor to
// migratedAt (import instant). These tests pin that behaviour AND prove ordinary
// + legacy-admin-migrated files are untouched.

const rule = { anchorMilestoneId: "def-anchor", useEventDate: false };
const IMPORT = new Date("2026-11-01T09:00:00Z"); // migratedAt
const HISTORICAL = new Date("2026-08-01T00:00:00Z"); // a step done before import
const POST_IMPORT = new Date("2026-11-20T00:00:00Z"); // a step done after import
const CREATED_BACKDATED = new Date("2026-07-01T00:00:00Z");

const completeAnchor = (completedAt: Date) => ({
  state: "complete",
  completedAt,
  eventDate: null,
  reconciledAtClaim: false,
});

describe("computeAnchorDate migrated-file flooring", () => {
  it("ordinary (non-migrated) file is unchanged: anchors on the real completedAt", () => {
    const d = computeAnchorDate({
      rule,
      transaction: { createdAt: CREATED_BACKDATED, isMigrated: false },
      anchorCompletion: completeAnchor(HISTORICAL),
    });
    expect(d).toEqual(HISTORICAL);
  });

  it("legacy admin-migrated file (migratedAt null) keeps prior completedAt behaviour", () => {
    const d = computeAnchorDate({
      rule,
      transaction: { createdAt: CREATED_BACKDATED, isMigrated: true, migratedAt: null },
      anchorCompletion: completeAnchor(HISTORICAL),
    });
    expect(d).toEqual(HISTORICAL);
  });

  it("new migrated file FLOORS a pre-import historical anchor to the import instant", () => {
    const d = computeAnchorDate({
      rule,
      transaction: { createdAt: CREATED_BACKDATED, isMigrated: true, migratedAt: IMPORT },
      anchorCompletion: completeAnchor(HISTORICAL),
    });
    expect(d).toEqual(IMPORT); // NOT the historical date → no retrospective chase
  });

  it("new migrated file keeps a genuine POST-import completion date (forward progress chases normally)", () => {
    const d = computeAnchorDate({
      rule,
      transaction: { createdAt: CREATED_BACKDATED, isMigrated: true, migratedAt: IMPORT },
      anchorCompletion: completeAnchor(POST_IMPORT),
    });
    expect(d).toEqual(POST_IMPORT);
  });

  it("no-anchor rule on a migrated file floors the backdated createdAt to import instant", () => {
    const d = computeAnchorDate({
      rule: { anchorMilestoneId: null, useEventDate: false },
      transaction: { createdAt: CREATED_BACKDATED, isMigrated: true, migratedAt: IMPORT },
      anchorCompletion: null,
    });
    expect(d).toEqual(IMPORT);
  });

  it("no-anchor rule on an ordinary file still returns createdAt", () => {
    const d = computeAnchorDate({
      rule: { anchorMilestoneId: null, useEventDate: false },
      transaction: { createdAt: CREATED_BACKDATED, isMigrated: false },
      anchorCompletion: null,
    });
    expect(d).toEqual(CREATED_BACKDATED);
  });

  it("anchor not yet complete → no chase (null), migrated or not", () => {
    expect(
      computeAnchorDate({
        rule,
        transaction: { createdAt: CREATED_BACKDATED, isMigrated: true, migratedAt: IMPORT },
        anchorCompletion: { state: "available", completedAt: null, eventDate: null, reconciledAtClaim: false },
      }),
    ).toBeNull();
  });
});

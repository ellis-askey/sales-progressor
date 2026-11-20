/**
 * @jest-environment node
 *
 * Progression-company Setup & settings — read-only configuration surfacing.
 *
 * Guards that: (a) getBusinessDetail exposes the read-only `settings` object,
 * (b) the business account Setup tab displays those preferences, and (c) the
 * account page stays strictly read-only — no server actions, forms, write
 * handlers, or Prisma mutations were introduced by surfacing the settings.
 * (Type-level correctness of the settings fields is enforced by `tsc`.)
 */

import { readFileSync } from "fs";

const PAGE = "app/command/(protected)/businesses/[id]/page.tsx";
const LOADER = "lib/command/businesses.ts";

describe("progression-company settings (read-only)", () => {
  it("getBusinessDetail exposes a read-only settings object with the expected fields", () => {
    const src = readFileSync(LOADER, "utf8");
    expect(src).toMatch(/settings:\s*\{/);
    for (const f of [
      "chaseClientsEnabled", "clientChaseEscalateAfter", "weeklyClientUpdatesEnabled",
      "showPortalKeyDates", "aiExplainEmailEnabled", "autoInviteOnAgentAdd",
      "billAtCompletion", "termsAcceptedVersion",
    ]) {
      expect(src).toContain(f);
    }
  });

  it("the business account renders the settings via SettingRow", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).toContain("b.settings.chaseClientsEnabled");
    expect(src).toContain("b.settings.showPortalKeyDates");
    expect(src).toContain("SettingRow");
  });

  it("the business account page stays strictly read-only (no mutations introduced)", () => {
    const src = readFileSync(PAGE, "utf8");
    expect(src).not.toMatch(/"use server"/);
    expect(src).not.toMatch(/\baction=/);
    expect(src).not.toMatch(/\bonClick\b|\bonSubmit\b/);
    expect(src).not.toMatch(/<form\b/);
    expect(src).not.toMatch(/\.(update|updateMany|create|createMany|delete|deleteMany|upsert)\(/);
  });
});

/**
 * @jest-environment node
 */
import { readToolSchemas, CONFIRMABLE_CODES } from "@/lib/agent/tools";

describe("read tool schemas (structural safety)", () => {
  it("exposes NO transaction identifier on any tool — the model cannot target another file", () => {
    for (const s of readToolSchemas()) {
      const keys = Object.keys(s.input_schema.properties ?? {});
      expect(keys).not.toContain("transactionId");
      expect(keys).not.toContain("transaction_id");
      expect(keys).not.toContain("id");
    }
  });

  it("contains only read (get*) tools — no mutation tool exists in the layer", () => {
    for (const s of readToolSchemas()) {
      expect(s.name.startsWith("get")).toBe(true);
    }
  });

  it("treats PM13 as confirmable and PM14 as not (matches the searches example)", () => {
    expect(CONFIRMABLE_CODES.has("PM13")).toBe(true); // search results received
    expect(CONFIRMABLE_CODES.has("PM14")).toBe(false); // enquiries raised is tracker-owned, not a confirmable step
  });
});

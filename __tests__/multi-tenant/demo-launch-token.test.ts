/**
 * @jest-environment node
 *
 * Agent-demo launcher token — a signed per-business link that can't be forged or
 * pointed at another business. See docs/active/agent-demo/SPEC.md.
 */
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-for-demo-launch-token";

import { signDemoLaunchToken, verifyDemoLaunchToken } from "@/lib/security/demo-launch-token";

describe("demo launch token", () => {
  it("round-trips a businessId", () => {
    const token = signDemoLaunchToken("biz_abc123");
    expect(verifyDemoLaunchToken(token)).toBe("biz_abc123");
  });

  it("rejects a tampered signature", () => {
    const token = signDemoLaunchToken("biz_abc123");
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyDemoLaunchToken(tampered)).toBeNull();
  });

  it("rejects a token whose payload was swapped to another business", () => {
    // Take biz A's signature but claim to be biz B — must not verify.
    const a = signDemoLaunchToken("biz_A");
    const sigA = a.slice(a.indexOf(".") + 1);
    const forged = `${Buffer.from("biz_B", "utf8").toString("base64url")}.${sigA}`;
    expect(verifyDemoLaunchToken(forged)).toBeNull();
  });

  it("rejects garbage", () => {
    expect(verifyDemoLaunchToken("")).toBeNull();
    expect(verifyDemoLaunchToken("nodot")).toBeNull();
    expect(verifyDemoLaunchToken(".onlysig")).toBeNull();
    expect(verifyDemoLaunchToken("payload.")).toBeNull();
  });

  it("two businesses get distinct, non-interchangeable tokens", () => {
    const ta = signDemoLaunchToken("biz_A");
    const tb = signDemoLaunchToken("biz_B");
    expect(ta).not.toBe(tb);
    expect(verifyDemoLaunchToken(ta)).toBe("biz_A");
    expect(verifyDemoLaunchToken(tb)).toBe("biz_B");
  });
});

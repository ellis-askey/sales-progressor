/**
 * @jest-environment node
 */

import { createTtlMemo } from "../ttl-memo";

describe("createTtlMemo", () => {
  it("reuses the cached value within the TTL (producer runs once)", async () => {
    let t = 1000;
    const memo = createTtlMemo<string, { n: number }>({ ttlMs: 100, now: () => t });
    let calls = 0;
    const produce = async () => { calls++; return { n: calls }; };

    const a = await memo.get("k", produce);
    t = 1050; // within TTL
    const b = await memo.get("k", produce);
    expect(calls).toBe(1);
    expect(b).toBe(a); // same object reference — Date fields etc. stay real
  });

  it("recomputes after the TTL expires", async () => {
    let t = 0;
    const memo = createTtlMemo<string, number>({ ttlMs: 100, now: () => t });
    let calls = 0;
    const produce = async () => ++calls;

    await memo.get("k", produce);
    t = 101; // past TTL
    await memo.get("k", produce);
    expect(calls).toBe(2);
  });

  it("keys separately so two scopes never share a value", async () => {
    const memo = createTtlMemo<string, string>({ ttlMs: 1000, now: () => 0 });
    const a = await memo.get("userA", async () => "A");
    const b = await memo.get("userB", async () => "B");
    expect(a).toBe("A");
    expect(b).toBe("B");
  });

  it("evicts the oldest entry past maxEntries", async () => {
    let t = 0;
    const memo = createTtlMemo<string, number>({ ttlMs: 10_000, maxEntries: 2, now: () => t });
    await memo.get("a", async () => 1); t = 1;
    await memo.get("b", async () => 2); t = 2;
    await memo.get("c", async () => 3); // evicts "a" (oldest)
    let recomputed = false;
    await memo.get("a", async () => { recomputed = true; return 1; });
    expect(recomputed).toBe(true); // "a" was evicted
  });
});

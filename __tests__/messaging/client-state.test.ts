/**
 * @jest-environment node
 *
 * Optimistic client-state reducers (Phase 1 fixes). Covers successful sends,
 * failed sends + retries (returned {ok:false} AND the thrown-transport path,
 * which the component routes through reconcileSend({ok:false})), the
 * network-failure-after-write case (a stuck bubble whose row landed is dedup'd on
 * refetch), freshness merging, and retry preserving the clientMsgId.
 */

import {
  makeOptimistic,
  reconcileSend,
  markRetrying,
  mergeServerMessages,
  type LocalMsg,
} from "@/lib/services/messaging/client-state";
import type { StaffMessageView } from "@/lib/services/messaging/types";

function serverMsg(over: Partial<StaffMessageView> = {}): StaffMessageView {
  return {
    id: "srv1",
    clientMsgId: "c1",
    body: "hello",
    senderKind: "staff",
    senderName: "Ellis",
    mine: true,
    createdAt: "2026-11-15T10:00:00Z",
    ...over,
  };
}

describe("makeOptimistic", () => {
  it("creates a 'sending' bubble keyed by clientMsgId", () => {
    const m = makeOptimistic("c1", "hi", "2026-11-15T10:00:00Z");
    expect(m).toMatchObject({ id: "c1", clientMsgId: "c1", body: "hi", senderKind: "staff", mine: true, status: "sending" });
  });
});

describe("reconcileSend: successful send", () => {
  it("replaces the optimistic bubble with the server message and clears status", () => {
    const list: LocalMsg[] = [makeOptimistic("c1", "hi", "t")];
    const out = reconcileSend(list, "c1", { ok: true, message: serverMsg({ id: "srv1", clientMsgId: "c1", body: "hi" }) });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "srv1", clientMsgId: "c1", body: "hi" });
    expect(out[0].status).toBeUndefined();
  });

  it("only touches the matching clientMsgId", () => {
    const list: LocalMsg[] = [makeOptimistic("c1", "a", "t"), makeOptimistic("c2", "b", "t")];
    const out = reconcileSend(list, "c1", { ok: true, message: serverMsg({ clientMsgId: "c1" }) });
    expect(out[1].status).toBe("sending"); // c2 untouched
  });
});

describe("reconcileSend: failed send / transport failure", () => {
  it("flips to 'failed' and preserves body + clientMsgId so Retry re-sends the same id", () => {
    const list: LocalMsg[] = [makeOptimistic("c1", "keep me", "t")];
    const out = reconcileSend(list, "c1", { ok: false });
    expect(out[0]).toMatchObject({ clientMsgId: "c1", body: "keep me", status: "failed" });
  });
});

describe("markRetrying", () => {
  it("flips a failed message back to 'sending', keeping clientMsgId + body", () => {
    const failed: LocalMsg[] = [{ ...makeOptimistic("c1", "hi", "t"), status: "failed" }];
    const out = markRetrying(failed, "c1");
    expect(out[0]).toMatchObject({ clientMsgId: "c1", body: "hi", status: "sending" });
  });
});

describe("mergeServerMessages: freshness + dedup", () => {
  it("replaces confirmed history with the fresh server snapshot", () => {
    const local: LocalMsg[] = [{ ...serverMsg({ id: "old", clientMsgId: "c1", body: "stale" }) }];
    const server = [serverMsg({ id: "new", clientMsgId: "c1", body: "fresh" })];
    const out = mergeServerMessages(local, server);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "new", body: "fresh" });
  });

  it("keeps a still-pending message the server does not yet have", () => {
    const local: LocalMsg[] = [makeOptimistic("c2", "unsent", "t")];
    const server = [serverMsg({ clientMsgId: "c1" })];
    const out = mergeServerMessages(local, server);
    expect(out.map((m) => m.clientMsgId)).toEqual(["c1", "c2"]);
    expect(out[1].status).toBe("sending");
  });

  it("network-failure-after-write: a stuck bubble whose row now exists on the server is replaced, not duplicated", () => {
    const local: LocalMsg[] = [{ ...makeOptimistic("c1", "landed", "t"), status: "failed" }];
    const server = [serverMsg({ id: "srv1", clientMsgId: "c1", body: "landed" })];
    const out = mergeServerMessages(local, server);
    expect(out).toHaveLength(1); // not 2 — dedup'd by clientMsgId
    expect(out[0]).toMatchObject({ id: "srv1", clientMsgId: "c1" });
    expect(out[0].status).toBeUndefined();
  });

  it("keeps a failed message absent from the server so Retry survives a refresh", () => {
    const local: LocalMsg[] = [{ ...makeOptimistic("c9", "truly failed", "t"), status: "failed" }];
    const out = mergeServerMessages(local, []);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("failed");
  });
});

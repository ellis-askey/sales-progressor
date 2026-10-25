/**
 * @jest-environment node
 */

// The "By sale" cockpit assembler — the pure grouping of per-file coverage +
// needs + forecast into Needs you / Chasing now / All set / Paused.

import { assembleCockpit } from "@/lib/services/automated-emails-cockpit";
import type { FileAutomationRow } from "@/lib/services/automated-emails-coverage";
import type { NeedsAttentionItem } from "@/lib/services/automated-emails-overview";
import type { PredictedItem, ExhaustedItem } from "@/lib/services/automated-emails-upcoming";

const NOW = new Date("2026-10-26T10:00:00Z"); // a Monday

const file = (txId: string, status: FileAutomationRow["status"], over: Partial<FileAutomationRow> = {}): FileAutomationRow =>
  ({ txId, address: `${txId} Road, Town`, status, pauseReason: null, pendingCount: 0, nextSendAt: null, issuesCount: 0, ...over });

const need = (txId: string, status: NeedsAttentionItem["status"], over: Partial<NeedsAttentionItem> = {}): NeedsAttentionItem =>
  ({ emailId: `e-${txId}`, source: "queue", status, transactionId: txId, transactionAddress: `${txId} Road, Town`,
     recipientName: "Someone", recipientEmail: "a@b.c", recipientRole: "vendor", reason: null, deferredCount: 0,
     action: "view", count: 1, ...over } as NeedsAttentionItem);

const predict = (txId: string, over: Partial<PredictedItem> = {}): PredictedItem =>
  ({ id: `p-${txId}`, kind: "solicitor", txId, address: `${txId} Road, Town`, recipientLabel: "Buyer's solicitor",
     milestoneLabel: "Searches ordered", milestoneCode: "PM8", contactId: null, side: "purchaser",
     chaseNumber: 2, chaseMax: 3, predictedFor: new Date("2026-10-27T09:30:00Z"), ...over });

const exhaust = (txId: string): ExhaustedItem =>
  ({ id: `x-${txId}`, kind: "solicitor", txId, address: `${txId} Road, Town`, recipientLabel: "Buyer's solicitor",
     milestoneLabel: "Searches", chasesSent: 3, cap: 3, daysOutstanding: 18, lastChaseAt: null });

const photos = new Map<string, string | null>();
const run = (i: { files: FileAutomationRow[]; needsItems?: NeedsAttentionItem[]; predicted?: PredictedItem[]; exhausted?: ExhaustedItem[] }) =>
  assembleCockpit({ files: i.files, needsItems: i.needsItems ?? [], predicted: i.predicted ?? [], exhausted: i.exhausted ?? [], photoByTx: photos }, NOW);

it("routes each file to exactly one group", () => {
  const c = run({
    files: [file("bnc", "covered"), file("mis", "needInfo"), file("exh", "covered"), file("chз", "covered"), file("quiet", "covered"), file("pz", "paused")],
    needsItems: [need("bnc", "bounced")],
    exhausted: [exhaust("exh")],
    predicted: [predict("chз")],
  });
  expect(c.needsYou.map((r) => r.txId).sort()).toEqual(["bnc", "exh", "mis"]);
  expect(c.chasing.map((r) => r.txId)).toEqual(["chз"]);
  expect(c.allSet.map((r) => r.txId)).toEqual(["quiet"]);
  expect(c.paused.map((r) => r.txId)).toEqual(["pz"]);
});

it("maps need kinds and keeps the most urgent when a file has several", () => {
  const c = run({
    files: [file("f", "covered")],
    needsItems: [need("f", "errored"), need("f", "bounced")], // bounced wins
    exhausted: [exhaust("f")],                                 // chased_out also present
  });
  expect(c.needsYou).toHaveLength(1);
  expect(c.needsYou[0].kind).toBe("bounced");
  expect(c.needsYou[0].actionLabel).toBe("Update email");
});

it("a stuck file with an upcoming chase appears ONLY in Needs you", () => {
  const c = run({
    files: [file("f", "needInfo")],
    predicted: [predict("f")], // would-be chasing, but it's stuck (missing email)
  });
  expect(c.needsYou.map((r) => r.txId)).toEqual(["f"]);
  expect(c.chasing).toHaveLength(0);
});

it("a paused file is never counted as chasing even with a prediction", () => {
  const c = run({ files: [file("f", "paused")], predicted: [predict("f")] });
  expect(c.chasing).toHaveLength(0);
  expect(c.paused.map((r) => r.txId)).toEqual(["f"]);
});

it("chasing rows carry who / milestone / chase N of M from the soonest prediction", () => {
  const c = run({
    files: [file("f", "covered")],
    predicted: [
      predict("f", { predictedFor: new Date("2026-10-30T09:30:00Z"), milestoneLabel: "Later" }),
      predict("f", { predictedFor: new Date("2026-10-27T09:30:00Z"), milestoneLabel: "Soonest", chaseNumber: 1, chaseMax: 2 }),
    ],
  });
  expect(c.chasing).toHaveLength(1);
  expect(c.chasing[0].milestone).toBe("Soonest");
  expect(c.chasing[0].chaseNumber).toBe(1);
  expect(c.chasing[0].chaseMax).toBe(2);
  expect(c.chasing[0].isSolicitor).toBe(true);
});

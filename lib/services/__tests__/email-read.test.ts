/**
 * @jest-environment node
 */

import { parseEmailReadResult, type EmailReadInput } from "../email-read";

const input: EmailReadInput = {
  subject: "Searches ordered",
  body: "We've submitted the local authority and water searches today.",
  outstandingMilestones: [
    { code: "PM8", name: "Searches ordered", side: "purchaser" },
    { code: "PM13", name: "Search results received", side: "purchaser" },
  ],
  onwardSteps: [{ id: "onw_1", name: "Contracts exchanged (onward)" }],
  relatedSteps: [{ id: "rel_1", name: "Searches ordered (related)" }],
};

describe("parseEmailReadResult", () => {
  it("keeps a grounded milestone suggestion", () => {
    const raw = JSON.stringify({
      summary: "The buyer's solicitor has ordered searches.",
      suggestions: [{ kind: "milestone", code: "PM8", label: "Searches ordered", reason: "Says searches submitted today." }],
    });
    const r = parseEmailReadResult(raw, input);
    expect(r.summary).toContain("ordered searches");
    expect(r.suggestions).toEqual([
      { kind: "milestone", code: "PM8", label: "Searches ordered", reason: "Says searches submitted today." },
    ]);
  });

  it("drops a hallucinated milestone code not in the outstanding list", () => {
    const raw = JSON.stringify({
      summary: "x",
      suggestions: [{ kind: "milestone", code: "PM99", label: "Invented", reason: "..." }],
    });
    expect(parseEmailReadResult(raw, input).suggestions).toEqual([]);
  });

  it("grounds onward/related steps by id and drops unknown ids", () => {
    const raw = JSON.stringify({
      summary: "x",
      suggestions: [
        { kind: "onward_step", stepId: "onw_1", label: "Onward exchanged", reason: "a" },
        { kind: "related_step", stepId: "nope", label: "bad", reason: "b" },
      ],
    });
    const r = parseEmailReadResult(raw, input);
    expect(r.suggestions).toEqual([
      { kind: "onward_step", stepId: "onw_1", label: "Onward exchanged", reason: "a" },
    ]);
  });

  it("keeps a to-do with a title and normalises a missing when to null", () => {
    const raw = JSON.stringify({
      summary: "x",
      suggestions: [{ kind: "todo", title: "Chase the seller's solicitor", reason: "No reply yet" }],
    });
    expect(parseEmailReadResult(raw, input).suggestions).toEqual([
      { kind: "todo", title: "Chase the seller's solicitor", when: null, reason: "No reply yet" },
    ]);
  });

  it("strips markdown fences and tolerates an empty suggestion list", () => {
    const raw = "```json\n{\"summary\":\"Just a thank-you.\",\"suggestions\":[]}\n```";
    const r = parseEmailReadResult(raw, input);
    expect(r.summary).toBe("Just a thank-you.");
    expect(r.suggestions).toEqual([]);
  });

  it("returns empty on malformed JSON", () => {
    expect(parseEmailReadResult("not json at all", input)).toEqual({ summary: "", suggestions: [] });
  });
});

import { parseAssessment, parseAssessmentFromText } from "@/lib/agent/assessment";

describe("parseAssessment (tolerant, enum-strict)", () => {
  it("parses a valid assessment and normalises action codes", () => {
    const a = parseAssessment({
      understood: "Solicitor says searches are back.",
      changed: "Search results received.",
      waitingOn: "buyer's solicitor",
      nextExpected: "enquiries raised",
      humanAttention: false,
      confidence: "high",
      proposedActions: [{ actionType: "confirmMilestone", milestoneCode: "pm13", confidence: "high", evidence: "searches have been returned" }],
    });
    expect(a).not.toBeNull();
    expect(a!.proposedActions).toHaveLength(1);
    expect(a!.proposedActions[0].milestoneCode).toBe("PM13");
    expect(a!.confidence).toBe("high");
  });

  it("drops invalid actions and defaults unknown confidence to low", () => {
    const a = parseAssessment({
      understood: "x",
      waitingOn: "y",
      nextExpected: "z",
      confidence: "wobbly",
      proposedActions: [{ actionType: "notARealAction" }, { actionType: "doNothing", confidence: "nope" }],
    });
    expect(a!.confidence).toBe("low");
    expect(a!.proposedActions).toHaveLength(1);
    expect(a!.proposedActions[0].actionType).toBe("doNothing");
    expect(a!.proposedActions[0].confidence).toBe("low");
  });

  it("returns null for non-object input (fails safe)", () => {
    expect(parseAssessment("not an object")).toBeNull();
    expect(parseAssessment(null)).toBeNull();
    expect(parseAssessment(42)).toBeNull();
  });

  it("extracts JSON from fenced/free text as a fallback", () => {
    const text = "Here you go:\n```json\n{\"understood\":\"a\",\"waitingOn\":\"b\",\"nextExpected\":\"c\",\"confidence\":\"medium\",\"proposedActions\":[]}\n```";
    const a = parseAssessmentFromText(text);
    expect(a).not.toBeNull();
    expect(a!.confidence).toBe("medium");
  });

  it("returns null for un-parseable text", () => {
    expect(parseAssessmentFromText("no json here at all")).toBeNull();
    expect(parseAssessmentFromText("")).toBeNull();
  });
});

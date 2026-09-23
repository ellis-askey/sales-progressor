/**
 * @jest-environment node
 *
 * Input-cleanup casing rules (founder report, 2026-09-23: "SJD Sales
 * Progression" saved as "Sjd…", "Gili-Ross" saved as "Gili-ross"):
 *   - two or more capitals in a row = deliberate (acronym) — never lowered
 *   - hyphen and apostrophe segments each get their own capital
 */

import { titleCaseKeepAcronyms, titleCase } from "../utils";

describe("titleCaseKeepAcronyms", () => {
  it("preserves typed acronyms", () => {
    expect(titleCaseKeepAcronyms("SJD Sales Progression")).toBe("SJD Sales Progression");
    expect(titleCaseKeepAcronyms("CJ properties")).toBe("CJ Properties");
    expect(titleCaseKeepAcronyms("ABC estates PLC")).toBe("ABC Estates PLC");
  });

  it("capitalises after hyphens", () => {
    expect(titleCaseKeepAcronyms("jonathan gili-ross")).toBe("Jonathan Gili-Ross");
    expect(titleCaseKeepAcronyms("Jonathan Gili-Ross")).toBe("Jonathan Gili-Ross");
    expect(titleCaseKeepAcronyms("smith-jones and co")).toBe("Smith-Jones And Co");
  });

  it("capitalises after apostrophes", () => {
    expect(titleCaseKeepAcronyms("tracey o'neill")).toBe("Tracey O'Neill");
    expect(titleCaseKeepAcronyms("d’arcy estates")).toBe("D’Arcy Estates");
  });

  it("still title-cases plain lowercase input", () => {
    expect(titleCaseKeepAcronyms("william h brown")).toBe("William H Brown");
    expect(titleCaseKeepAcronyms("  sarah derry ")).toBe("Sarah Derry");
  });
});

describe("titleCase (addresses — unchanged semantics)", () => {
  it("lower-cases caps-lock addresses and handles hyphens via word boundaries", () => {
    expect(titleCase("40 TRESCO ROAD")).toBe("40 Tresco Road");
    expect(titleCase("walnut-tree barn")).toBe("Walnut-Tree Barn");
  });
});

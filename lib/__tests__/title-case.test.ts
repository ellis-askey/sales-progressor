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

  it("capitalises after apostrophes for name prefixes only", () => {
    expect(titleCaseKeepAcronyms("tracey o'neill")).toBe("Tracey O'Neill");
    expect(titleCaseKeepAcronyms("d’arcy estates")).toBe("D’Arcy Estates");
  });

  it("leaves possessive apostrophes lowercase", () => {
    expect(titleCaseKeepAcronyms("someone's agency")).toBe("Someone's Agency");
    expect(titleCaseKeepAcronyms("barratt's homes")).toBe("Barratt's Homes");
    expect(titleCaseKeepAcronyms("o'neill's estates")).toBe("O'Neill's Estates");
  });

  it("still title-cases plain lowercase input", () => {
    expect(titleCaseKeepAcronyms("william h brown")).toBe("William H Brown");
    expect(titleCaseKeepAcronyms("  sarah derry ")).toBe("Sarah Derry");
  });

  it("capitalises the letter after a Mc prefix", () => {
    expect(titleCaseKeepAcronyms("david mcclure")).toBe("David McClure");
    expect(titleCaseKeepAcronyms("mcdonald")).toBe("McDonald");
    expect(titleCaseKeepAcronyms("fiona mcintyre")).toBe("Fiona McIntyre");
    // Idempotent: already-correct input stays correct.
    expect(titleCaseKeepAcronyms("David McClure")).toBe("David McClure");
    // Double-barrelled: the Mc half still gets its inner capital.
    expect(titleCaseKeepAcronyms("smith-mcclure")).toBe("Smith-McClure");
  });

  it("leaves 'Mac' and ordinary 'mc'-free names untouched", () => {
    // Mac is ambiguous (Macey, Machin, Mackenzie) so we don't auto-capitalise it.
    expect(titleCaseKeepAcronyms("sarah macey")).toBe("Sarah Macey");
    expect(titleCaseKeepAcronyms("paul machin")).toBe("Paul Machin");
    // A typed all-caps acronym is still preserved (never lowered or re-cased).
    expect(titleCaseKeepAcronyms("MCCLURE LTD")).toBe("MCCLURE LTD");
  });
});

describe("titleCase (addresses — unchanged semantics)", () => {
  it("lower-cases caps-lock addresses and handles hyphens via word boundaries", () => {
    expect(titleCase("40 TRESCO ROAD")).toBe("40 Tresco Road");
    expect(titleCase("walnut-tree barn")).toBe("Walnut-Tree Barn");
  });
});

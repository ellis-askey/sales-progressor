import { parseAddressParts } from "@/lib/utils/address";

describe("parseAddressParts", () => {
  const cases: Array<[string, { street: string; town: string; postcode: string }]> = [
    // Clean 3-part: street / town / postcode.
    ["16 Deans Furlong, Tring, HP23 4AR", { street: "16 Deans Furlong", town: "Tring", postcode: "HP23 4AR" }],
    ["5 Oakhill Drive, Bristol, BS3 5EU", { street: "5 Oakhill Drive", town: "Bristol", postcode: "BS3 5EU" }],
    // County present → town groups with county, street keeps the rest.
    ["Flat 2, Hafod, Church Road, Hythe, Kent, CT21 5DP",
      { street: "Flat 2, Hafod, Church Road", town: "Hythe, Kent", postcode: "CT21 5DP" }],
    // Flat at a street number — no county, town is the single piece before postcode.
    ["Flat 16, 33 St Stephens Gardens, London, W2 5NA",
      { street: "Flat 16, 33 St Stephens Gardens", town: "London", postcode: "W2 5NA" }],
    // Bare outward code slots into postcode, not the town box.
    ["44 Tufton Road, London, E4", { street: "44 Tufton Road", town: "London", postcode: "E4" }],
    // Lower-cased postcode is normalised.
    ["9 Roselle Drive, Brockworth, gl3 4gg", { street: "9 Roselle Drive", town: "Brockworth", postcode: "GL3 4GG" }],
    // No postcode — town is still pulled off the end.
    ["Sunnyside, Dedham", { street: "Sunnyside", town: "Dedham", postcode: "" }],
    // Single token — all street.
    ["47 Oak Road", { street: "47 Oak Road", town: "", postcode: "" }],
  ];
  it.each(cases)("parses %s", (input, expected) => {
    expect(parseAddressParts(input)).toEqual(expected);
  });
});

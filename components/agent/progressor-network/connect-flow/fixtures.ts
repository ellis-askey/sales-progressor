// Clearly fictional fixtures for the connect-flow preview. Not real data.

export type RelState = "none" | "pending" | "connected" | "declined";

export type ProgressorFixture = {
  id: string;
  name: string;
  descriptor: string;
  positioning: string;
  brandColor: string;
  availability: "accepting" | "limited" | "closed";
  blurb: string;
  about: string;
  coverage: string;
  specialisms: string[];
  stats: { completionRate: number | null; exchanges12mo: number | null; avgWeeks: number | null; teamSize: number };
  team: { name: string; role: string }[];
};

export type AgencyFixture = {
  name: string;
  descriptor: string;
  region: string;
};

export const PROGRESSOR: ProgressorFixture = {
  id: "mbw",
  name: "Moves By Wright",
  descriptor: "Independent sales progression",
  positioning: "Independent sales progression specialists",
  brandColor: "#2E3D38",
  availability: "accepting",
  blurb:
    "Proactive sales progression for estate agents, coordinating the chain and keeping clients informed, from sale agreed through to completion.",
  about:
    "Moves By Wright is an independent sales progression business working alongside estate agents to keep transactions moving. We take on the chasing, the chain coordination and the client updates, so your team can stay focused on listing and selling. Every sale is progressed by a named person who owns it end to end.",
  coverage: "Nationwide",
  specialisms: ["Residential sales", "Complex chains", "Leasehold", "New-build"],
  stats: { completionRate: 88, exchanges12mo: 24, avgWeeks: 11, teamSize: 4 },
  team: [
    { name: "Annalise Wright", role: "Founder & lead progressor" },
    { name: "Priya Shah", role: "Sales progressor" },
    { name: "Tom Fielding", role: "Sales progressor" },
    { name: "Megan Hart", role: "Sales progressor" },
  ],
};

export const AGENCY: AgencyFixture = {
  name: "Boardwalk",
  descriptor: "Estate agency",
  region: "South West",
};

// Relationship-specific figures shown once connected (sales this agency has
// handed to this progressor) — fictional.
export const RELATIONSHIP = { activeSales: 12, exchanged: 8, completionRate: 92 };

export const SAMPLE_INTRO =
  "We're looking for a progression partner to support our team through busier periods. It'd be good to talk through how you work and your current availability.";

// Demo guided-walkthrough — step machine types + the canonical 6-step story.
//
// The tour runs INSIDE the real demo file (14 Beaumont Rise). Each step points
// the agent at a real, seeded element: the screen switches a tab or scrolls to
// it, dims the rest, rings the target, and floats a small guide card. Every
// move follows an explicit user action — nothing auto-advances.
//
// See docs/DEMO_SALE_GUIDED_EXPERIENCE_PLAN.md §7–§8 for the narrative and the
// per-step rationale. Microcopy here is the source of truth (voice-passed: no
// em-dashes, no exclamation marks, "we"/"you", never "the system").

export type TourAdvance =
  // Guide card shows a "Continue" button; clicking it advances.
  | "continue"
  // The agent clicks the spotlighted target itself (its real handler runs);
  // a small "Skip" also advances so nobody can get stuck.
  | "click-target";

export type TourStep = {
  // Stable id — used for analytics (demo_tour_step_*) and localStorage resume.
  id: string;
  // Ensure this file tab is active before the step shows. Omit for the
  // default (Overview) tab. "chase" is the one deliberate jump.
  tab?: string;
  // CSS selector for the real element to spotlight. Prefer stable
  // data-glass-id / data-tour / id anchors, never structural selectors.
  target: string;
  // Where the guide card sits relative to the target. "auto" picks the side
  // with the most room. On narrow screens the card always docks to the bottom.
  placement?: "auto" | "top" | "bottom";
  title: string;
  body: string;
  // Extra line shown under the body when the agent must act (click-target).
  actionHint?: string;
  advance: TourAdvance;
  // If the target can't be found (e.g. the Chase tab isn't present on this
  // file), skip this step silently instead of stalling the tour.
  optional?: boolean;
};

export const DEMO_TOUR_STEPS: TourStep[] = [
  {
    id: "orientation",
    tab: "overview",
    target: '[data-glass-id="property-hero"]',
    placement: "bottom",
    title: "A real sale, start to finish",
    body: "This is 14 Beaumont Rise, a sample sale we've part-progressed for you. We'll take you through how we keep one moving. Explore anything you like as we go.",
    advance: "continue",
  },
  {
    id: "where-it-stands",
    tab: "overview",
    target: '[data-glass-id="milestone-timeline"]',
    placement: "bottom",
    title: "See where it stands at a glance",
    body: "The full journey stays in view wherever you are on the file. Green is done, coral is live now, and the dates ahead are our forecast.",
    advance: "continue",
  },
  {
    id: "waiting-on",
    tab: "overview",
    target: '[data-glass-id="overview-next-action"]',
    placement: "auto",
    title: "The one thing that matters next",
    body: "We surface the next action and who it's waiting on, so a sale never stalls while you're looking the other way.",
    advance: "continue",
  },
  {
    id: "chasing",
    tab: "chase",
    target: '[data-tour="chase-threads"]',
    placement: "auto",
    title: "We do the chasing for you",
    body: "Behind every step we're chasing the right person on a set cadence, and only handing it to you when it genuinely needs you. No more remembering to nudge the solicitor.",
    advance: "continue",
    optional: true,
  },
  {
    id: "risk",
    tab: "overview",
    target: "#risk-score",
    placement: "auto",
    title: "We flag trouble before you'd spot it",
    body: "We read fall-through risk from what's really happening on the file, not just the steps ticked, so a sale that goes quiet still gets flagged to you.",
    advance: "continue",
  },
  {
    id: "clients",
    tab: "overview",
    target: '[data-glass-id="overview-people"]',
    placement: "auto",
    title: "Your clients can see it too",
    body: "Your buyer and seller follow the same progress in their own portal, so they stop calling you for updates. You can even see when they last looked in.",
    advance: "continue",
  },
];

// Event names used to trigger / restart the tour from outside the controller
// (e.g. the "Demo sale" marker's replay button). Dispatched on window.
export const DEMO_TOUR_EVENTS = {
  start: "demo-tour:start",
} as const;

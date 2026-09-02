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
    body: "This is 14 Beaumont Rise, a sample sale we've already started progressing. We'll show you how we keep it moving. Feel free to explore as we go.",
    advance: "continue",
  },
  {
    id: "where-it-stands",
    tab: "overview",
    target: '[data-glass-id="milestone-timeline"]',
    placement: "bottom",
    title: "See where everything stands",
    body: "The whole sale stays in view. What's done, what's happening now, and where we expect things to go next.",
    advance: "continue",
  },
  {
    id: "waiting-on",
    tab: "overview",
    target: '[data-glass-id="overview-next-action"]',
    placement: "auto",
    title: "Know what needs to happen next",
    body: "We keep the next action clear, including what we're waiting for and who we're waiting on.",
    advance: "continue",
  },
  {
    id: "chasing",
    tab: "chase",
    target: '[data-tour="chase-threads"]',
    placement: "auto",
    title: "We do the chasing for you",
    body: "We chase the right people at the right time, and only bring it back to you when something genuinely needs your attention.",
    advance: "continue",
    optional: true,
  },
  {
    id: "risk",
    tab: "overview",
    target: "#risk-score",
    placement: "auto",
    title: "Spot trouble before it becomes a problem",
    body: "We look beyond the steps completed to spot silence, delays and other signs that a sale may be at risk.",
    advance: "continue",
  },
  {
    id: "clients",
    tab: "overview",
    target: '[data-glass-id="overview-people"]',
    placement: "auto",
    title: "Your clients can follow along",
    body: "Buyers and sellers get their own live view of the sale, so they can check progress without having to ask you. You can even see when they last looked.",
    advance: "continue",
  },
];

// Event names used to trigger / restart the tour from outside the controller
// (e.g. the "Demo sale" marker's replay button). Dispatched on window.
export const DEMO_TOUR_EVENTS = {
  start: "demo-tour:start",
} as const;

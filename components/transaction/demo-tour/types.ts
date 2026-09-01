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
    target: '[data-glass-id="property-hero"]',
    placement: "bottom",
    title: "This is a live example sale",
    body: "14 Beaumont Rise, part-way to exchange. We'll walk you through how we'd keep it moving. It's all sample data, so look around any time.",
    advance: "continue",
  },
  {
    id: "where-it-stands",
    target: '[data-glass-id="milestone-timeline"]',
    placement: "bottom",
    title: "Where the sale stands",
    body: "The whole journey, always in view. Green is done, coral is live, and the rest is forecast from how the file is moving.",
    advance: "continue",
  },
  {
    id: "waiting-on",
    target: '[data-glass-id="overview-next-action"]',
    placement: "auto",
    title: "What we're waiting on",
    body: "We keep the single next action in view, and who it's waiting on, so nothing slips.",
    actionHint: "Mark this one done to see the file move on.",
    advance: "click-target",
  },
  {
    id: "chasing",
    tab: "chase",
    target: '[data-tour="chase-threads"]',
    placement: "auto",
    title: "We do the chasing",
    body: "Behind every step we chase the right person for you, automatically first, and only bring it to you when it needs a human. You're not the one remembering to nudge the solicitor.",
    advance: "continue",
    optional: true,
  },
  {
    id: "risk",
    target: "#risk-score",
    placement: "auto",
    title: "We flag what needs you",
    body: "We score fall-through risk from what's actually happening on the file, separate from progress, so a sale that's on step but going quiet still gets flagged.",
    advance: "continue",
  },
  {
    id: "clients",
    target: '[data-tour="people-clients"]',
    placement: "auto",
    title: "Your clients stay in the loop",
    body: "Your buyer and seller see this same progress in their own portal, so they're not calling you for updates. You can even see when they last looked.",
    advance: "continue",
  },
];

// Event names used to trigger / restart the tour from outside the controller
// (e.g. the "Demo sale" marker's replay button). Dispatched on window.
export const DEMO_TOUR_EVENTS = {
  start: "demo-tour:start",
} as const;

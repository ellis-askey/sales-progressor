// Registry types for the /dev/sheets inspection environment.
//
// The catalogue is data-driven: every drawer / modal / notification on the
// internal (agent + dashboard + command) side of the app is one SheetEntry.
// Adding a new overlay to the QA harness = add one entry to a _registry file,
// never touch the page shell. Keep this file the single source of truth for
// the entry shape.

import type { ReactNode } from "react";

// The three top-level catalogue sections.
export type SheetType = "drawer" | "modal" | "notification";

// App-area grouping. Kept as a string union so a typo is a type error, but
// broad enough to cover the whole internal surface. Add areas here as the
// registry grows.
export type SheetArea =
  | "Property file"
  | "Milestones"
  | "Chains"
  | "Updates"
  | "To-do"
  | "Completions"
  | "Reminders"
  | "My Files"
  | "Solicitors & contacts"
  | "Brokers & partners"
  | "Documents"
  | "Comms"
  | "Auto emails"
  | "Billing"
  | "Onboarding & account"
  | "Admin & command"
  | "Global chrome";

// One inspectable visual state of a component. `id` is stable and feeds the
// remount key, so switching state re-runs the component's mount effects with
// fresh fixtures (matters for components that seed useState from props).
export type SheetState = {
  id: string;
  label: string;
  // Optional one-liner shown in the inspector control bar describing what
  // this state is exercising (e.g. "very long address + 6 contacts").
  hint?: string;
};

// Context handed to an entry's render function.
export type RenderCtx = {
  // Whether the overlay should be open. Overlay components read this as their
  // `open` prop. For components that self-mount (no `open` prop) the entry
  // simply renders them unconditionally — the host only calls render when open.
  open: boolean;
  // The active state id (one of entry.states[].id).
  stateId: string;
  // Close callback — wired to every dismiss / cancel / confirm handler so the
  // overlay closes cleanly and no real mutation escapes.
  onClose: () => void;
};

export type SheetEntry = {
  // Stable unique id. NEVER reuse or renumber — it keys localStorage
  // verification, so a change silently resets a component's verified flag.
  id: string;
  // Human-readable name shown on the card ("Edit client details").
  name: string;
  type: SheetType;
  area: SheetArea;
  // Where it's used in the real app, shown on the card ("Property file · buyer card").
  usedIn: string;
  // Component source path, shown behind the dev-info disclosure.
  file: string;
  // The exported component name, for the dev-info disclosure.
  componentName?: string;
  // One-line reviewer note: quirks, what to look at, known caveats.
  note?: string;
  // How the host presents it:
  //   "overlay" — the component portals itself over the live /sheets page
  //     (drawers, modals, celebrations). Judge it against the real background.
  //   "inline"  — the component is placed inside a fixture page-content stage
  //     so notices/banners/empty-states can be judged in realistic context.
  preview: "overlay" | "inline";
  // The inspectable states, most-representative first. Always at least one.
  states: SheetState[];
  // Renders the real production component for the given state. Wire every
  // action handler to ctx.onClose (or a no-op) so nothing mutates real data.
  render: (ctx: RenderCtx) => ReactNode;
};

// A resolved verification snapshot for the header counts.
export type VerificationSummary = {
  total: number;
  verified: number;
  needsReview: number;
};

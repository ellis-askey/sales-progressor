// TSP component library — registry. The single record for each component: what it
// is, where it came from, its licence, how we adapted it, its variants/states, the
// real reusable import path, and when a future page should reach for it.
// Isolated to /dev/library; nothing here is Approved until founder review.

export type RegEntry = {
  name: string;
  purpose: string;
  source: string;        // original source + how it was used
  licence: string;
  adaptations: string;   // what we changed for TSP
  variants: string;
  states: string;
  importPath: string;    // the actual reusable import
  whenToUse: string;     // guidance for future page builders
};

export const CONTROLS: RegEntry[] = [
  {
    name: "Button",
    purpose: "Primary and secondary actions.",
    source: "Interaction (press-swell) adapted from theatom liquid-glass GlassButton; rendered on TSP tokens, not theatom's material.",
    licence: "theatom: MIT",
    adaptations: "Swell replaced with spring.ts press-scale; five TSP variants + coral primary; glass/token fills, not theatom's glass engine.",
    variants: "primary · secondary · subtle · ghost · danger; sizes sm/md/lg; icon; full; loading",
    states: "rest · hover · focus-visible · pressed (spring) · disabled · loading",
    importPath: "app/dev/library/controls.tsx → Button / IconButton",
    whenToUse: "Any action. Exactly one coral primary per surface; everything else secondary/ghost.",
  },
  {
    name: "Switch",
    purpose: "Binary on/off toggle.",
    source: "Radix @radix-ui/react-switch (accessibility) + theatom GlassSwitch knob feel.",
    licence: "Radix: MIT · theatom: MIT",
    adaptations: "Radix root for a11y/keyboard; knob travel driven by spring.ts; coral 'on' track.",
    variants: "with/without label; disabled",
    states: "off · on · focus-visible · disabled · reduced-motion (instant)",
    importPath: "app/dev/library/controls.tsx → Switch",
    whenToUse: "Instant settings that take effect immediately (not form submit choices).",
  },
  {
    name: "Checkbox",
    purpose: "Multi-select / opt-in.",
    source: "Custom — @radix-ui/react-checkbox is NOT installed; built accessible (role=checkbox, Space/Enter) rather than install blindly. Tick-draw adapted from animate-ui's check animation idea.",
    licence: "Custom (TSP)",
    adaptations: "Keyboard + aria-checked; coral fill; SVG tick with spring/ease draw.",
    variants: "with/without label; disabled",
    states: "unchecked · checked · focus-visible · disabled",
    importPath: "app/dev/library/controls.tsx → Checkbox",
    whenToUse: "Independent boolean choices in a form or list.",
  },
  {
    name: "RadioGroup",
    purpose: "One-of-many selection.",
    source: "Radix @radix-ui/react-radio-group (accessibility), TSP-styled.",
    licence: "Radix: MIT",
    adaptations: "Radix root/item/indicator for roving focus + a11y; coral dot; optional hint text.",
    variants: "options with optional hint",
    states: "unselected · selected · focus-visible · disabled",
    importPath: "app/dev/library/controls.tsx → RadioGroup",
    whenToUse: "2–5 mutually-exclusive options shown at once (else use Select).",
  },
  {
    name: "Slider",
    purpose: "Pick a value in a range.",
    source: "Radix @radix-ui/react-slider (a11y/keyboard) + the foundation SliderThumb, whose displacement refraction is built on the slab map (refraction-map.ts, Glassy UI MIT) and reused from /dev/glass-optics.",
    licence: "Radix: MIT · Glassy UI: MIT",
    adaptations: "Material transitions by state: SOLID capsule at rest → the feDisplacementMap scale ramps 0→full as you drag (genuine refraction emerging, not a crossfade) → SOLID on release; drag velocity stretches the capsule and relaxes when movement pauses. Map built once (no per-frame canvas rebuild).",
    variants: "min/max/step; disabled",
    states: "rest (solid) · dragging (refractive + velocity stretch) · release (returns to solid) · focus-visible · keyboard arrows · disabled · reduced-motion (instant)",
    importPath: "app/dev/library/controls.tsx → Slider · app/dev/library/foundation.tsx → SliderThumb",
    whenToUse: "Continuous ranges where the exact number is secondary. The refraction only shows over textured content — test it on the Material Bench.",
  },
  {
    name: "Segmented",
    purpose: "Compact exclusive choice / view switch.",
    source: "Built on the foundation TravellingSelection primitive (the moving glass pill), shared with Tabs and the Dock active state.",
    licence: "Custom (TSP) on spring.ts",
    adaptations: "One continuous frosted pill that SLIDES and RESIZES between options (left+width on one spring → reads as a single physical object), not a colour swap; recessed track; coral only on the selected label; roving arrow-key/Home/End selection; reduced-transparency → opaque pill; increased-contrast → stronger edge.",
    variants: "2–4 options; size sm/md",
    states: "selected · hover · focus-visible · keyboard · reduced-motion (instant) · reduced-transparency · increased-contrast",
    importPath: "app/dev/library/controls.tsx → Segmented · app/dev/library/foundation.tsx → TravellingSelection",
    whenToUse: "A small, always-visible set of views/ranges (Day/Week/Month).",
  },
  {
    name: "Input · Textarea · Search · Field",
    purpose: "Text entry.",
    source: "Adapted from theatom GlassInput (leading icon + clear).",
    licence: "theatom: MIT",
    adaptations: "Leading-icon slot, clear button, Field label/error/hint wrapper, coral focus ring.",
    variants: "Input (leading, clearable) · Textarea · Search preset · Field(label/error/hint)",
    states: "rest · focus (coral ring) · error · disabled · with-value (clear shows)",
    importPath: "app/dev/library/controls.tsx → Input / Textarea / Search / Field",
    whenToUse: "All free-text entry. Wrap in Field for a labelled, validated row.",
  },
  {
    name: "Select",
    purpose: "One-of-many from a longer list.",
    source: "Custom listbox — @radix-ui/react-select NOT installed; built accessible (listbox/option roles, arrow keys, Enter/Esc) over the library's portal+anchor overlay, to avoid a blind install.",
    licence: "Custom (TSP)",
    adaptations: "Overlay on the frosted surface (not the lens — small portalled overlay); keyboard nav; coral selected tick.",
    variants: "placeholder; options",
    states: "closed · open · option hover/selected · keyboard · disabled",
    importPath: "app/dev/library/controls.tsx → Select",
    whenToUse: "6+ options or when space is tight. (If we later add @radix-ui/react-select, swap the behaviour layer.)",
  },
  {
    name: "DatePicker",
    purpose: "Pick a calendar date.",
    source: "Custom — no date library present; month-grid calendar over the portal+anchor overlay.",
    licence: "Custom (TSP)",
    adaptations: "Month navigation, selected-day coral, frosted popover; keyboard-dismissable.",
    variants: "value/onChange",
    states: "closed · open · month nav · selected day",
    importPath: "app/dev/library/controls.tsx → DatePicker",
    whenToUse: "Exchange/completion dates, reminders. (Time picker to follow.)",
  },
  {
    name: "Stepper",
    purpose: "Increment/decrement a small integer.",
    source: "Custom (small, standard pattern).",
    licence: "Custom (TSP)",
    adaptations: "Min/max clamping, aria-live value, disabled bounds.",
    variants: "min/max/step/suffix",
    states: "rest · at-min (− disabled) · at-max (+ disabled)",
    importPath: "app/dev/library/controls.tsx → Stepper",
    whenToUse: "Counts/quantities with sensible bounds (chase rounds, days).",
  },
  {
    name: "Toggle",
    purpose: "A pressable on/off button (not a form switch).",
    source: "Custom (aria-pressed button) + spring press.",
    licence: "Custom (TSP)",
    adaptations: "aria-pressed, coral active, spring press-scale.",
    variants: "content any",
    states: "off · on · pressed · focus-visible",
    importPath: "app/dev/library/controls.tsx → Toggle",
    whenToUse: "Toolbar-style toggles (bold, filter-on) where a switch would be wrong.",
  },
];

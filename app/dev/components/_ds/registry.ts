// TSP Design System — registry (types + information architecture).
//
// This is the typed spine of the /dev/components workspace. It defines:
//   · the decision statuses a component moves through,
//   · the shape of a canonical component entry (incl. its variants, states,
//     discovered sources and protected "Existing Behaviour & Exceptions"),
//   · the empty information architecture (AREAS) the workspace renders.
//
// It is DELIBERATELY empty of components. The architecture exists so entries
// can be added one at a time, by review, as we go through the real app. Nothing
// here invents a component, a token, a variant or an exception. See
// docs/design-system/README.md for the programme and rules.

import type { ReactNode } from "react";

/* ── Decision lifecycle ─────────────────────────────────────────────────────
   A discussed idea is not approved; an approved component is not implemented;
   an implemented canonical component is not migrated across the app. These
   statuses keep those distinctions explicit. */
export type DecisionStatus =
  | "not-reviewed"
  | "proposed"
  | "under-review"
  | "approved"
  | "implemented"
  | "deprecated";

export const STATUS_META: Record<DecisionStatus, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  "not-reviewed": { label: "Not reviewed", tone: "neutral" },
  "proposed": { label: "Proposed", tone: "info" },
  "under-review": { label: "Under review", tone: "warning" },
  "approved": { label: "Approved", tone: "success" },
  "implemented": { label: "Implemented", tone: "success" },
  "deprecated": { label: "Deprecated", tone: "danger" },
};

/* ── Entry shape ────────────────────────────────────────────────────────────
   What a canonical component will carry once reviewed. All optional except the
   identity + status, so an entry can start as a stub the moment we open it. */

/** A per-preview render — a state or variant can carry its own live preview so
 *  the reviewer can click through them in the EntryCard, rather than reading a
 *  static label. Optional: a chip without one stays a descriptive label. */
export type EntryRender = (ctx: { theme: "light" | "dark" }) => ReactNode;

/** An intentional difference in size, appearance, density or purpose. */
export interface EntryVariant { id: string; label: string; note?: string; render?: EntryRender }

/** A relevant state. Not every state applies to every component. When it carries
 *  a `render`, the state becomes a clickable step in the preview. */
export interface EntryState { id: string; label: string; render?: EntryRender }

/** A discovered existing implementation in the real app (for the Discover step). */
export interface EntrySource { path: string; note?: string }

/** A protected behaviour / context-specific refinement that must survive
 *  shared updates — the "Existing Behaviour & Exceptions" record. */
export interface EntryException {
  title: string;
  detail: string;
  /** Where the behaviour originates. */
  source?: string;
  /** Shared across usages, or specific to one. */
  scope?: "shared" | "specific";
}

export interface ComponentEntry {
  id: string;
  name: string;
  /** Category id this entry belongs to. */
  category: string;
  status: DecisionStatus;
  summary?: string;
  /** Extra descriptive words for search — colours, shapes, synonyms a reviewer
   *  might type to find this ("orange", "arrow", "pill") that aren't already in
   *  the name or summary. Indexed by the nav search. */
  keywords?: string[];
  variants?: EntryVariant[];
  states?: EntryState[];
  /** Existing implementations found across the app. */
  sources?: EntrySource[];
  /** Protected behaviours — rendered in a collapsed section on the entry. */
  exceptions?: EntryException[];
  /** The live canonical preview, supplied only once the entry is approved and
   *  built. Receives the active theme so it can render light/dark correctly. */
  render?: (ctx: { theme: "light" | "dark" }) => ReactNode;
  /** Where we are in the review workflow, for the reviewer's note. */
  note?: string;
}

/* ── Information architecture ────────────────────────────────────────────────
   The category homes for future work (brief §4). Every category starts empty
   and clearly awaiting review. Reorganised into five areas with progressive
   disclosure so the nav never shows dozens of items at once. */

export interface Category { id: string; label: string; blurb?: string }
export interface Area { id: string; label: string; blurb: string; categories: Category[] }

export const AREAS: Area[] = [
  {
    id: "foundations",
    label: "Foundations",
    blurb: "The shared rules every component inherits — colour, type, space, motion, elevation, theming.",
    categories: [
      { id: "colour", label: "Colour & semantic tokens" },
      { id: "typography", label: "Typography" },
      { id: "spacing", label: "Spacing & layout rhythm" },
      { id: "sizing", label: "Dimensions & sizing" },
      { id: "radii", label: "Border radii" },
      { id: "borders", label: "Borders & dividers" },
      { id: "elevation", label: "Shadows & elevation" },
      { id: "iconography", label: "Iconography" },
      { id: "motion", label: "Motion & transitions" },
      { id: "breakpoints", label: "Responsive breakpoints" },
      { id: "layering", label: "Layering & z-index" },
      { id: "themes", label: "Light & dark themes" },
      { id: "density", label: "Density & visual hierarchy" },
    ],
  },
  {
    id: "components",
    label: "Components",
    blurb: "The shared UI elements — each with its canonical implementation, variants, states and protected exceptions.",
    categories: [
      { id: "buttons", label: "Buttons & actions" },
      { id: "text-inputs", label: "Text inputs & textareas" },
      { id: "selects", label: "Selects & dropdowns" },
      { id: "toggles", label: "Checkboxes, radios & toggles" },
      { id: "search", label: "Search & filtering controls" },
      { id: "datetime", label: "Date & time controls" },
      { id: "cards", label: "Cards & surfaces" },
      { id: "rows", label: "Rows & list items" },
      { id: "tables", label: "Tables & data displays" },
      { id: "badges", label: "Badges & status indicators" },
      { id: "progress", label: "Progress indicators & timelines" },
      { id: "navigation", label: "Navigation elements" },
      { id: "tabs", label: "Tabs & segmented controls" },
      { id: "modals", label: "Modals & dialogs" },
      { id: "drawers", label: "Drawers & popovers" },
      { id: "tooltips", label: "Tooltips" },
      { id: "notifications", label: "Notifications & feedback" },
      { id: "uploads", label: "File uploads & documents" },
      { id: "loading", label: "Loading & skeleton states" },
      { id: "empty-error", label: "Empty & error states" },
    ],
  },
  {
    id: "patterns",
    label: "Application patterns",
    blurb: "How components compose into the page-level patterns TSP uses.",
    categories: [
      { id: "shells", label: "Page shells & layouts" },
      { id: "toolbars", label: "Headers & toolbars" },
      { id: "sidebars", label: "Sidebars & navigation docks" },
      { id: "titles", label: "Page titles & action placement" },
      { id: "forms", label: "Forms & validation" },
      { id: "filtering", label: "Search, filtering & sorting" },
      { id: "data-heavy", label: "Data-heavy layouts" },
      { id: "responsive", label: "Responsive adaptations" },
      { id: "conventions", label: "Navigation & interaction conventions" },
      { id: "destructive", label: "Confirmation & destructive actions" },
      { id: "feedback", label: "Saving, loading & success feedback" },
    ],
  },
  {
    id: "lifecycle",
    label: "Application lifecycle",
    blurb: "How the product reads across the full account journey and account states.",
    categories: [
      { id: "registration", label: "Registration" },
      { id: "authentication", label: "Authentication" },
      { id: "onboarding", label: "Onboarding" },
      { id: "first-login", label: "First login" },
      { id: "empty-accounts", label: "Empty accounts" },
      { id: "partial-accounts", label: "Partially populated accounts" },
      { id: "full-accounts", label: "Fully populated accounts" },
      { id: "high-volume", label: "High-volume accounts" },
      { id: "restricted", label: "Restricted permissions" },
      { id: "exceptional", label: "Errors & exceptional conditions" },
    ],
  },
  {
    id: "governance",
    label: "Quality & governance",
    blurb: "How we keep it consistent, accessible, performant and accountable over time.",
    categories: [
      { id: "accessibility", label: "Accessibility" },
      { id: "responsive-qa", label: "Responsive consistency" },
      { id: "visual-qa", label: "Visual consistency" },
      { id: "interaction-qa", label: "Interaction consistency" },
      { id: "performance", label: "Performance" },
      { id: "reuse", label: "Component reuse" },
      { id: "regression", label: "Regression testing" },
      { id: "decisions", label: "Approved design decisions" },
      { id: "migration", label: "Migration tracking" },
      { id: "deprecated", label: "Deprecated implementations" },
    ],
  },
];

/* ── Signed off ──────────────────────────────────────────────────────────────
   Flows / pages confirmed 100% complete — spacing, canonicals, every element,
   container, popup and state accounted for in the library (bar anything
   deliberately kept bespoke). Appended one at a time as Ellis signs each off;
   empty until the first. */
export interface SignOff { flow: string; date: string; note?: string }
export const SIGNED_OFF: SignOff[] = [
  { flow: "Login page", date: "20 Nov 2026", note: "Type, buttons, SSO, coral links, cookie banner, inline email error, 2FA stage (coral OTP + backup escape hatch), token-danger error banner — all accounted for." },
  { flow: "Sign-up — step 1 (your details)", date: "20 Nov 2026", note: "Heading, two-bar step progress, LabelInput fields, password strength, arc terms checkbox, coral links, primary button, token-danger error." },
  { flow: "Sign-up — step 2 (agency / role)", date: "20 Nov 2026", note: "Agency field + focus-aware nudge, flat-coral role radio, primary + ghost buttons, token-danger error." },
  { flow: "Welcome modal (self-managed) — steps 1–3", date: "20 Nov 2026", note: "First canonical modal. Step dots, warm type (no eyebrow), flat-coral primary + ghost at equal height with press-down, muted back link, flat-coral icon circles, preference rows + canonical toggle, canonical X; in/out + drawer + step-cross-fade animation. All parts catalogued." },
  { flow: "Empty states — 11 onboarding pages", date: "20 Nov 2026", note: "Hub, Reminders, Chains, Comms, Auto-emails, To-do, Partners, Enquiries, Analytics, All-files, Completions. Pills removed; flat-coral primary + theme-aware white/outline secondary + coral animated arrows via .agent-canon-cta; banner + info cards on canon buttons/close/link; dark-card picks fixed (auto-emails/chains); type on the 600 ramp. Shipped to prod. Inner buttons are the agent-btn treatment matched to canon; card surfaces use the Glass system. Excludes the in-page generic ui/EmptyState (deferred) + FileSetupChecklist relational empty (separate pattern)." },
  { flow: "App shell — top bar + left nav", date: "20 Nov 2026", note: "Top bar (search → canonical arc SearchField as a ⌘K trigger; All/Mine view toggle; dark/contrast/lab icon controls; notification bell; account menu) + left nav rail (icon+label items, radial coral spotlight on active, outline count badges, New sale, dark-mode toggle). Each piece catalogued (search, account menu, view toggle, icon controls, count badge, nav rail, top bar). Signed off as interactive REPRESENTATIONS (Option A) — the live AgentShell/AgentNavRail can't mount in /dev, so the composites are faithful mocks sourced to the real files; only the SearchField is the literal component. A one-off (one top bar, one nav)." },
  { flow: "Automated emails (/agent/automated-emails)", date: "22 Nov 2026", note: "First page through the deep-tree sign-off audit (compare at /dev/components/compare/automated-emails-signoff) — 20 residuals surfaced after the initial migration and all resolved. Hero banner (StatBlock stats, phosphor state icons, PanelHeader), Needs-attention / Still-to-send / Coverage / Activity panels (PanelHeader, CountBadge, Donut, LegendItem, StatBlock + DeltaIndicator, arc EmptyState), stacked bar chart (recharts, ChartTipPortal hover), tabbed list (GlassTabs, canonical Select filters, DateField, FeedRowShell rows, de-tinted category chips + StatusDot statuses, agent-btn load-more/export), By-sale cockpit (PropertyThumb/ContactAvatar identities, StepDots, PanelHeader group headers, de-tinted StatusPill, factored tap-to-expand), Insights (StatBlock tiles, StackedBar). Dividers → one token; --agent-indigo added; dead ExhaustedCard removed. New shared canonicals: PanelHeader, FeedRowShell, GlassTabs. Excludes EmailDetailDrawer (drawer — own pass)." },
  { flow: "Updates (/agent/comms)", date: "22 Nov 2026", note: "Deep-tree sign-off audit (compare at /dev/components/compare/comms-signoff) — 12 residuals all resolved. The filter rail extracted for real into the shared FilterRail + FilterDropdowns (group-header hover → quieter hover-shade, mobile caret → real icon); feed rows → ActivityRow (sizes on tokens); kind markers → IconChip; the agency welcome hero → OnboardingHero; document links → agent-link; captions → design tokens. Bug fixed: the empty-state ghost preview no longer shimmers (settled, not loading). Dead 'View guide' button removed (Law 13). Admin 'across the platform' → 'across every agency' (Law 21). New shared canonicals: FilterRail, IconChip, ActivityRow, OnboardingHero (the other 14 onboarding heroes migrate onto OnboardingHero in a follow-up)." },
  { flow: "Reminders (/agent/work-queue + file reminders tab)", date: "22 Nov 2026", note: "Deep-tree sign-off audit. Headline finding: ReminderCard AND RemindersSection were BOTH entirely dead (no live consumer) — the live surface is AgentRemindersList everywhere — so both deleted (+ their dev-only demo/registration), erasing five 'residuals' that only existed in the dead file. Live aligns on AgentRemindersList / FileAlertsStrip / AutoChaseCountdown: file-alert chips + summary pills → outline Pills (de-tint); auto-chase countdown de-tinted to a hairline border (ticking timer untouched); the three empty states → the canonical animated arc EmptyState; inline calendar SVG → CalendarBlank icon; Wake all / Wake now → flat arc primary + outline with the real ArrowClockwise icon (hover-spin), typed ↻ gone; ~60 lines of dead urgency-grouping code (GROUP_CONFIG, computeUrgency, durationLabel, a per-render grouped sort) + dead imports removed; internal-only ghost preview deleted. Section bars kept as-is (founder: the live bar + pill + chevron + small text IS the canonical — rejected the SectionDisclosure swap). Left untouched: a typed ↻ in the admin-only hideChase 'Chased' button (not in the approved compare)." },
  { flow: "Enquiries (/agent/enquiries)", date: "23 Nov 2026", note: "Deep-tree sign-off audit (compare at /dev/components/compare/enquiries-signoff). The list was already substantially canonical (arc split-button, agent-icon-btn, AnchoredPanel menus, PropertyThumb, Select, StatCards) — no dead code, no typed glyphs, whole tree live. Applied: the drag-to-confirm popup's bespoke enq-btn-* gradient buttons → flat arc buttons (the last home of that parallel family; the popup BOX rebuild deferred to the modal pass by founder choice); hardcoded tone hex → palette tokens (#16a34a green → --agent-success; #b45309 amber pill → --agent-warning; #2563eb blue pill + 'raised' timeline dot → --agent-info; navy ball drop-shadow → --agent-shadow-rgb). Empty-state re-hero fixed: the big coral hero now shows for genuine first-run only (no self-managed files); the resting 'no open enquiries' state renders the canonical animated arc EmptyState INSIDE the list (stat cards + search stay, like To-Do), copy 'No sales at enquiry stage' (founder) + a 'No matches' filtered variant. ChaseBar (drag-to-flip court slider) + enq-card (expandable row) registered as deliberate domain primitives via components/enquiries/README.md (Law 14), not force-migrated (Law 19). EnquiriesEmptyState still hand-copies OnboardingHero (the 14-hero follow-up) — kept, it's visually signed off." },
  { flow: "Hub (/agent/hub)", date: "23 Nov 2026", note: "Deep-tree sign-off audit of the flagship (compare at /dev/components/compare/hub-signoff) across hub-view + the full card suite — already strongly canonical. Deleted 3 dead files (AttentionListView, SectionLoading, PipelineStageHover) + the help demo + the dead InlineLoadingCard. Applied: activity-feed icon colours tokenised (call→--agent-info, sms→--agent-indigo, WhatsApp brand teal kept) + dead bg field dropped; hardcoded tone hex → tokens (HubListCard muted slate→--agent-text-muted, Bookings warning #b45309→--agent-warning, RowActionMenu danger #b91c1c→--agent-danger); Bookings raw checkbox → ui/Checkbox (coral box-tick); AttentionCard raw <select> → Select, inline all-clear dot → StatusDot; NeedsFilingCard glass pills → outline (de-tint); pipeline-health stat cells → StatBlock; service-split legend → LegendItem + 'By our fee income' eyebrow → agent-eyebrow; progressor no-files panel → arc EmptyState + decorative ghost preview deleted; typed ↑/↓ momentum + Wins trends → TrendUp/TrendDown icons. Registered 4 deliberate domain primitives (pipeline strip, diary row + its deliberate semantic tint, attention row grid, resume-hold modal) + the pipeline stage palette via new components/hub/README.md (Law 14/19). Grandfathered at founder request: BookingsToConfirmCard hand-rolled shell (byte-identical, no visual gain). Recent-activity row layout kept as-is (founder prefers the live row) — only its icon colour tokenised. Dead TONE.iconBg config fields left in place (unused, harmless)." },
  { flow: "All Files (/agent/transactions)", date: "23 Nov 2026", note: "Canonical-alignment audit of the biggest page — 4 views in one (Pipeline/List/Forecast/Map), ~15 components (compare at /dev/components/compare/all-files-signoff; 33 reviewed → 5 compliant, 22 align, 3 new canonicals, 3 exceptions). Applied over 3 commits, all clean files (the icon-shim swap was reverted to @phosphor in the 3 shim-dirty files — FilterMenu/MonthlyTargetMenu/RiskBadgeWithPopover — so no shim shipped; globals.css left untouched). Chrome: search input hand-SVG magnifier + typed × → MagnifyingGlass/X icons; status-tab counts → CountBadge; filtered/narrowed/internal-staff empties → arc EmptyState; the search+tabs container extracted to a new canonical ui/SearchTabsBar (Completions can adopt next). List: predicted-exchange cell Tailwind slate/red → tokens; status hex (#2563a8/#64748b/#5b6b8c, rgba(199,62,62,…)) → tokens; retired UPPERCASE eyebrows (headers + card labels) → sentence-case; risk popover typed ✓/✗ → Check/X icons; the 'N of 6' journey bar + its ReachedCell duplicate unified onto a new canonical ui/StageBar. Pipeline: 'Busiest' badge de-tinted to outline, two missing stage colours added. Map: segmented → flat coral (matches forecast toggle), legend hex → tokens. Forecast: em-dashes removed (Law 21). FilterMenu coral-gradient badge → CountBadge; MonthlyTargetMenu error → .agent-helper-error. The two hub/month filter banners extracted to a new ActiveFilterBanner (border-only, sidesteps a live \\*-comment CSS bug in globals.css). New components/transactions/README.md registers the Pipeline board, Forecast confidence chart, Map (WebGL paint can't read tokens), table row + filter controls as deliberate domain primitives. Registered (not migrated): the RiskBadgeWithPopover hand-rolled popover (works; full Popover rewrite deferred). Onboarding hero → OnboardingHero left for the founder's separate first-look-empty pass. Commits: 92e68af6, 8ee97ceb, + part 3." },
  { flow: "Chains (/agent/chains)", date: "23 Nov 2026", note: "Deep-tree sign-off audit (compare at /dev/components/compare/chains) — 46 components across 4 parallel audits; the page was already strongly canonical in its chrome (PageHeader, StatCards, tab bar, CountBadge, Popover, Pill, PropertyThumb, EmptyState usage). Applied: search box aligned to the SearchTabsBar search-half conventions (magnifier weight regular at left 12, symmetric 34px paddings, clear → agent-icon-btn-sm); filter-menu tick → canonical AnimatedTick (row kept, label-left/tick-right, catalogued as a menu-check row); all 5 in-tab empties + the 'No matches' variants → arc EmptyState with founder-reworded copy; empty CTA inline-CSS flat coral → the real .agent-canon-cta .agent-btn-primary (dead .chains-empty-cta CSS removed). New shared canonicals: ui/CountChip (the 'N links' icon-count chip) + ui/MetaStatRow (MetaStatItem + MetaStatDivider — the footer below/above/connected/invite/bounced/declined row), both extracted from ChainCard. ChainMiniMap (the numbered node ladder) promoted to canonical as-is (ChainNodeStepper), no visual change. ChainStepTicks (the shared 9-step confirm-progress track) catalogued + its typed ✓ → Check icon. Check-ins tab (CheckInsList): hand-rolled photo → PropertyThumb, bespoke progress bar → ui/ProgressBar, mini dots → ui/StepDots, row radius 13→14, step-rail typed ✓ → Check icon, .ciq-logbtn → agent-btn-ghost-bordered, em-dash in empty copy removed (Law 21). Push-to-exchange (ExchangePushList/ExchangeChecklist, the latter also on the file Overview): green tags → Pill success, typed ▾/→ → Phosphor carets, Book CTA → canonical button (flat green), Chase → agent-link, checklist panel + own-sale row green washes de-tinted (no-faded-fills). The ⋯ row menu (shared account/chrome/RowActionsMenu, used app-wide) trigger → canonical agent-icon-btn (circular shade-on-hover, matches Enquiries) + de-shimmed its icon import. HELD as functional follow-ups (not clean-visual): item 8 confirm/undo text-links → primary/secondary buttons (layout + ViewChainButton prefetch), and the Check-ins step-track dedup onto the shared ChainStepTicks (server-action wiring) — only the typed ✓ fixed in both for now." },
  { flow: "Password reset (/forgot-password, /reset-password)", date: "24 Nov 2026", note: "Both re-skinned to the canonical login/register shell — sunlit photo background + white veil + entrance animation, TSP lockup, 28px/600 heading, solid white card. Forgot: LabelInput email + arc Button + InlineAlert + 'check your email' success. Reset: two LabelInput password fields (each with the canonical eye) + PasswordStrength + length hint, arc Button, InlineAlert, invalid-link guard + 'password updated → redirect' success. All wiring (API calls, 429, lowercase-on-blur, validation) untouched." },
  { flow: "Invitations — agency team + negotiator (/invite/[token], /invite-negotiator/[token])", date: "24 Nov 2026", note: "Both flows — landing, error card, and email+password signup — moved off the old SunriseBackground glass look onto the canonical login/register shell (photo bg, TSP lockup, white card). OAuth → arc Button (secondary); the email+password link carries the arc secondary classes (keeps real link semantics); mismatch notice → InlineAlert (warning); sign-out → arc primary; the pre-filled invited email uses the new LabelInput `locked` variant (greyed, read-only). Error states (not found / expired / already accepted) and the negotiator's email-mismatch sign-out rule preserved. Backgrounds left on the shared login photo (not the invite photo — that's the claim page). move-invite NOT yet done." },
  { flow: "Chain invite — claim landing (/claim)", date: "24 Nov 2026", note: "Flattened to the no-gradient-3D direction: flat position circles, flat solid-coral CTA, text-only status labels (Joined keeps a green tick), solid-orange 'your sale' card with white content (its sub-line now shows the invited agency, not a duplicate 'Your sale'), circular property thumbnails with the warm-peach SOLD badge placeholder (a real uploaded photo fills the same circle), thinner headline weight, trust ticks kept (new canonical ui/TrustStrip registered — ticks + plain middot variants). Inviter 'top bar' kept bespoke (avatar flattened). Page background swapped to the responsive invite backgrounds (invite-bg-*.jpg). SCOPE: the /claim landing card only — the claim SUB-pages (signup / login / confirm / decline) are NOT yet audited (they share the claim-flow.css ladder styling but their own chrome is untouched)." },
  { flow: "Terms & legal pages (/terms, /privacy, /cookie-policy, /billing-terms, /outsourced-terms, /progression-business-terms, /provider-terms, /legal/dpa)", date: "24 Nov 2026", note: "The public policy / terms set — long-form legal text on the shared policy chrome (PolicyNavBar). Signed off visually. FUNCTIONAL BUG (not visual, tracked separately): /progression-business-terms is auth-gated by a middleware allowlist gap — a logged-out visitor clicking it from the register terms checkbox is bounced to /login, while every other terms page is public. Fix is to add it (plus /chases-paused, /unsubscribed, /feedback) to the middleware public matcher." },
  { flow: "Quote request (/quote/[token])", date: "24 Nov 2026", note: "The public provider-quote flow (TSP-progressed files only; a non-TSP file shows the 'ask your agent' dead-end). Canonicalised, wiring untouched: service selector → arc RadioGroup; contact preferences → arc ChipGroup (solid-coral chips); firm picker → the new CheckCardGroup (multi-select, white tick-in-circle top-right, firm logo in the leading slot); name/email/phone → LabelInput; uppercase field labels + header eyebrow → sentence case; both links → the canonical coral link; page background → the chain-invite backgrounds. Strings reworded (welcoming header, de-duplicated step titles, success copy). Two new canonicals registered in /dev/components (toggles): ChipGroup (solid-primary selected) + CheckCardGroup. Kept custom: the £ onward-price input + the free-text textarea (LabelInput is single-line). The submit stays disabled until required fields are filled (phone is required only when the chosen contact method needs it) — correct, not a bug." },
];

/* ── Still to do ─────────────────────────────────────────────────────────────
   The canonical pass's open list: pages/flows not yet signed off. Deliberately
   EXCLUDES the client (buyer/seller) portals, the broker/solicitor portals and
   the command centre (separate programmes). Rendered under the Signed-off view
   so the remaining count stays visible. Tick these off as each is signed off. */
export interface ToDoItem { flow: string; note?: string }
export const TO_DO: ToDoItem[] = [
  // Auth / invite stragglers
  { flow: "Claim sub-pages (/claim/signup · login · confirm · decline)", note: "The chain-invite landing is signed off; the rest of that flow isn't." },
  { flow: "move-invite (/move-invite/[token])", note: "Last invite-family stray; flag-gated." },
  { flow: "2FA setup (account security)", note: "The login 2FA stage is signed off; the setup screen isn't." },
  // Client-facing notices (not the portal)
  { flow: "Feedback survey (/feedback/[token]/survey)", note: "Client email link. Also carries the middleware auth-gate bug." },
  { flow: "Chases paused (/chases-paused)", note: "Client email link. Also carries the middleware auth-gate bug." },
  { flow: "Unsubscribed (/unsubscribed)", note: "Client email link. Also carries the middleware auth-gate bug." },
  // File-detail page + tabs (the core working surface)
  { flow: "File page · Overview + property hero" },
  { flow: "File page · Steps / Activity tab" },
  { flow: "File page · Chain tab" },
  { flow: "File page · Reminders tab" },
  { flow: "File page · Chase tab" },
  { flow: "File page · To-Do tab" },
  { flow: "File page · Documents tab" },
  { flow: "File page · Client-portal tab" },
  { flow: "File page · WhatsApp tab" },
  { flow: "File page · Setup tab" },
  // Settings cluster
  { flow: "Account settings", note: "Profile, emails, chasing, client-portal, billing, team, security, notifications, connections, connect-CRM, email-templates, welcome-call." },
  { flow: "Business settings", note: "The mirrored set (profile, billing, chases, client-portal, emails, business, connections, security, notifications, team, email-templates)." },
  // Remaining agent pages
  { flow: "Analytics (/agent/analytics)", note: "Empty state signed off; populated page not." },
  { flow: "Clients (/agent/clients + agency detail)", note: "Empty state signed off; populated page not." },
  { flow: "Completions (/agent/completions)", note: "Empty state signed off; populated page not." },
  { flow: "Focus (/agent/focus)" },
  { flow: "Messages (/agent/messages)" },
  { flow: "Partners (/agent/partners + partner detail)", note: "Empty state signed off; populated page not." },
  { flow: "Solicitors (/agent/solicitors)" },
  { flow: "To-Do (/agent/to-do, full page)", note: "Empty state signed off; full page not." },
  { flow: "What's new (/agent/whats-new)" },
  { flow: "Quick-add (new sale)" },
];

/* ── The components themselves ───────────────────────────────────────────────
   The entries live in ./components (a .tsx file — they carry live JSX previews)
   so this module stays JSX-free and there is no import cycle. Entries are added
   one at a time, by review. See ./components. */

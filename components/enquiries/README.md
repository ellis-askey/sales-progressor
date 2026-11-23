# `components/enquiries/` — Enquiries triage surface

Domain components for the Enquiries page (`/agent/enquiries`), which tracks the
"court" of every open enquiry loop (which solicitor currently holds it) and
drives the chase. Everything here is specific to that workflow — none is a
candidate for `components/ui/`.

| Component | What it is | Why it's domain-specific, not a primitive |
|---|---|---|
| `EnquiriesTriageList` | The whole triage list: stat cards, filters, per-enquiry rows, the drag-to-flip slider, chase controls, and an expandable detail drawer. | Composes canonical primitives (StatCards, Select, PropertyThumb, arc Button, AnchoredPanel, DateField, arc EmptyState) around the enquiries-specific court/chase model. |
| `ChaseBar` | The drag-to-flip "court" slider on each row — a bidirectional-fill track with a draggable ball that moves a loop between the seller's and buyer's solicitor. | A genuine custom control with no canonical equivalent: bidirectional fill, drag-to-commit ball, per-stage colour, handover drain/regrow. `ProgressBar` (one-directional) and `StepDots` don't model it. **Registered as a deliberate domain primitive (2026-11-23 sign-off).** |
| `enq-card` (CSS in `app/agent/styles/agent-system.css`) | The expandable enquiry row shell — holds the slider, the action cluster, and an accordion detail drawer. | More complex than the shared row / `FeedRowShell`; forcing it onto the shared shell risks behavioural change (Law 19). **Registered as a deliberate domain row (2026-11-23 sign-off).** |
| `EnquiriesEmptyState` | The first-run onboarding hero + "How it works" cards. Shown only when the agency has no self-managed files. | The onboarding-hero pattern shared with Comms / To-Do / Completions. The resting "no open enquiries" empty is the canonical arc `EmptyState`, rendered inside the list — not this hero. |
| `EnquiryLogSheet` | Sheet to log a manual chase or movement. | Enquiries-specific logging form. Own modal/drawer pass. |
| `EnquiryEmailPreview` | Read-only preview of a sent chase email. | Enquiries-specific email preview. Own modal/drawer pass. |
| `AddSolicitorModal` | Add a missing solicitor inline from a log sheet. | Enquiries-specific inline add. Own modal/drawer pass. |

Sign-off residuals + rationale: `app/dev/components/compare/enquiries-signoff`.

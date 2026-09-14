# components/command/ai-outreach

Domain components for the Command Centre → Growth → **AI Outreach** surface. Superadmin-only. Dark CC visual system (reuses `components/command/ui/primitives.tsx`).

| Component | Why it's domain-specific (not a `components/ui` primitive) |
|---|---|
| `GenerateProposalButton.tsx` | The manual "Generate a proposal" trigger. Wraps the outreach-specific `runStrategyCycleAction` server action (strategist → reviewer → conditional revision). Generation only — it cannot approve, launch, assign prospects, or send. Not reusable outside this surface. |
| `ExperimentReviewActions.tsx` | The Build Order G approval decision bar + pre-approval edit form for one proposal (approve / reject / discard / reviewer-override / edit). Wraps the outreach approval server actions. Approval marks intent only; nothing sends or launches. Edits re-run app guardrails + feasibility server-side. Not reusable outside this surface. |
| `LaunchPanel.tsx` | The Build Order H launch controls for an approved (preflight + Launch, with under-sample confirm) or running (send tallies + Resume) experiment. Wraps the launch server actions; all authority is server-side. Nothing sends outside the Europe/London business window. Not reusable outside this surface. |

The AI Outreach page itself (`app/command/(protected)/ai-outreach/page.tsx`) is server-rendered from the shared primitives; only genuinely interactive controls live here as client components.

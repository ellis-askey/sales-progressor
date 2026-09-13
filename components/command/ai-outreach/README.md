# components/command/ai-outreach

Domain components for the Command Centre → Growth → **AI Outreach** surface. Superadmin-only. Dark CC visual system (reuses `components/command/ui/primitives.tsx`).

| Component | Why it's domain-specific (not a `components/ui` primitive) |
|---|---|
| `GenerateProposalButton.tsx` | The manual "Generate a proposal" trigger. Wraps the outreach-specific `runStrategyCycleAction` server action (strategist → reviewer → conditional revision). Generation only — it cannot approve, launch, assign prospects, or send. Not reusable outside this surface. |

The AI Outreach page itself (`app/command/(protected)/ai-outreach/page.tsx`) is server-rendered from the shared primitives; only genuinely interactive controls live here as client components.

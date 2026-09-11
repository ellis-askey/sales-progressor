// Autopilot levels + guardrails (docs/active/content-brand/SPEC.md, Phase 5.2).
// Pure data, server- and client-safe.

export const AUTOPILOT_LEVELS = [
  { id: "manual", label: "Manual", desc: "We surface ideas. You write and approve everything." },
  { id: "assisted", label: "Assisted", desc: "We draft and prepare posts. You approve each one." },
  { id: "trusted", label: "Trusted", desc: "We pick ideas, draft and schedule them. You give final approval." },
  { id: "autopilot", label: "Autopilot", desc: "Approved categories get scheduled automatically within your rules." },
] as const;

export type AutopilotLevel = (typeof AUTOPILOT_LEVELS)[number]["id"];

export function autopilotLabel(id: string): string {
  return AUTOPILOT_LEVELS.find((l) => l.id === id)?.label ?? id;
}

// Fixed policy: what autopilot must NEVER publish without explicit approval, at
// any level. Enforced at the (future) publish step.
export const AUTOPILOT_GUARDRAILS = [
  "Anything with an unresolved unverified factual claim.",
  "Sensitive topics.",
  "A strong new opinion Ellis has never approved.",
  "A personal story Ellis has not explicitly approved.",
  "Major company announcements.",
  "Anything outside the established persona boundaries.",
];

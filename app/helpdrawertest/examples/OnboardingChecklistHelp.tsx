"use client";

import { OnboardingChecklistView } from "@/components/agent/OnboardingChecklistView";

// Preview state: first three steps done, last three pending
const PREVIEW_STEPS = [
  { label: "Add your first sale",            href: "/agent/transactions/new", done: true  },
  { label: "Add client contact details",     href: "/agent/dashboard",        done: true  },
  { label: "Share the portal with a client", href: "/agent/comms",            done: true  },
  { label: "Add your phone number",          href: "/agent/settings",         done: false },
  { label: "Choose your branch theme",       href: "/agent/settings",         done: false },
  { label: "Verify your email address",      href: "/agent/settings",         done: false },
];

export function OnboardingChecklistHelpExample(_props: Record<string, string>) {
  return (
    <OnboardingChecklistView
      steps={PREVIEW_STEPS}
      completedCount={3}
      totalCount={6}
    />
  );
}

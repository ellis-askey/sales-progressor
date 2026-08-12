"use client";

// Copies a ready-to-send onboarding message for a surveyor — everything we
// need to fill in their firm card. Ellis pastes it into an email / WhatsApp.

import { useState } from "react";

const MESSAGE = `Hi,

We'd love to add your firm to our surveyor panel. When a homebuyer needs a survey in your area, we send you their details so you can quote — there's no cost to be listed.

To set you up, could you send me:

• Are you RICS regulated? (yes/no)
• The year your firm was established
• Your typical turnaround for a quote (e.g. "within 2 working days")
• The postcode areas you cover (just the outward codes, e.g. EN8, HP4, SW1)
• Which surveys you offer: Level 2 HomeBuyer report, Level 3 Building survey, RICS Valuation, New-build snagging
• The email address quote requests should go to
• Your logo (PNG, JPEG, SVG or WEBP — square works best)
• A one-line intro for your card (e.g. "RICS regulated, 15 years covering North London, fast turnaround")

Thanks!`;

export function CopyOnboardingButton() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(MESSAGE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-[11px] px-2.5 py-1 rounded border border-[#262626] text-[#a3a3a3] hover:text-[#fafafa] hover:border-[#404040] transition-colors"
      title="Copy a message to send a surveyor asking for everything we need"
    >
      {copied ? "Copied ✓" : "Copy surveyor request"}
    </button>
  );
}

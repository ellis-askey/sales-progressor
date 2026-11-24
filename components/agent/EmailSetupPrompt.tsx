"use client";

// Director hub prompt (Phase 2 of agency email readiness). A quiet, dismissible
// nudge shown at the top of the hub for directors whose agency is still sending
// from the shared Sales Progressor address, pointing them at the sender setup
// that already exists. Reads the same hasVerifiedSender signal the onboarding
// checklist uses (a verified sending domain), so it disappears the moment the
// domain authenticates. Only mounted for directors by the hub; it self-gates on
// readiness + a per-user dismissal.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { PromoCard } from "@/components/agent/PromoCard";
import { buttonClasses } from "@/components/arc/button/button";

const dismissedKey = (userId: string) => `sp_email_prompt_dismissed_${userId}`;

export function EmailSetupPrompt({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(dismissedKey(userId))) {
      setDismissed(true);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/agent/onboarding-progress");
        if (!res.ok) return;
        const data = (await res.json()) as { progress: { hasVerifiedSender?: boolean } };
        if (alive && !data.progress?.hasVerifiedSender) setShow(true);
      } catch {
        // non-critical; stay hidden on error
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  function dismiss() {
    localStorage.setItem(dismissedKey(userId), "1");
    setDismissed(true);
  }

  if (dismissed || !show) return null;

  // Agency copy. EmailSetupPrompt is director-only (mounted at hub-view.tsx
  // behind `role === "director" && session.user.agencyId`), so external
  // progression-business users never see this card — no external variant wired.
  // TODO(critique): external variant — card is director-only; external users never reach it.
  return (
    <PromoCard
      glassId="hub-email-nudge"
      label="Hub · Email nudge banner"
      className="agent-reveal-in agent-canon-cta"
      icon={<PaperPlaneTilt size={20} weight="fill" />}
      title="Send emails from your own address"
      body="Connect your agency email so client updates come directly from you, keeping every communication familiar, personal and on-brand."
      footnote={
        <>
          Want to make these emails your own?{" "}
          {/* Canon coral text link — .agent-link (shared coral + hover underline/darken). */}
          <Link href="/agent/account/emails" className="agent-link" style={{ fontWeight: 600 }}>
            Personalise your client emails
          </Link>
        </>
      }
      cta={
        <>
          <Link
            href="/agent/account/connections"
            className="agent-btn agent-btn-primary agent-btn-sm"
            style={{ textDecoration: "none" }}
          >
            Connect my email
          </Link>
          {/* Canon ghost (arc Button) — hover / focus / active states built in. */}
          <button type="button" onClick={dismiss} className={buttonClasses({ variant: "ghost", size: "sm" })}>
            Not now
          </button>
        </>
      }
      onDismiss={dismiss}
    />
  );
}

"use client";

// Hub prompt (Phase 2 of email readiness). A quiet, dismissible nudge shown at
// the top of the hub, pointing at the sender setup that already exists, and
// disappearing the moment a verified sending address is in place.
//
// Two audiences:
//   - "agency" (default): a director whose agency is still on the shared Sales
//     Progressor address. Readiness = the onboarding-progress hasVerifiedSender
//     signal (a verified sending domain). Setup lives at /agent/account/*.
//   - "business": an external progression-business OWNER whose business has no
//     verified default sender yet. Readiness = the business sender status
//     (/api/agent/settings/sender → senderVerified, or a verified domain). Setup
//     lives on the owner's own Emails settings page. Only owners can set the
//     business sender, so the hub mounts this variant for owners only.
//
// Both self-gate on readiness + a per-user dismissal.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { PromoCard } from "@/components/agent/PromoCard";
import { buttonClasses } from "@/components/arc/button/button";

const dismissedKey = (userId: string) => `sp_email_prompt_dismissed_${userId}`;

type Audience = "agency" | "business";

// Per-audience readiness probe. Returns true when the nudge should SHOW (no
// verified sending address yet), false when it should stay hidden. Any error or
// non-ok response resolves to "hidden" — this is a non-critical nudge.
async function shouldShow(audience: Audience): Promise<boolean> {
  if (audience === "business") {
    // Business default sender: verified when the owner has a confirmed single
    // sender (senderVerified + senderEmail) or an authenticated domain. Mirrors
    // the component's own "verified" resting state.
    const res = await fetch("/api/agent/settings/sender");
    if (!res.ok) return false;
    const s = (await res.json()) as {
      senderEmail?: string | null;
      senderVerified?: boolean;
      domain?: { status?: string } | null;
    };
    const verified = (!!s.senderVerified && !!s.senderEmail) || s.domain?.status === "verified";
    return !verified;
  }
  const res = await fetch("/api/agent/onboarding-progress");
  if (!res.ok) return false;
  const data = (await res.json()) as { progress: { hasVerifiedSender?: boolean } };
  return !data.progress?.hasVerifiedSender;
}

export function EmailSetupPrompt({ userId, audience = "agency" }: { userId: string; audience?: Audience }) {
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
        if (await shouldShow(audience)) {
          if (alive) setShow(true);
        }
      } catch {
        // non-critical; stay hidden on error
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, audience]);

  function dismiss() {
    localStorage.setItem(dismissedKey(userId), "1");
    setDismissed(true);
  }

  if (dismissed || !show) return null;

  const isBusiness = audience === "business";
  // Agency and business share the title, footnote and CTA labels; only the body
  // copy and the setup destinations differ. The business owner's sender setup
  // and client-email personalisation both live on their Emails settings page.
  const body = isBusiness
    ? "Connect your business email so client updates come directly from you, keeping every communication familiar, professional and under your own brand."
    : "Connect your agency email so client updates come directly from you, keeping every communication familiar, personal and on-brand.";
  const connectHref = isBusiness ? "/agent/settings/emails" : "/agent/account/connections";
  const personaliseHref = isBusiness ? "/agent/settings/emails" : "/agent/account/emails";

  return (
    <PromoCard
      glassId="hub-email-nudge"
      label="Hub · Email nudge banner"
      className="agent-reveal-in agent-canon-cta"
      icon={<PaperPlaneTilt size={20} weight="fill" />}
      title="Send emails from your own address"
      body={body}
      footnote={
        <>
          Want to make these emails your own?{" "}
          {/* Canon coral text link — .agent-link (shared coral + hover underline/darken). */}
          <Link href={personaliseHref} className="agent-link" style={{ fontWeight: 600 }}>
            Personalise your client emails
          </Link>
        </>
      }
      cta={
        <>
          <Link
            href={connectHref}
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

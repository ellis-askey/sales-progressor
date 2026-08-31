"use client";

import { useState, useOptimistic, useTransition } from "react";
import { PortalSheet } from "./PortalSheet";
import { P, PortalPill } from "./portal-ui";
import { PortalButton } from "./PortalButton";
import { PortalGlassCard } from "./PortalGlassCard";
import { portalConfirmMilestoneAction } from "@/app/actions/portal";
import { getEventDateLabel, getMilestoneConfirmCopy } from "@/lib/portal-copy";

type Props = {
  token: string;
  milestone: {
    id: string;
    label: string;
    who: string;
    code: string;
    eventDateRequired: boolean;
  };
  whatHappensNext: string | null;
};

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ["#FF8A65", "#FFB74D", "#FFD54F", "#FF6B4A", "#FFA726"],
  });
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 120,
      origin: { y: 0.4 },
      colors: ["#FF8A65", "#FFB74D", "#FFD54F"],
    });
  }, 260);
}

export function PortalNextActionCard({ token, milestone, whatHappensNext }: Props) {
  const [, startTransition] = useTransition();
  const [optimisticConfirmed, addOptimistic] = useOptimistic(false, () => true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isYours = milestone.who === "you";
  const confirmCopy = getMilestoneConfirmCopy(milestone.code);

  function openSheet() {
    setEventDate("");
    setError(null);
    setSheetOpen(true);
  }

  function closeSheet() {
    if (loading) return;
    setSheetOpen(false);
    setEventDate("");
    setError(null);
  }

  function confirm() {
    if (milestone.eventDateRequired && !eventDate) {
      setError("Please enter the date for this step.");
      return;
    }
    const ed = eventDate || null;
    setSheetOpen(false);
    setLoading(true);
    startTransition(async () => {
      addOptimistic(true);
      try {
        const result = await portalConfirmMilestoneAction({ token, milestoneDefinitionId: milestone.id, eventDate: ed });
        if (result.ok) {
          await fireConfetti();
          // revalidatePath in action triggers page re-render — no setTimeout needed
        } else if (result.reason === "agent_only") {
          // B1 hard-block — should never reach via normal UI flow (the card
          // doesn't surface bilateral codes), but surface the friendly copy
          // if it ever does (e.g. a crafted request).
          setError("We confirm this step once it's done.");
          setSheetOpen(true);
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setSheetOpen(true);
      } finally {
        setLoading(false);
      }
    });
  }

  if (optimisticConfirmed) {
    return (
      <div
        className="portal-reveal-fade rounded-2xl px-5 py-5"
        style={{ background: P.successBg, border: `1px solid rgba(16,185,129,0.20)`, boxShadow: P.shadowMd }}
      >
        <p className="text-[15px] font-semibold" style={{ color: P.success }}>
          ✓ Step confirmed, updating your progress…
        </p>
      </div>
    );
  }

  return (
    <>
      <PortalGlassCard
        glassId="next-step"
        label="Your next step"
        defaultVariant="v26"
        className="overflow-hidden"
        style={{ borderLeft: isYours ? `4px solid ${P.primary}` : undefined }}
      >
        <div className="px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ color: P.primary }}>
            Your next step
          </p>
          <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>
            {milestone.label}
          </p>
          <div className="mb-4">
            <PortalPill tone={isYours ? "coral" : "blue"} size="md">
              {isYours ? "Action needed from you" : `Waiting on your ${milestone.who}`}
            </PortalPill>
          </div>

          <PortalButton onClick={openSheet} loading={loading}>
            {loading ? "Saving…" : "Confirm this step"}
          </PortalButton>

          {whatHappensNext && (
            <div
              className="mt-3 px-3.5 py-3 rounded-xl"
              style={{ background: P.pageBg }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: P.textMuted }}>
                What happens next
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
                {whatHappensNext}
              </p>
            </div>
          )}
        </div>
      </PortalGlassCard>

      {/* Bottom sheet — PortalSheet handles blur + slide in/out. */}
      <PortalSheet open={sheetOpen} onClose={closeSheet} closeDisabled={loading}>
            <div className="px-6 pb-6 pt-2">
              <p className="text-[18px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>
                {milestone.eventDateRequired ? "When is this happening?" : "Are you sure?"}
              </p>
              {confirmCopy && (
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
                  {confirmCopy}
                </p>
              )}

              {milestone.eventDateRequired && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
                    {getEventDateLabel(milestone.code)} <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                    style={{
                      borderColor: P.border,
                      background: P.pageBg,
                      color: P.textPrimary,
                    }}
                  />
                </div>
              )}

              {error && (
                <p className="text-[13px] mb-3" style={{ color: "#EF4444" }}>{error}</p>
              )}

              <PortalButton onClick={confirm}>
                Confirm
              </PortalButton>
              <button
                onClick={closeSheet}
                className="pbtn pbtn-press w-full mt-3 py-3 text-[15px] font-medium rounded-xl"
                style={{ color: P.textSecondary, background: "transparent" }}
              >
                Cancel
              </button>
            </div>
      </PortalSheet>
    </>
  );
}

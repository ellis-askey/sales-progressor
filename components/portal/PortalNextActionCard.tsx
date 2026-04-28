"use client";

import { useState, useOptimistic, useTransition } from "react";
import { P } from "./portal-ui";
import { portalConfirmMilestoneAction } from "@/app/actions/portal";

const DATE_REQUIRED_CODES = new Set(["VM19", "VM20", "PM26", "PM27"]);

type Props = {
  token: string;
  milestone: {
    id: string;
    label: string;
    who: string;
    code: string;
  };
  nextAfterDescription: string | null;
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

export function PortalNextActionCard({ token, milestone, nextAfterDescription }: Props) {
  const [, startTransition] = useTransition();
  const [optimisticConfirmed, addOptimistic] = useOptimistic(false, () => true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [eventDate, setEventDate] = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const isYours = milestone.who === "you";

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
    if (DATE_REQUIRED_CODES.has(milestone.code) && !eventDate) {
      setError("Please enter the date for this step.");
      return;
    }
    const ed = eventDate || null;
    setSheetOpen(false);
    setLoading(true);
    startTransition(async () => {
      addOptimistic(true);
      try {
        await portalConfirmMilestoneAction({ token, milestoneDefinitionId: milestone.id, eventDate: ed });
        await fireConfetti();
        // revalidatePath in action triggers page re-render — no setTimeout needed
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
        className="rounded-2xl px-5 py-5"
        style={{ background: P.successBg, border: `1px solid rgba(16,185,129,0.20)`, boxShadow: P.shadowMd }}
      >
        <p className="text-[15px] font-semibold" style={{ color: P.success }}>
          ✓ Step confirmed — updating your progress…
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: P.cardBg,
          boxShadow: isYours ? P.heroGlow : P.shadowMd,
          borderLeft: isYours ? `4px solid ${P.primary}` : undefined,
        }}
      >
        <div className="px-5 py-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-3" style={{ color: P.primary }}>
            Your next step
          </p>
          <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>
            {milestone.label}
          </p>
          <div className="mb-4">
            <span
              className="text-[12px] font-semibold px-3 py-1 rounded-full"
              style={
                isYours
                  ? { background: P.primaryBg, color: P.primaryText }
                  : { background: P.accentBg, color: P.accent }
              }
            >
              {isYours
                ? "Action needed from you"
                : `Waiting on your ${milestone.who}`}
            </span>
          </div>

          {isYours && (
            <button
              onClick={openSheet}
              disabled={loading}
              className="w-full flex items-center justify-center py-3.5 rounded-xl text-[15px] font-bold text-white transition-opacity active:opacity-80 disabled:opacity-50"
              style={{ background: P.primary, boxShadow: P.heroGlow, borderRadius: P.radiusMd }}
            >
              {loading ? "Saving…" : "Confirm this step"}
            </button>
          )}

          {nextAfterDescription && (
            <div
              className="mt-3 px-3.5 py-3 rounded-xl"
              style={{ background: P.pageBg }}
            >
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: P.textMuted }}>
                After this
              </p>
              <p className="text-[13px] leading-relaxed" style={{ color: P.textSecondary }}>
                {nextAfterDescription}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={closeSheet}>
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,0.45)" }}
          />
          <div
            className="relative w-full max-w-lg mx-auto"
            style={{
              background: "#FFFFFF",
              borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`,
              boxShadow: P.shadowXl,
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
            </div>

            <button
              onClick={closeSheet}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(15,23,42,0.06)", color: P.textMuted }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            <div className="px-6 pb-6 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: P.primary }}>
                Confirm step
              </p>
              <p className="text-[18px] font-semibold leading-snug mb-4" style={{ color: P.textPrimary }}>
                {DATE_REQUIRED_CODES.has(milestone.code) ? "When is this happening?" : "Mark this step as done?"}
              </p>

              {DATE_REQUIRED_CODES.has(milestone.code) && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
                    Date <span style={{ color: "#EF4444" }}>*</span>
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

              <button
                onClick={confirm}
                className="w-full flex items-center justify-center py-4 rounded-xl text-[15px] font-bold text-white transition-opacity"
                style={{ background: P.primary, borderRadius: P.radiusMd }}
              >
                {DATE_REQUIRED_CODES.has(milestone.code) ? "Confirm date" : "Yes, it's done"}
              </button>
              <button
                onClick={closeSheet}
                className="w-full mt-3 py-3 text-[15px] font-medium rounded-xl transition-colors"
                style={{ color: P.textSecondary, background: "transparent" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

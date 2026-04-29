"use client";

import { useState, useOptimistic, useTransition } from "react";
import { P, VENDOR_GROUPS, PURCHASER_GROUPS } from "./portal-ui";
import { portalConfirmMilestoneAction, portalMarkNotRequiredAction } from "@/app/actions/portal";
import { getEventDateLabel } from "@/lib/portal-copy";
import { SearchesUpload } from "./SearchesUpload";


type Milestone = {
  id: string;
  code: string;
  orderIndex: number;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
  isPostExchange: boolean;
  isExchangeGate: boolean;
  completedAt: Date | null;
  eventDate: Date | null;
  label: string;
  labelOther?: string | null;
  who: string;
  whoLabel: string;
  confirmedByPortal: boolean;
  description?: string | null;
  eventDateRequired: boolean;
};

type Props = {
  token: string;
  milestones: Milestone[];
  otherSideMilestones: Milestone[];
  hasExchanged: boolean;
  side: string;
};

function fmtDate(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

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
  }, 250);
}

export function PortalMilestoneList({ token, milestones, otherSideMilestones, hasExchanged, side }: Props) {
  const [, startTransition] = useTransition();
  const [optimisticMilestones, addOptimistic] = useOptimistic(
    milestones,
    (current, confirmedId: string) =>
      current.map((m) => m.id !== confirmedId ? m : { ...m, isComplete: true })
  );
  const [confirming, setConfirming]         = useState<string | null>(null);
  const [eventDate, setEventDate]           = useState("");
  const [loading, setLoading]               = useState(false);
  const [processingId, setProcessingId]     = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);
  const [showOtherSide, setShowOtherSide]   = useState(false);
  const [helpMilestone, setHelpMilestone]   = useState<Milestone | null>(null);
  const [skipSurveyId, setSkipSurveyId]     = useState<string | null>(null);
  const [skipLoading, setSkipLoading]       = useState(false);

  const groups      = side === "vendor" ? VENDOR_GROUPS : PURCHASER_GROUPS;
  const otherGroups = side === "vendor" ? PURCHASER_GROUPS : VENDOR_GROUPS;

  const byCode      = new Map(optimisticMilestones.map((m) => [m.code, m]));
  const otherByCode = new Map(otherSideMilestones.map((m) => [m.code, m]));

  const activeGroupIdx = groups.findIndex((g) =>
    g.codes.some((code) => {
      const m = byCode.get(code);
      return m && !m.isComplete && !m.isNotRequired && m.isAvailable;
    })
  );

  const [expanded, setExpanded] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {};
    groups.forEach((_, i) => { init[i] = i === activeGroupIdx || (hasExchanged && i === groups.length - 1); });
    return init;
  });

  function toggle(i: number) { setExpanded((p) => ({ ...p, [i]: !p[i] })); }

  function openSheet(id: string) {
    setConfirming(id);
    setEventDate("");
    setError(null);
  }

  function closeSheet() {
    if (loading) return;
    setConfirming(null);
    setEventDate("");
    setError(null);
  }

  function confirmMilestone(milestoneId: string, isTimeSensitive: boolean) {
    if (isTimeSensitive && !eventDate) {
      setError("Please enter the date for this step.");
      return;
    }
    const ed = eventDate || null;
    setConfirming(null);
    setEventDate("");
    setLoading(true);
    setProcessingId(milestoneId);
    startTransition(async () => {
      addOptimistic(milestoneId);
      try {
        await portalConfirmMilestoneAction({ token, milestoneDefinitionId: milestoneId, eventDate: ed });
        await fireConfetti();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setConfirming(milestoneId);
      } finally {
        setLoading(false);
        setProcessingId(null);
      }
    });
  }

  function skipSurvey(milestoneId: string) {
    setSkipSurveyId(null);
    setSkipLoading(true);
    startTransition(async () => {
      addOptimistic(milestoneId);
      try {
        await portalMarkNotRequiredAction({ token, milestoneDefinitionId: milestoneId });
      } catch {
        // survey skip failed — page will revalidate and show correct state
      } finally {
        setSkipLoading(false);
      }
    });
  }

  const confirmingMilestone = confirming ? optimisticMilestones.find((m) => m.id === confirming) ?? null : null;

  return (
    <>
      <div className="space-y-3">
        {/* ── Your milestones ───────────────────────────────────── */}
        {groups.map((group, gIdx) => {
          const groupMilestones = group.codes.map((c) => byCode.get(c)).filter((m): m is Milestone => !!m);
          if (groupMilestones.length === 0) return null;
          if (group.label === "After Exchange" && !hasExchanged) return null;

          const doneCount  = groupMilestones.filter((m) => m.isComplete || m.isNotRequired).length;
          const totalCount = groupMilestones.length;
          const allDone    = doneCount === totalCount;
          const isActive   = gIdx === activeGroupIdx;
          const isOpen     = expanded[gIdx] ?? false;

          const headerBg = allDone ? P.successBg : isActive ? P.accentBg : "transparent";

          return (
            <div key={group.label} className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
              <button
                className="w-full flex items-center gap-3 px-5 py-4 text-left"
                style={{
                  background: headerBg,
                  borderBottom: isOpen ? `1px solid ${P.border}` : undefined,
                }}
                onClick={() => toggle(gIdx)}
              >
                <span className="text-xl flex-shrink-0">{group.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>{group.label}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: P.textSecondary }}>
                    {allDone ? "All complete" : `${doneCount} of ${totalCount} done`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {allDone ? (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: P.successBg, color: P.success }}>Done ✓</span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: P.primaryBg, color: P.primaryText }}>{doneCount}/{totalCount}</span>
                  )}
                  <ChevronIcon open={isOpen} />
                </div>
              </button>

              {isOpen && (
                <div>
                  {groupMilestones.map((m, mIdx) => {
                    const isLast        = mIdx === groupMilestones.length - 1;
                    const canConfirm    = !m.isComplete && !m.isNotRequired && m.isAvailable;
                    const isLocked      = !m.isComplete && !m.isNotRequired && !m.isAvailable;
                    const isProcessing  = processingId === m.id;

                    return (
                      <div
                        key={m.id}
                        className={isProcessing ? "animate-pulse" : ""}
                        style={{
                          borderBottom: !isLast ? `1px solid ${P.border}` : undefined,
                          opacity: isLocked ? 0.35 : 1,
                        }}
                      >
                        <div className="flex items-start gap-3.5 px-5 py-4">
                          <StatusDot isComplete={m.isComplete} isLocked={isLocked} canConfirm={canConfirm} isProcessing={isProcessing} />

                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium leading-snug" style={{ color: m.isComplete ? P.textMuted : P.textPrimary, textDecoration: m.isComplete ? "line-through" : "none" }}>
                              {m.label}
                            </p>
                            <p className="text-[12px] mt-0.5" style={{ color: m.isComplete ? P.success : P.textMuted }}>
                              {m.isComplete
                                ? `Confirmed${m.confirmedByPortal ? " by you" : ""}${m.completedAt ? ` · ${fmtDate(m.completedAt)}` : ""}${m.eventDate ? ` · ${fmtDate(m.eventDate)}` : ""}`
                                : m.whoLabel
                              }
                            </p>
                            {m.code === "PM10" && !isLocked && (
                              <SearchesUpload token={token} />
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 self-center">
                            {m.description && (
                              <button
                                onClick={() => setHelpMilestone(m)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold"
                                style={{ background: P.border, color: P.textMuted }}
                                aria-label="What does this mean?"
                              >
                                ?
                              </button>
                            )}
                            {canConfirm && (
                              <div className="flex flex-col items-end gap-1.5">
                                <button
                                  onClick={() => openSheet(m.id)}
                                  className="px-4 py-2 rounded-xl text-[13px] font-bold"
                                  style={{ background: P.primaryBg, color: P.primaryText }}
                                >
                                  Confirm
                                </button>
                                {m.code === "PM9" && (
                                  <button
                                    onClick={() => setSkipSurveyId(m.id)}
                                    className="text-[11px] font-medium underline"
                                    style={{ color: P.textMuted }}
                                  >
                                    Skip survey
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Other side progress (read-only) ─────────────────── */}
        {otherSideMilestones.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd, borderLeft: `3px solid rgba(139,145,163,0.25)` }}>
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              style={{ borderBottom: showOtherSide ? `1px solid ${P.border}` : undefined }}
              onClick={() => setShowOtherSide((v) => !v)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={P.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-semibold" style={{ color: P.textSecondary }}>
                    {side === "vendor" ? "Purchase progress" : "Sale progress"}
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: P.border, color: P.textMuted }}>
                    View only
                  </span>
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: P.textMuted }}>
                  {otherSideMilestones.filter((m) => m.isComplete).length} of {otherSideMilestones.filter((m) => !m.isNotRequired).length} steps done
                </p>
              </div>
              <ChevronIcon open={showOtherSide} />
            </button>

            {showOtherSide && (
              <div>
                {otherGroups.map((group) => {
                  const groupMilestones = group.codes.map((c) => otherByCode.get(c)).filter((m): m is Milestone => !!m);
                  if (groupMilestones.length === 0) return null;
                  if (group.label === "After Exchange" && !hasExchanged) return null;

                  const doneCount = groupMilestones.filter((m) => m.isComplete || m.isNotRequired).length;
                  const allDone   = doneCount === groupMilestones.length;

                  return (
                    <div key={group.label}>
                      <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: P.pageBg, borderBottom: `1px solid ${P.border}` }}>
                        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: P.textMuted }}>
                          {group.icon} {group.label}
                        </p>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: allDone ? P.successBg : P.primaryBg, color: allDone ? P.success : P.primaryText }}>
                          {doneCount}/{groupMilestones.length}
                        </span>
                      </div>
                      {groupMilestones.map((m, mIdx) => (
                        <div key={m.id} className="flex items-center gap-3.5 px-5 py-3" style={{ borderBottom: mIdx < groupMilestones.length - 1 ? `1px solid ${P.border}` : undefined }}>
                          <StatusDot isComplete={m.isComplete} isLocked={!m.isComplete && !m.isAvailable} canConfirm={false} />
                          <p className="text-[13px] flex-1" style={{ color: m.isComplete ? P.textMuted : P.textPrimary, textDecoration: m.isComplete ? "line-through" : "none" }}>
                            {m.labelOther ?? m.label}
                          </p>
                          {m.isComplete && (
                            <span className="text-[11px] flex-shrink-0" style={{ color: P.success }}>✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom sheet: milestone help / glossary ───────────── */}
      {helpMilestone && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setHelpMilestone(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
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
              onClick={() => setHelpMilestone(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,0.06)", color: P.textMuted }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="px-6 pb-6 pt-2">
              <span
                className="inline-block text-[11px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full mb-3"
                style={
                  helpMilestone.who === "you"
                    ? { background: P.primaryBg, color: P.primaryText }
                    : { background: P.accentBg, color: P.accent }
                }
              >
                {helpMilestone.whoLabel}
              </span>
              <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>
                {helpMilestone.label}
              </p>
              <p className="text-[14px] leading-relaxed" style={{ color: P.textSecondary }}>
                {helpMilestone.description}
              </p>
              <button
                onClick={() => setHelpMilestone(null)}
                className="w-full mt-6 py-4 rounded-xl text-[15px] font-bold text-white"
                style={{ background: P.primary, borderRadius: P.radiusMd }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom sheet: skip survey ────────────────────────── */}
      {skipSurveyId && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setSkipSurveyId(null)}>
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
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
              onClick={() => setSkipSurveyId(null)}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(15,23,42,0.06)", color: P.textMuted }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="px-6 pb-6 pt-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: P.warning }}>
                Skip survey
              </p>
              <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>
                Not getting a survey?
              </p>
              <p className="text-[14px] leading-relaxed mb-6" style={{ color: P.textSecondary }}>
                This will mark both "Book your survey" and "Survey report received" as not required. You can still proceed without a survey — this just removes those steps from your progress list.
              </p>
              <button
                onClick={() => skipSurvey(skipSurveyId!)}
                disabled={skipLoading}
                className="w-full flex items-center justify-center py-4 rounded-xl text-[15px] font-bold text-white disabled:opacity-50 transition-opacity"
                style={{ background: P.warning, borderRadius: P.radiusMd }}
              >
                {skipLoading ? "Saving…" : "Yes, skip the survey"}
              </button>
              <button
                onClick={() => setSkipSurveyId(null)}
                disabled={skipLoading}
                className="w-full mt-3 py-3 text-[15px] font-medium rounded-xl"
                style={{ color: P.textSecondary }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom sheet confirm ──────────────────────────────── */}
      {confirmingMilestone && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={closeSheet}>
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
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
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
            </div>

            {/* Close button */}
            <button
              onClick={closeSheet}
              className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
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
                {confirmingMilestone.eventDateRequired
                  ? "When is this happening?"
                  : confirmingMilestone.who === "you"
                    ? "Mark this step as done?"
                    : "Has this happened?"}
              </p>

              {confirmingMilestone.eventDateRequired && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
                    {getEventDateLabel(confirmingMilestone.code)} <span style={{ color: "#EF4444" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                    style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
                  />
                </div>
              )}

              {error && (
                <p className="text-[13px] mb-3" style={{ color: "#EF4444" }}>{error}</p>
              )}

              <button
                onClick={() => confirmMilestone(confirmingMilestone.id, confirmingMilestone.eventDateRequired)}
                disabled={loading}
                className="w-full flex items-center justify-center py-4 rounded-xl text-[15px] font-bold text-white disabled:opacity-50 transition-opacity"
                style={{ background: P.primary, borderRadius: P.radiusMd }}
              >
                {loading
                  ? "Saving…"
                  : confirmingMilestone.eventDateRequired
                    ? "Confirm date"
                    : confirmingMilestone.who === "you"
                      ? "Yes, it's done"
                      : "Yes, this has happened"}
              </button>
              <button
                onClick={closeSheet}
                disabled={loading}
                className="w-full mt-3 py-3 text-[15px] font-medium rounded-xl"
                style={{ color: P.textSecondary }}
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

function StatusDot({ isComplete, isLocked, canConfirm, isProcessing }: { isComplete: boolean; isLocked: boolean; canConfirm: boolean; isProcessing?: boolean }) {
  if (isComplete) {
    if (isProcessing) {
      return (
        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.successBg }}>
          <div
            className="w-3 h-3 rounded-full border-2 animate-spin"
            style={{ borderColor: P.success, borderTopColor: "transparent" }}
          />
        </div>
      );
    }
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.success }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  if (isLocked) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.pageBg }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={P.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
    );
  }
  return (
    <div
      className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ borderColor: canConfirm ? P.primary : P.border }}
    >
      {canConfirm && <div className="w-2 h-2 rounded-full" style={{ background: P.primary }} />}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke={P.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

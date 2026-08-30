"use client";

import { useState, useOptimistic, useTransition, useRef, useEffect, useLayoutEffect } from "react";
import { PortalSheet } from "./PortalSheet";

// Measure before paint on the client (avoids a height flash), plain effect on
// the server where useLayoutEffect would warn.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { P, VENDOR_GROUPS, PURCHASER_GROUPS } from "./portal-ui";
import { portalConfirmMilestoneAction, portalMarkNotRequiredAction, getPortalSurveyBookingOptions, recordPortalSurveyBookingAction } from "@/app/actions/portal";
import type { SurveyBookingOption, SurveyBookingChoice } from "@/lib/services/survey-booking";
import { getEventDateLabel, getMilestoneConfirmCopy } from "@/lib/portal-copy";
import { getMilestoneGuidance } from "@/lib/portal/milestone-guidance";
import { SearchesUpload } from "./SearchesUpload";
import { isPortalAgentOnly } from "@/lib/chase/portal-agent-only-codes";
import { PortalButton } from "./PortalButton";
import { PortalPill } from "./portal-ui";


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
  // Optional third panel (the seller's reported onward purchase). When present,
  // the toggle + swipe become three panels: [onward] [your side] [other side],
  // with onward to the LEFT so it swipes the opposite way from the other side.
  onwardPanel?: React.ReactNode;
  onwardLabel?: string;
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

export function PortalMilestoneList({ token, milestones, otherSideMilestones, hasExchanged, side, onwardPanel, onwardLabel }: Props) {
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
  const [activeSide, setActiveSide]         = useState<string>("own");
  const swipeRef                            = useRef<HTMLDivElement | null>(null);
  const settleTimer                         = useRef<number | null>(null);
  // Height-match the swipe row to the ACTIVE panel so a shorter side doesn't
  // inherit the tallest panel's height (empty space at the foot). Re-measures
  // on swipe and whenever the active panel's content changes (expand / confirm).
  const panelRefs                           = useRef<Record<string, HTMLDivElement | null>>({});
  const [panelHeight, setPanelHeight]       = useState<number | undefined>(undefined);
  const [helpMilestone, setHelpMilestone]   = useState<Milestone | null>(null);
  const [skipSurveyId, setSkipSurveyId]     = useState<string | null>(null);
  const [skipLoading, setSkipLoading]       = useState(false);
  // Survey-booking picker (buyer confirming PM9 on a file that requested quotes).
  const [surveyOptions, setSurveyOptions]   = useState<SurveyBookingOption[] | null>(null);
  const [surveyChoice, setSurveyChoice]     = useState<SurveyBookingChoice | null>(null);
  const [otherFirmName, setOtherFirmName]   = useState("");

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

  // Other-side (View only) groups collapse independently, keyed by label. They
  // all start collapsed except the earliest group that isn't fully done — the
  // one currently in progress on the other side.
  const otherActiveLabel = (() => {
    for (const group of otherGroups) {
      if (group.label === "After Exchange" && !hasExchanged) continue;
      const gm = group.codes.map((c) => otherByCode.get(c)).filter((m): m is Milestone => !!m && !m.isNotRequired);
      if (gm.length === 0) continue;
      const done = gm.filter((m) => m.isComplete || m.isNotRequired).length;
      if (done !== gm.length) return group.label;
    }
    return null;
  })();
  const [otherExpanded, setOtherExpanded] = useState<Record<string, boolean>>({});
  function toggleOther(label: string) { setOtherExpanded((p) => ({ ...p, [label]: !(p[label] ?? false) })); }

  function openSheet(id: string) {
    setConfirming(id);
    setEventDate("");
    setError(null);
    setSurveyOptions(null);
    setSurveyChoice(null);
    // If this is the survey-booked step and the buyer requested quotes through
    // us, load the firms so they can say who they booked.
    const m = milestones.find((mm) => mm.id === id);
    if (m?.code === "PM9") {
      getPortalSurveyBookingOptions(token)
        .then((opts) => { if (opts.length > 0) setSurveyOptions(opts); })
        .catch(() => {});
    }
  }

  function closeSheet() {
    if (loading) return;
    setConfirming(null);
    setEventDate("");
    setError(null);
    setSurveyOptions(null);
    setSurveyChoice(null);
  }

  function confirmMilestone(milestoneId: string, isTimeSensitive: boolean) {
    if (isTimeSensitive && !eventDate) {
      setError("Please enter the date for this step.");
      return;
    }
    if (surveyOptions && !surveyChoice) {
      setError("Please choose the surveyor you booked.");
      return;
    }
    const ed = eventDate || null;
    const choice: SurveyBookingChoice | null = surveyChoice?.kind === "someone_else"
      ? { kind: "someone_else", firmName: otherFirmName.trim() || undefined }
      : surveyChoice;
    setConfirming(null);
    setEventDate("");
    setSurveyOptions(null);
    setSurveyChoice(null);
    setOtherFirmName("");
    setLoading(true);
    setProcessingId(milestoneId);
    startTransition(async () => {
      addOptimistic(milestoneId);
      try {
        const result = await portalConfirmMilestoneAction({ token, milestoneDefinitionId: milestoneId, eventDate: ed });
        if (result.ok) {
          if (choice) await recordPortalSurveyBookingAction({ token, choice }).catch(() => {});
          await fireConfetti();
        } else if (result.reason === "agent_only") {
          // B1 hard-block hit. Normally the UI strips the Confirm button for
          // these six codes (see portalAgentOnlyCode below), so reaching this
          // branch means a crafted request or a UI bug. Surface the friendly
          // explanation rather than the dev sentinel.
          setError("We confirm this step once it's done. You don't need to mark it here.");
          setConfirming(milestoneId);
        }
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
  const confirmCopy = confirmingMilestone ? getMilestoneConfirmCopy(confirmingMilestone.code) : null;

  // Swipe between your side and the other side (buyer / seller). Both are
  // already shown today (the other side read-only at the foot of the list);
  // this just presents them as two swipeable panels that always default to and
  // start on your own side. No new information.
  const hasOtherSide = otherSideMilestones.length > 0;
  const hasOnward    = !!onwardPanel;
  const ownLabel   = side === "vendor" ? "Your sale" : "Your purchase";
  const otherLabel = side === "vendor" ? "The purchase" : "The sale";

  // Panel order left-to-right. Onward sits to the LEFT of your own side, so it
  // swipes the opposite way from the other side (which stays on the right). With
  // no onward this is exactly the previous [own, other] two-panel layout.
  const panelKeys: string[] = [
    ...(hasOnward ? ["onward"] : []),
    "own",
    ...(hasOtherSide ? ["other"] : []),
  ];
  const nPanels    = panelKeys.length;
  const ownIndex   = panelKeys.indexOf("own");
  const indexOfKey = (k: string) => Math.max(0, panelKeys.indexOf(k));
  const labelForKey = (k: string) => (k === "onward" ? (onwardLabel ?? "Your onward") : k === "own" ? ownLabel : otherLabel);

  function scrollToSide(s: string) {
    setActiveSide(s);
    const el = swipeRef.current;
    if (el) el.scrollTo({ left: indexOfKey(s) * el.clientWidth, behavior: "smooth" });
  }
  function onSwipeScroll() {
    const el = swipeRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    const next = panelKeys[Math.min(Math.max(idx, 0), nPanels - 1)] ?? "own";
    setActiveSide((prev) => (prev === next ? prev : next));
    // Settle: a slow drag or trackpad flick can leave mandatory scroll-snap
    // resting between panels. When scrolling stops (~140ms of quiet), nudge it
    // to the nearest panel so it never sticks halfway.
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const e2 = swipeRef.current;
      if (!e2) return;
      const target = indexOfKey(next) * e2.clientWidth;
      if (Math.abs(e2.scrollLeft - target) > 2) {
        e2.scrollTo({ left: target, behavior: "smooth" });
      }
    }, 140);
  }
  // Start on your own side. When onward is present your side is no longer the
  // leftmost panel, so jump the scroll to it once on mount (no animation).
  useEffect(() => {
    if (ownIndex > 0 && swipeRef.current) {
      swipeRef.current.scrollLeft = ownIndex * swipeRef.current.clientWidth;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (settleTimer.current) window.clearTimeout(settleTimer.current); }, []);

  // Track the active panel's height (re-observing when the active side changes).
  useIsoLayoutEffect(() => {
    const el = panelRefs.current[activeSide];
    if (!el) return;
    const measure = () => setPanelHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSide, nPanels]);

  return (
    <>
      {nPanels > 1 && (
        <div style={{ position: "relative", display: "flex", padding: 4, borderRadius: 999, background: P.borderSubtle, marginBottom: 12 }}>
          {/* Sliding indicator: slides across, overshoots a touch, settles. */}
          <div
            aria-hidden
            style={{
              position: "absolute", top: 4, bottom: 4, left: 4, width: `calc((100% - 8px) / ${nPanels})`,
              borderRadius: 999, background: P.cardElevated, boxShadow: "0 1px 2px rgba(15,23,42,0.12)",
              transform: `translateX(${indexOfKey(activeSide) * 100}%)`,
              transition: "transform 440ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          />
          {panelKeys.map((key) => {
            const on = activeSide === key;
            return (
              <button
                key={key}
                onClick={() => scrollToSide(key)}
                style={{ position: "relative", zIndex: 1, flex: 1, minWidth: 0, border: 0, background: "transparent", cursor: "pointer", fontSize: nPanels >= 3 ? 12 : 13, fontWeight: 700, padding: nPanels >= 3 ? "7px 4px" : "7px 10px", color: on ? P.textPrimary : P.textMuted, transition: "color 200ms ease", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
              >
                {labelForKey(key)}
              </button>
            );
          })}
        </div>
      )}
      {/* Bleed to the screen edges so each panel fills the viewport exactly — no
          peek of the other side, and card shadows only clip at the screen edge.
          The 16px inset lives on the panels so cards line up with the other tabs. */}
      <div
        ref={swipeRef}
        onScroll={onSwipeScroll}
        className="scrollbar-hide"
        style={{ display: "flex", alignItems: "flex-start", overflowX: "auto", overflowY: "hidden", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", marginInline: -16, paddingBlock: 10, boxSizing: "content-box", height: panelHeight, transition: "height 320ms cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        {hasOnward && (
          <div ref={(el) => { panelRefs.current.onward = el; }} style={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start", scrollSnapStop: "always", paddingInline: 16 }}>
            {onwardPanel}
          </div>
        )}
        <div ref={(el) => { panelRefs.current.own = el; }} style={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start", scrollSnapStop: "always", paddingInline: 16 }}>
          <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd }}>
        {/* ── Your milestones (one unified card, flat group headers) ── */}
        {groups.map((group, gIdx) => {
          const groupMilestones = group.codes.map((c) => byCode.get(c)).filter((m): m is Milestone => !!m && !m.isNotRequired);
          if (groupMilestones.length === 0) return null;
          if (group.label === "After Exchange" && !hasExchanged) return null;

          const doneCount  = groupMilestones.filter((m) => m.isComplete || m.isNotRequired).length;
          const totalCount = groupMilestones.length;
          const allDone    = doneCount === totalCount;
          const isActive   = gIdx === activeGroupIdx;
          const isOpen     = expanded[gIdx] ?? false;

          const headerBg = allDone ? P.successBg : isActive ? P.accentBg : P.pageBg;

          return (
            <div key={group.label}>
              <button
                className="w-full px-5 py-3 flex items-center justify-between gap-3 text-left"
                style={{ background: headerBg, borderBottom: `1px solid ${P.border}` }}
                onClick={() => toggle(gIdx)}
              >
                <p className="text-[12px] font-bold uppercase tracking-wide min-w-0 truncate" style={{ color: P.textMuted }}>
                  {group.icon} {group.label}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {allDone ? (
                    <PortalPill tone="green">Done</PortalPill>
                  ) : (
                    <PortalPill tone="coral">{doneCount}/{totalCount}</PortalPill>
                  )}
                  <ChevronIcon open={isOpen} />
                </div>
              </button>

              {isOpen && (
                <div>
                  {groupMilestones.map((m, mIdx) => {
                    const isLast        = mIdx === groupMilestones.length - 1;
                    // B1 hard-block: the six bilateral / agent-only codes
                    // (VM18/PM25/VM19/PM26/VM20/PM27) are never client-
                    // confirmable. Show the milestone in the list so the
                    // client sees what's coming, but strip the Confirm
                    // button and replace with explanatory copy.
                    const isAgentOnly   = isPortalAgentOnly(m.code);
                    const canConfirm    = !m.isComplete && !m.isNotRequired && m.isAvailable && !isAgentOnly;
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
                                ? `Confirmed${m.confirmedByPortal ? " by you" : ""}${(m.eventDate ?? m.completedAt) ? ` · ${fmtDate(m.eventDate ?? m.completedAt)}` : ""}`
                                : m.whoLabel
                              }
                            </p>
                            {m.code === "PM10" && !isLocked && (
                              <SearchesUpload token={token} />
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 self-center">
                            {m.description && !m.isComplete && (
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
                                <PortalButton size="sm" full={false} onClick={() => openSheet(m.id)}>
                                  Confirm
                                </PortalButton>
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
                            {/* B1 hard-block: replace the Confirm button with
                              * explanatory copy for the six agent-only codes
                              * when they're available + not complete. The
                              * client sees the milestone is coming and knows
                              * it's deliberately handled by the agent. */}
                            {isAgentOnly && !m.isComplete && !m.isNotRequired && m.isAvailable && (
                              <p
                                className="text-[11px] font-medium italic max-w-[180px] text-right"
                                style={{ color: P.textMuted, lineHeight: 1.4 }}
                              >
                                We confirm this once it&apos;s done.
                              </p>
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
          </div>
        </div>
        {hasOtherSide && (
          <div ref={(el) => { panelRefs.current.other = el; }} style={{ flex: "0 0 100%", minWidth: 0, scrollSnapAlign: "start", scrollSnapStop: "always", paddingInline: 16 }}>
            <div className="space-y-3">
              <div className="rounded-2xl overflow-hidden" style={{ background: P.cardBg, boxShadow: P.shadowMd, borderLeft: `3px solid rgba(139,145,163,0.25)` }}>
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${P.border}` }}>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: P.border, color: P.textMuted }}>View only</span>
                  <p className="text-[12px]" style={{ color: P.textMuted }}>
                    {otherSideMilestones.filter((m) => m.isComplete).length} of {otherSideMilestones.filter((m) => !m.isNotRequired).length} steps done
                  </p>
                </div>
              <div>
                {otherGroups.map((group) => {
                  const groupMilestones = group.codes.map((c) => otherByCode.get(c)).filter((m): m is Milestone => !!m && !m.isNotRequired);
                  if (groupMilestones.length === 0) return null;
                  if (group.label === "After Exchange" && !hasExchanged) return null;

                  const doneCount = groupMilestones.filter((m) => m.isComplete || m.isNotRequired).length;
                  const allDone   = doneCount === groupMilestones.length;
                  const isOpen    = otherExpanded[group.label] ?? (group.label === otherActiveLabel);

                  return (
                    <div key={group.label}>
                      <button
                        type="button"
                        onClick={() => toggleOther(group.label)}
                        className="w-full px-5 py-2.5 flex items-center justify-between text-left"
                        style={{ background: P.pageBg, borderBottom: `1px solid ${P.border}` }}
                      >
                        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: P.textMuted }}>
                          {group.icon} {group.label}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <PortalPill tone={allDone ? "green" : "coral"}>
                            {doneCount}/{groupMilestones.length}
                          </PortalPill>
                          <ChevronIcon open={isOpen} />
                        </div>
                      </button>
                      {isOpen && groupMilestones.map((m, mIdx) => (
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom sheet: milestone help / glossary ── */}
      <PortalSheet open={!!helpMilestone} onClose={() => setHelpMilestone(null)}>
        {helpMilestone && (
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
            {(() => {
              const guidance = getMilestoneGuidance(helpMilestone.code);
              if (!guidance) return null;
              return (
                <div className="mt-4 flex items-center gap-2">
                  <a
                    href={guidance.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-guidance-link inline-flex items-center gap-1.5 text-[13.5px] font-semibold"
                    style={{ color: P.accent }}
                  >
                    Learn more
                    <span className="pgl-glide inline-flex">
                      <span className="pgl-spin inline-flex">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </span>
                    </span>
                  </a>
                  <span className="text-[11.5px]" style={{ color: P.textMuted }}>{guidance.source}</span>
                </div>
              );
            })()}
            <button
              onClick={() => setHelpMilestone(null)}
              className="w-full mt-6 py-4 rounded-xl text-[15px] font-bold text-white"
              style={{ background: P.primary, borderRadius: P.radiusMd }}
            >
              Got it
            </button>
            <style>{`
              .portal-guidance-link .pgl-spin {
                transform: rotate(-45deg);
                transition: transform 170ms cubic-bezier(0.16,1,0.3,1);
              }
              .portal-guidance-link .pgl-glide {
                transform: translateX(0);
                transition: transform 220ms cubic-bezier(0.16,1,0.3,1) 150ms;
              }
              .portal-guidance-link:hover .pgl-spin { transform: rotate(0deg); }
              .portal-guidance-link:hover .pgl-glide { transform: translateX(3px); }
              @media (prefers-reduced-motion: reduce) {
                .portal-guidance-link .pgl-spin,
                .portal-guidance-link .pgl-glide { transition: none; }
              }
            `}</style>
          </div>
        )}
      </PortalSheet>

      {/* ── Bottom sheet: skip survey ─────────────── */}
      <PortalSheet open={!!skipSurveyId} onClose={() => setSkipSurveyId(null)} closeDisabled={skipLoading}>
        {skipSurveyId && (
          <div className="px-6 pb-6 pt-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: P.warning }}>
              Skip survey
            </p>
            <p className="text-[18px] font-semibold leading-snug mb-3" style={{ color: P.textPrimary }}>
              Not getting a survey?
            </p>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: P.textSecondary }}>
              This will mark &apos;Book your survey&apos; and &apos;Survey report received&apos; as not required. We&apos;ll also let the other side know that you&apos;re not getting a survey. You can change this from your menu at any time until your solicitor&apos;s enquiries have been satisfied.
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
        )}
      </PortalSheet>

      {/* ── Bottom sheet confirm ──────────────────── */}
      <PortalSheet open={!!confirmingMilestone} onClose={closeSheet} closeDisabled={loading}>
        {confirmingMilestone && (
            <div className="px-6 pb-6 pt-2">
              <p className="text-[18px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>
                {confirmingMilestone.eventDateRequired ? "When is this happening?" : "Are you sure?"}
              </p>
              {confirmCopy && (
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: P.textSecondary }}>
                  {confirmCopy}
                </p>
              )}

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

              {surveyOptions && (
                <div className="mb-4">
                  <label className="block text-[13px] font-semibold mb-2" style={{ color: P.textSecondary }}>
                    Which surveyor did you book?
                  </label>
                  <div className="flex flex-col gap-2">
                    {surveyOptions.map((o) => {
                      const active = surveyChoice?.kind === "our_firm" && surveyChoice.quoteRequestId === o.quoteRequestId;
                      return (
                        <button
                          key={o.quoteRequestId}
                          type="button"
                          onClick={() => setSurveyChoice({ kind: "our_firm", quoteRequestId: o.quoteRequestId })}
                          className="text-left px-4 py-3 rounded-xl text-[14px] font-semibold border transition-colors"
                          style={{ borderColor: active ? P.primary : P.border, borderWidth: active ? 2 : 1, background: active ? P.primaryBg : P.cardBg, color: P.textPrimary }}
                        >
                          {o.firmName}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setSurveyChoice({ kind: "someone_else" })}
                      className="text-left px-4 py-3 rounded-xl text-[14px] border transition-colors"
                      style={{ borderColor: surveyChoice?.kind === "someone_else" ? P.primary : P.border, borderWidth: surveyChoice?.kind === "someone_else" ? 2 : 1, background: surveyChoice?.kind === "someone_else" ? P.primaryBg : P.cardBg, color: P.textPrimary }}
                    >
                      I booked someone else
                    </button>
                    {surveyChoice?.kind === "someone_else" && (
                      <input
                        type="text"
                        value={otherFirmName}
                        onChange={(e) => setOtherFirmName(e.target.value)}
                        placeholder="Surveyor's name (optional)"
                        className="w-full px-4 py-3 rounded-xl text-[15px] border focus:outline-none"
                        style={{ borderColor: P.border, background: P.pageBg, color: P.textPrimary }}
                      />
                    )}
                  </div>
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
                {loading ? "Saving…" : "Confirm"}
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
        )}
      </PortalSheet>
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

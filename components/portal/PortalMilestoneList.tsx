"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { P, VENDOR_GROUPS, PURCHASER_GROUPS } from "./portal-ui";

type Milestone = {
  id: string;
  code: string;
  orderIndex: number;
  isComplete: boolean;
  isNotRequired: boolean;
  isAvailable: boolean;
  isPostExchange: boolean;
  isExchangeGate: boolean;
  timeSensitive: boolean;
  completedAt: Date | null;
  eventDate: Date | null;
  label: string;
  who: string;
  whoLabel: string;
  confirmedByClient: boolean;
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
  confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ["#3a7bd5", "#16A34A", "#f59e0b", "#8b5cf6", "#ec4899"] });
  setTimeout(() => {
    confetti({ particleCount: 50, spread: 120, origin: { y: 0.4 }, colors: ["#3a7bd5", "#16A34A", "#f59e0b"] });
  }, 250);
}

export function PortalMilestoneList({ token, milestones, otherSideMilestones, hasExchanged, side }: Props) {
  const router = useRouter();
  const [confirming, setConfirming]     = useState<string | null>(null);
  const [eventDate, setEventDate]       = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [showOtherSide, setShowOtherSide] = useState(false);

  const groups = side === "vendor" ? VENDOR_GROUPS : PURCHASER_GROUPS;
  const otherGroups = side === "vendor" ? PURCHASER_GROUPS : VENDOR_GROUPS;

  const byCode = new Map(milestones.map((m) => [m.code, m]));
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

  function startConfirm(id: string) {
    setConfirming(id);
    setEventDate("");
    setError(null);
  }

  function cancelConfirm() {
    setConfirming(null);
    setEventDate("");
    setError(null);
  }

  async function confirmMilestone(milestoneId: string, isTimeSensitive: boolean) {
    if (isTimeSensitive && !eventDate) {
      setError("Please enter the date for this step.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/milestone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, milestoneDefinitionId: milestoneId, eventDate: eventDate || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to confirm");
      setConfirming(null);
      setEventDate("");
      await fireConfetti();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* ── Your milestones ───────────────────────────────────── */}
      {groups.map((group, gIdx) => {
        const groupMilestones = group.codes.map((c) => byCode.get(c)).filter((m): m is Milestone => !!m);
        if (groupMilestones.length === 0) return null;
        if (group.label === "After Exchange" && !hasExchanged) return null;

        const doneCount  = groupMilestones.filter((m) => m.isComplete || m.isNotRequired).length;
        const totalCount = groupMilestones.length;
        const allDone    = doneCount === totalCount;
        const isOpen     = expanded[gIdx] ?? false;

        return (
          <div key={group.label} className="rounded-2xl overflow-hidden" style={{ background: P.card, boxShadow: P.shadow }}>
            <button
              className="w-full flex items-center gap-3 px-5 py-4 text-left"
              style={{ borderBottom: isOpen ? `1px solid ${P.border}` : undefined }}
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
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#F0FDF4", color: "#16A34A" }}>Done ✓</span>
                ) : (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: P.primaryLight, color: P.primary }}>{doneCount}/{totalCount}</span>
                )}
                <ChevronIcon open={isOpen} />
              </div>
            </button>

            {isOpen && (
              <div>
                {groupMilestones.map((m, mIdx) => {
                  const isLast = mIdx === groupMilestones.length - 1;
                  const isConfirming = confirming === m.id;
                  const canConfirm = !m.isComplete && !m.isNotRequired && m.isAvailable && m.who === "you";
                  const isLocked = !m.isComplete && !m.isNotRequired && !m.isAvailable;

                  return (
                    <div key={m.id} style={{ borderBottom: !isLast ? `1px solid ${P.border}` : undefined, opacity: isLocked ? 0.4 : 1 }}>
                      <div className="flex items-start gap-3.5 px-5 py-4">
                        <StatusDot isComplete={m.isComplete} isLocked={isLocked} canConfirm={canConfirm} />

                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-medium leading-snug" style={{ color: m.isComplete ? P.textMuted : P.textPrimary, textDecoration: m.isComplete ? "line-through" : "none" }}>
                            {m.label}
                          </p>
                          <p className="text-[12px] mt-0.5" style={{ color: m.isComplete ? "#16A34A" : P.textMuted }}>
                            {m.isComplete
                              ? `Confirmed${m.confirmedByClient ? " by you" : ""}${m.completedAt ? ` · ${fmtDate(m.completedAt)}` : ""}${m.eventDate ? ` · ${fmtDate(m.eventDate)}` : ""}`
                              : m.whoLabel
                            }
                          </p>

                          {/* Inline confirm dialog */}
                          {isConfirming && (
                            <div className="mt-3 rounded-xl p-4" style={{ background: P.bg, border: `1px solid ${P.border}` }}>
                              <p className="text-[14px] font-semibold mb-3" style={{ color: P.textPrimary }}>
                                {m.timeSensitive ? `When is this happening?` : `Confirm this is done?`}
                              </p>

                              {m.timeSensitive && (
                                <div className="mb-3">
                                  <label className="block text-[12px] font-semibold mb-1.5" style={{ color: P.textSecondary }}>
                                    Date <span className="text-red-400">*</span>
                                  </label>
                                  <input
                                    type="date"
                                    value={eventDate}
                                    onChange={(e) => setEventDate(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl text-[14px] border focus:outline-none"
                                    style={{ borderColor: P.border, background: P.card, color: P.textPrimary }}
                                  />
                                </div>
                              )}

                              {error && <p className="text-[12px] text-red-500 mb-2">{error}</p>}

                              <div className="flex gap-2">
                                <button
                                  onClick={() => confirmMilestone(m.id, m.timeSensitive)}
                                  disabled={loading}
                                  className="flex-1 py-3 rounded-xl text-[14px] font-bold text-white disabled:opacity-50"
                                  style={{ background: `linear-gradient(135deg, ${P.primary} 0%, ${P.primaryDark} 100%)` }}
                                >
                                  {loading ? "Saving…" : m.timeSensitive ? "Confirm date" : "Yes, done"}
                                </button>
                                <button
                                  onClick={cancelConfirm}
                                  disabled={loading}
                                  className="px-5 py-3 rounded-xl text-[14px] font-semibold disabled:opacity-50"
                                  style={{ background: P.card, color: P.textSecondary, border: `1px solid ${P.border}` }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {canConfirm && !isConfirming && (
                          <button
                            onClick={() => startConfirm(m.id)}
                            className="flex-shrink-0 self-center px-4 py-2 rounded-xl text-[13px] font-bold"
                            style={{ background: P.primaryLight, color: P.primary }}
                          >
                            Confirm
                          </button>
                        )}
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
        <div className="rounded-2xl overflow-hidden" style={{ background: P.card, boxShadow: P.shadow }}>
          <button
            className="w-full flex items-center gap-3 px-5 py-4 text-left"
            style={{ borderBottom: showOtherSide ? `1px solid ${P.border}` : undefined }}
            onClick={() => setShowOtherSide((v) => !v)}
          >
            <span className="text-xl">👀</span>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>
                {side === "vendor" ? "Buyer's" : "Seller's"} progress
              </p>
              <p className="text-[12px] mt-0.5" style={{ color: P.textSecondary }}>
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
                    <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: P.bg, borderBottom: `1px solid ${P.border}` }}>
                      <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: P.textMuted }}>
                        {group.icon} {group.label}
                      </p>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: allDone ? "#F0FDF4" : P.primaryLight, color: allDone ? "#16A34A" : P.primary }}>
                        {doneCount}/{groupMilestones.length}
                      </span>
                    </div>
                    {groupMilestones.map((m, mIdx) => (
                      <div key={m.id} className="flex items-center gap-3.5 px-5 py-3" style={{ borderBottom: mIdx < groupMilestones.length - 1 ? `1px solid ${P.border}` : undefined }}>
                        <StatusDot isComplete={m.isComplete} isLocked={!m.isComplete && !m.isAvailable} canConfirm={false} />
                        <p className="text-[13px] flex-1" style={{ color: m.isComplete ? P.textMuted : P.textPrimary, textDecoration: m.isComplete ? "line-through" : "none" }}>
                          {m.label}
                        </p>
                        {m.isComplete && (
                          <span className="text-[11px] flex-shrink-0" style={{ color: "#16A34A" }}>✓</span>
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
  );
}

function StatusDot({ isComplete, isLocked, canConfirm }: { isComplete: boolean; isLocked: boolean; canConfirm: boolean }) {
  if (isComplete) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#16A34A" }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    );
  }
  if (isLocked) {
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: P.bg }}>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={P.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
      style={{ borderColor: canConfirm ? P.primary : P.border }}>
      {canConfirm && <div className="w-2 h-2 rounded-full" style={{ background: P.primary }} />}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { P } from "./portal-ui";

type Props = {
  token: string;
  completionDate: string | null;
  /** ISO date contracts exchanged — drives the countdown progress bar. */
  exchangeDate?: string | null;
  /** Property photo shown behind the frosted card. Falls back to the hero image. */
  photoUrl?: string | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

// Whole calendar days from today to the target date (local), so "tomorrow" is
// always 1 regardless of the current time of day.
function wholeDaysUntil(target: Date): number {
  const a = new Date(); a.setHours(0, 0, 0, 0);
  const b = new Date(target); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function daysUntil(d: string) {
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)} days ago`;
  return `${diff} days away`;
}

async function fireConfetti() {
  const confetti = (await import("canvas-confetti")).default;
  confetti({
    particleCount: 140,
    spread: 90,
    origin: { y: 0.5 },
    colors: ["#FF8A65", "#FFB74D", "#FFD54F", "#FF6B4A", "#FFA726"],
  });
  setTimeout(() => {
    confetti({
      particleCount: 70,
      spread: 130,
      origin: { y: 0.3 },
      colors: ["#FF8A65", "#FFB74D", "#FFD54F"],
    });
  }, 300);
}

export function ExchangeBanner({ token, completionDate, exchangeDate, photoUrl }: Props) {
  useEffect(() => {
    const key = `exchange-celebrated-${token}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      fireConfetti();
    }
  }, [token]);

  // Recompute the day count when the local date rolls over, so a portal left
  // open ticks the countdown down overnight.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!completionDate) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => { setTick((t) => t + 1); schedule(); }, nextMidnight.getTime() - now.getTime());
    };
    schedule();
    return () => clearTimeout(timer);
  }, [completionDate]);

  const days       = completionDate ? wholeDaysUntil(new Date(completionDate)) : null;
  const isPast     = days !== null && days < 0;
  const isToday    = days === 0;
  const isTomorrow = days === 1;
  const isImminent = days !== null && days >= 2 && days <= 7;

  // Progress from exchange day → completion day (0..1).
  let progress: number | null = null;
  if (exchangeDate && completionDate) {
    const ex = new Date(exchangeDate).getTime();
    const co = new Date(completionDate).getTime();
    if (co > ex) progress = Math.min(1, Math.max(0, (Date.now() - ex) / (co - ex)));
  }

  return (
    <div>
      {/* Property photo runs to the very top under the floating header (keeps the
          image, and pushes the card down so the greeting no longer overlaps it). */}
      <div className="-mx-4 -mt-5" style={{ position: "relative", height: 232, overflow: "hidden", background: "var(--portal-pageBg, #f6f8fc)" }}>
        {photoUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={photoUrl} alt="" aria-hidden fetchPriority="high" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "var(--portal-hero-fallback)", backgroundSize: "cover", backgroundPosition: "center 35%" }} />
        )}
        {/* Gentle bottom fade so the card's frost dissolves into the image. */}
        <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "55%", pointerEvents: "none", background: "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--portal-pageBg, #f6f8fc) 55%, transparent) 70%, var(--portal-pageBg, #f6f8fc) 100%)" }} />
      </div>

      {/* Heavy-frost card, pulled up over the photo. Holds everything: the
          exchanged strings, the countdown, and the buttons. */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: -76,
          borderRadius: 22,
          padding: 18,
          background: P.glassFill,
          backdropFilter: "blur(32px) saturate(1.8)",
          WebkitBackdropFilter: "blur(32px) saturate(1.8)",
          border: `0.5px solid ${P.glassBorder}`,
          boxShadow: "0 14px 44px color-mix(in srgb, var(--portal-primary, #FF6B4A) 20%, transparent), 0 2px 10px rgba(15,23,42,0.08)",
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.10em] mb-1" style={{ color: P.primary }}>
          Contracts exchanged
        </p>
        <p className="text-[19px] font-semibold leading-snug" style={{ color: P.textPrimary }}>
          Your transaction is now legally committed
        </p>

        {completionDate && days !== null && (
          <div className="mt-3">
            {isPast ? (
              <p className="text-[16px] font-semibold" style={{ color: P.textPrimary }}>
                Completion {fmtDate(completionDate)}
              </p>
            ) : (
              <>
                {isToday || isTomorrow ? (
                  <p className="text-[24px] font-bold leading-tight" style={{ color: P.textPrimary }}>
                    {isToday ? "Completion day is here" : "Completion is tomorrow"}
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <span className={`text-[46px] font-black leading-none tabular-nums ${isImminent ? "animate-pulse" : ""}`} style={{ color: P.primary }}>
                      {days}
                    </span>
                    <span className="text-[13px] font-semibold pb-1.5" style={{ color: P.textSecondary }}>days until completion</span>
                  </div>
                )}
                <p className="text-[14px] font-medium mt-1" style={{ color: P.textSecondary }}>{fmtDate(completionDate)}</p>
                {progress !== null && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,107,74,0.16)" }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.round(progress * 100)}%`, background: P.primary, transition: "width 600ms ease" }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: P.textMuted }}>Exchanged</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: P.textMuted }}>Moving day</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          {completionDate && !isPast && (
            <a
              href={`/api/portal/calendar-export/${token}`}
              download="completion-date.ics"
              className="pbtn pbtn-press flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-[14px] font-bold"
              style={{ background: P.heroGradient, color: "#FFFFFF", boxShadow: "0 2px 8px rgba(255,107,74,0.35)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Add to calendar
            </a>
          )}
          <Link
            href={`/portal/${token}/exchange`}
            className="pbtn pbtn-press flex items-center justify-center gap-2 flex-1 py-3 rounded-xl text-[14px] font-bold"
            style={{ background: P.glassSoft, color: P.textPrimary, border: `0.5px solid ${P.border}` }}
          >
            Exchange guide
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CompletionBanner({ token, saleWord, completionDate }: { token: string; saleWord: string; completionDate: string | null }) {
  useEffect(() => {
    const key = `completion-celebrated-${token}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      fireConfetti();
    }
  }, [token]);

  return (
    <div
      className="rounded-2xl px-5 py-5"
      style={{
        background: "linear-gradient(135deg, #10B981 0%, #34D399 100%)",
        boxShadow: "0 8px 32px rgba(16,185,129,0.30)",
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-white/70 mb-1">
        All done
      </p>
      <p className="text-[22px] font-semibold text-white leading-snug">
        {saleWord === "sale" ? "Sale complete!" : "Purchase complete!"}
      </p>
      {completionDate && (
        <p className="text-[14px] text-white/80 mt-1">
          Completed {fmtDate(completionDate)}
        </p>
      )}
      <Link
        href={`/portal/${token}/complete`}
        className="mt-4 flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[14px] font-bold"
        style={{ background: "rgba(255,255,255,0.22)", color: "#FFFFFF" }}
      >
        View your completion guide
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </Link>
    </div>
  );
}

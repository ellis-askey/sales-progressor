"use client";

import { useEffect } from "react";
import { P } from "./portal-ui";

type Props = {
  token: string;
  completionDate: string | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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

export function ExchangeBanner({ token, completionDate }: Props) {
  useEffect(() => {
    const key = `exchange-celebrated-${token}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, "1");
      fireConfetti();
    }
  }, [token]);

  const days = completionDate
    ? Math.round((new Date(completionDate).getTime() - Date.now()) / 86400000)
    : null;

  const isToday    = days === 0;
  const isPast     = days !== null && days < 0;
  const isImminant = days !== null && days > 0 && days <= 7;

  return (
    <div
      className="rounded-2xl px-5 py-5"
      style={{ background: P.heroGradient, boxShadow: P.heroGlow }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.10em] text-white/70 mb-1">
        Contracts exchanged
      </p>
      <p className="text-[20px] font-semibold text-white leading-snug">
        Your transaction is now legally committed
      </p>

      {completionDate && days !== null && (
        <div
          className="mt-4 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/70">
              {isPast ? "Completed" : "Completion"}
            </p>
            <p className="text-[16px] font-semibold text-white mt-0.5">{fmtDate(completionDate)}</p>
          </div>
          {!isPast && (
            <div className="text-right">
              {isToday ? (
                <p className="text-[22px] font-bold text-white">Today!</p>
              ) : (
                <>
                  <p className={`text-[36px] font-black text-white leading-none tabular-nums ${isImminant ? "animate-pulse" : ""}`}>
                    {days}
                  </p>
                  <p className="text-[11px] text-white/70 font-semibold uppercase tracking-wide">
                    {days === 1 ? "day to go" : "days to go"}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}
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
    </div>
  );
}

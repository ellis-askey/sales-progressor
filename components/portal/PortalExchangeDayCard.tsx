"use client";

// Client-facing "aiming to exchange today" state (Phase 4). Shows while the file
// is actively in exchange day. Asks the client to give their solicitor authority
// and stay reachable, with an "I've given authority" confirm that logs back to
// the team. Warm and careful not to over-promise. See docs/active/exchange-day-SPEC.md.

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";

type AuthorityState = "given" | "reask" | "first";

export function PortalExchangeDayCard({
  token,
  saleWord,
  authorityState,
}: {
  token: string;
  saleWord: "sale" | "purchase";
  authorityState: AuthorityState;
}) {
  const [given, setGiven] = useState(authorityState === "given");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    try {
      const res = await fetch(`/api/portal/${token}/give-authority`, { method: "POST" });
      if (res.ok) setGiven(true);
    } catch {
      /* leave the button so they can retry */
    } finally {
      setLoading(false);
      setSheetOpen(false);
    }
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          borderRadius: 22,
          padding: 20,
          background: P.glassFill,
          backdropFilter: "blur(28px) saturate(1.6)",
          WebkitBackdropFilter: "blur(28px) saturate(1.6)",
          border: `0.5px solid ${P.glassBorder}`,
          boxShadow: "0 12px 40px color-mix(in srgb, var(--portal-primary, #FF6B4A) 16%, transparent), 0 2px 10px rgba(15,23,42,0.06)",
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.10em] mb-1" style={{ color: P.primary }}>
          Exchange day
        </p>
        <p className="text-[20px] font-semibold leading-snug mb-2" style={{ color: P.textPrimary }}>
          We&apos;re aiming to exchange today
        </p>
        <p className="text-[14px] leading-relaxed" style={{ color: P.textSecondary }}>
          Today could be the day your {saleWord} exchanges. Your solicitor will need your authority to exchange, and
          may need to reach you. Please make sure you&apos;ve given them authority, and try to stay reachable today.
        </p>

        {authorityState === "reask" && !given && (
          <p className="text-[13px] leading-relaxed mt-3" style={{ color: P.textMuted }}>
            Exchange has moved to today, so we just need to confirm your authority again.
          </p>
        )}

        <div className="mt-4">
          {given ? (
            <span
              className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-[14px] font-bold"
              style={{ background: "rgba(16,185,129,0.14)", color: "#0f9d6b" }}
            >
              <Check size={16} weight="bold" /> Authority given
            </span>
          ) : (
            <button
              onClick={() => setSheetOpen(true)}
              className="pbtn pbtn-press w-full py-3.5 rounded-xl text-[15px] font-bold text-white"
              style={{ background: P.heroGradient, boxShadow: "0 2px 8px rgba(255,107,74,0.35)" }}
            >
              I&apos;ve given authority
            </button>
          )}
        </div>
      </div>

      {sheetOpen && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => !loading && setSheetOpen(false)}>
          <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
          <div
            className="relative w-full max-w-lg mx-auto"
            style={{ background: P.cardBg, borderRadius: `${P.radiusXl} ${P.radiusXl} 0 0`, boxShadow: P.shadowXl, paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(139,145,163,0.30)" }} />
            </div>
            <div className="px-6 pt-3 pb-6">
              <h2 className="text-[20px] font-bold leading-snug mb-2" style={{ color: P.textPrimary }}>
                You&apos;ve given authority?
              </h2>
              <p className="text-[14px] leading-relaxed mb-6" style={{ color: P.textSecondary }}>
                Confirm you&apos;ve given your solicitor authority to exchange contracts. We&apos;ll let your team know
                straight away.
              </p>
              <button
                onClick={confirm}
                disabled={loading}
                className="pbtn pbtn-press w-full py-3.5 rounded-xl text-[15px] font-bold text-white"
                style={{ background: P.heroGradient, boxShadow: "0 2px 8px rgba(255,107,74,0.35)", opacity: loading ? 0.7 : 1 }}
              >
                {loading ? "Confirming…" : "Yes, I've given authority"}
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl text-[14px] font-semibold"
                style={{ color: P.textSecondary }}
              >
                Not yet
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

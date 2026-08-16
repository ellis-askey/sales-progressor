"use client";

// One-time welcome sheet on a client's first portal visit. localStorage-gated
// per token, slides up shortly after load (before the install/push toasts). A
// warm orientation for a nervous first-time visitor: a big lead line, a small
// progress stepper (with a gently pulsing "in progress" node), and three points.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { House, Check, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";

export function PortalWelcomeSheet({ token, side }: { token: string; side: "vendor" | "purchaser" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const key = `portal-welcome-seen-${token}`;
    if (localStorage.getItem(key)) return;
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [token]);

  function dismiss() {
    localStorage.setItem(`portal-welcome-seen-${token}`, "1");
    setOpen(false);
  }

  if (!open || typeof document === "undefined") return null;

  const dealWord = side === "vendor" ? "sale" : "purchase";
  const startPhrase = side === "vendor" ? "offer accepted" : "sale agreed";
  const startNode = side === "vendor" ? "Offer accepted" : "Sale agreed";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end" onClick={dismiss}>
      <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
      <div
        className="portal-sheet relative w-full max-w-lg mx-auto"
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
        <div className="px-6 pt-3 pb-6">
          <h2 className="text-[26px] font-bold leading-[1.15] mb-2" style={{ color: P.textPrimary }}>
            Your {dealWord} starts here
          </h2>
          <p className="text-[14px] leading-snug mb-6" style={{ color: P.textSecondary }}>
            Follow your {dealWord} from {startPhrase} to moving day. We&apos;ll keep everything together and show you
            what&apos;s happening along the way.
          </p>

          <Stepper startNode={startNode} />

          <div className="flex flex-col">
            <Point icon={<House size={18} weight="fill" />} title="Follow your progress">
              See what&apos;s been completed, what&apos;s happening now and what comes next.
            </Point>
            <div className="h-px my-4" style={{ background: P.border }} />
            <Point solid icon={<Check size={16} weight="bold" />} title="Confirm your steps">
              When you complete something, confirm it here and we&apos;ll keep everyone updated with the latest progress.
            </Point>
            <div className="h-px my-4" style={{ background: P.border }} />
            <Point icon={<ChatCircle size={18} weight="fill" />} title="Stay in the loop">
              We&apos;ll keep you updated as things move forward, and your sales progressor is always on hand if you need
              them.
            </Point>
          </div>

          <button
            onClick={dismiss}
            className="pbtn pbtn-press w-full mt-6 py-3.5 rounded-xl text-[15px] font-bold"
            style={{ background: P.primaryBg, color: P.primary, border: "1px solid rgba(255,107,74,0.35)" }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Stepper({ startNode }: { startNode: string }) {
  return (
    <div className="flex items-start mb-7 px-1">
      {/* Done */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: P.success }}>
          <Check size={15} weight="bold" color="#FFFFFF" />
        </div>
        <span className="text-[12px] mt-2 whitespace-nowrap" style={{ color: P.textSecondary }}>{startNode}</span>
      </div>
      {/* Solid connector */}
      <div className="flex-1 h-[2px] rounded-full mx-1.5" style={{ background: P.success, marginTop: 13 }} />
      {/* In progress (pulsing) */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="relative w-7 h-7 flex items-center justify-center">
          <span className="portal-inprogress-pulse absolute inset-0 rounded-full" style={{ background: P.primary }} />
          <span className="relative w-7 h-7 rounded-full" style={{ background: P.primary }} />
        </div>
        <span className="text-[12px] mt-2 font-bold whitespace-nowrap" style={{ color: P.textPrimary }}>In progress</span>
      </div>
      {/* Dashed connector */}
      <div className="flex-1 mx-1.5" style={{ marginTop: 13, borderTop: `2px dashed ${P.border}` }} />
      {/* Moving day */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full" style={{ border: `2px solid ${P.border}` }} />
        <span className="text-[12px] mt-2 whitespace-nowrap" style={{ color: P.textSecondary }}>Moving day</span>
      </div>
    </div>
  );
}

function Point({
  icon,
  title,
  children,
  solid,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  solid?: boolean;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className={`w-9 h-9 flex items-center justify-center flex-shrink-0 ${solid ? "rounded-full" : "rounded-xl"}`}
        style={solid ? { background: P.primary, color: "#FFFFFF" } : { background: P.primaryBg, color: P.primary }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[15px] font-bold" style={{ color: P.textPrimary }}>{title}</p>
        <p className="text-[13px] leading-snug mt-1" style={{ color: P.textSecondary }}>{children}</p>
      </div>
    </div>
  );
}

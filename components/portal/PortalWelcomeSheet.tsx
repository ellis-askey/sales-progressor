"use client";

// One-time welcome sheet on a client's first portal visit. Slides up shortly
// after load (before the install/push toasts). A warm orientation for a nervous
// first-time visitor: a big lead line, a small progress stepper (with a gently
// pulsing "in progress" node), and three points.
//
// Shown once per PERSON, forever, across every device. The Contact's
// welcomeSeenAt timestamp (via `alreadySeen`) is the source of truth; once set
// the sheet never re-appears anywhere. localStorage is a same-device fast-path
// covering the gap between dismissing it and the next server read.

import { useEffect, useState } from "react";
import { PortalSheet } from "./PortalSheet";
import { House, Check, ChatCircle, Package, Key } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";

export function PortalWelcomeSheet({ token, side, alreadySeen }: { token: string; side: "vendor" | "purchaser"; alreadySeen: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Server gate wins: dismissed on any device -> never shows again.
    if (alreadySeen) return;
    const key = `portal-welcome-seen-${token}`;
    if (localStorage.getItem(key)) return;
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [token, alreadySeen]);

  function dismiss() {
    localStorage.setItem(`portal-welcome-seen-${token}`, "1");
    // Persist to the Contact so it never re-appears on their other devices.
    // Fire-and-forget: if it fails, localStorage still gates this device and
    // the stamp retries on the next dismiss.
    fetch(`/api/portal/${token}/welcome-seen`, { method: "POST" }).catch(() => {});
    setOpen(false);
  }

  const dealWord = side === "vendor" ? "sale" : "purchase";
  const startPhrase = side === "vendor" ? "offer accepted" : "sale agreed";
  const startNode = side === "vendor" ? "Offer accepted" : "Sale agreed";

  return (
    <PortalSheet open={open} onClose={dismiss} showClose={false}>
        <div className="px-6 pt-3 pb-6">
          <h2 className="text-[26px] font-bold leading-[1.15] mb-2" style={{ color: P.textPrimary }}>
            Your {dealWord} starts here
          </h2>
          <p className="text-[14px] leading-snug mb-6" style={{ color: P.textSecondary }}>
            Follow your {dealWord} from {startPhrase} to completion. We&apos;ll keep everything together and show you
            what&apos;s happening along the way.
          </p>

          <Stepper startNode={startNode} side={side} />

          <div className="flex flex-col">
            <Point icon={<House size={18} weight="fill" />} title="Follow your progress">
              See what&apos;s been completed, what&apos;s happening now and what comes next.
            </Point>
            <div className="h-px my-4" style={{ background: P.border }} />
            <Point icon={<Check size={18} weight="bold" />} title="Confirm your steps">
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
            className="pbtn pbtn-press w-full mt-6 py-3.5 rounded-xl text-[15px] font-bold text-white"
            style={{ background: P.heroGradient, boxShadow: "0 2px 8px rgba(255,107,74,0.35)" }}
          >
            Got it
          </button>
        </div>
    </PortalSheet>
  );
}

function Stepper({ startNode, side }: { startNode: string; side: "vendor" | "purchaser" }) {
  // Moving day gets a themed, still-upcoming glyph: a moving box for buyers,
  // keys for sellers (handing over). Muted, inside the outline node.
  const MovingIcon = side === "vendor" ? Key : Package;
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
      {/* Moving day (upcoming) */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ border: `2px solid ${P.border}` }}>
          <MovingIcon size={14} weight="regular" color={P.textMuted} />
        </div>
        <span className="text-[12px] mt-2 whitespace-nowrap" style={{ color: P.textSecondary }}>Moving day</span>
      </div>
    </div>
  );
}

function Point({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <div
        className="w-9 h-9 flex items-center justify-center flex-shrink-0 rounded-xl"
        style={{ background: P.primaryBg, color: P.primary }}
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

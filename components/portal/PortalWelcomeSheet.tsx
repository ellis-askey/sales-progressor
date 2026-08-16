"use client";

// One-time welcome sheet on a client's first portal visit. localStorage-gated
// per token, slides up shortly after load (before the install/push toasts). A
// warm three-point orientation for a nervous first-time visitor.

import { useEffect, useState } from "react";
import { House, CheckCircle, ChatCircle } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";

export function PortalWelcomeSheet({ token, firstName, saleWord }: { token: string; firstName: string; saleWord: string }) {
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

  if (!open) return null;

  return (
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
        <div className="px-6 pt-2 pb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: P.primary }}>
            Welcome{firstName ? `, ${firstName}` : ""}
          </p>
          <h2 className="text-[20px] font-bold leading-snug mb-5" style={{ color: P.textPrimary }}>
            Your {saleWord}, all in one place
          </h2>

          <div className="flex flex-col gap-4">
            <Point icon={<House size={18} weight="fill" />} title="Everything in one place">
              Follow your {saleWord} from here, step by step, right through to moving day.
            </Point>
            <Point icon={<CheckCircle size={18} weight="fill" />} title="Confirm as you go">
              When something's done, confirm it here so everyone can see progress.
            </Point>
            <Point icon={<ChatCircle size={18} weight="fill" />} title="Your team, a tap away">
              Reach your team any time from the menu, and see every update as it happens.
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
      </div>
    </div>
  );
}

function Point({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: P.primaryBg, color: P.primary }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-semibold" style={{ color: P.textPrimary }}>{title}</p>
        <p className="text-[13px] leading-snug mt-0.5" style={{ color: P.textSecondary }}>{children}</p>
      </div>
    </div>
  );
}

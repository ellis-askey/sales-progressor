"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getFirstName } from "@/lib/utils";
import { markWelcomeSeenAction } from "@/app/actions/profile";
import { Lightning, X } from "@phosphor-icons/react";
import { TourSlides } from "@/components/agent/TourSlides";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

export function WelcomeModal({ name }: { name: string }) {
  const router = useRouter();
  const theme = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const firstName = getFirstName(name) || "there";

  useEffect(() => {
    setMounted(true);
    markWelcomeSeenAction().catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setVisible(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setVisible(false);
  }

  function handleAddSale() {
    setVisible(false);
    router.push("/agent/transactions/new-v2");
  }

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      data-theme={theme}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={close}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 agent-backdrop-overlay" />

      {/* Card */}
      <div
        className="agent-modal"
        style={{
          maxWidth: showTour ? 540 : 460,
          width: "calc(100vw - 48px)",
          position: "relative",
          borderTop: "2px solid var(--agent-coral-deep)",
          animation: "agent-modal-in 280ms cubic-bezier(0.34,1.56,0.64,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button — ghost treatment */}
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute", top: 16, right: 16, zIndex: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 6, borderRadius: 8, border: "none",
            background: "transparent", color: "rgba(15,23,42,0.40)", cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.06)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X size={16} weight="bold" />
        </button>

        {showTour ? (
          <TourSlides
            onClose={close}
            onFinish={() => {
              setVisible(false);
              router.push("/agent/transactions/new-v2");
            }}
          />
        ) : (
          <>
            {/* Header gradient strip — theme-driven */}
            <div style={{
              margin: "-24px -24px 24px",
              padding: "28px 24px 24px",
              background: "linear-gradient(135deg, rgba(var(--agent-coral-base-rgb), 0.18) 0%, rgba(var(--agent-bloom-gold-rgb), 0.12) 100%)",
              borderBottom: "0.5px solid rgba(255,255,255,0.50)",
              borderRadius: "var(--agent-radius-xl) var(--agent-radius-xl) 0 0",
            }}>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-coral-deep)", opacity: 0.7 }}>
                Welcome
              </p>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Good to have you, {firstName}.
              </h2>
              <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                Let's get your first file set up — it takes less than a minute.
              </p>
            </div>

            {/* CTAs */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleAddSale}
                className="agent-btn agent-btn-color-primary"
                style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, fontWeight: 700 }}
              >
                <Lightning size={18} weight="fill" />
                Add my first sale
              </button>

              {/* Secondary — text link, doesn't compete with primary */}
              <button
                onClick={() => setShowTour(true)}
                style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center", textUnderlineOffset: 2, padding: "2px 0" }}
                className="text-sm text-slate-900/60 hover:text-slate-900/85 hover:underline transition-colors"
              >
                Explore a quick tour
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--agent-text-muted)", margin: "4px 0 0" }}>
                You can always add files any time from the dashboard.
              </p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

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
  const { theme } = usePortalTheme();
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
          padding: 0,
          overflow: "hidden",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showTour ? (
          /* TourSlides owns its header + X */
          <div style={{ padding: 24 }}>
            <TourSlides
              onClose={close}
              onFinish={() => {
                setVisible(false);
                router.push("/agent/transactions/new-v2");
              }}
            />
          </div>
        ) : (
          <>
            {/* V1 56px header */}
            <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
              <p style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
                Welcome, {firstName}
              </p>
              <button onClick={close} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
                <X size={14} weight="bold" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                Let&apos;s get your first file set up — it takes less than a minute.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <button
                  onClick={handleAddSale}
                  className="agent-btn agent-btn-color-primary"
                  style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, fontWeight: 700 }}
                >
                  <Lightning size={18} weight="fill" />
                  Add my first sale
                </button>
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
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

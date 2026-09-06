"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { markWelcomeSeenAction } from "@/app/actions/profile";
import { Plus, ArrowRight, Play, X } from "@phosphor-icons/react";
import { TourSlides } from "@/components/agent/TourSlides";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { extractFirstName } from "@/lib/contacts/displayName";

type AgencyModeProfile = "self_progressed" | "progressor_managed" | "mixed";

export function WelcomeModal({
  agencyModeProfile = "self_progressed",
  userName = "",
}: {
  agencyModeProfile?: AgencyModeProfile;
  userName?: string;
}) {
  const router = useRouter();
  const firstName = extractFirstName(userName);
  const { theme } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setMounted(true);
    markWelcomeSeenAction().catch(() => {});
    // Flag the shell so the nav bars go opaque + lift above the full-screen dim
    // (no wash, no seam). Removed on unmount, restoring the normal glass nav.
    document.documentElement.classList.add("welcome-modal-open");
    return () => document.documentElement.classList.remove("welcome-modal-open");
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  // Play the "zoom through" exit, then unmount when it ends. Reduced-motion skips
  // straight to unmount. The card + backdrop animate together (see globals.css).
  function close() {
    if (closing) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisible(false);
      return;
    }
    setClosing(true);
  }

  function handleAddSale() {
    setVisible(false);
    router.push("/agent/transactions/new");
  }

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      data-theme={theme}
      className={showTour ? undefined : "welcome-shell"}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center",
        // Override the shared backdrop tint for the welcome moment only —
        // the page should feel paused, not just dimmed. Other modals keep
        // the default 0.35.
        ["--agent-backdrop-bg" as string]: "rgba(0, 0, 0, 0.55)",
      } as React.CSSProperties}
      onClick={close}
    >
      {/* Backdrop — dim + blur clear in lockstep with the card's zoom-out. On
          desktop it's inset to the content area (past the 232px sidebar + 44px top
          bar) so the nav chrome keeps its normal, un-washed look. */}
      <div className={`agent-backdrop-overlay welcome-backdrop${closing ? " welcome-backdrop-closing" : ""}`} />

      {/* Card — welcome view sizes via .welcome-card (responsive); tour keeps its
          own fixed width. */}
      <div
        className={`agent-modal${showTour ? "" : " welcome-card"}`}
        style={{
          ...(showTour ? { maxWidth: 720, width: "calc(100vw - 48px)" } : {}),
          position: "relative",
          padding: 0,
          overflow: "hidden",
          background: "#ffffff",
          animation: closing
            ? "welcome-zoom-out 420ms cubic-bezier(0.4,0,1,1) both"
            : "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
        onAnimationEnd={() => { if (closing) setVisible(false); }}
      >
        {showTour ? (
          /* TourSlides owns its header + X */
          <div style={{ padding: 24 }}>
            <TourSlides
              agencyModeProfile={agencyModeProfile}
              onClose={close}
              onFinish={() => {
                setVisible(false);
                router.push("/agent/transactions/new");
              }}
            />
          </div>
        ) : (
          <>
            {/* Illustrated backdrop — the memorandum + keys + property-file art
                bleeds off the right; a left-to-right white wash keeps the text
                column crisp regardless of how cover crops the image. */}
            <div
              aria-hidden="true"
              className="welcome-bg"
              style={{
                position: "absolute", inset: 0,
                backgroundImage: "url('/agent/welcome-bg.png')",
                backgroundSize: "cover", backgroundPosition: "right center", backgroundRepeat: "no-repeat",
              }}
            />
            <div
              aria-hidden="true"
              className="welcome-gradient"
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, #ffffff 0%, #ffffff 48%, rgba(255,255,255,0.85) 62%, rgba(255,255,255,0) 80%)",
              }}
            />

            {/* Floating close */}
            <button
              onClick={close}
              aria-label="Close"
              className="agent-icon-btn agent-icon-btn-sm"
              style={{ position: "absolute", top: 12, right: 12, zIndex: 2 }}
            >
              <X size={14} weight="bold" />
            </button>

            {/* Text column (left) — sizing/padding via .welcome-col (responsive) */}
            <div className="welcome-col">
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "#FF6B4A" }}>
                You&apos;re in
              </span>
              <h2 style={{ margin: "12px 0 0", fontSize: 32, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-0.6px", color: "#0F1B2D" }}>
                Welcome to TSP{firstName ? `, ${firstName}` : ""}.
              </h2>
              <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.55, color: "#54617d" }}>
                Your workspace is ready. Let&apos;s get your first sale in and show you how everything works.
              </p>

              <button
                onClick={handleAddSale}
                className="welcome-cta"
                style={{
                  margin: "22px 0 0", width: "100%",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: "none", borderRadius: 14, cursor: "pointer",
                  padding: "15px 20px", fontSize: 15, fontWeight: 700, color: "#ffffff",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <Plus size={18} weight="bold" />
                  Add your first sale
                </span>
                <ArrowRight size={18} weight="bold" />
              </button>
              <p style={{ margin: "10px 0 0", fontSize: 12.5, lineHeight: 1.5, color: "#9aa3b2" }}>
                Drop in your Memorandum of Sale or add the details yourself.
              </p>

              {/* OR divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0 0" }}>
                <div style={{ flex: 1, height: 1, background: "#ECE7E2" }} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#9aa3b2" }}>OR</span>
                <div style={{ flex: 1, height: 1, background: "#ECE7E2" }} />
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, margin: "14px 0 0" }}>
                <button
                  onClick={() => setShowTour(true)}
                  className="welcome-tour"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 9,
                    background: "none", border: "none", cursor: "pointer", padding: 0,
                    fontSize: 14, fontWeight: 600,
                  }}
                >
                  <Play size={17} weight="fill" />
                  Take a quick tour
                </button>
                <p style={{ margin: 0, fontSize: 12, color: "#9aa3b2", textAlign: "center" }}>
                  See how TSP can save you time in 60 seconds.
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

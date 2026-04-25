"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { getFirstName } from "@/lib/utils";
import { markWelcomeSeenAction } from "@/app/actions/profile";
import { Lightning, PlayCircle, X } from "@phosphor-icons/react";
import { TourSlides } from "@/components/agent/TourSlides";

export function WelcomeModal({ name }: { name: string }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const firstName = getFirstName(name) || "there";

  useEffect(() => {
    setMounted(true);
    markWelcomeSeenAction().catch(() => {});
  }, []);

  function close() {
    setVisible(false);
  }

  function handleAddSale() {
    setVisible(false);
    router.push("/agent/quick-add");
  }

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className="agent-backdrop"
      style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={close}
    >
      <div
        className="agent-modal"
        style={{ maxWidth: showTour ? 540 : 460, width: "calc(100vw - 48px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {showTour ? (
          <TourSlides
            onClose={close}
            onFinish={() => {
              setVisible(false);
              router.push("/agent/quick-add");
            }}
          />
        ) : (
          <>
            {/* Header gradient strip */}
            <div style={{
              margin: "-24px -24px 24px",
              padding: "28px 24px 24px",
              background: "linear-gradient(135deg, rgba(255,138,101,0.18) 0%, rgba(255,183,77,0.12) 100%)",
              borderBottom: "0.5px solid rgba(255,255,255,0.50)",
              borderRadius: "var(--agent-radius-xl) var(--agent-radius-xl) 0 0",
              position: "relative",
            }}>
              <button
                onClick={close}
                aria-label="Close"
                style={{
                  position: "absolute", top: 16, right: 16,
                  width: 28, height: 28, borderRadius: 8,
                  border: "none", background: "rgba(0,0,0,0.06)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "var(--agent-text-muted)",
                  transition: "background 150ms",
                }}
                className="hover:bg-black/10"
              >
                <X size={14} weight="bold" />
              </button>
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
                className="agent-btn agent-btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, fontWeight: 700 }}
              >
                <Lightning size={18} weight="fill" />
                Add my first sale
              </button>

              <button
                onClick={() => setShowTour(true)}
                style={{
                  width: "100%", padding: "12px 20px", borderRadius: "var(--agent-radius-lg)",
                  border: "1.5px solid var(--agent-border-default)", background: "rgba(255,255,255,0.60)",
                  fontSize: 14, fontWeight: 600, color: "var(--agent-text-secondary)", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "background 150ms",
                }}
                className="hover:bg-white/80"
              >
                <PlayCircle size={17} />
                Explore a quick tour
              </button>

              <p style={{ textAlign: "center", fontSize: 12, color: "var(--agent-text-muted)", margin: "4px 0 0" }}>
                You can always add real files any time from the dashboard.
              </p>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

"use client";

// Shared "explore the demo sale" flow used by the New Sale hero and the All
// Files empty state. Owns the intro modal + the "Getting your demo ready"
// transition, provisions (or reopens) the demo, and routes into the star file.
// Returns { launch, node }: render {node} once, call launch() to start —
// launch(true) skips the intro and goes straight into the transition.
// See app/actions/demo.ts and lib/services/demo-sale.ts.

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { X, Check, CircleNotch, Sparkle } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { getOrCreateDemoSaleAction } from "@/app/actions/demo";

const STEPS = ["Loading the sale", "Adding its progress", "Getting everything ready"];
const MIN_TRANSITION_MS = 1500;

type Stage = "closed" | "intro" | "loading";

export function useDemoExplore() {
  const router = useRouter();
  const { theme } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [stage, setStage] = useState<Stage>("closed");
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // Escape closes the intro only — never interrupt the ready transition.
  useEffect(() => {
    if (stage !== "intro") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setStage("closed"); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [stage]);

  async function explore() {
    setError(null);
    setStage("loading");
    setStep(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 480);
    try {
      const { transactionId } = await getOrCreateDemoSaleAction();
      clearInterval(ticker);
      setStep(STEPS.length);
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TRANSITION_MS) await new Promise((r) => setTimeout(r, MIN_TRANSITION_MS - elapsed));
      router.push(`/agent/transactions/${transactionId}`);
    } catch (e) {
      clearInterval(ticker);
      const msg = e instanceof Error ? e.message : "";
      setError(msg.includes("already have a sale") ? "You already have a sale on this account." : "We couldn't open the demo. Try again.");
      setStage("intro");
    }
  }

  function launch(skipIntro = false) {
    setError(null);
    if (skipIntro) void explore();
    else setStage("intro");
  }

  const node = mounted && stage !== "closed"
    ? createPortal(
        <div
          data-theme={theme}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={stage === "intro" ? () => setStage("closed") : undefined}
        >
          <div className="fixed inset-0 agent-backdrop-overlay" />
          <div
            className="agent-modal"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 440, width: "calc(100vw - 48px)", position: "relative", padding: 0, overflow: "hidden", animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both" }}
            onClick={(e) => e.stopPropagation()}
          >
            {stage === "intro" ? (
              <>
                <button
                  onClick={() => setStage("closed")}
                  aria-label="Close"
                  className="agent-icon-btn agent-icon-btn-sm"
                  style={{ position: "absolute", top: 12, right: 12, zIndex: 1 }}
                >
                  <X size={14} weight="bold" />
                </button>
                <div style={{ padding: "28px 26px", display: "flex", flexDirection: "column", gap: 18 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <span style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(var(--agent-coral-rgb),0.14)", color: "var(--agent-coral-deep)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                      <Sparkle size={22} weight="fill" />
                    </span>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>
                      See Sales Progressor in action
                    </p>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
                      Explore a fully worked example with progress, updates, tasks and activity already in place.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void explore()}
                    className="agent-btn agent-btn-color-primary"
                    style={{ width: "100%", justifyContent: "center", padding: "13px 20px", fontSize: 15, fontWeight: 700 }}
                  >
                    Explore demo sale
                  </button>
                  <p style={{ textAlign: "center", fontSize: 12, color: "var(--agent-text-muted)", margin: 0 }}>
                    It&apos;s all sample data. Nothing here affects a real sale.
                  </p>
                  {error && (
                    <p role="alert" style={{ textAlign: "center", fontSize: 12.5, color: "var(--agent-danger, #dc2626)", margin: 0 }}>{error}</p>
                  )}
                </div>
              </>
            ) : (
              <div style={{ padding: "34px 28px", display: "flex", flexDirection: "column", gap: 22, alignItems: "center", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
                  Getting your demo ready&hellip;
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignSelf: "stretch", maxWidth: 240, margin: "0 auto" }}>
                  {STEPS.map((label, i) => {
                    const done = step > i;
                    const active = step === i;
                    return (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 11, opacity: done || active ? 1 : 0.4, transition: "opacity 200ms" }}>
                        <span style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: done ? "var(--agent-coral-deep)" : "transparent",
                          border: done ? "none" : "1.5px solid var(--agent-border-strong, rgba(15,23,42,0.18))",
                          color: done ? "#fff" : "var(--agent-coral-deep)",
                        }}>
                          {done ? <Check size={13} weight="bold" /> : active ? <CircleNotch size={13} weight="bold" className="agent-spin" /> : null}
                        </span>
                        <span style={{ fontSize: 13.5, fontWeight: done || active ? 600 : 500, color: "var(--agent-text-primary)" }}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return { launch, node };
}

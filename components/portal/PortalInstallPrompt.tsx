"use client";

import { useState, useEffect } from "react";
import { P } from "./portal-ui";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY   = "portal-install-dismissed";
const SUBSCRIBED_KEY = "portal-push-subscribed";

export function PortalInstallPrompt() {
  const [ready, setReady] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSSheet, setShowIOSSheet] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — don't show
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (standalone) return;

    // Already dismissed or already subscribed to push (implies they went through the full flow)
    if (localStorage.getItem(STORAGE_KEY) === "1") return;
    if (localStorage.getItem(SUBSCRIBED_KEY) === "1") return;

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setIsIOS(true);
      setReady(true);
      return;
    }

    // Android / Chrome — listen for the install prompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setReady(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setReady(false);
  }

  async function handleTap() {
    if (isIOS) {
      setShowIOSSheet(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      dismiss();
    } else {
      setReady(false); // hide for now but don't permanently dismiss
    }
  }

  if (!ready) return null;

  return (
    <>
      <div
        className="mb-4 rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: P.primaryBg, border: "1px solid rgba(255,107,74,0.15)" }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: P.primary }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <polyline points="8 13 12 17 16 13"/>
            <line x1="12" y1="9" x2="12" y2="17"/>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug" style={{ color: P.textPrimary }}>
            Add to your home screen
          </p>
          <p className="text-[12px] leading-snug mt-0.5" style={{ color: P.textSecondary }}>
            One tap access to your property updates
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleTap}
            className="px-3 py-1.5 rounded-xl text-[12px] font-semibold"
            style={{ background: P.primary, color: "#FFFFFF" }}
          >
            {isIOS ? "Show me" : "Install"}
          </button>
          <button
            onClick={dismiss}
            className="w-7 h-7 flex items-center justify-center rounded-full"
            style={{ color: P.textMuted }}
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* iOS step-by-step bottom sheet */}
      {showIOSSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowIOSSheet(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: "#FFFFFF", boxShadow: P.shadowXl }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: "#E2E8F0" }} />
            <h3 className="text-[17px] font-semibold mb-1" style={{ color: P.textPrimary }}>
              Add to Home Screen
            </h3>
            <p className="text-[13px] mb-5" style={{ color: P.textSecondary }}>
              Two quick steps in Safari:
            </p>

            <div className="space-y-4 mb-6">
              <IOSStep n={1}>
                <>
                  Tap the{" "}
                  <svg className="inline-block align-text-top mx-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  {" "}<strong>Share</strong> button at the bottom of your screen
                </>
              </IOSStep>
              <IOSStep n={2}>
                Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong>
              </IOSStep>
            </div>

            <button
              onClick={() => { setShowIOSSheet(false); dismiss(); }}
              className="w-full py-3.5 rounded-2xl text-[15px] font-semibold"
              style={{ background: P.primary, color: "#FFFFFF" }}
            >
              Got it
            </button>
            <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
          </div>
        </div>
      )}
    </>
  );
}

function IOSStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold mt-0.5"
        style={{ background: P.primaryBg, color: P.primary }}
      >
        {n}
      </div>
      <p className="text-[14px] flex-1 leading-relaxed" style={{ color: P.textPrimary }}>
        {children}
      </p>
    </div>
  );
}

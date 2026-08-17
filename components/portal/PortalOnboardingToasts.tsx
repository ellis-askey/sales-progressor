"use client";
// PortalOnboardingToasts — queue-driven bottom-anchored pop-ups that
// replace the old inline banners for "Add to home screen" (install
// prompt) and "Get notified of progress" (push prompt).
//
// Ellis's brief (2026-08-09):
//   - Fade up + in a few seconds after page loads (not immediately)
//   - Only one shows at a time
//   - If one is X'd, the OTHER appears (if eligible)
//   - Bottom-anchored, above the tab bar
//
// Behaviour details:
//   - 3-second post-mount delay before the first toast appears
//   - Install is tried first (higher-value action; if they install the
//     PWA then push naturally becomes possible)
//   - Push is tried after Install is dismissed OR determined ineligible
//   - Once both have been shown-and-dismissed this session, we mark a
//     sessionStorage flag and stay silent for the rest of the visit
//   - Toasts do NOT auto-dismiss — they carry a primary action, so
//     they stay until the user actions or X's them
//   - Mobile-only per the existing `lg:hidden` gate around the mount
//     site (PortalShell); desktop never sees these
//
// The iOS "Add to Home Screen" bottom sheet from the original Install
// prompt is preserved as-is — same UI, invoked when Install's primary
// action fires on iOS.

import { useEffect, useMemo, useState } from "react";
import { P } from "./portal-ui";

// ── Storage keys (unchanged from the original components so users who
//    dismissed a prompt before this refactor stay dismissed) ────────
const INSTALL_DISMISSED_KEY = "portal-install-dismissed";
const PUSH_DISMISSED_KEY    = "portal-push-dismissed";
const PUSH_SUBSCRIBED_KEY   = "portal-push-subscribed";
const SESSION_SEEN_KEY      = "portal-onboarding-seen-this-session";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type QueueItem = "install" | "push" | null;

// ─── Install eligibility hook ──────────────────────────────────────
function useInstallEligibility(): {
  eligible: boolean;
  isIOS: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  markDismissed: () => void;
} {
  const [eligible, setEligible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already installed as PWA → don't show.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (standalone) return;

    // Already dismissed OR already subscribed to push (full onboarding
    // done previously) → don't show.
    if (localStorage.getItem(INSTALL_DISMISSED_KEY) === "1") return;
    if (localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1") return;

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setIsIOS(true);
      setEligible(true);
      return;
    }

    // Android / Chromium — wait for the browser to fire the install prompt.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setEligible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return {
    eligible,
    isIOS,
    deferredPrompt,
    markDismissed: () => localStorage.setItem(INSTALL_DISMISSED_KEY, "1"),
  };
}

// ─── Push eligibility hook ──────────────────────────────────────────
function usePushEligibility(): {
  eligible: boolean;
  markDismissed: () => void;
  markSubscribed: () => void;
} {
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(PUSH_DISMISSED_KEY) === "1") return;
    if (localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1") return;

    const pushSupported =
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!pushSupported) return;
    if (Notification.permission === "denied") return;

    setEligible(true);
  }, []);

  return {
    eligible,
    markDismissed: () => localStorage.setItem(PUSH_DISMISSED_KEY, "1"),
    markSubscribed: () => localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1"),
  };
}

// ─── Toast shell — bottom-anchored, fades up + in ───────────────────
function ToastShell({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        // Sits above the bottom tab bar (~70px) + the iOS home indicator
        // inset. Users can still tap the tab bar through the gap between.
        bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        zIndex: 30,
        maxWidth: 500,
        margin: "0 auto",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition:
          "opacity 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ─── iOS "Add to Home Screen" bottom sheet (unchanged behaviour) ────
function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      onClick={onClose}
    >
      <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
      <div
        className="portal-sheet relative w-full max-w-lg mx-auto rounded-t-3xl p-6"
        style={{ background: P.cardBg, boxShadow: P.shadowXl }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: P.border }} />
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
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl text-[15px] font-semibold"
          style={{ background: P.primary, color: "#FFFFFF" }}
        >
          Got it
        </button>
        <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
      </div>
    </div>
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

// ─── Queue + toast bodies ───────────────────────────────────────────
export function PortalOnboardingToasts({
  token,
  vapidPublicKey,
}: {
  token: string;
  vapidPublicKey: string;
}) {
  const install = useInstallEligibility();
  const push    = usePushEligibility();

  const [active, setActive] = useState<QueueItem>(null);
  const [visible, setVisible] = useState(false);  // controls fade-up
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "asking" | "denied" | "error">("idle");

  // Session flag — once both toasts have been shown-and-dismissed this
  // session, don't try again on subsequent navigation.
  const sessionSeen = useMemo(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_SEEN_KEY) === "1";
  }, []);

  // Queue driver: 3s after mount, decide what to show. If active gets
  // set to null (dismissed / not eligible) fall through to the next.
  useEffect(() => {
    if (sessionSeen) return;
    if (active !== null) return;
    // The eligibility hooks resolve async in their own useEffects, so
    // this effect re-runs when they change. First pass: 3s delay.
    const t = window.setTimeout(() => {
      if (install.eligible) setActive("install");
      else if (push.eligible) setActive("push");
      // else: nothing to show; stay null.
    }, 3000);
    return () => window.clearTimeout(t);
  }, [sessionSeen, active, install.eligible, push.eligible]);

  // Fade-up on active change — flip visible one frame later so the CSS
  // transition fires from opacity 0 → 1.
  useEffect(() => {
    if (active === null) { setVisible(false); return; }
    // Give the browser a frame to paint opacity: 0, then flip.
    const r = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(r);
  }, [active]);

  // Tell the floating help widget to get out of the way while a toast or the
  // iOS sheet is up, and come back once it's gone.
  useEffect(() => {
    const shown = active !== null || showIOSSheet;
    window.dispatchEvent(new CustomEvent("portal-overlay", { detail: { shown } }));
  }, [active, showIOSSheet]);

  function afterInstallDismissed() {
    install.markDismissed();
    setVisible(false);
    // Wait for fade-out to finish, then queue the next.
    window.setTimeout(() => {
      if (push.eligible) {
        setActive("push");
      } else {
        setActive(null);
        sessionStorage.setItem(SESSION_SEEN_KEY, "1");
      }
    }, 340);
  }

  function afterPushDismissed() {
    push.markDismissed();
    setVisible(false);
    window.setTimeout(() => {
      setActive(null);
      sessionStorage.setItem(SESSION_SEEN_KEY, "1");
    }, 340);
  }

  async function handleInstallPrimary() {
    if (install.isIOS) {
      setShowIOSSheet(true);
      return;
    }
    if (!install.deferredPrompt) return;
    await install.deferredPrompt.prompt();
    const { outcome } = await install.deferredPrompt.userChoice;
    if (outcome === "accepted") {
      install.markDismissed();
      setVisible(false);
      window.setTimeout(() => {
        // Try push after successful install.
        if (push.eligible) setActive("push");
        else { setActive(null); sessionStorage.setItem(SESSION_SEEN_KEY, "1"); }
      }, 340);
    } else {
      // User dismissed the native picker — treat as dismiss.
      afterInstallDismissed();
    }
  }

  async function handlePushEnable() {
    setPushStatus("asking");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setPushStatus("denied"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/portal/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error("subscribe-failed");
      push.markSubscribed();
      setPushStatus("idle");
      setVisible(false);
      window.setTimeout(() => {
        setActive(null);
        sessionStorage.setItem(SESSION_SEEN_KEY, "1");
      }, 340);
    } catch (err) {
      console.error("[PortalOnboardingToasts] push subscribe failed:", err);
      setPushStatus("error");
    }
  }

  // Nothing to show → nothing rendered.
  if (sessionSeen || active === null) return null;

  return (
    <>
      <ToastShell visible={visible}>
        {active === "install" && (
          <InstallToastBody
            isIOS={install.isIOS}
            onPrimary={handleInstallPrimary}
            onDismiss={afterInstallDismissed}
          />
        )}
        {active === "push" && (
          <PushToastBody
            status={pushStatus}
            onEnable={handlePushEnable}
            onDismiss={afterPushDismissed}
          />
        )}
      </ToastShell>

      {showIOSSheet && (
        <IOSInstallSheet
          onClose={() => {
            setShowIOSSheet(false);
            // Mark install dismissed once the iOS sheet closes; if the
            // user actually did the two steps, great; if not, they can
            // still add later via the browser menu.
            afterInstallDismissed();
          }}
        />
      )}
    </>
  );
}

// ─── Toast bodies (Install + Push) ──────────────────────────────────
function InstallToastBody({
  isIOS,
  onPrimary,
  onDismiss,
}: {
  isIOS: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px 12px 12px 14px",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--portal-toast-bg, rgba(255, 255, 255, 0.94))",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: `0.5px solid ${P.border}`,
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: P.primary,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2"/>
          <polyline points="8 13 12 17 16 13"/>
          <line x1="12" y1="9" x2="12" y2="17"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.textPrimary, lineHeight: 1.25 }}>
          Add to your home screen
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textSecondary, lineHeight: 1.35 }}>
          One tap access to your updates.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onPrimary}
          style={{
            padding: "7px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            background: P.primary,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {isIOS ? "Show me" : "Install"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            width: 30, height: 30, borderRadius: 999,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            border: "none",
            background: "transparent",
            color: P.textMuted,
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

function PushToastBody({
  status,
  onEnable,
  onDismiss,
}: {
  status: "idle" | "asking" | "denied" | "error";
  onEnable: () => void;
  onDismiss: () => void;
}) {
  if (status === "denied") {
    return (
      <div style={toastStyleTint("#FEF3C7", "#FDE68A")}>
        <p style={{ margin: 0, fontSize: 12, color: "#92400E", flex: 1 }}>
          Notifications blocked in your browser. You can enable them from Settings.
        </p>
        <DismissBtn onClick={onDismiss} tone="dark" />
      </div>
    );
  }
  if (status === "error") {
    return (
      <div style={toastStyleTint("#FEF2F2", "#FECACA")}>
        <p style={{ margin: 0, fontSize: 12, color: "#991B1B", flex: 1 }}>
          Couldn&apos;t set up notifications. Try refreshing.
        </p>
        <DismissBtn onClick={onDismiss} tone="dark" />
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "12px 12px 12px 14px",
        borderRadius: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--portal-toast-bg, rgba(255, 255, 255, 0.94))",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: `0.5px solid ${P.border}`,
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 10,
          background: P.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 003.4 0"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: P.textPrimary, lineHeight: 1.25 }}>
          Get notified of progress
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: P.textSecondary, lineHeight: 1.35 }}>
          We&apos;ll ping you when your sale moves forward.
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onEnable}
          disabled={status === "asking"}
          style={{
            padding: "7px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            border: "none",
            background: P.accent,
            color: "#fff",
            cursor: status === "asking" ? "wait" : "pointer",
            opacity: status === "asking" ? 0.7 : 1,
          }}
        >
          {status === "asking" ? "Setting up…" : "Enable"}
        </button>
        <DismissBtn onClick={onDismiss} tone="light" />
      </div>
    </div>
  );
}

function DismissBtn({ onClick, tone }: { onClick: () => void; tone: "light" | "dark" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      style={{
        width: 30, height: 30, borderRadius: 999,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: "none",
        background: "transparent",
        color: tone === "dark" ? "#92400E" : P.textMuted,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  );
}

function toastStyleTint(bg: string, border: string): React.CSSProperties {
  return {
    padding: "12px 12px 12px 14px",
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: bg,
    border: `1px solid ${border}`,
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.10)",
  };
}

// ─── Utility (unchanged from the original push component) ───────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

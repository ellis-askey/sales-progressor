"use client";

import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_KEY  = "agent-install-dismissed";
const SUBSCRIBED_KEY = "agent-push-subscribed";
const PUSH_KEY     = "agent-push-dismissed";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

// ── Install prompt (shown when not yet installed) ─────────────────────────────

export function AgentInstallPrompt() {
  const [ready, setReady]               = useState(false);
  const [isIOS, setIsIOS]               = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSSheet, setShowIOSSheet] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(INSTALL_KEY) === "1") return;
    if (localStorage.getItem(SUBSCRIBED_KEY) === "1") return;

    const ua = navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua)) {
      setIsIOS(true);
      setReady(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setReady(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(INSTALL_KEY, "1");
    setReady(false);
  }

  async function handleTap() {
    if (isIOS) { setShowIOSSheet(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") dismiss();
    else setReady(false);
  }

  if (!ready) return null;

  return (
    <>
      {/* Fixed bottom banner */}
      <div style={{
        position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 50,
        background: "rgba(255,245,236,0.96)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        border: "0.5px solid rgba(255,138,101,0.30)",
        borderRadius: 16,
        boxShadow: "0 12px 40px rgba(200,80,30,0.18)",
        padding: "14px 16px",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "linear-gradient(135deg, #FF8A65 0%, #FF6B4A 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <polyline points="8 13 12 17 16 13"/>
            <line x1="12" y1="9" x2="12" y2="17"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#3D1F0E", lineHeight: 1.3 }}>
            Add to your home screen
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#7A4A2E" }}>
            One tap to your files and reminders
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleTap}
            style={{
              padding: "7px 14px", borderRadius: 10, border: "none",
              background: "#D85A35", color: "#fff",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {isIOS ? "Show me" : "Install"}
          </button>
          <button
            onClick={dismiss}
            style={{
              width: 28, height: 28, display: "flex", alignItems: "center",
              justifyContent: "center", border: "none", background: "none",
              cursor: "pointer", color: "rgba(61,31,14,0.40)", borderRadius: 6,
            }}
            aria-label="Dismiss"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* iOS bottom sheet */}
      {showIOSSheet && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }}
          onClick={() => setShowIOSSheet(false)}
        >
          <div
            style={{ width: "100%", borderRadius: "28px 28px 0 0", background: "#fff", padding: "24px 24px 0" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "#E2E8F0", margin: "0 auto 20px" }} />
            <p style={{ fontSize: 17, fontWeight: 600, color: "#3D1F0E", marginBottom: 4 }}>
              Add to Home Screen
            </p>
            <p style={{ fontSize: 13, color: "#7A4A2E", marginBottom: 20 }}>Two quick steps in Safari:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <IOSStep n={1}>
                <>
                  Tap the{" "}
                  <svg style={{ display: "inline-block", verticalAlign: "text-top", marginInline: 2 }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                    <polyline points="16 6 12 2 8 6"/>
                    <line x1="12" y1="2" x2="12" y2="15"/>
                  </svg>
                  {" "}<strong>Share</strong> button at the bottom of your screen
                </>
              </IOSStep>
              <IOSStep n={2}>Scroll down and tap <strong>&ldquo;Add to Home Screen&rdquo;</strong></IOSStep>
            </div>
            <button
              onClick={() => { setShowIOSSheet(false); dismiss(); }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 16, border: "none",
                background: "#D85A35", color: "#fff", fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}
            >
              Got it
            </button>
            <div style={{ height: "max(env(safe-area-inset-bottom), 16px)" }} />
          </div>
        </div>
      )}
    </>
  );
}

function IOSStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: "rgba(216,90,53,0.12)", color: "#D85A35",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700,
      }}>
        {n}
      </div>
      <p style={{ fontSize: 14, color: "#3D1F0E", flex: 1, lineHeight: 1.5, margin: 0 }}>{children}</p>
    </div>
  );
}

// ── Push prompt (shown after app is installed / standalone) ───────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

export function AgentPushPrompt() {
  const [show, setShow]     = useState(false);
  const [status, setStatus] = useState<"idle" | "asking" | "done" | "denied" | "error" | "unsupported">("idle");

  useEffect(() => {
    if (localStorage.getItem(PUSH_KEY) || localStorage.getItem(SUBSCRIBED_KEY)) return;

    const standalone = isStandalone();
    const pushSupported =
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    if (!pushSupported) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS && standalone) {
        const t = setTimeout(() => { setStatus("unsupported"); setShow(true); }, 3000);
        return () => clearTimeout(t);
      }
      return;
    }

    if (Notification.permission === "denied") return;

    const t = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(t);
  }, []);

  async function enable() {
    setStatus("asking");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setStatus("denied"); return; }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await fetch("/api/agent/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      localStorage.setItem(SUBSCRIBED_KEY, "1");
      setStatus("done");
      setTimeout(() => setShow(false), 2000);
    } catch (err) {
      console.error("[AgentPushPrompt] subscribe failed:", err);
      setStatus("error");
    }
  }

  function dismiss() {
    localStorage.setItem(PUSH_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  if (status === "done") {
    return (
      <div style={{
        position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 50,
        background: "#D1FAE5", borderRadius: 14, padding: "12px 16px",
        fontSize: 13, fontWeight: 500, color: "#065F46",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>✓</span> Notifications enabled
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div style={{
        position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 50,
        background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 14, padding: "14px 16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#92400E", margin: "0 0 4px" }}>Notifications not available</p>
            <p style={{ fontSize: 12, color: "#B45309", margin: 0, lineHeight: 1.5 }}>
              iOS 16.4+ required. Update your iPhone and re-add this page to your Home Screen.
            </p>
          </div>
          <button onClick={dismiss} style={{ flexShrink: 0, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "rgba(146,64,14,0.12)", borderRadius: "50%", cursor: "pointer", color: "#92400E" }} aria-label="Dismiss">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div style={{
        position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 50,
        background: "#FEF3C7", borderRadius: 14, padding: "12px 16px",
        fontSize: 13, color: "#92400E",
      }}>
        Notifications blocked. Enable them in Settings → Safari → [this site].
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{
        position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 50,
        background: "#FEF2F2", borderRadius: 14, padding: "12px 16px",
        fontSize: 13, color: "#991B1B",
      }}>
        Couldn&apos;t set up notifications. Try refreshing the page.
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 50,
      background: "rgba(255,245,236,0.96)",
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      border: "0.5px solid rgba(255,138,101,0.30)",
      borderRadius: 16,
      boxShadow: "0 12px 40px rgba(200,80,30,0.18)",
      padding: "16px",
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: "#3D1F0E", margin: "0 0 4px" }}>
        Get notified of updates
      </p>
      <p style={{ fontSize: 12, color: "#7A4A2E", margin: "0 0 14px", lineHeight: 1.5 }}>
        We&apos;ll alert you when buyers, sellers, or solicitors act — no need to keep checking.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={enable}
          disabled={status === "asking"}
          style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
            background: "#D85A35", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
            opacity: status === "asking" ? 0.6 : 1,
          }}
        >
          {status === "asking" ? "Setting up…" : "Enable notifications"}
        </button>
        <button
          onClick={dismiss}
          style={{
            padding: "10px 16px", borderRadius: 10, border: "none",
            background: "rgba(216,90,53,0.12)", color: "#D85A35",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

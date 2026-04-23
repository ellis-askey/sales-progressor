"use client";

import { useState, useEffect } from "react";

const DISMISSED_KEY  = "portal-push-dismissed";
const SUBSCRIBED_KEY = "portal-push-subscribed";
const FAILED_KEY     = "portal-push-failed";

export function PortalPushPrompt({ token, vapidPublicKey }: { token: string; vapidPublicKey: string }) {
  const [show, setShow]     = useState(false);
  const [status, setStatus] = useState<"idle" | "asking" | "done" | "denied" | "error">("idle");

  useEffect(() => {
    if (
      typeof Notification === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      Notification.permission === "denied" ||
      localStorage.getItem(DISMISSED_KEY) ||
      localStorage.getItem(SUBSCRIBED_KEY)
    ) return;

    // Show after a short delay so it doesn't immediately interrupt
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

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      await fetch("/api/portal/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, subscription: sub.toJSON() }),
      });

      localStorage.setItem(SUBSCRIBED_KEY, "1");
      setStatus("done");
      setTimeout(() => setShow(false), 2000);
    } catch (err) {
      console.error("[PushPrompt] subscribe failed:", err);
      setStatus("error");
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setShow(false);
  }

  if (!show) return null;

  if (status === "done") {
    return (
      <div className="mx-4 mb-4 px-4 py-3 rounded-2xl text-[13px] font-medium flex items-center gap-2.5" style={{ background: "#D1FAE5", color: "#065F46" }}>
        <span>✓</span> Notifications enabled
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="mx-4 mb-4 px-4 py-3 rounded-2xl text-[13px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
        Notifications blocked. Enable them in your browser settings.
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-4 mb-4 px-4 py-3 rounded-2xl text-[13px]" style={{ background: "#FEF2F2", color: "#991B1B" }}>
        Couldn&apos;t set up notifications. Try refreshing the page.
      </div>
    );
  }

  return (
    <div className="mx-4 mb-4 px-4 py-4 rounded-2xl" style={{ background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
      <p className="text-[13px] font-semibold text-blue-900 mb-1">Get notified of progress</p>
      <p className="text-[12px] text-blue-700 mb-3 leading-relaxed">
        We'll notify you when your transaction moves forward — no need to keep checking.
      </p>
      <div className="flex gap-2">
        <button
          onClick={enable}
          disabled={status === "asking"}
          className="flex-1 py-2 rounded-xl text-[13px] font-bold text-white transition-colors disabled:opacity-60"
          style={{ background: "#3B82F6" }}
        >
          {status === "asking" ? "Setting up…" : "Enable"}
        </button>
        <button
          onClick={dismiss}
          className="px-4 py-2 rounded-xl text-[13px] font-medium text-blue-600"
          style={{ background: "#DBEAFE" }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

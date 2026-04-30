"use client";

import { useState, useEffect } from "react";

const SUBSCRIBED_KEY = "agent-push-subscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

export function AnalyticsNotifCta() {
  const [status, setStatus] = useState<"hidden" | "idle" | "asking" | "done" | "denied">("hidden");

  useEffect(() => {
    if (localStorage.getItem(SUBSCRIBED_KEY)) return;
    const supported =
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    if (!supported || Notification.permission === "denied") return;
    setStatus("idle");
  }, []);

  async function subscribe() {
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
    } catch {
      setStatus("hidden");
    }
  }

  if (status === "hidden" || status === "denied") return null;

  if (status === "done") {
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 99,
        background: "var(--agent-success-bg)", color: "var(--agent-success)",
        flexShrink: 0,
      }}>
        ✓ Alerts on
      </span>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={status === "asking"}
      style={{
        fontSize: 11, fontWeight: 600,
        padding: "5px 10px", borderRadius: 99,
        background: "rgba(255,138,101,0.12)",
        color: "var(--agent-coral-deep)",
        border: "1px solid rgba(255,138,101,0.25)",
        cursor: "pointer",
        flexShrink: 0,
        whiteSpace: "nowrap",
        opacity: status === "asking" ? 0.6 : 1,
      }}
    >
      {status === "asking" ? "Setting up…" : "🔔 Enable alerts"}
    </button>
  );
}

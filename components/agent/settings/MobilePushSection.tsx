"use client";

// Mobile push notifications card on /agent/settings. Three concerns:
//   1. Per-event toggles (six rows) — drive whether each event fires push
//      when it happens. Defaults from DEFAULT_PUSH_PREFS (most ON, client
//      milestone confirm OFF).
//   2. Subscribed devices list — shows existing AgentPushSubscription rows
//      with a Revoke button (deletes by endpoint via existing API).
//   3. "Enable on this device" button — runs the same permission/SW/subscribe
//      flow AgentInstallPrompt uses. Detects iOS Safari outside PWA and shows
//      a short walkthrough instead of a broken-looking button.
//
// All toggle writes go through updateAgentPushPrefAction (server action,
// JSON-merge into agentPreferences.notifications.push).
//
// Bell notifications fire regardless of push toggles — these toggles only
// gate the device-push duplicate.

import { useState, useTransition, useEffect } from "react";
import { updateAgentPushPrefAction } from "@/app/actions/agent-preferences";
import type { NotificationPrefs, PushKey } from "@/lib/agent/notification-prefs";

export type SubscribedDevice = {
  id: string;
  endpoint: string;
  label: string;       // Best-effort "Chrome on Mac" parse from user agent (server-side)
  createdAt: Date;
};

type Spec = { key: PushKey; label: string; description: string };

const TOGGLES: Spec[] = [
  {
    key: "clientConfirmation",
    label: "Client milestone confirmations",
    description: "When a buyer or seller confirms a milestone via their portal. Off by default — turn on if you want the buzz for every client tick.",
  },
  {
    key: "clientChaseNote",
    label: "Client replies on Respond page",
    description: "When a client leaves a note on a chase request (e.g. \"Solicitor's away til Monday\").",
  },
  {
    key: "chaseEscalation",
    label: "Chase escalates",
    description: "When a chase task crosses the threshold to escalated priority — manually or by the engine.",
  },
  {
    key: "fileAssigned",
    label: "File assigned to me",
    description: "When an admin assigns a new file to you.",
  },
  {
    key: "exchangeApproaching",
    label: "Exchange ≤ 7 days",
    description: "Daily check; fires once per file when the exchange target is within a week.",
  },
  {
    key: "chainEvent",
    label: "Chain updates",
    description: "Lost buyer / lost purchase / asked to wait / wait nudge / decline on any chain your file is part of.",
  },
];

type SubscribeStatus =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "done" }
  | { kind: "denied" }
  | { kind: "blocked" }
  | { kind: "unsupported"; reason: "browser" | "ios-needs-pwa" }
  | { kind: "error"; message: string };

export function MobilePushSection({
  initialPrefs,
  initialDevices,
}: {
  initialPrefs: NotificationPrefs;
  initialDevices: SubscribedDevice[];
}) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(initialPrefs);
  const [devices, setDevices] = useState<SubscribedDevice[]>(initialDevices);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [subStatus, setSubStatus] = useState<SubscribeStatus>({ kind: "idle" });
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Detect support + iOS-PWA situation on mount (client-only).
  const [envCheck, setEnvCheck] = useState<{
    supported: boolean;
    isIOS: boolean;
    isStandalone: boolean;
  } | null>(null);

  useEffect(() => {
    const supported =
      typeof Notification !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    setEnvCheck({ supported, isIOS, isStandalone: standalone });
  }, []);

  function handleToggle(key: PushKey) {
    if (isPending) return;
    const next = !prefs.push[key];
    setPrefs((p) => ({ ...p, push: { ...p.push, [key]: next } }));
    setSavingKey(key);
    startTransition(async () => {
      try {
        await updateAgentPushPrefAction({ key, value: next });
      } catch {
        setPrefs((p) => ({ ...p, push: { ...p.push, [key]: !next } }));
      } finally {
        setSavingKey(null);
      }
    });
  }

  async function handleEnable() {
    if (!envCheck) return;
    if (!envCheck.supported) {
      if (envCheck.isIOS && !envCheck.isStandalone) {
        setSubStatus({ kind: "unsupported", reason: "ios-needs-pwa" });
      } else {
        setSubStatus({ kind: "unsupported", reason: "browser" });
      }
      return;
    }
    if (Notification.permission === "denied") {
      setSubStatus({ kind: "blocked" });
      return;
    }
    setSubStatus({ kind: "asking" });
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSubStatus({ kind: "denied" });
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      if (!vapidKey) {
        setSubStatus({ kind: "error", message: "Push isn't configured for this environment." });
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const subJson = sub.toJSON();
      const res = await fetch("/api/agent/push-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subJson }),
      });
      if (!res.ok) throw new Error("Server save failed");

      // Optimistically add the new device to the list.
      setDevices((prev) => [
        ...prev,
        {
          id: subJson.endpoint ?? "new",
          endpoint: subJson.endpoint ?? "",
          label: parseUserAgent(navigator.userAgent),
          createdAt: new Date(),
        },
      ]);
      setSubStatus({ kind: "done" });
    } catch (err) {
      console.error("[push subscribe failed]", err);
      setSubStatus({ kind: "error", message: err instanceof Error ? err.message : "Subscribe failed" });
    }
  }

  async function handleRevoke(device: SubscribedDevice) {
    if (isPending) return;
    setRevokingId(device.id);
    try {
      await fetch("/api/agent/push-subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: device.endpoint }),
      });
      setDevices((prev) => prev.filter((d) => d.id !== device.id));
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="glass-card p-6">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-slate-900/80 mb-1">Mobile push notifications</h2>
        <p className="text-xs text-slate-900/50">
          Get device pop-ups for the events that matter — even when the tab is closed. The in-app bell still fires for everything; these toggles only control the device push.
        </p>
      </div>

      {/* Devices list */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Devices</p>
        {devices.length === 0 ? (
          <p className="text-xs text-slate-500 italic mb-3">No devices subscribed yet — click below to enable on this one.</p>
        ) : (
          <div className="space-y-2 mb-3">
            {devices.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-slate-50 border border-slate-200">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800 truncate">{d.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Added {new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(d)}
                  disabled={revokingId === d.id}
                  className="agent-btn agent-btn-xs agent-btn-ghost-bordered flex-shrink-0"
                >
                  {revokingId === d.id ? "…" : "Revoke"}
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={handleEnable}
          disabled={subStatus.kind === "asking" || subStatus.kind === "done"}
          className="agent-btn agent-btn-sm agent-btn-primary"
        >
          {subStatus.kind === "asking" ? "Asking permission…" : subStatus.kind === "done" ? "✓ Enabled" : "Enable on this device"}
        </button>

        {subStatus.kind === "denied" && (
          <p className="text-xs text-amber-700 mt-2">
            Permission denied. To enable, click the lock/permissions icon in your browser address bar and allow notifications, then click Enable again.
          </p>
        )}
        {subStatus.kind === "blocked" && (
          <p className="text-xs text-amber-700 mt-2">
            Notifications are blocked for this site in your browser settings. Unblock there, then click Enable again.
          </p>
        )}
        {subStatus.kind === "unsupported" && subStatus.reason === "browser" && (
          <p className="text-xs text-slate-600 mt-2">
            Your browser doesn&apos;t support web push notifications. Try Chrome, Edge, Firefox, or Safari (macOS 13+).
          </p>
        )}
        {subStatus.kind === "unsupported" && subStatus.reason === "ios-needs-pwa" && (
          <div className="mt-3 p-3 rounded-md bg-blue-50 border border-blue-100 text-xs text-blue-900">
            <p className="font-semibold mb-1">To get push on iPhone, install Sales Progressor first:</p>
            <ol className="list-decimal pl-5 space-y-0.5">
              <li>Tap the Share button at the bottom of Safari</li>
              <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
              <li>Tap Add</li>
              <li>Open the new Sales Progressor icon from your home screen</li>
              <li>Come back to this settings page and click Enable</li>
            </ol>
          </div>
        )}
        {subStatus.kind === "error" && (
          <p className="text-xs text-red-700 mt-2">Something went wrong: {subStatus.message}</p>
        )}
      </div>

      {/* Per-event toggles */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Push me when…</p>
        <div className="space-y-3">
          {TOGGLES.map((t) => {
            const on = prefs.push[t.key];
            const saving = savingKey === t.key;
            return (
              <div
                key={t.key}
                className="flex items-start justify-between gap-4 py-2 border-t border-slate-200/40 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900/85">{t.label}</p>
                  <p className="text-xs text-slate-900/55 mt-0.5">{t.description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${on ? "Turn off" : "Turn on"} ${t.label}`}
                  disabled={saving}
                  onClick={() => handleToggle(t.key)}
                  className="relative inline-flex h-7 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors disabled:opacity-60"
                  style={{ background: on ? "#FF6B4A" : "rgba(15,23,42,0.20)" }}
                >
                  <span
                    className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
                    style={{ transform: on ? "translateX(22px)" : "translateX(4px)", marginTop: 4 }}
                  />
                </button>
              </div>
            );
          })}
        </div>
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

function parseUserAgent(ua: string): string {
  // Lightweight browser + OS extraction. Not exhaustive — covers the common
  // agents we'd see (Chrome/Edge/Firefox/Safari on Mac/Windows/Android/iOS).
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = "Safari";

  let os = "device";
  if (/Mac/.test(ua) && !/iPhone|iPad/.test(ua)) os = "Mac";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone/.test(ua)) os = "iPhone";
  else if (/iPad/.test(ua)) os = "iPad";
  else if (/Linux/.test(ua)) os = "Linux";

  return `${browser} on ${os}`;
}

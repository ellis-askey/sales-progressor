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
import { DeviceMobile } from "@phosphor-icons/react";
import { updateAgentPushPrefAction, sendTestPushAction } from "@/app/actions/agent-preferences";
import { Pill } from "@/components/ui/Pill";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { SectionMasterControl } from "@/components/account/chrome/SectionMasterControl";
import type { NotificationPrefs, PushKey } from "@/lib/agent/notification-prefs";

export type SubscribedDevice = {
  id: string;
  endpoint: string;
  userAgent: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
};

type Spec = { key: PushKey; label: string; description: string };

const TOGGLES: Spec[] = [
  {
    key: "clientConfirmation",
    label: "Client milestone confirmations",
    description: "When a buyer or seller confirms a milestone via their portal. Off by default — turn on to be notified every time a client confirms.",
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
    description: "When a file is assigned (or reassigned) to you.",
  },
  {
    key: "exchangeApproaching",
    label: "Exchange approaching",
    description: "Daily check; fires once per file when the exchange target is within a week.",
  },
  {
    key: "mortgageOfferExpiring",
    label: "Mortgage offer expiring",
    description: "Daily check; warns you as a client's mortgage-offer expiry nears: a heads-up at 21 days, a sharper nudge at 7, and once it lapses.",
  },
  {
    key: "chainEvent",
    label: "Chain updates",
    description: "When something happens on a chain your file is part of — a pulled buyer, a fallen purchase, a wait request, or a declined invite.",
  },
];

type SubscribeStatus =
  | { kind: "idle" }
  | { kind: "asking" }
  | { kind: "done" }
  | { kind: "denied" }
  | { kind: "blocked" }
  | { kind: "unsupported"; reason: "browser" | "ios-needs-pwa" }
  | { kind: "unavailable" }   // VAPID public key not in client bundle — push pipeline unconfigured
  | { kind: "error" };        // generic catch-all; details go to console

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
  // Endpoint of the subscription registered to THIS browser session, if any.
  // Used to render the "This device" badge on the matching row.
  const [thisDeviceEndpoint, setThisDeviceEndpoint] = useState<string | null>(null);
  // Result of clicking "Send test push" — null = idle, otherwise a short
  // human-readable status string.
  const [testStatus, setTestStatus] = useState<string | null>(null);

  // Detect support + iOS-PWA situation + the current browser's subscription
  // endpoint on mount (client-only).
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

    // Look up THIS browser's push subscription endpoint so we can render the
    // "This device" badge. Quiet failure if SW not registered or no sub.
    (async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        const sub = await reg.pushManager.getSubscription();
        if (sub?.endpoint) setThisDeviceEndpoint(sub.endpoint);
      } catch {
        // Service worker not registered yet — no badge to render.
      }
    })();
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

  // Master "All on / All off" over the visible push toggles. The hidden
  // saleRelisted key is intentionally left untouched.
  function setAllPush(value: boolean) {
    if (isPending) return;
    const changed = TOGGLES.filter((t) => prefs.push[t.key] !== value);
    if (changed.length === 0) return;
    const prev = prefs;
    setPrefs((p) => {
      const push = { ...p.push };
      for (const t of changed) push[t.key] = value;
      return { ...p, push };
    });
    startTransition(async () => {
      try {
        await Promise.all(changed.map((t) => updateAgentPushPrefAction({ key: t.key, value })));
      } catch {
        setPrefs(prev);
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
        // Diagnostic detail goes to console; user sees the "unavailable" copy.
        console.error("[push subscribe] NEXT_PUBLIC_VAPID_PUBLIC_KEY missing");
        setSubStatus({ kind: "unavailable" });
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

      // Optimistically add the new device to the list. userAgent populated
      // from navigator.userAgent — server will have done the same from the
      // request header, so the persisted row will match on next reload.
      const newEndpoint = subJson.endpoint ?? "new";
      setDevices((prev) => [
        ...prev,
        {
          id: newEndpoint,
          endpoint: newEndpoint,
          userAgent: navigator.userAgent,
          lastUsedAt: null,
          createdAt: new Date(),
        },
      ]);
      // Now-current device — render the "This device" badge straight away.
      setThisDeviceEndpoint(newEndpoint);
      setSubStatus({ kind: "done" });
    } catch (err) {
      // Detail goes to the console for debugging; the user-facing string is
      // a fixed line so browser-API error fragments don't leak into the UI.
      console.error("[push subscribe failed]", err);
      setSubStatus({ kind: "error" });
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
      if (device.endpoint === thisDeviceEndpoint) setThisDeviceEndpoint(null);
    } finally {
      setRevokingId(null);
    }
  }

  async function handleTestPush() {
    setTestStatus("Sending…");
    try {
      const result = await sendTestPushAction();
      if (!result.ok) {
        setTestStatus("Couldn't send the test — try again.");
        return;
      }
      if (result.deliveredCount === 0) {
        if ("reason" in result && result.reason === "vapid_not_configured") {
          // Diagnostic detail (which env var, which environment) belongs
          // in server logs — the user just sees the unavailable copy.
          setTestStatus("Push notifications aren't available right now.");
        } else {
          setTestStatus("No devices subscribed yet — enable on this device first.");
        }
        return;
      }
      setTestStatus(
        result.deliveredCount === 1
          ? "Sent — check your device."
          : `Sent to ${result.deliveredCount} devices.`,
      );
    } catch {
      setTestStatus("Couldn't send the test — try again.");
    }
    // Auto-clear after a few seconds so the UI doesn't get stuck.
    setTimeout(() => setTestStatus(null), 8000);
  }

  function deviceLabel(d: SubscribedDevice): string {
    if (d.userAgent) return parseUserAgent(d.userAgent);
    return "Subscribed device";
  }

  // "Last used 3 days ago" if lastUsedAt set, otherwise "Added 5 Mar".
  function deviceSubLabel(d: SubscribedDevice): string {
    if (d.lastUsedAt) {
      const days = Math.floor((Date.now() - new Date(d.lastUsedAt).getTime()) / 86400000);
      if (days === 0) {
        const hours = Math.floor((Date.now() - new Date(d.lastUsedAt).getTime()) / 3600000);
        if (hours === 0) return "Last used just now";
        return hours === 1 ? "Last used 1 hour ago" : `Last used ${hours} hours ago`;
      }
      if (days === 1) return "Last used yesterday";
      if (days < 7) return `Last used ${days} days ago`;
      if (days < 30) return `Last used ${Math.round(days / 7)} weeks ago`;
      return `Last used ${Math.round(days / 30)} months ago`;
    }
    return `Added ${new Date(d.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  }

  return (
    <AccountCard
      icon={<DeviceMobile size={18} weight="bold" />}
      title="Push notifications"
      subtitle="Get pop-ups for important events, even when the app is closed."
      headerAction={<SectionMasterControl values={TOGGLES.map((t) => prefs.push[t.key])} onSetAll={setAllPush} disabled={isPending} />}
      bodyStyle={{ marginTop: 10 }}
    >
      {/* Devices list */}
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Devices</p>
        {devices.length === 0 ? (
          <p className="text-xs text-slate-500 italic mb-3">No devices subscribed yet — click below to enable on this one.</p>
        ) : (
          <div className="space-y-2 mb-3">
            {devices.map((d) => {
              const isThisDevice = d.endpoint === thisDeviceEndpoint;
              return (
                <div
                  key={d.id}
                  className={`flex items-center justify-between gap-3 py-2 px-3 rounded-md border ${
                    isThisDevice ? "bg-orange-50/40 border-orange-200" : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-800 truncate">{deviceLabel(d)}</p>
                      {isThisDevice && (
                        <Pill glass tone="brand" size="sm" className="uppercase tracking-wider flex-shrink-0">This device</Pill>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{deviceSubLabel(d)}</p>
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
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleEnable}
            disabled={subStatus.kind === "asking" || subStatus.kind === "done"}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            {subStatus.kind === "asking" ? "Asking permission…" : subStatus.kind === "done" ? "✓ Enabled" : "Enable on this device"}
          </button>
          <button
            type="button"
            onClick={handleTestPush}
            disabled={devices.length === 0 || testStatus === "Sending…"}
            className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
            title={devices.length === 0 ? "Enable on a device first" : "Sends a test push to confirm setup works. Bypasses the toggles below."}
          >
            Send test push
          </button>
          {testStatus && (
            <span className="text-xs text-slate-600">{testStatus}</span>
          )}
        </div>

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
        {subStatus.kind === "unavailable" && (
          <p className="text-xs text-amber-700 mt-2">Push notifications aren&apos;t available right now.</p>
        )}
        {subStatus.kind === "error" && (
          <p className="text-xs text-red-700 mt-2">Something went wrong — try again.</p>
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
    </AccountCard>
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

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
import { DeviceMobile, Bell, UploadSimple, Info } from "@/components/icons/ph";
import { updateAgentPushPrefAction, sendTestPushAction } from "@/app/actions/agent-preferences";
import { Button } from "@/components/arc/button/button";
import { Badge } from "@/components/ui/Badge";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

const coralVars = { "--foreground": "#FF6B4A", "--background": "#ffffff" } as React.CSSProperties;
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
  { key: "clientConfirmation", label: "Client confirmations", description: "When a buyer or seller confirms a milestone." },
  { key: "clientChaseNote", label: "Client replies on Respond page", description: "When a client leaves a note on a chase request." },
  { key: "chaseEscalation", label: "Chase escalations", description: "When a chase reaches escalated priority." },
  { key: "fileAssigned", label: "Files assigned to me", description: "When a file is assigned or reassigned to you." },
  { key: "exchangeApproaching", label: "Exchange approaching", description: "When an exchange target is within a week." },
  { key: "mortgageOfferExpiring", label: "Mortgage offer expiring", description: "When a client's mortgage offer is nearing expiry." },
  { key: "chainEvent", label: "Chain updates", description: "When something changes elsewhere in a chain that affects one of your files." },
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
        setTestStatus("Couldn't send the test. Try again.");
        return;
      }
      if (result.deliveredCount === 0) {
        if ("reason" in result && result.reason === "vapid_not_configured") {
          // Diagnostic detail (which env var, which environment) belongs
          // in server logs — the user just sees the unavailable copy.
          setTestStatus("Push notifications aren't available right now.");
        } else {
          setTestStatus("No devices subscribed yet. Enable on this device first.");
        }
        return;
      }
      setTestStatus(
        result.deliveredCount === 1
          ? "Sent. Check your device."
          : `Sent to ${result.deliveredCount} devices.`,
      );
    } catch {
      setTestStatus("Couldn't send the test. Try again.");
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
        <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--agent-text-secondary)] mb-2">Devices</p>
        {devices.length === 0 ? (
          <p className="text-xs text-[color:var(--agent-text-muted)] italic mb-3">No devices connected yet. Enable push notifications on this device below.</p>
        ) : (
          <div className="space-y-2 mb-3">
            {devices.map((d) => {
              const isThisDevice = d.endpoint === thisDeviceEndpoint;
              return (
                <div
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-2.5 px-3.5 rounded-[10px] border"
                  style={{ background: "var(--agent-surface-subtle, rgba(45,24,16,0.03))", borderColor: isThisDevice ? "rgba(var(--agent-coral-rgb),0.30)" : "var(--agent-border-subtle)" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-[color:var(--agent-text-secondary)] truncate">{deviceLabel(d)}</p>
                      {isThisDevice && <Badge tone="accent">This device</Badge>}
                    </div>
                    <p className="text-xs text-[color:var(--agent-text-muted)] mt-0.5">{deviceSubLabel(d)}</p>
                  </div>
                  <Button variant="secondary" size="xs" onClick={() => handleRevoke(d)} loading={revokingId === d.id} className="flex-shrink-0">
                    Revoke
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            style={coralVars}
            onClick={handleEnable}
            loading={subStatus.kind === "asking"}
            disabled={subStatus.kind === "done"}
          >
            {subStatus.kind === "done" ? "Enabled" : "Enable on this device"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestPush}
            loading={testStatus === "Sending…"}
            disabled={devices.length === 0}
            title={devices.length === 0 ? "Enable on a device first" : "Sends a test push to confirm setup works. Bypasses the toggles below."}
          >
            Send test push
          </Button>
          {testStatus && testStatus !== "Sending…" && (
            <span className="text-xs text-[color:var(--agent-text-secondary)]">{testStatus}</span>
          )}
        </div>

        {subStatus.kind === "denied" && (
          <div className="mt-2"><InlineAlert kind="warning">Permission denied. Click the lock or permissions icon in your browser&apos;s address bar, allow notifications, then try again.</InlineAlert></div>
        )}
        {subStatus.kind === "blocked" && (
          <div className="mt-2"><InlineAlert kind="warning">Notifications are blocked for this site. Allow them in your browser settings, then try again.</InlineAlert></div>
        )}
        {subStatus.kind === "unsupported" && subStatus.reason === "browser" && (
          <div className="mt-2"><InlineAlert kind="info">Your browser doesn&apos;t support push notifications. Try Chrome, Edge, Firefox or Safari (macOS 13+).</InlineAlert></div>
        )}
        {subStatus.kind === "unsupported" && subStatus.reason === "ios-needs-pwa" && <IosInstallGuide />}
        {subStatus.kind === "unavailable" && (
          <div className="mt-2"><InlineAlert kind="warning">Push notifications aren&apos;t available right now.</InlineAlert></div>
        )}
        {subStatus.kind === "error" && (
          <div className="mt-2"><InlineAlert kind="danger">Something went wrong. Try again.</InlineAlert></div>
        )}
      </div>

      {/* Per-event toggles */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--agent-text-secondary)] mb-2">Push me when…</p>
        <div className="space-y-3">
          {TOGGLES.map((t) => {
            const on = prefs.push[t.key];
            const saving = savingKey === t.key;
            return (
              <div
                key={t.key}
                className="flex items-start justify-between gap-4 py-2 border-t border-[color:var(--agent-border-subtle)] first:border-t-0 first:pt-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[color:var(--agent-text-primary)]">{t.label}</p>
                  <p className="text-xs text-[color:var(--agent-text-muted)] mt-0.5">{t.description}</p>
                </div>
                <LiquidToggle
                  checked={on}
                  onChange={() => handleToggle(t.key)}
                  width={44}
                  height={24}
                  color="var(--agent-coral, #FF8A65)"
                  disabled={saving}
                  aria-label={`${on ? "Turn off" : "Turn on"} ${t.label}`}
                />
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

// iPhone (Safari-outside-PWA) install walkthrough — push needs the app on the
// home screen first. A proper guide card (icon + heading + numbered steps),
// shown in place of a broken-looking Enable button.
function IosInstallGuide() {
  return (
    <div className="iig">
      <style>{IIG_CSS}</style>
      <span className="iig-ic"><Bell size={20} weight="regular" /></span>
      <p className="iig-h">Enable notifications on your iPhone</p>
      <p className="iig-sub">Stay up to date with new messages and important updates, even when you&apos;re not using the app.</p>
      <div className="iig-div" />
      <p className="iig-lead">First, add the app to your Home Screen</p>
      <div className="iig-steps">
        <div className="iig-step"><span className="iig-num">1.</span><span>Tap the <span style={{ whiteSpace: "nowrap" }}><b>Share</b> <UploadSimple size={13} weight="bold" className="iig-share" /></span> button in Safari.</span></div>
        <div className="iig-step"><span className="iig-num">2.</span><span>Scroll down and select <b>Add to Home Screen</b>.</span></div>
        <div className="iig-step"><span className="iig-num">3.</span><span>Tap <b>Add</b> in the top-right corner.</span></div>
        <div className="iig-step"><span className="iig-num">4.</span><span>Open the app from your Home Screen.</span></div>
        <div className="iig-step"><span className="iig-num">5.</span><span>Return to this page and select <b>Enable notifications</b>.</span></div>
      </div>
      <div className="iig-note"><Info size={14} weight="regular" /> You only need to do this once.</div>
    </div>
  );
}

const IIG_CSS = `
  .iig { border: 1px solid var(--agent-border-default); border-radius: 16px; background: var(--agent-surface-elevated, #fff); padding: 22px 24px; margin-top: 12px; max-width: 480px; box-shadow: 0 1px 2px rgba(60,40,22,.04); }
  .iig-ic { display: inline-flex; width: 40px; height: 40px; border-radius: 11px; align-items: center; justify-content: center; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.06)); color: var(--agent-text-primary); margin-bottom: 14px; }
  .iig-h { margin: 0 0 6px; font-size: 16.5px; font-weight: 720; color: var(--agent-text-primary); letter-spacing: -0.01em; }
  .iig-sub { margin: 0; font-size: 13px; line-height: 1.5; color: var(--agent-text-muted); }
  .iig-div { height: 1px; background: var(--agent-border-subtle); margin: 16px 0; }
  .iig-lead { margin: 0 0 14px; font-size: 13px; font-weight: 700; color: var(--agent-text-primary); }
  .iig-steps { display: flex; flex-direction: column; gap: 13px; }
  .iig-step { display: flex; gap: 10px; font-size: 13.5px; line-height: 1.5; color: var(--agent-text-secondary); }
  .iig-step b { color: var(--agent-text-primary); font-weight: 700; }
  .iig-num { font-weight: 700; color: var(--agent-text-primary); flex-shrink: 0; }
  .iig-share { vertical-align: -2px; }
  .iig-note { display: flex; align-items: center; gap: 7px; margin-top: 16px; padding: 10px 12px; border-radius: 9px; background: var(--agent-hover-shade, rgba(45,24,16,0.04)); font-size: 12.5px; color: var(--agent-text-muted); }
`;

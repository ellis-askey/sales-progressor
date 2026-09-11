"use client";
// PortalOnboardingToasts — the "save to your home screen" and "turn on updates"
// prompts (Portal Engagement v2, Phase 2 rework).
//
// Principle (Ellis, 2026-09): on iPhone, web push only works once the portal is
// on the home screen, so INSTALL is the gate and notifications are what it
// unlocks. And we ask at the right MOMENT, never on a blind timer, and never
// silence someone forever after one dismissal.
//
// Cadence (per-device, localStorage):
//   Install — at most 3 asks: (A1) after a value moment (they've confirmed a
//     step, or it's a return visit), (A2) ~14 days later if still not installed,
//     (A3) near exchange if still not installed.
//   Notifications — offered only once installed; at most 2 asks: (B1) right
//     after install, (B2) near exchange if declined.
// A dismissal just moves to the next scheduled ask (with a time gap) and stops
// at the cap. Mobile-only (the mount site gates with lg:hidden); the /respond
// chase page is excluded by PortalShell.

import { useEffect, useState } from "react";
import { P } from "./portal-ui";
import { portalTrackOnboardingAction } from "@/app/actions/portal";

const INSTALL_ASKS_KEY  = "portal-install-asks-v2";
const PUSH_ASKS_KEY     = "portal-push-asks-v2";
const PUSH_SUBSCRIBED_KEY = "portal-push-subscribed";
const SESSION_SEEN_KEY  = "portal-onboarding-shown-session";
const DAY = 86400000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type AskState = { n: number; at: number };
function readAsks(key: string): AskState {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "");
    if (raw && typeof raw.n === "number" && typeof raw.at === "number") return raw;
  } catch { /* ignore */ }
  return { n: 0, at: 0 };
}
function bumpAsks(key: string) {
  const s = readAsks(key);
  localStorage.setItem(key, JSON.stringify({ n: s.n + 1, at: Date.now() }));
}
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

type InstallVariant = "A1" | "A2" | "A3";
type PushVariant = "B1" | "B2";

function decideInstall(
  asks: AskState,
  o: { installed: boolean; hasConfirmedStep: boolean; isReturningVisit: boolean; isNearExchange: boolean },
): InstallVariant | null {
  if (o.installed || asks.n >= 3) return null;
  if (asks.n > 0) {
    const gap = asks.n === 1 ? 14 * DAY : 3 * DAY;
    if (Date.now() - asks.at < gap) return null;
  }
  // First ask needs a real reason: a value moment or a near-exchange nudge.
  if (asks.n === 0 && !(o.hasConfirmedStep || o.isReturningVisit || o.isNearExchange)) return null;
  // The third ask is reserved for the near-exchange moment.
  if (asks.n === 2 && !o.isNearExchange) return null;
  return o.isNearExchange ? "A3" : asks.n === 0 ? "A1" : "A2";
}

function decidePush(
  asks: AskState,
  o: { installed: boolean; subscribed: boolean; supported: boolean; denied: boolean; isNearExchange: boolean },
): PushVariant | null {
  if (!o.installed || o.subscribed || o.denied || !o.supported) return null;
  if (asks.n >= 2) return null;
  // Second ask only near exchange, after a gap.
  if (asks.n === 1 && !(o.isNearExchange && Date.now() - asks.at >= 3 * DAY)) return null;
  return o.isNearExchange && asks.n > 0 ? "B2" : "B1";
}

function installCopy(v: InstallVariant, saleWord: string): { h: string; b: string } {
  if (v === "A2") return { h: "Keep your move a tap away", b: `You've been checking in on your ${saleWord}. Save it to your home screen so it's always there, and we can flag anything new.` };
  if (v === "A3") return { h: "Exchange is getting close", b: "Save this to your home screen so you'll know the moment contracts exchange, without hunting for the link." };
  return { h: "Keep your move one tap away", b: "Save this to your home screen so it's always here when you want to check, and we can let you know the moment something changes." };
}
function pushCopy(v: PushVariant, saleWord: string): { h: string; b: string } {
  if (v === "B2") return { h: "Exchange is getting close", b: "Turn on updates and we'll tell you the moment contracts exchange. Nothing else." };
  return { h: "Want a heads-up when something changes?", b: `We'll message you when there's real progress on your ${saleWord}, or when something needs you. Nothing else.` };
}

export function PortalOnboardingToasts({
  token,
  vapidPublicKey,
  saleWord,
  hasConfirmedStep,
  isReturningVisit,
  isNearExchange,
}: {
  token: string;
  vapidPublicKey: string;
  saleWord: string;
  hasConfirmedStep: boolean;
  isReturningVisit: boolean;
  isNearExchange: boolean;
}) {
  const [isIOS, setIsIOS] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<{ kind: "install" | "push"; variant: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [pushStatus, setPushStatus] = useState<"idle" | "asking" | "denied" | "error">("idle");

  // Platform detection + a short settle before we consider showing anything.
  useEffect(() => {
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) setIsIOS(true);
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener("beforeinstallprompt", handler);
    const t = window.setTimeout(() => setReady(true), 1500);
    return () => { window.removeEventListener("beforeinstallprompt", handler); window.clearTimeout(t); };
  }, []);

  function showPrompt(kind: "install" | "push", variant: string) {
    bumpAsks(kind === "install" ? INSTALL_ASKS_KEY : PUSH_ASKS_KEY);
    sessionStorage.setItem(SESSION_SEEN_KEY, "1");
    setActive({ kind, variant });
    void portalTrackOnboardingAction(token, kind === "install" ? "install_prompt_shown" : "notif_prompt_shown", variant);
  }

  // Decide what (if anything) to show, once settled.
  useEffect(() => {
    if (!ready || active) return;
    if (sessionStorage.getItem(SESSION_SEEN_KEY) === "1") return;
    const installed = isStandalone();

    // Install is the gate — try it first.
    if (isIOS || deferredPrompt) {
      const v = decideInstall(readAsks(INSTALL_ASKS_KEY), { installed, hasConfirmedStep, isReturningVisit, isNearExchange });
      if (v) { showPrompt("install", v); return; }
    }
    // Notifications only once installed.
    const supported = typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    const denied = supported && Notification.permission === "denied";
    const subscribed = localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1";
    const pv = decidePush(readAsks(PUSH_ASKS_KEY), { installed, subscribed, supported, denied, isNearExchange });
    if (pv) showPrompt("push", pv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, active, isIOS, deferredPrompt, hasConfirmedStep, isReturningVisit, isNearExchange]);

  // Fade up when something becomes active.
  useEffect(() => {
    if (!active) { setVisible(false); return; }
    const r = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(r);
  }, [active]);

  // Keep the floating help widget out of the way while a prompt/sheet is up.
  useEffect(() => {
    const shown = active !== null || showIOSSheet;
    window.dispatchEvent(new CustomEvent("portal-overlay", { detail: { shown } }));
  }, [active, showIOSSheet]);

  function hide(after: () => void = () => setActive(null)) {
    setVisible(false);
    window.setTimeout(after, 340);
  }

  function dismissActive() {
    if (active) void portalTrackOnboardingAction(token, active.kind === "install" ? "install_dismissed" : "notif_dismissed", active.variant);
    hide();
  }

  function maybeChainPush() {
    const supported = typeof Notification !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    const denied = supported && Notification.permission === "denied";
    const subscribed = localStorage.getItem(PUSH_SUBSCRIBED_KEY) === "1";
    const pv = decidePush(readAsks(PUSH_ASKS_KEY), { installed: true, subscribed, supported, denied, isNearExchange });
    if (pv) showPrompt("push", pv);
    else setActive(null);
  }

  async function handleInstallPrimary() {
    if (isIOS) { setShowIOSSheet(true); return; }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      void portalTrackOnboardingAction(token, "install_completed", active?.variant);
      hide(maybeChainPush);
    } else {
      dismissActive();
    }
  }

  async function handlePushEnable() {
    setPushStatus("asking");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("denied");
        void portalTrackOnboardingAction(token, "notif_dismissed", active?.variant);
        return;
      }
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
      localStorage.setItem(PUSH_SUBSCRIBED_KEY, "1");
      void portalTrackOnboardingAction(token, "notif_enabled", active?.variant);
      setPushStatus("idle");
      hide();
    } catch (err) {
      console.error("[PortalOnboardingToasts] push subscribe failed:", err);
      setPushStatus("error");
    }
  }

  if (!active) return null;
  const copy = active.kind === "install"
    ? installCopy(active.variant as InstallVariant, saleWord)
    : pushCopy(active.variant as PushVariant, saleWord);

  return (
    <>
      <ToastShell visible={visible}>
        {active.kind === "install" ? (
          <PromptCard
            accent={P.primary}
            icon={<InstallIcon />}
            heading={copy.h}
            body={copy.b}
            primaryLabel={isIOS ? "Show me how" : "Install"}
            onPrimary={handleInstallPrimary}
            onDismiss={dismissActive}
          />
        ) : pushStatus === "denied" ? (
          <TintCard bg="#FEF3C7" border="#FDE68A" color="#92400E" onDismiss={() => hide()}>
            Notifications are switched off in your settings. You can turn them back on there whenever you like.
          </TintCard>
        ) : pushStatus === "error" ? (
          <TintCard bg="#FEF2F2" border="#FECACA" color="#991B1B" onDismiss={() => hide()}>
            We couldn&apos;t set up notifications. Try refreshing.
          </TintCard>
        ) : (
          <PromptCard
            accent={P.accent}
            icon={<BellIcon />}
            heading={copy.h}
            body={copy.b}
            primaryLabel={pushStatus === "asking" ? "Setting up…" : "Turn on"}
            primaryDisabled={pushStatus === "asking"}
            onPrimary={handlePushEnable}
            onDismiss={dismissActive}
          />
        )}
      </ToastShell>

      {showIOSSheet && (
        <IOSInstallSheet
          onClose={() => { setShowIOSSheet(false); hide(); }}
        />
      )}
    </>
  );
}

// ─── Prompt card (icon + heading, full-width body, two labelled buttons) ─────
function PromptCard({
  accent, icon, heading, body, primaryLabel, primaryDisabled, onPrimary, onDismiss,
}: {
  accent: string;
  icon: React.ReactNode;
  heading: string;
  body: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "var(--portal-toast-bg, rgba(255, 255, 255, 0.94))",
        backdropFilter: "blur(20px) saturate(1.6)",
        WebkitBackdropFilter: "blur(20px) saturate(1.6)",
        border: `0.5px solid ${P.border}`,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.12), 0 2px 6px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {icon}
        </div>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: P.textPrimary, lineHeight: 1.25 }}>{heading}</p>
      </div>
      <p style={{ margin: "0 0 13px", fontSize: 12.5, color: P.textSecondary, lineHeight: 1.4 }}>{body}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onDismiss}
          className="pbtn pbtn-press"
          style={{ flex: "0 0 auto", padding: "9px 14px", borderRadius: 11, fontSize: 13, fontWeight: 600, border: `1px solid ${P.border}`, background: "transparent", color: P.textSecondary, cursor: "pointer" }}
        >
          Not now
        </button>
        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="pbtn pbtn-press"
          style={{ flex: 1, padding: "9px 14px", borderRadius: 11, fontSize: 13, fontWeight: 600, border: "none", background: accent, color: "#fff", cursor: primaryDisabled ? "wait" : "pointer", opacity: primaryDisabled ? 0.7 : 1 }}
        >
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}

function TintCard({ bg, border, color, onDismiss, children }: { bg: string; border: string; color: string; onDismiss: () => void; children: React.ReactNode }) {
  return (
    <div style={{ padding: "13px 14px", borderRadius: 16, display: "flex", alignItems: "center", gap: 12, background: bg, border: `1px solid ${border}`, boxShadow: "0 10px 28px rgba(15, 23, 42, 0.10)" }}>
      <p style={{ margin: 0, fontSize: 12.5, color, flex: 1, lineHeight: 1.4 }}>{children}</p>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="pbtn pbtn-press" style={{ width: 30, height: 30, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", color, cursor: "pointer", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
}

function InstallIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/><polyline points="8 13 12 17 16 13"/><line x1="12" y1="9" x2="12" y2="17"/>
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 003.4 0"/>
    </svg>
  );
}

// ─── Toast shell — bottom-anchored, fades up + in ────────────────────────────
function ToastShell({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: 12, right: 12,
        bottom: "calc(84px + env(safe-area-inset-bottom, 0px))",
        zIndex: 30, maxWidth: 500, margin: "0 auto",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 320ms cubic-bezier(0.16, 1, 0.3, 1), transform 320ms cubic-bezier(0.16, 1, 0.3, 1)",
        pointerEvents: visible ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

// ─── iOS "Add to Home Screen" bottom sheet ───────────────────────────────────
function IOSInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="portal-sheet-backdrop absolute inset-0" style={{ background: "rgba(15,23,42,0.45)" }} />
      <div className="portal-sheet relative w-full max-w-lg mx-auto rounded-t-3xl p-6" style={{ background: P.cardBg, boxShadow: P.shadowXl }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: P.border }} />
        <h3 className="text-[17px] font-semibold mb-1" style={{ color: P.textPrimary }}>Add to your home screen</h3>
        <p className="text-[13px] mb-5" style={{ color: P.textSecondary }}>Two quick steps in Safari:</p>
        <div className="space-y-4 mb-6">
          <IOSStep n={1}>
            <>
              Tap the{" "}
              <svg className="inline-block align-text-top mx-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              {" "}<strong>Share</strong> button at the bottom of your screen
            </>
          </IOSStep>
          <IOSStep n={2}>Scroll down and tap <strong>Add to Home Screen</strong></IOSStep>
        </div>
        <button onClick={onClose} className="w-full py-3.5 rounded-2xl text-[15px] font-semibold" style={{ background: P.primary, color: "#FFFFFF" }}>Done</button>
        <div style={{ height: "env(safe-area-inset-bottom, 16px)" }} />
      </div>
    </div>
  );
}
function IOSStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold mt-0.5" style={{ background: P.primaryBg, color: P.primary }}>{n}</div>
      <p className="text-[14px] flex-1 leading-relaxed" style={{ color: P.textPrimary }}>{children}</p>
    </div>
  );
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return new Uint8Array([...raw].map((c) => c.charCodeAt(0)));
}

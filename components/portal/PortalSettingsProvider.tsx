"use client";

// Holds the client's portal appearance/accessibility settings, applies them to
// <html> live (so toggling is instant), follows the OS theme when on "system",
// and debounce-saves changes to the DB. Initialised from the server-read value
// (which the layout also applies via a no-flash boot script), so first paint is
// already correct.

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { HIDE_MONEY_KEY, type PortalSettings } from "@/lib/portal/settings";
import { portalSaveSettingsAction } from "@/app/actions/portal";

type Ctx = {
  settings: PortalSettings;
  update: (patch: Partial<PortalSettings>) => void;
  saving: boolean;
  savedTick: number; // increments after each successful save (drives the "Saved" tick)
  // "Hide money on this device" — per-device (localStorage), NOT saved to the DB.
  moneyHidden: boolean;
  setMoneyHidden: (v: boolean) => void;
};

const PortalSettingsContext = createContext<Ctx | null>(null);

export function usePortalSettings(): Ctx {
  const c = useContext(PortalSettingsContext);
  if (!c) throw new Error("usePortalSettings must be used inside PortalSettingsProvider");
  return c;
}

function applyToDom(s: PortalSettings) {
  const d = document.documentElement;
  const theme =
    s.theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : s.theme;
  d.setAttribute("data-portal-theme", theme);
  if (s.textSize !== "default") d.setAttribute("data-portal-textsize", s.textSize);
  else d.removeAttribute("data-portal-textsize");
  if (s.highContrast) d.setAttribute("data-portal-contrast", "on");
  else d.removeAttribute("data-portal-contrast");
  if (s.reduceMotion) d.setAttribute("data-portal-motion", "reduced");
  else d.removeAttribute("data-portal-motion");
  if (s.dyslexicFont) d.setAttribute("data-portal-font", "dyslexic");
  else d.removeAttribute("data-portal-font");
  if (s.accent) d.style.setProperty("--portal-primary", s.accent);
  else d.style.removeProperty("--portal-primary");
}

export function PortalSettingsProvider({
  token,
  initial,
  children,
}: {
  token: string;
  initial: PortalSettings;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<PortalSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(0);
  const [moneyHidden, setMoneyHiddenState] = useState(false);
  const firstRun = useRef(true);

  // Sync money-hidden from the per-device flag (the boot script already applied
  // the attribute pre-paint; this just aligns the React state).
  useEffect(() => {
    try {
      setMoneyHiddenState(localStorage.getItem(HIDE_MONEY_KEY) === "1");
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  const setMoneyHidden = useCallback((v: boolean) => {
    setMoneyHiddenState(v);
    try {
      if (v) localStorage.setItem(HIDE_MONEY_KEY, "1");
      else localStorage.removeItem(HIDE_MONEY_KEY);
    } catch {
      /* ignore */
    }
    const d = document.documentElement;
    if (v) d.setAttribute("data-portal-hidemoney", "on");
    else d.removeAttribute("data-portal-hidemoney");
  }, []);

  // Apply live whenever settings change.
  useEffect(() => {
    applyToDom(settings);
  }, [settings]);

  // Follow the OS theme while on "system".
  useEffect(() => {
    if (settings.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToDom(settings);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings]);

  // Debounce-save to the DB on change (skip the initial mount).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaving(true);
    const t = window.setTimeout(async () => {
      try {
        await portalSaveSettingsAction({ token, settings });
      } catch {
        /* best-effort; the live UI already reflects the change */
      }
      setSaving(false);
      setSavedTick((n) => n + 1);
    }, 400);
    return () => window.clearTimeout(t);
  }, [settings, token]);

  const update = useCallback((patch: Partial<PortalSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <PortalSettingsContext.Provider value={{ settings, update, saving, savedTick, moneyHidden, setMoneyHidden }}>
      {children}
    </PortalSettingsContext.Provider>
  );
}

"use client";

// The "Appearance & accessibility" group at the top of the portal Settings tab.
// Reads/writes the live settings via usePortalSettings (which applies them to
// <html> instantly and debounce-saves to the DB). Batch 4.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { P } from "./portal-ui";
import { usePortalSettings } from "./PortalSettingsProvider";
import { PORTAL_ACCENTS, type PortalTheme, type PortalTextSize } from "@/lib/portal/settings";

const DEFAULT_ACCENT = PORTAL_ACCENTS[0].hex; // coral

export function PortalAppearanceSettings() {
  const { settings, update, savedTick, moneyHidden, setMoneyHidden } = usePortalSettings();
  const [showSaved, setShowSaved] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setShowSaved(true);
    const t = window.setTimeout(() => setShowSaved(false), 1600);
    return () => window.clearTimeout(t);
  }, [savedTick]);

  const currentAccent = (settings.accent ?? DEFAULT_ACCENT).toLowerCase();

  return (
    <section
      style={{
        background: P.cardBg,
        borderRadius: P.radiusMd,
        boxShadow: P.shadowSm,
        border: `1px solid ${P.borderSubtle}`,
        padding: 18,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: P.textPrimary }}>Appearance &amp; accessibility</h3>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 12,
            color: P.success,
            opacity: showSaved ? 1 : 0,
            transition: "opacity 300ms ease",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Saved
        </span>
      </header>
      <p style={{ margin: "0 0 16px", fontSize: 12.5, color: P.textMuted }}>
        These stay with you across devices. Changes save on their own.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Segmented
          label="Theme"
          value={settings.theme}
          options={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]}
          onChange={(v) => update({ theme: v as PortalTheme })}
        />
        <Segmented
          label="Text size"
          value={settings.textSize}
          options={[["default", "Default"], ["large", "Large"], ["larger", "Larger"]]}
          onChange={(v) => update({ textSize: v as PortalTextSize })}
        />

        <div>
          <Label>Accent colour</Label>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            {PORTAL_ACCENTS.map((a) => {
              const active = currentAccent === a.hex.toLowerCase();
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => update({ accent: a.id === "coral" ? null : a.hex })}
                  aria-label={a.label}
                  title={a.label}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: a.hex,
                    cursor: "pointer",
                    border: `2px solid ${P.cardBg}`,
                    boxShadow: active ? `0 0 0 2px ${a.hex}` : P.shadowSm,
                    transform: active ? "scale(1.08)" : "none",
                    transition: "transform 150ms ease, box-shadow 150ms ease",
                  }}
                />
              );
            })}
          </div>
        </div>

        <Toggle label="Reduce motion" desc="Turn off animations and transitions." checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
        <Toggle label="High contrast" desc="Stronger text and borders." checked={settings.highContrast} onChange={(v) => update({ highContrast: v })} />
        <Toggle label="Readable font" desc="Use OpenDyslexic, designed to be easier to read." checked={settings.dyslexicFont} onChange={(v) => update({ dyslexicFont: v })} />
        <Toggle
          label="Hide money on this device"
          desc="Blurs every amount (prices, costs, fees) until you tap it. Handy on a shared or public screen. Applies to this device only, not your other devices."
          checked={moneyHidden}
          onChange={setMoneyHidden}
        />
      </div>
    </section>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: P.textPrimary }}>{children}</span>;
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        style={{
          display: "inline-flex",
          gap: 3,
          marginTop: 8,
          padding: 3,
          borderRadius: 10,
          background: P.primaryBg,
          border: `1px solid ${P.borderSubtle}`,
        }}
      >
        {options.map(([v, l]) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: active ? P.primary : "transparent",
                color: active ? "#fff" : P.textSecondary,
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span>
        <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: P.textPrimary }}>{label}</span>
        <span style={{ display: "block", fontSize: 12.5, color: P.textMuted, marginTop: 1 }}>{desc}</span>
      </span>
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 26,
          borderRadius: 13,
          background: checked ? P.primary : P.border,
          position: "relative",
          transition: "background 180ms ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            transition: "left 180ms ease",
          }}
        />
      </span>
    </button>
  );
}

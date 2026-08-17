// Client-portal appearance + accessibility settings (Batch 4). Shared, pure,
// client-safe. Persisted per contact in Contact.portalSettings (JSON); "hide
// money" is per-device (localStorage), deliberately not here.

export type PortalTheme = "system" | "light" | "dark";
export type PortalTextSize = "default" | "large" | "larger";

export type PortalSettings = {
  theme: PortalTheme;
  textSize: PortalTextSize;
  accent: string | null; // hex; null = default (coral)
  reduceMotion: boolean;
  highContrast: boolean;
  dyslexicFont: boolean;
  whatsappOptIn: boolean;
};

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  theme: "system",
  textSize: "default",
  accent: null,
  reduceMotion: false,
  highContrast: false,
  dyslexicFont: false,
  whatsappOptIn: false,
};

// Curated, brand-safe accent swatches. First = the default (coral).
export const PORTAL_ACCENTS: { id: string; label: string; hex: string }[] = [
  { id: "coral", label: "Coral", hex: "#FF6B4A" },
  { id: "blue", label: "Blue", hex: "#3B82F6" },
  { id: "violet", label: "Violet", hex: "#7C6BFF" },
  { id: "emerald", label: "Emerald", hex: "#10B981" },
  { id: "rose", label: "Rose", hex: "#F43F87" },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

// Coerce arbitrary stored JSON into a valid PortalSettings (defaults on miss).
export function parsePortalSettings(raw: unknown): PortalSettings {
  const s = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    theme: s.theme === "light" || s.theme === "dark" ? s.theme : "system",
    textSize: s.textSize === "large" || s.textSize === "larger" ? s.textSize : "default",
    accent: typeof s.accent === "string" && HEX.test(s.accent) ? s.accent : null,
    reduceMotion: s.reduceMotion === true,
    highContrast: s.highContrast === true,
    dyslexicFont: s.dyslexicFont === true,
    whatsappOptIn: s.whatsappOptIn === true,
  };
}

// Inline no-flash boot script: applies the settings to <html> before first
// paint. "system" resolves via prefers-color-scheme. Injected by the portal
// layout (server) so there's no flash of the wrong theme.
export function portalSettingsBootScript(s: PortalSettings): string {
  return (
    `(function(){try{var d=document.documentElement;` +
    `var t=${JSON.stringify(s.theme)};` +
    `if(t==="system"){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";}` +
    `d.setAttribute("data-portal-theme",t);` +
    (s.textSize !== "default" ? `d.setAttribute("data-portal-textsize",${JSON.stringify(s.textSize)});` : ``) +
    (s.highContrast ? `d.setAttribute("data-portal-contrast","on");` : ``) +
    (s.reduceMotion ? `d.setAttribute("data-portal-motion","reduced");` : ``) +
    (s.dyslexicFont ? `d.setAttribute("data-portal-font","dyslexic");` : ``) +
    (s.accent ? `d.style.setProperty("--portal-primary",${JSON.stringify(s.accent)});` : ``) +
    `}catch(e){}})();`
  );
}

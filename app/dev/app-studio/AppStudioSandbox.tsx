"use client";

import { useState } from "react";
import { AppColourStudio, DEFAULT_APP_COLOUR, type AppColourConfig } from "@/components/account/v2/AppColourStudio";

export function AppStudioSandbox() {
  const [lastSaved, setLastSaved] = useState<AppColourConfig | null>(null);
  return (
    <div style={{ minHeight: "100vh", background: "#f4f0ea", padding: "40px 24px 80px", fontFamily: "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" }}>
      <div style={{ maxWidth: 1060, margin: "0 auto 18px" }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#b45309" }}>/dev sandbox</p>
        <h1 style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "#2d1810" }}>App Colour Studio</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#5a3a28", maxWidth: "70ch", lineHeight: 1.55 }}>
          Full component, no server wiring. Save logs the config below. When approved, this drops into
          <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 12, background: "rgba(45,24,16,0.06)", padding: "1px 5px", borderRadius: 4, margin: "0 4px" }}>/agent/account/profile</code>
          and the save path extends the brand-theme engine + the primary-button CSS.
        </p>
      </div>

      <AppColourStudio initial={DEFAULT_APP_COLOUR} onSave={(cfg) => { setLastSaved(cfg); console.log("[app-studio] save", cfg); }} />

      {lastSaved && (
        <div style={{ maxWidth: 1060, margin: "22px auto 0", background: "#2d1810", color: "#f3ede7", borderRadius: 12, padding: "14px 16px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.6 }}>Last saved config (would persist to agentPreferences)</p>
          <pre style={{ margin: 0, fontSize: 12, fontFamily: "ui-monospace,monospace", whiteSpace: "pre-wrap" }}>{JSON.stringify(lastSaved, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

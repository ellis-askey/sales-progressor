"use client";

// Disposable preview for components/ui/LiquidToggle — rendered at every real
// size and on-colour used across the agent app, on white + glass, light + dark,
// so the liquid feel can be judged at the actual sizes before the sweep.
// /dev convention: throwaway, delete when decided.

import { useState } from "react";
import { LiquidToggle } from "@/components/ui/LiquidToggle";

// Every distinct size found in the agent-app toggle inventory.
const SIZES: Array<{ label: string; w: number; h: number }> = [
  { label: "32×18 (portal-confirm)", w: 32, h: 18 },
  { label: "36×20 (per-code)", w: 36, h: 20 },
  { label: "38×22 (log/welcome)", w: 38, h: 22 },
  { label: "40×23 (step row)", w: 40, h: 23 },
  { label: "42×24 (drawers)", w: 42, h: 24 },
  { label: "44×24 (dominant)", w: 44, h: 24 },
  { label: "46×26 (automation)", w: 46, h: 26 },
  { label: "48×28 (push)", w: 48, h: 28 },
  { label: "58×26 (chain card)", w: 58, h: 26 },
];

const COLOURS: Array<{ label: string; value: string }> = [
  { label: "Coral (primary)", value: "var(--agent-coral, #FF8A65)" },
  { label: "Coral-deep", value: "var(--agent-coral-deep, #FF6B4A)" },
  { label: "Emerald (fee received)", value: "#10b981" },
];

function Demo({ w, h, color }: { w: number; h: number; color: string }) {
  const [on, setOn] = useState(false);
  return <LiquidToggle checked={on} onChange={setOn} width={w} height={h} color={color} />;
}

function Card({ title, dark, children }: { title: string; dark?: boolean; children: React.ReactNode }) {
  return (
    <div
      data-theme={dark ? "slate" : "sunset"}
      style={{
        flex: 1,
        minWidth: 320,
        borderRadius: 18,
        padding: 24,
        background: dark ? "#0f1115" : "var(--agent-surface-elevated, #fff)",
        border: "0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08))",
        color: "var(--agent-text-primary, #211d18)",
      }}
    >
      <h2 style={{ margin: "0 0 18px", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6 }}>{title}</h2>
      {children}
    </div>
  );
}

export default function LiquidTogglePreview() {
  return (
    <div
      data-theme="sunset"
      style={{
        minHeight: "100vh",
        background: "var(--agent-bg, #faf7f4)",
        fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        padding: "44px 24px 120px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--agent-text-primary, #211d18)" }}>Liquid toggle</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "var(--agent-text-secondary, #6b6258)" }}>
            Bencho&rsquo;s liquid toggle at every real agent-app size and colour. Drag the thumb or click. Keep an eye on the 32&ndash;44px sizes &mdash; that&rsquo;s where the liquid stretch is subtlest.
          </p>
        </header>

        {/* Sizes, coral-deep, on white + dark */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[false, true].map((dark) => (
            <Card key={String(dark)} title={dark ? "Dark surface" : "White surface"} dark={dark}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {SIZES.map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ width: 160, fontSize: 12.5, color: "var(--agent-text-secondary, #6b6258)" }}>{s.label}</span>
                    <Demo w={s.w} h={s.h} color="var(--agent-coral-deep, #FF6B4A)" />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Colours at the dominant 44×24 */}
        <Card title="On-colours (at 44×24)">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {COLOURS.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ width: 200, fontSize: 12.5, color: "var(--agent-text-secondary, #6b6258)" }}>{c.label}</span>
                <Demo w={44} h={24} color={c.value} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Disabled">
          <LiquidToggle checked={true} onChange={() => {}} width={44} height={24} color="var(--agent-coral-deep, #FF6B4A)" disabled />
        </Card>
      </div>
    </div>
  );
}

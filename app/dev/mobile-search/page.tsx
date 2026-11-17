"use client";

// Disposable /dev preview for (1) the mobile top-bar search interaction
// (MobileNavSearch) and (2) the ported Bencho "Seek" primitive it borrows
// from. /dev convention: throwaway, delete when the design is decided.

import { Seek } from "@/components/ui/Seek";
import { MobileNavSearch } from "./MobileNavSearch";

export default function MobileSearchPreview() {
  return (
    <div
      data-theme="sunset"
      style={{
        minHeight: "100vh",
        background: "var(--agent-bg, #faf7f4)",
        color: "var(--agent-text-primary, #211d18)",
        fontFamily: "var(--font-geist-sans, system-ui, sans-serif)",
        padding: "48px 24px 140px",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 860, display: "flex", flexDirection: "column", gap: 44 }}>
        <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>Mobile nav search</h1>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--agent-text-secondary, #6b6258)", lineHeight: 1.6, maxWidth: 620 }}>
            On a phone the search is a single icon in the bar. Tap it: it grows into a full-bar field, the other
            controls fade out of the way, and a results panel drops down. Typing filters (empty = “Go to”); the X in
            the grey circle, selecting a result, or Esc collapses it back to the icon. One object the whole time.
          </p>
        </header>

        {/* the phone */}
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Label>Phone — tap the search icon</Label>
          <div
            style={{
              width: 390,
              maxWidth: "100%",
              borderRadius: 40,
              padding: 10,
              background: "linear-gradient(160deg, #e9e3dc, #d8cfc5)",
              boxShadow: "0 30px 60px -30px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.5)",
            }}
          >
            <div
              style={{
                position: "relative",
                borderRadius: 32,
                overflow: "hidden",
                background: "var(--agent-bg, #faf7f4)",
                minHeight: 560,
              }}
            >
              <MobileNavSearch />
              {/* mock page content beneath the bar, so the drop has somewhere to land */}
              <div style={{ padding: "18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
                {["14 Oakfield Road", "3 Mornington Crescent", "28 Harbour View", "9 Alder Close"].map((a) => (
                  <div
                    key={a}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: "var(--agent-surface-elevated, #fff)",
                      border: "1px solid var(--agent-border-default, rgba(33,29,24,0.08))",
                    }}
                  >
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{a}</div>
                    <div style={{ fontSize: 12.5, color: "var(--agent-text-muted, #8a8178)", marginTop: 2 }}>In progress · exchange pending</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* the Bencho primitive this borrows from */}
        <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Label>Bencho “Seek” primitive — components/ui/Seek (tokens mapped to the agent system)</Label>
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              padding: 28,
              borderRadius: 20,
              background: "var(--agent-surface-elevated, #fff)",
              border: "1px solid var(--agent-border-default, rgba(33,29,24,0.08))",
            }}
          >
            <Seek />
            <Seek width={320} />
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted, #8a8178)", lineHeight: 1.6, maxWidth: 620 }}>
            The faithful port: an icon that becomes a field as one object, the lens pinned so it reads as the box
            growing around it. The mobile nav search above scales the same idea to the whole bar and adds the drop-down
            and clear control.
          </p>
        </section>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--agent-text-muted, #8a8178)" }}>
      {children}
    </span>
  );
}

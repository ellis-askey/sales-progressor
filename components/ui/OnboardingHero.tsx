import type { CSSProperties, ReactNode } from "react";
import { HeroArt } from "@/components/agent/HeroArt";

// Canonical onboarding hero — the coral welcome banner that leads an empty
// account page: a soft coral gradient, an optional HeroArt illustration, a
// title and a body line. Extracted from the ~15 hand-copied versions across the
// empty states (Hub, Reminders, Chains, To-do, Updates…); the other consumers
// migrate onto this in a follow-up. Type sizes are design tokens.

export function OnboardingHero({
  title,
  body,
  art,
  maxBodyWidth = 480,
  style,
}: {
  title: ReactNode;
  body: ReactNode;
  /** Optional illustration (light/dark PNGs + mask). */
  art?: { light: string; dark: string; maxWidth?: string; maskStart?: string };
  maxBodyWidth?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--agent-radius-xl)",
        minHeight: 210,
        padding: "28px 30px",
        border: "1px solid var(--agent-border-subtle)",
        background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)",
        ...style,
      }}
    >
      {art && <HeroArt light={art.light} dark={art.dark} maxWidth={art.maxWidth ?? "46%"} maskStart={art.maskStart ?? "42%"} />}
      <div style={{ position: "relative", maxWidth: maxBodyWidth }}>
        <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>{title}</p>
        <p style={{ margin: 0, fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>{body}</p>
      </div>
    </div>
  );
}

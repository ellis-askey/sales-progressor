"use client";

// /dev/chase-timing — a polished REBUILD prototype of the automated-chasing
// timing screen (the real one is components/automation/AutomationSettingsForm).
// Dev-only, nothing wired to the app. Mounts the real agent warm-cream theme
// (data-theme="custom") + agent-system.css so the prototype reads as native
// chrome while we iterate on the polish. Blocked in production.

import { notFound } from "next/navigation";
import { Flask } from "@phosphor-icons/react";

import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

export default function DevChaseTimingLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div
      data-theme="custom"
      style={{ minHeight: "100vh", position: "relative", isolation: "isolate", background: "#FBF8F5", color: "var(--agent-text-primary)" }}
    >
      <div aria-hidden style={{
        position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
        background: "linear-gradient(120deg, rgba(255,107,74,0.12) 0%, rgba(255,170,120,0.10) 30%, rgba(170,140,255,0.08) 70%, rgba(120,205,180,0.08) 100%), #FBF8F5",
      }} />

      <div style={{
        position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 7,
        padding: "7px 16px", fontSize: 11.5, fontWeight: 700, letterSpacing: ".02em",
        color: "#B2452E", background: "rgba(224,73,42,.09)", borderBottom: "1px solid rgba(224,73,42,.14)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
      }}>
        <Flask size={13} weight="fill" /> DEV PROTOTYPE · Automated chasing timing — rebuild in progress
      </div>

      <main style={{ maxWidth: 820, margin: "0 auto", padding: "36px 24px 120px" }}>
        {children}
      </main>
    </div>
  );
}

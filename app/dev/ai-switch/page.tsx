"use client";

// /dev/ai-switch — a live reference for the AI master switch (#291).
//
// Flip the toggle at the top to simulate the global switch being off: every AI
// trigger that the real app hides disappears here too, because each demo below
// is wrapped in the SAME AiEnabledProvider + useAiEnabled() the production
// components use. Each card names the real component/location and the model.
// Background jobs (crons, inbound-email) have no UI, so they're listed without a
// control. This page is a dev aid; it renders faithful replicas of the real
// trigger buttons (the production ones need live file/session context).

import { useState, type ReactNode } from "react";
import { AiEnabledProvider, useAiEnabled } from "@/components/ai/AiEnabledProvider";

type Entry = {
  name: string;
  where: string;
  model: string;
  gate: string;
  demo: ReactNode | null; // null = no UI (server/cron)
};

// ── Replica trigger buttons (inline-styled so they render without app CSS) ──
const coral = "#FF6B4A";
const btnBase: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px",
  borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: "default",
};
const Primary = ({ children }: { children: ReactNode }) => (
  <span style={{ ...btnBase, background: coral, color: "#fff" }}>{children}</span>
);
const Ghost = ({ children }: { children: ReactNode }) => (
  <span style={{ ...btnBase, background: "transparent", color: coral, border: `1px solid ${coral}55` }}>{children}</span>
);
const Link = ({ children }: { children: ReactNode }) => (
  <span style={{ fontSize: 12, fontWeight: 600, color: coral }}>{children}</span>
);
const Blue = ({ children }: { children: ReactNode }) => (
  <span style={{ ...btnBase, background: "#2563eb", color: "#fff" }}>{children}</span>
);
const Violet = ({ children }: { children: ReactNode }) => (
  <span style={{ ...btnBase, background: "#2e1065", color: "#c4b5fd", border: "1px solid #5b21b6" }}>{children}</span>
);

const GROUPS: { title: string; subtitle: string; entries: Entry[] }[] = [
  {
    title: "Agent app",
    subtitle: "Hidden via the AiEnabledProvider in app/agent/layout.tsx",
    entries: [
      { name: "Email “Refine to your voice”", where: "ComposeEmailModal", model: "Haiku", gate: "useAiEnabled() — button", demo: <Ghost>✦ Refine</Ghost> },
      { name: "Draft for everyone", where: "CommsEntry", model: "Haiku", gate: "useAiEnabled() — entry", demo: <Ghost>✨ Draft for everyone</Ghost> },
      { name: "Draft client updates", where: "LogUpdateModal", model: "Haiku", gate: "useAiEnabled() — entry", demo: <Ghost>✦ Draft client updates</Ghost> },
      { name: "Chase — generate message", where: "ChaseDrawer", model: "Haiku", gate: "useAiEnabled() — button", demo: <Primary>✨ Generate message</Primary> },
      { name: "Chase — regenerate", where: "ChaseDrawer", model: "Haiku", gate: "useAiEnabled() — button", demo: <Link>⟳ Regenerate</Link> },
      { name: "Chase — AI follow-up offers", where: "ChaseSentOffers", model: "Haiku", gate: "useAiEnabled() — auto-skip", demo: <Ghost>Follow-up suggestions (auto)</Ghost> },
      { name: "Neighbour chase — “Chase agent”", where: "OnwardPurchaseCard · ChainMapPanel", model: "Haiku", gate: "useAiEnabled() — entry + render", demo: <Link>Chase agent</Link> },
      { name: "Memo-AI “Drop a memo”", where: "HeroCard (New sale / Migrate)", model: "Haiku", gate: "useAiEnabled() — button", demo: <Primary>Drop a memo of sale</Primary> },
      { name: "Voice note → update", where: "VoiceNotePanel (orphaned)", model: "Haiku", gate: "useAiEnabled() — whole panel", demo: <Primary>Analyse this</Primary> },
    ],
  },
  {
    title: "Buyer / seller portal & account",
    subtitle: "Hidden via a server prop (showExplain && aiOn / {aiOn && …})",
    entries: [
      { name: "Explain this email", where: "ExplainEmailCard (portal)", model: "Haiku", gate: "server prop at portal page", demo: <Primary>Explain this email</Primary> },
      { name: "AI explainer “try it”", where: "AiExplainerTryIt (account)", model: "Haiku", gate: "server prop at account page", demo: <Primary>Explain it</Primary> },
    ],
  },
  {
    title: "Command Centre",
    subtitle: "Hidden via the AiEnabledProvider in app/command/(protected)/layout.tsx",
    entries: [
      { name: "Content — generate post", where: "CreateFlow", model: "Haiku", gate: "useAiEnabled() — whole panel", demo: <Blue>Generate the post</Blue> },
      { name: "Content — 2 variants", where: "DraftComposer", model: "Haiku", gate: "useAiEnabled() — whole panel", demo: <Blue>Generate 2 variants</Blue> },
      { name: "Content — refine actions", where: "Composer", model: "Haiku", gate: "useAiEnabled() — AI block", demo: <Ghost>Shorten · Punch up · Explain</Ghost> },
      { name: "Content — adapt for platforms", where: "AdaptPanel", model: "Haiku", gate: "useAiEnabled() — whole panel", demo: <Ghost>Adapt for platforms</Ghost> },
      { name: "Content — suggest a visual", where: "SuggestVisualPanel", model: "Haiku", gate: "useAiEnabled() — whole panel", demo: <Ghost>Suggest a visual</Ghost> },
      { name: "Content — AI image", where: "ImageGenerator (AI tab)", model: "FLUX", gate: "useAiEnabled() — button", demo: <Blue>Generate image</Blue> },
      { name: "Content — brand / plan / voice / inbox / opportunities", where: "BrandReview · WeeklyPlan · VoiceLearning · InboxList · OpportunitiesList", model: "Haiku", gate: "useAiEnabled()", demo: <Ghost>✨ AI panels</Ghost> },
      { name: "Prospects — research", where: "ProspectDrawer · ProspectImport · ProspectsBoard", model: "Sonnet", gate: "useAiEnabled() — buttons", demo: <Violet>Research</Violet> },
      { name: "AI Outreach — generate / find agents", where: "GenerateProposalButton · FindAgentsPanel", model: "Opus + GPT-5", gate: "useAiEnabled() — whole panels", demo: <Blue>Generate a proposal</Blue> },
    ],
  },
  {
    title: "Background — no UI (server short-circuit)",
    subtitle: "No component to hide; the model call is gated and the cron / job skips cleanly",
    entries: [
      { name: "Daily brief · Weekly insight review", where: "crons daily-brief / weekly-review", model: "Haiku / Opus", gate: "cron early no-op + root", demo: null },
      { name: "Problem detection", where: "cron detect-problems", model: "Haiku", gate: "cron early no-op + callClaude", demo: null },
      { name: "WhatsApp promise scan", where: "cron whatsapp-promises", model: "Haiku", gate: "cron early no-op + proxy", demo: null },
      { name: "Weekly client narrative", where: "cron client-weekly-update", model: "Haiku", gate: "cron early no-op + proxy", demo: null },
      { name: "Prospect research / outreach / content jobs", where: "crons prospect-* / outreach-send / content-*", model: "Sonnet / Opus / Haiku", gate: "cron early no-op + roots", demo: null },
      { name: "Inbound-email interpret (progression agent)", where: "interpretNewInboundEmails", model: "Haiku", gate: "aiEnabled() early return", demo: null },
    ],
  },
];

function DemoCell({ demo }: { demo: ReactNode | null }) {
  const on = useAiEnabled();
  if (demo === null) {
    return <span style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic" }}>no component — server / cron</span>;
  }
  if (!on) {
    return (
      <span style={{ fontSize: 12, color: "#9ca3af", display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ display: "inline-block", width: 92, height: 1, background: "#374151" }} /> hidden
      </span>
    );
  }
  return <>{demo}</>;
}

export default function AiSwitchDevPage() {
  const [on, setOn] = useState(true);
  const total = GROUPS.flatMap((g) => g.entries).filter((e) => e.demo !== null).length;

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e5e7eb", padding: "32px 24px 80px", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px" }}>AI master switch — hidden components</h1>
        <p style={{ fontSize: 14, color: "#9ca3af", margin: "0 0 24px", lineHeight: 1.6 }}>
          Every AI trigger the switch hides, grouped by surface. Flip the toggle to simulate AI being off and watch the{" "}
          {total} on-screen controls disappear — exactly as they do in the app via the same <code style={{ color: "#93c5fd" }}>useAiEnabled()</code>.
          The real switch lives in <strong>Command Centre → Settings → AI features</strong>; server-side, every model call is also gated.
        </p>

        {/* Master toggle */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#0b0f14", padding: "12px 0 16px", display: "flex", alignItems: "center", gap: 14, borderBottom: "1px solid #1f2937", marginBottom: 24 }}>
          <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => setOn((v) => !v)}
            style={{
              position: "relative", width: 52, height: 28, borderRadius: 999, border: "none", cursor: "pointer",
              background: on ? "#2563eb" : "#374151", transition: "background 160ms",
            }}
          >
            <span style={{ position: "absolute", top: 3, left: on ? 27 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left 160ms" }} />
          </button>
          <span style={{ fontSize: 15, fontWeight: 600 }}>
            AI features are <span style={{ color: on ? "#34d399" : "#f87171" }}>{on ? "ON — triggers visible" : "OFF — triggers hidden"}</span>
          </span>
        </div>

        <AiEnabledProvider enabled={on}>
          {GROUPS.map((g) => (
            <section key={g.title} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", margin: "0 0 2px" }}>{g.title}</h2>
              <p style={{ fontSize: 12, color: "#4b5563", margin: "0 0 12px" }}>{g.subtitle}</p>
              <div style={{ border: "1px solid #1f2937", borderRadius: 12, overflow: "hidden" }}>
                {g.entries.map((e, i) => (
                  <div key={e.name} style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr 0.8fr 1fr", gap: 12, alignItems: "center", padding: "12px 16px", background: i % 2 ? "#0f141a" : "#0b1117", borderTop: i ? "1px solid #161c24" : "none" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{e.name}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280", fontFamily: "ui-monospace, monospace" }}>{e.where}</div>
                    <div style={{ fontSize: 11, color: "#93c5fd" }}>{e.model}</div>
                    <div><DemoCell demo={e.demo} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </AiEnabledProvider>
      </div>
    </div>
  );
}

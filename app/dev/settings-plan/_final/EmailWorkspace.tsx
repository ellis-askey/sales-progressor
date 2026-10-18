"use client";

// FINAL (proposal, dev-only) — the email workspace, built from the REAL TSP
// components so it is exactly what ships. Look = the real EmailStudio (full
// colour/branding builder + its own live preview). Words = the real milestone
// copy editor. One tab strip over the real surfaces; the only new build at
// implementation is wiring both into a single shared preview (noted in-page).
// Only the active tab's component mounts (the copy editor fetches on mount).

import { useState } from "react";
import { PaintBrushBroad, TextAa, PaperPlaneTilt } from "@phosphor-icons/react";
import type { BrandingInitial } from "@/components/account/v2/EmailBrandingStudio";
import { EmailStudio } from "@/components/account/v2/EmailStudio";
import { AgencyMilestoneEmailsEditor } from "@/components/account/emails/AgencyMilestoneEmailsEditor";

// Mock branding seed for the real Studio (nothing saves on this page).
const BRAND_INIT: BrandingInitial = { logoUrl: null, tileColor: null, scale: null, align: null, theme: null, appAccent: "#FF6B4A" };

// A small, real-shaped step list for the real copy editor.
const STEPS = [
  { code: "VM7", label: "Draft contract pack issued", sides: ["vendor", "purchaser"], mortgageOnly: false, leaseholdOnly: false },
  { code: "PM8", label: "Searches ordered", sides: ["purchaser"], mortgageOnly: false, leaseholdOnly: false },
  { code: "PM20", label: "All enquiries satisfied", sides: ["vendor", "purchaser"], mortgageOnly: false, leaseholdOnly: false },
  { code: "VM19", label: "Contracts exchanged", sides: ["vendor"], mortgageOnly: false, leaseholdOnly: false },
];

type Tab = "look" | "words" | "sender";
const TABS: { id: Tab; label: string; Icon: typeof TextAa }[] = [
  { id: "words", label: "Words", Icon: TextAa },
  { id: "look", label: "Look", Icon: PaintBrushBroad },
  { id: "sender", label: "Sender", Icon: PaperPlaneTilt },
];

export function FinalEmailWorkspace() {
  const [tab, setTab] = useState<Tab>("look");
  return (
    <div style={{ background: "#fff", border: "1px solid var(--agent-border-default)", borderRadius: 14, overflow: "hidden" }}>
      {/* Tab strip — real TSP underline style */}
      <div style={{ display: "flex", gap: 4, padding: "10px 14px 0", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
        {TABS.map(({ id, label, Icon }) => {
          const on = tab === id;
          return (
            <button key={id} type="button" onClick={() => setTab(id)}
              style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 7, font: "inherit", fontSize: 13.5, fontWeight: 650, cursor: "pointer", background: "none", border: "none", padding: "8px 12px 12px", color: on ? "var(--agent-coral-deep)" : "var(--agent-text-muted)", transition: "color 160ms" }}>
              <Icon size={15} weight={on ? "fill" : "regular"} />
              {label}
              <span style={{ position: "absolute", left: 10, right: 10, bottom: -0.5, height: 2, borderRadius: 2, background: "var(--agent-coral-deep)", transform: on ? "scaleX(1)" : "scaleX(0)", transformOrigin: "center", transition: "transform 200ms cubic-bezier(.4,0,.2,1)" }} />
            </button>
          );
        })}
      </div>

      <div style={{ padding: 16 }}>
        {tab === "look" && (
          <>
            <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", margin: "0 0 12px" }}>
              The real Email Studio: palettes, gradient stops, header styles, fonts, logo, and its own live preview. In the final this preview also shows your edited Words (the one piece of new wiring).
            </p>
            <EmailStudio initial={BRAND_INIT} identityName="Your agency" />
          </>
        )}
        {tab === "words" && (
          <>
            <p style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", margin: "0 0 12px" }}>
              The real milestone copy editor. In the final it sits beside the Look preview so you see your words in your branding as you type.
            </p>
            <AgencyMilestoneEmailsEditor
              steps={STEPS}
              previewTheme={{ headerBg: "linear-gradient(135deg,#E0492A,#B4452E)", headerText: "#ffffff", accent: "#E0492A", cardBg: "#ffffff", bodyFont: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}
            />
          </>
        )}
        {tab === "sender" && (
          <div style={{ fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.6 }}>
            <p style={{ margin: "0 0 10px" }}>The sending-address setup is the real <b>SenderDomainSection</b> (single-sender or domain auth). It needs a live scope/status to render, so review it in place:</p>
            <a href="/agent/account/profile" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: "var(--agent-coral-deep)", textDecoration: "none", border: "1.5px solid var(--agent-border-default)", borderRadius: 9, padding: "8px 13px" }}>
              <PaperPlaneTilt size={14} weight="bold" /> Sending addresses (live)
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

// /dev/settings-plan — the consolidation proposal as two tabs (founder ask,
// 2026-10-14):
//   • FINAL — my merged best-of-breed component for each concept (new, dev-only,
//     built in ./_final/*). Takes the best phrasing from the originals.
//   • SCRAP — every existing component those finals replace, mounted live with
//     mock data, so it's clear what's going and nothing's silently lost.
// If a component is on neither tab, it doesn't get touched. Nothing here is
// wired into the real app. Dev-only: blocked in production.
//
// Agent CSS + tokens load per-layout (not globally), so we import them here and
// sit inside agent-shell-root[data-theme="custom"] for faithful rendering.

import "@/app/agent/styles/themes.css";
import "@/app/agent/styles/agent-system.css";

import { useState } from "react";
import { notFound } from "next/navigation";
import { ArrowSquareOut, Trash, Sparkle } from "@phosphor-icons/react";
import type { UserRole } from "@prisma/client";
import { AgentToaster } from "@/components/agent/AgentToaster";

// FINAL proposals (dev-only). The chasing + paused finals are the REAL
// components composed into the merged layout; only the email workspace and the
// nav-alignment schematic are thin dev-only wrappers.
import { FinalEmailWorkspace } from "./_final/EmailWorkspace";
import { FinalSettingsNav } from "./_final/SettingsNav";

// SCRAP — the real components being replaced
import { BusinessAutomationForm } from "@/components/progression/BusinessAutomationForm";
import { AutomationSettingsForm } from "@/components/automation/AutomationSettingsForm";
import { EnquiryChaseToggle } from "@/components/automation/EnquiryChaseToggle";
import { SolicitorAutomationForm } from "@/components/automation/SolicitorAutomationForm";
import { SilencedFilesSectionPlain } from "@/components/account/v2/SilencedFilesSectionPlain";
import { AccountLeftNav } from "@/components/account/chrome/AccountLeftNav";
import { BusinessSettingsNav } from "@/components/account/chrome/BusinessSettingsNav";

// ── Mock props for the scrap specimens ────────────────────────────────────────
const BIZ_AUTO = { client: true, solicitor: true, enquiries: true, weekly: false, chain: true, autoChainInvites: true };
const MOCK_RULES = [
  { milestoneCode: "VM1", milestoneName: "Seller has instructed their solicitor", side: "vendor" as const, orderIndex: 1, graceDays: 2, repeatEveryDays: 3, defaultGraceDays: 2, defaultRepeatEveryDays: 3, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "VM7", milestoneName: "Seller's solicitor has issued the draft contract pack", side: "vendor" as const, orderIndex: 7, graceDays: 5, repeatEveryDays: 3, defaultGraceDays: 5, defaultRepeatEveryDays: 3, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "PM8", milestoneName: "Buyer's solicitor has ordered searches", side: "purchaser" as const, orderIndex: 8, graceDays: 3, repeatEveryDays: 3, defaultGraceDays: 3, defaultRepeatEveryDays: 3, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
  { milestoneCode: "PM20", milestoneName: "Buyer's solicitor has confirmed all enquiries are now satisfied", side: "purchaser" as const, orderIndex: 20, graceDays: 28, repeatEveryDays: 7, defaultGraceDays: 28, defaultRepeatEveryDays: 7, escalateAfterChases: 2, escalateOverridden: false, enabled: true },
];
const MOCK_SILENCED = [
  { id: "demo-1", propertyAddress: "24 Willow Close, Ashford, TN23 4AB", pausedAt: new Date("2026-10-10T09:00:00Z"), pausedByName: "Ellis Askey" },
  { id: "demo-2", propertyAddress: "2 The Courtyard, Leighton Buzzard, LU7 0GY", pausedAt: new Date("2026-10-08T09:00:00Z"), pausedByName: "Taylor Kay" },
];
const SOLICITOR_INIT = { enabled: true, graceWorkingDays: 3, repeatDays: 7, maxChases: 3 };

const ACT = "#E0492A", INK = "#241A14", INK2 = "#574638", MUTED = "#8C7B6B", LINE = "rgba(40,26,18,.14)";

function Block({ kind, title, note, children }: { kind: "final" | "scrap"; title: string; note: string; children: React.ReactNode }) {
  const accent = kind === "final" ? ACT : "#9A5B4A";
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 2 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#fff", background: accent, borderRadius: 5, padding: "2px 7px" }}>
          {kind === "final" ? <Sparkle size={10} weight="fill" /> : <Trash size={10} weight="fill" />} {kind}
        </span>
        <span style={{ fontSize: 16, fontWeight: 740, letterSpacing: "-.015em", color: INK }}>{title}</span>
      </div>
      <p style={{ fontSize: 12.5, color: INK2, margin: "0 0 12px", paddingLeft: 2 }}>{note}</p>
      <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, padding: kind === "final" ? 0 : 14, background: kind === "final" ? "transparent" : "#FbF8F3", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

export default function SettingsPlanProposalPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const [tab, setTab] = useState<"final" | "scrap">("final");

  return (
    <div className="agent-shell-root" data-theme="custom" style={{ minHeight: "100vh", background: "#F2ECE3", color: INK, fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", padding: "32px 20px 160px" }}>
      <AgentToaster>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: ACT, fontWeight: 600 }}>/dev · settings &amp; email · final vs scrap</div>
          <h1 style={{ fontSize: 27, fontWeight: 760, letterSpacing: "-.02em", margin: "12px 0 0" }}>One component per concept</h1>
          <p style={{ fontSize: 15, color: INK2, margin: "10px 0 0", maxWidth: "72ch" }}>
            <b>Final</b> is my merged best-of-breed component for each bit, taking the best phrasing from the originals. <b>Scrap</b> is everything those finals replace, mounted live so nothing is lost silently. Anything on neither tab stays untouched. Default coral only; your brand colour resolves in the real app.
          </p>

          {/* Tabs */}
          <div style={{ display: "inline-flex", gap: 4, marginTop: 22, background: "#fff", border: `1px solid ${LINE}`, borderRadius: 11, padding: 4 }}>
            {(["final", "scrap"] as const).map((t) => {
              const on = tab === t;
              return (
                <button key={t} type="button" onClick={() => setTab(t)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer", borderRadius: 8, padding: "8px 18px", border: "none",
                    background: on ? (t === "final" ? ACT : "#5A4B3E") : "transparent", color: on ? "#fff" : INK2 }}>
                  {t === "final" ? <Sparkle size={14} weight={on ? "fill" : "regular"} /> : <Trash size={14} weight={on ? "fill" : "regular"} />}
                  {t === "final" ? "Final · what we build" : "Scrap · what goes in the bin"}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 24 }}>
            {tab === "final" ? (
              <>
                <Block kind="final" title="Automated chasing" note="The REAL components composed into one screen: the toggle block (BusinessAutomationForm) over the timing + per-milestone editor (AutomationSettingsForm). Absorbs EnquiryChaseToggle, WeeklyUpdateToggle, ChainNeighbourUpdatesToggle; solicitor on/off stays, its cadence moves to Command Centre.">
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <BusinessAutomationForm initial={BIZ_AUTO} />
                    <AutomationSettingsForm initialChaseEmailsEnabled initialRules={MOCK_RULES} initialEscalateAfter={2} scope="agency" showMasterToggle={false} />
                  </div>
                </Block>
                <Block kind="final" title="Email workspace" note="The REAL Email Studio (full colour/branding builder) + the REAL copy editor, under one tab strip. Only new wiring at build: a single shared preview showing your words in your branding.">
                  <FinalEmailWorkspace />
                </Block>
                <Block kind="final" title="Paused files" note="The REAL 'Silenced files' component; in the final it becomes read-only (pausing moves to the file's Client settings, so there's one source of truth).">
                  <SilencedFilesSectionPlain initialSilenced={MOCK_SILENCED} />
                </Block>
                <Block kind="final" title="Settings menus, aligned" note="Reconciles AccountLeftNav + BusinessSettingsNav, same features under the same tabs in both.">
                  <FinalSettingsNav />
                </Block>
              </>
            ) : (
              <>
                <Block kind="scrap" title="BusinessAutomationForm" note="→ absorbed into Automated chasing (the toggle block).">
                  <BusinessAutomationForm initial={BIZ_AUTO} />
                </Block>
                <Block kind="scrap" title="AutomationSettingsForm" note="→ absorbed into Automated chasing (the timing + per-milestone editor).">
                  <AutomationSettingsForm initialChaseEmailsEnabled initialRules={MOCK_RULES} initialEscalateAfter={2} scope="agency" showMasterToggle />
                </Block>
                <Block kind="scrap" title="EnquiryChaseToggle" note="→ moves into Automated chasing (kept as-is, better home).">
                  <EnquiryChaseToggle initialEnabled />
                </Block>
                <Block kind="scrap" title="SolicitorAutomationForm" note="→ on/off kept in Automated chasing; the cadence fields move to Command Centre (they currently write a platform-global setting, the scoping bug).">
                  <SolicitorAutomationForm initial={SOLICITOR_INIT} />
                </Block>
                <Block kind="scrap" title="SilencedFilesSectionPlain" note="→ replaced by the read-only 'Paused files' roster; the control moves to the file drawer.">
                  <SilencedFilesSectionPlain initialSilenced={MOCK_SILENCED} />
                </Block>
                <Block kind="scrap" title="AccountLeftNav + BusinessSettingsNav" note="→ kept, but aligned to mirror each other.">
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ maxWidth: 240 }}><AccountLeftNav role={"director" as UserRole} agencyHasDirector /></div>
                    <div style={{ maxWidth: 240 }}><BusinessSettingsNav isOwner /></div>
                  </div>
                </Block>
                <Block kind="scrap" title="EmailStudio + the copy editor" note="→ merged into the Email workspace. Too heavy to mount here (live data / preview engine). See them live:">
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <a href="/agent/account/profile" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: ACT, textDecoration: "none", border: `1.5px solid ${LINE}`, borderRadius: 9, padding: "8px 13px" }}><ArrowSquareOut size={14} weight="bold" /> Branding Studio</a>
                    <a href="/agent/account/emails" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 650, color: ACT, textDecoration: "none", border: `1.5px solid ${LINE}`, borderRadius: 9, padding: "8px 13px" }}><ArrowSquareOut size={14} weight="bold" /> Copy editor</a>
                  </div>
                </Block>
              </>
            )}
          </div>

          <p style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: MUTED, marginTop: 22 }}>Dev-only · mock data · nothing wired into the app · delete once the design is agreed.</p>
        </div>
      </AgentToaster>
    </div>
  );
}

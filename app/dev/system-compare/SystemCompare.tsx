"use client";

// System Compare — a dev-only SHOWROOM of the real TSP application. It mounts the
// actual production components with seeded (non-DB) props, grouped by real UI
// area (Agent dashboard · External Progressor · Command Centre). Everything in a
// stage is a real imported component/class — no recreations. Each real component
// is wrapped in an error boundary so a slightly-off seed degrades to a reference
// line instead of blanking the page. Only the page chrome (.sc-*) is local.
// No production component, style, token, or data is modified. Dev-only.

import "../../agent/styles/themes.css";
import "../../agent/styles/agent-system.css";
import "../../styles/elevra.css";
import "../../styles/glass.css";

import React, { useEffect, useState, useCallback, Component, type ReactNode } from "react";
import { Info } from "@phosphor-icons/react";

// ── Real agent file-detail components ──
import { PropertyHero } from "@/components/transaction/PropertyHero";
import { FileProgressProvider } from "@/components/transaction/FileProgressContext";
import { MilestoneTimelineStrip, type MilestoneStage } from "@/components/transaction/MilestoneTimelineStrip";
import { PeoplePanel } from "@/components/transaction/PeoplePanel";
import { ContactsSection } from "@/components/contacts/ContactsSection";
import { RemindersWidget } from "@/components/transaction/RemindersWidget";
import { NextActionCard } from "@/components/transaction/NextActionCard";
import { StatusControl } from "@/components/transaction/StatusControl";
import { StatusBadge } from "@/components/ui/StatusBadge";
// ── Real hub components ──
import { FirstSaleHero } from "@/components/hub/FirstSaleHero";
import { PipelineAtAGlance } from "@/components/hub/PipelineAtAGlance";
import { HubListCard } from "@/components/hub/HubListCard";
import { AttentionCard } from "@/components/hub/AttentionCard";
// ── Real external-progression components ──
import { ClientsWorkspace } from "@/components/progression/ClientsWorkspace";
import { ClientsEmptyState } from "@/components/progression/ClientsEmptyState";
import { ProgressionOwnerEmptyState } from "@/components/agent/ProgressionOwnerEmptyState";
import { BusinessTeamView } from "@/components/progression/BusinessTeamView";
// ── Real Command Centre primitives ──
import { Section, KpiCard, DeltaPill, InsightCard, FunnelBars, ParamTabs, TableShell, Tr, Td, CardEmpty, TrackingDisabled } from "@/components/command/ui/primitives";
import { BusinessStatusPill } from "@/components/command/businesses/StatusPill";
// ── UI primitives used in genuine comparisons ──
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Banner } from "@/components/ui/Banner";
import { SettingsNote } from "@/components/ui/SettingsNote";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import type { UndoImpact } from "@/app/actions/milestones";
import type { TransactionStatus, Tenure, PurchaseType, ServiceType } from "@prisma/client";

// ───────────────────────── Error boundary ─────────────────────────
class Boundary extends Component<{ label: string; file: string; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  render() {
    if (this.state.err) {
      return (
        <div className="sc-fallback">
          Couldn&apos;t render <strong>{this.props.label}</strong> in isolation — it needs live data or context not available here.
          Real implementation: <code>{this.props.file}</code>
        </div>
      );
    }
    return this.props.children;
  }
}

// ───────────────────────── Seed data (not real customers) ─────────────────────────
const MILESTONES = [
  { key: "instructed", name: "Instructed", status: "complete", completedAt: new Date("2026-09-14") },
  { key: "finances", name: "Finances", status: "complete", completedAt: null },
  { key: "searches", name: "Searches", status: "in_progress" },
  { key: "enquiries", name: "Enquiries", status: "up_next" },
  { key: "exchange", name: "Exchange", status: "pending", forecastDate: new Date("2026-12-05") },
  { key: "completion", name: "Completion", status: "pending" },
] as unknown as MilestoneStage[];

const CONTACTS = [
  { id: "c1", name: "Daniel & Sophie Hart", phone: "07700 900123", email: "hart.family@example.com", roleType: "vendor", portalToken: "tok_abc", createdAt: new Date("2026-09-14"), lastVisitedPortalAt: new Date("2026-10-20"), unsubscribedAt: null, isPrincipal: true, portalEligible: true },
  { id: "c2", name: "Marcus Bell", phone: "07700 900456", email: "m.bell@example.com", roleType: "purchaser", portalToken: null, createdAt: new Date("2026-09-20"), isPrincipal: false, portalEligible: true },
];

const REMINDERS = [
  { id: "r1", ruleName: "Chase buyer's solicitor for searches", nextDueDate: new Date(Date.now() - 2 * 864e5), snoozedUntil: null, pendingChaseCount: 1 },
  { id: "r2", ruleName: "Confirm mortgage offer received", nextDueDate: new Date(), snoozedUntil: null, pendingChaseCount: 0 },
  { id: "r3", ruleName: "Review draft contract pack", nextDueDate: new Date(Date.now() + 5 * 864e5), snoozedUntil: new Date(Date.now() + 3 * 864e5), pendingChaseCount: 0 },
];

const SAMPLE_UNDO = { currentPercent: 72, targetOnlyPercent: 61, cascadePercent: 48, cascade: [{ id: "s1", name: "Search results received", reconciledAtExchange: false }, { id: "s2", name: "Enquiries raised", reconciledAtExchange: false }, { id: "s3", name: "Mortgage offer received", reconciledAtExchange: true }] } as unknown as UndoImpact;

const PIPELINE_EMPTY = { count: 0, sample: null, more: [] };
const PIPELINE = {
  new: { count: 2, sample: { id: "tx_1", propertyAddress: "9 Birch Street, York, YO1 7HH", photoStoragePath: null }, more: [] },
  onboarding: { count: 1, sample: { id: "tx_2", propertyAddress: "22 Pemberton Road, Bristol", photoStoragePath: null }, more: [] },
  searches: { count: 3, sample: { id: "tx_3", propertyAddress: "14 Marlowe Court, Hemel Hempstead", photoStoragePath: null }, more: [] },
  enquiries: PIPELINE_EMPTY, ready: { count: 1, sample: { id: "tx_4", propertyAddress: "83 Victoria Park Road", photoStoragePath: null }, more: [] }, exchanging: PIPELINE_EMPTY, completed: { count: 5, sample: null, more: [] },
};

const CLIENTS_DATA = {
  business: { name: "Harbour & Co Progression", shortName: null },
  totals: { agencies: 2, activeSales: 14, pipelinePence: 420000000, exchangedThisMonth: 3 },
  clients: [
    { linkId: "l1", agencyId: "a1", name: "Oak & Key Estates", contact: "Sophie Bennett", logoUrl: null, tileColor: null, status: "active", people: 3, active: 6, pipelinePence: 180000000, exchanged: 2, removed: false },
    { linkId: "l2", agencyId: "a2", name: "Castle & Co", contact: "Tom Ridley", logoUrl: null, tileColor: null, status: "active", people: 2, active: 8, pipelinePence: 240000000, exchanged: 1, removed: false },
  ],
};

const TEAM = [
  { id: "m1", name: "Alex Hughes", email: "alex@harbour.co", role: "owner", image: null, imageFocusX: 50, imageFocusY: 50, canViewAllFiles: true, pending: false, removed: false },
  { id: "m2", name: "Jamie Lee", email: "jamie@harbour.co", role: "progressor", image: null, imageFocusX: 50, imageFocusY: 50, canViewAllFiles: false, pending: true, removed: false },
];

const LETTER = ["A", "B", "C"];
type Decision = "prefer" | "keep-both" | "neither" | "skip";
type Saved = { decision: Decision; variantId?: string };
type Decisions = Record<string, Saved>;

// ───────────────────────── Component ─────────────────────────
export function SystemCompare() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [area, setArea] = useState<"agent" | "progressor" | "command">("agent");
  const [mounted, setMounted] = useState(false);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [modal, setModal] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [surveyModal, setSurveyModal] = useState(false);
  const [undoModal, setUndoModal] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => {
    fetch("/api/dev/ui-preferences", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.decisions) setDecisions(j.decisions); }).catch(() => {});
  }, []);

  const save = useCallback(async (groupId: string, decision: Decision | "clear", variantId?: string) => {
    setDecisions((prev) => { const next = { ...prev }; if (decision === "clear") delete next[groupId]; else next[groupId] = { decision, variantId }; return next; });
    try { const res = await fetch("/api/dev/ui-preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId, decision, variantId }) }); const j = await res.json(); if (j?.decisions) setDecisions(j.decisions); } catch { /* dev only */ }
  }, []);

  return (
    <div className="sc-root" data-theme={theme}>
      <style dangerouslySetInnerHTML={{ __html: SC_CSS }} />

      <header className="sc-topbar">
        <div className="sc-topbar-in">
          <div className="sc-brand">
            <div className="sc-title">TSP Visual Showroom</div>
            <div className="sc-sub">Real production components, seeded with sample data. Dev-only — nothing here changes the app.</div>
          </div>
          <div className="sc-topbar-right">
            <div className="sc-areas">
              <button className={area === "agent" ? "on" : ""} onClick={() => setArea("agent")}>Agent dashboard</button>
              <button className={area === "progressor" ? "on" : ""} onClick={() => setArea("progressor")}>External Progressor</button>
              <button className={area === "command" ? "on" : ""} onClick={() => setArea("command")}>Command Centre</button>
            </div>
            <button className="sc-toggle" onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}>{theme === "light" ? "Dark" : "Light"}</button>
          </div>
        </div>
      </header>

      <main className="sc-main">
        {area === "agent" && <AgentArea decisions={decisions} save={save} openModal={() => setModal(true)} openDrawer={() => setDrawerOpen(true)} openSurvey={() => setSurveyModal(true)} openUndo={() => setUndoModal(true)} />}
        {area === "progressor" && <ProgressorArea />}
        {area === "command" && <CommandArea decisions={decisions} save={save} />}
      </main>

      {mounted && modal ? (
        <Modal open onClose={() => setModal(false)} ariaLabel="Modal demo">
          <Modal.Header><div style={{ fontSize: 17, fontWeight: 600, color: "var(--agent-text-primary)" }}>Canonical Modal</div></Modal.Header>
          <Modal.Body><p style={{ fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>The real modal — portal, coral accent, Escape, backdrop dismiss, close-button hover.</p></Modal.Body>
          <Modal.Footer><button className="agent-btn agent-btn-md agent-btn-neutral" onClick={() => setModal(false)}>Cancel</button><button className="agent-btn agent-btn-md agent-btn-primary" onClick={() => setModal(false)}>Confirm</button></Modal.Footer>
        </Modal>
      ) : null}
      {mounted && drawerOpen ? (
        <Drawer open onClose={() => setDrawerOpen(false)} ariaLabel="Drawer demo">
          <Drawer.Header><div style={{ fontSize: 17, fontWeight: 600, color: "var(--agent-text-primary)" }}>Canonical Drawer</div></Drawer.Header>
          <Drawer.Body><p style={{ fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.6, margin: 0 }}>Real right-anchored slide, glass surface, coral accent.</p></Drawer.Body>
          <Drawer.Footer><button className="agent-btn agent-btn-md agent-btn-neutral" onClick={() => setDrawerOpen(false)}>Close</button></Drawer.Footer>
        </Drawer>
      ) : null}
      {mounted && surveyModal ? <SurveyNrConfirmModal onConfirm={() => setSurveyModal(false)} onCancel={() => setSurveyModal(false)} /> : null}
      {mounted && undoModal ? <UndoMilestoneModal milestoneName="Searches ordered" milestoneId="demo" undoData={SAMPLE_UNDO} isPending={false} onConfirm={() => setUndoModal(false)} onCancel={() => setUndoModal(false)} /> : null}
    </div>
  );
}

// ───────────────────────── Agent area ─────────────────────────
function AgentArea({ decisions, save, openModal, openDrawer, openSurvey, openUndo }: { decisions: Decisions; save: (g: string, d: Decision | "clear", v?: string) => void; openModal: () => void; openDrawer: () => void; openSurvey: () => void; openUndo: () => void }) {
  return (
    <>
      <AreaHead title="Agent dashboard" sub="The estate-agent view. The file detail page is the heart of the app — property header, progress, people, next action and reminders." />

      <Stage label="File detail — the composed Overview">
        <Boundary label="PropertyHero" file="components/transaction/PropertyHero.tsx">
          <FileProgressProvider seed={[]} fallbackPercent={62}>
            <PropertyHero address="14 Marlowe Court, Hemel Hempstead" agencyName="Castle & Co Estate Agents" status={"active" as TransactionStatus} tenure={"leasehold" as Tenure} purchaseType={"mortgage" as PurchaseType} purchasePrice={42500000} exchangeDate={new Date("2026-12-05")} percent={62} onTrack="on_track" serviceType={"self_managed" as ServiceType} backHref="/agent/transactions" assignedUserName="Priya Shah" assignedUserImage={null} createdAt={new Date("2026-09-14")} photoUrl={null} exchanged={false} isShareOfFreehold={false} hasManagementPack={false} />
          </FileProgressProvider>
        </Boundary>
        <div style={{ height: 14 }} />
        <Boundary label="MilestoneTimelineStrip" file="components/transaction/MilestoneTimelineStrip.tsx">
          <MilestoneTimelineStrip stages={MILESTONES} exchangeDayActive={false} />
        </Boundary>
        <div className="sc-grid2">
          <Boundary label="PeoplePanel + ContactsSection" file="components/transaction/PeoplePanel.tsx · components/contacts/ContactsSection.tsx">
            <PeoplePanel headerAction={null} professionals={<div style={{ padding: 16, color: "var(--agent-text-secondary)", fontSize: 13 }}>Solicitor, surveyor and other professionals appear here.</div>} clients={<ContactsSection transactionId="demo-tx" address="14 Marlowe Court, Hemel Hempstead" isInternalStaff={false} allowIntroCall={false} embedded contacts={CONTACTS as unknown as React.ComponentProps<typeof ContactsSection>["contacts"]} portalViewDates={{ c1: new Date("2026-10-20") } as unknown as React.ComponentProps<typeof ContactsSection>["portalViewDates"]} automatedEmailCounts={{}} lastContactedByContactId={{}} linkSentByContactId={{}} photoUrl={null} />} />
          </Boundary>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Boundary label="NextActionCard" file="components/transaction/NextActionCard.tsx">
              <NextActionCard title="Chase buyer's solicitor for searches" description="Waiting on: Local authority search returned." dueLabel="2 days overdue" dueTone="warn" primaryLabel="Mark complete" secondaryLabel="View reminders" onPrimary={() => {}} onSecondary={() => {}} />
            </Boundary>
            <Boundary label="RemindersWidget" file="components/transaction/RemindersWidget.tsx">
              <RemindersWidget totalActive={3} reminders={REMINDERS as unknown as React.ComponentProps<typeof RemindersWidget>["reminders"]} />
            </Boundary>
          </div>
        </div>
        <div className="sc-inline-controls">
          <span className="sc-inline-label">Status control (open the menu):</span>
          <Boundary label="StatusControl" file="components/transaction/StatusControl.tsx"><StatusControl transactionId="demo-tx" currentStatus={"active" as TransactionStatus} inChain={false} /></Boundary>
          <StatusBadge status={"on_hold" as TransactionStatus} />
        </div>
      </Stage>

      <Stage label="Hub — the pipeline landing">
        <Boundary label="FirstSaleHero" file="components/hub/FirstSaleHero.tsx"><FirstSaleHero sale={{ id: "tx_1", address: "12 Elm Road, Didsbury, Manchester, M20 2WX" }} photoUrl={null} /></Boundary>
        <div style={{ height: 14 }} />
        <Boundary label="PipelineAtAGlance" file="components/hub/PipelineAtAGlance.tsx"><PipelineAtAGlance signedPhotos={{}} stages={PIPELINE as unknown as React.ComponentProps<typeof PipelineAtAGlance>["stages"]} /></Boundary>
        <div className="sc-grid2">
          <Boundary label="HubListCard (gone quiet)" file="components/hub/HubListCard.tsx">
            <HubListCard cardKind="gone_quiet" iconName="clock" headerTone="warning" title="Gone quiet" countWord={{ one: "file gone quiet", many: "files gone quiet" }} subtitle="No movement in 14+ days" rows={[{ transactionId: "tx_1", href: "#", photoUrl: null, address: "4 Oak Lane, Leeds, LS1 4AB", pillLabel: null, pillTone: "warning", subtext: "No update since 3 Oct", meta: "14 days quiet", metaTone: "warning", dismissSignature: "sig1" }] as unknown as React.ComponentProps<typeof HubListCard>["rows"]} />
          </Boundary>
          <Boundary label="AttentionCard (all clear)" file="components/hub/AttentionCard.tsx"><AttentionCard holds={[]} reminders={[]} unassigned={[]} relists={[]} chainSetup={[]} /></Boundary>
        </div>
      </Stage>

      <Stage label="Live modals, drawers &amp; overlays">
        <div className="sc-row-wrap">
          <button className="agent-btn agent-btn-md agent-btn-secondary" onClick={openModal}>Open modal</button>
          <button className="agent-btn agent-btn-md agent-btn-secondary" onClick={openDrawer}>Open drawer</button>
          <button className="agent-btn agent-btn-md agent-btn-secondary" onClick={openSurvey}>SurveyNrConfirmModal</button>
          <button className="agent-btn agent-btn-md agent-btn-secondary" onClick={openUndo}>UndoMilestoneModal</button>
        </div>
        <p className="sc-hint">Real overlays — open them to feel the actual entrance animation and close-button hover.</p>
      </Stage>

      <AreaHead title="Decisions" sub="The few genuine same-purpose forks worth a preference. Browsing above needs no decisions." small />

      <Compare id="agent-card-frosted" useCase="Frosted card surface" summary="glass-card (canonical, blur 40) vs the legacy agent-glass (blur 24). Shown at card size on the real app surface."
        decisions={decisions} save={save} family="agent"
        variants={[
          { id: "glass-card", label: "glass-card / <Card>", node: <div className="glass-card" style={{ borderRadius: 16, width: 260, padding: 16 }}><div style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>Contract pack received</div><div style={{ fontSize: 13, color: "var(--agent-text-secondary)", marginTop: 4 }}>The seller's solicitor has sent the pack.</div></div> },
          { id: "agent-glass", label: "agent-glass (legacy)", node: <div className="agent-glass" style={{ borderRadius: 16, width: 260, padding: 16 }}><div style={{ fontWeight: 600, color: "var(--agent-text-primary)" }}>Contract pack received</div><div style={{ fontSize: 13, color: "var(--agent-text-secondary)", marginTop: 4 }}>The seller's solicitor has sent the pack.</div></div> },
        ]} />

      <Compare id="agent-status-pill" useCase="Status pill" summary="Token-based agent-pill (dark-aware) vs StatusBadge (hard-coded Tailwind)."
        decisions={decisions} save={save} family="agent"
        variants={[
          { id: "agent-pill", label: "agent-pill", node: <span className="sc-row-wrap"><span className="agent-pill agent-pill-active">Active</span><span className="agent-pill agent-pill-hold">On hold</span><span className="agent-pill agent-pill-completed">Completed</span></span> },
          { id: "status-badge", label: "<StatusBadge>", node: <span className="sc-row-wrap"><StatusBadge status={"active" as TransactionStatus} /><StatusBadge status={"on_hold" as TransactionStatus} /><StatusBadge status={"completed" as TransactionStatus} /></span> },
        ]} />

      <Compare id="agent-banner-note" useCase="Banner vs inset note" summary="Likely keep-both: the floating glass Banner (transaction surfaces) vs the calm inset SettingsNote (settings)."
        decisions={decisions} save={save} family="agent"
        variants={[
          { id: "banner", label: "<Banner>", node: <div style={{ width: 340 }}><Banner kind="info" icon={<Info size={18} weight="fill" />} title="Searches ordered" body="Your solicitor has submitted the search applications." /></div> },
          { id: "settings-note", label: "<SettingsNote>", node: <div style={{ width: 340 }}><SettingsNote tone="info" title="Searches ordered" body="Your solicitor has submitted the search applications." /></div> },
        ]} />
    </>
  );
}

// ───────────────────────── Progressor area ─────────────────────────
function ProgressorArea() {
  return (
    <>
      <AreaHead title="External Sales Progression Business" sub="An independent progression firm running its own bounded book on the platform. Same app shell, its own screens." />
      <Stage label="Clients workspace">
        <Boundary label="ClientsWorkspace" file="components/progression/ClientsWorkspace.tsx"><ClientsWorkspace pendingRequests={[]} data={CLIENTS_DATA as unknown as React.ComponentProps<typeof ClientsWorkspace>["data"]} /></Boundary>
      </Stage>
      <Stage label="Team &amp; onboarding states">
        <div className="sc-grid2">
          <Boundary label="BusinessTeamView" file="components/progression/BusinessTeamView.tsx"><BusinessTeamView team={TEAM as unknown as React.ComponentProps<typeof BusinessTeamView>["team"]} /></Boundary>
          <Boundary label="ProgressionOwnerEmptyState" file="components/agent/ProgressionOwnerEmptyState.tsx"><ProgressionOwnerEmptyState stage={{ total: 1, pending: 1, sampleName: "Oak & Key" } as unknown as React.ComponentProps<typeof ProgressionOwnerEmptyState>["stage"]} /></Boundary>
        </div>
      </Stage>
      <Stage label="Clients — first-run empty state">
        <Boundary label="ClientsEmptyState" file="components/progression/ClientsEmptyState.tsx"><ClientsEmptyState pendingRequests={[]} /></Boundary>
      </Stage>
    </>
  );
}

// ───────────────────────── Command area ─────────────────────────
function CommandArea({ decisions, save }: { decisions: Decisions; save: (g: string, d: Decision | "clear", v?: string) => void }) {
  return (
    <>
      <AreaHead title="Command Centre" sub="A deliberately separate family — utilitarian dark, blue accent, no glass. Internal founder tooling. These comparisons are internal to it." />
      <Stage label="Operations dashboard" dark>
        <Boundary label="Command Centre primitives" file="components/command/ui/primitives.tsx">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Section title="This month" subtitle="Platform at a glance">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                <KpiCard label="Sales started" value="128" sub="vs 112" delta={<DeltaPill current={128} previous={112} />} accent />
                <KpiCard label="Exchanges" value="41" sub="vs 38" delta={<DeltaPill current={41} previous={38} />} />
                <KpiCard label="Live agencies" value="19" sub="3 new" />
                <KpiCard label="Chases sent" value="2,410" sub="this week" />
              </div>
            </Section>
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
              <Section title="Agencies" subtitle="Who's using the platform" right={<ParamTabs active="30d" options={[{ key: "7d", label: "7 days" }, { key: "30d", label: "30 days" }]} hrefFor={(k) => `#${k}`} />}>
                <TableShell head={["Agency", "Active", "Pipeline", "Status"]}>
                  <Tr><Td first>Oak &amp; Key Estates</Td><Td>6</Td><Td muted>£1.8m</Td><Td><BusinessStatusPill status={"live"} /></Td></Tr>
                  <Tr><Td first>Castle &amp; Co</Td><Td>8</Td><Td muted>£2.4m</Td><Td><BusinessStatusPill status={"no_card"} /></Td></Tr>
                  <Tr><Td first>Harbour Residential</Td><Td>3</Td><Td muted>£0.9m</Td><Td><BusinessStatusPill status={"payment_failed"} /></Td></Tr>
                </TableShell>
              </Section>
              <Section title="Acquisition funnel">
                <FunnelBars stages={[{ label: "Site visits", value: 1200 }, { label: "Signups", value: 240 }, { label: "First sale", value: 96 }, { label: "Paying", value: 36 }]} />
                <div style={{ marginTop: 12 }}><InsightCard tone="good">Conversion to first sale is up 6% this week.</InsightCard></div>
              </Section>
            </div>
            <TrackingDisabled what="Website analytics" why="Connect GA4 to see traffic sources here." />
          </div>
        </Boundary>
      </Stage>

      <AreaHead title="Decisions (internal to the Command Centre)" sub="Same treatment rendered multiple ways — worth consolidating within this family." small />
      <Compare id="cc-badge" useCase="'Good' status badge — three recipes" summary="The same green status rendered three ways. Shown on the dark surface." family="command" decisions={decisions} save={save}
        variants={[
          { id: "cc-badge-tw", label: "StatusPill (Tailwind)", node: <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/50 border-emerald-900/60">Active</span> },
          { id: "cc-badge-hex", label: "AdoptionTable (hex)", node: <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border bg-[#14352a] text-[#6ee7b7] border-[#2c5a3f]">Active</span> },
          { id: "cc-badge-solid", label: "overview (solid)", node: <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-900">Active</span> },
        ]} />
      <Compare id="cc-button-primary" useCase="Primary button" summary="Same blue, two notations and radii." family="command" decisions={decisions} save={save}
        variants={[
          { id: "cc-btn-tw", label: "bg-blue-600 · rounded-lg", node: <button className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-blue-500">Save</button> },
          { id: "cc-btn-hex", label: "bg-[#2563eb] · rounded-md", node: <button className="rounded-md bg-[#2563eb] px-4 py-2 text-[13px] font-medium text-white">Save</button> },
        ]} />
    </>
  );
}

// ───────────────────────── Building blocks ─────────────────────────
function AreaHead({ title, sub, small }: { title: string; sub: string; small?: boolean }) {
  return (
    <div className={`sc-areahead ${small ? "sc-areahead-sm" : ""}`}>
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );
}

function Stage({ label, dark, children }: { label: string; dark?: boolean; children: ReactNode }) {
  return (
    <div className="sc-stage-wrap">
      <div className="sc-stage-label">{label}</div>
      <div className={`sc-stage ${dark ? "sc-stage-cc" : "sc-stage-agent"}`}>{children}</div>
    </div>
  );
}

function Compare({ id, useCase, summary, variants, family, decisions, save }: { id: string; useCase: string; summary?: string; family: "agent" | "command"; variants: { id: string; label: string; node: ReactNode }[]; decisions: Decisions; save: (g: string, d: Decision | "clear", v?: string) => void }) {
  const saved = decisions[id];
  return (
    <div className={`sc-group ${saved ? "sc-group-decided" : ""}`}>
      <div className="sc-group-title">{useCase}{saved ? <span className="sc-decided">✓ {saved.decision === "prefer" ? `Prefer ${LETTER[variants.findIndex((v) => v.id === saved.variantId)] ?? "?"}` : saved.decision === "keep-both" ? "Keep both" : saved.decision === "neither" ? "Neither" : "Skipped"}</span> : null}</div>
      {summary ? <p className="sc-group-sum">{summary}</p> : null}
      <div className="sc-variants">
        {variants.map((v, i) => (
          <div className={`sc-variant ${saved?.decision === "prefer" && saved.variantId === v.id ? "sc-variant-chosen" : ""}`} key={v.id}>
            <div className="sc-variant-badge">{LETTER[i]}</div>
            <div className={`sc-specimen ${family === "command" ? "sc-stage-cc" : "sc-stage-agent"}`}>{v.node}</div>
            <div className="sc-variant-name">{v.label}</div>
          </div>
        ))}
      </div>
      <div className="sc-controls">
        {variants.map((v, i) => <button key={v.id} className={`sc-ctrl ${saved?.decision === "prefer" && saved.variantId === v.id ? "on" : ""}`} onClick={() => save(id, "prefer", v.id)}>Prefer {LETTER[i]}</button>)}
        <button className={`sc-ctrl ${saved?.decision === "keep-both" ? "on" : ""}`} onClick={() => save(id, "keep-both")}>Keep both</button>
        <button className={`sc-ctrl ${saved?.decision === "neither" ? "on" : ""}`} onClick={() => save(id, "neither")}>Neither</button>
        <button className={`sc-ctrl ${saved?.decision === "skip" ? "on" : ""}`} onClick={() => save(id, "skip")}>Skip</button>
        {saved ? <button className="sc-ctrl sc-ctrl-clear" onClick={() => save(id, "clear")}>Clear</button> : null}
      </div>
    </div>
  );
}

const SC_CSS = `
/* Suppress the app's global cookie banner while browsing the dev showroom. */
[aria-label="Cookie consent"], [aria-label="Manage cookie preferences"] { display: none !important; }
.sc-root { min-height: 100vh; background: #f4f3f1; color: #1a1714; }
.sc-root[data-theme="dark"] { background: #121110; color: #ece6dc; }
.sc-topbar { position: sticky; top: 0; z-index: 40; background: rgba(255,255,255,0.9); border-bottom: 1px solid rgba(0,0,0,0.1); backdrop-filter: blur(8px); }
.sc-root[data-theme="dark"] .sc-topbar { background: rgba(20,19,17,0.9); border-bottom-color: rgba(255,255,255,0.1); }
.sc-topbar-in { max-width: 1240px; margin: 0 auto; padding: 11px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.sc-title { font-size: 17px; font-weight: 750; letter-spacing: -0.01em; }
.sc-sub { font-size: 12px; opacity: 0.6; margin-top: 2px; }
.sc-topbar-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.sc-areas { display: inline-flex; background: rgba(0,0,0,0.05); border-radius: 10px; padding: 3px; }
.sc-root[data-theme="dark"] .sc-areas { background: rgba(255,255,255,0.07); }
.sc-areas button { font-size: 13px; font-weight: 600; padding: 6px 12px; border: none; background: transparent; color: inherit; border-radius: 8px; cursor: pointer; opacity: 0.7; }
.sc-areas button.on { background: #1a1714; color: #fff; opacity: 1; }
.sc-root[data-theme="dark"] .sc-areas button.on { background: #ece6dc; color: #121110; }
.sc-toggle { font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.18); background: transparent; color: inherit; cursor: pointer; }
.sc-root[data-theme="dark"] .sc-toggle { border-color: rgba(255,255,255,0.22); }
.sc-main { max-width: 1240px; margin: 0 auto; padding: 24px 24px 120px; }
.sc-areahead { margin: 8px 0 20px; }
.sc-areahead h2 { font-size: 26px; font-weight: 750; letter-spacing: -0.015em; margin: 0; }
.sc-areahead p { font-size: 14px; opacity: 0.7; margin: 6px 0 0; max-width: 760px; line-height: 1.55; }
.sc-areahead-sm { margin-top: 40px; padding-top: 24px; border-top: 1px solid rgba(0,0,0,0.12); }
.sc-root[data-theme="dark"] .sc-areahead-sm { border-top-color: rgba(255,255,255,0.12); }
.sc-areahead-sm h2 { font-size: 20px; }
.sc-stage-wrap { margin: 0 0 28px; }
.sc-stage-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; opacity: 0.5; margin-bottom: 10px; }
.sc-stage { border-radius: 16px; padding: 22px; border: 1px solid rgba(0,0,0,0.1); overflow: hidden; }
.sc-root[data-theme="dark"] .sc-stage { border-color: rgba(255,255,255,0.1); }
.sc-stage-agent { background: linear-gradient(170deg, var(--agent-bg-base, #FFF5EC), var(--agent-bg-deep, #FFCBA4)); }
.sc-root[data-theme="dark"] .sc-stage-agent { background: linear-gradient(170deg, #1b2433, #0c1016); }
.sc-stage-cc { background: #0a0a0a; border-color: #262626; }
.sc-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
@media (max-width: 900px) { .sc-grid2 { grid-template-columns: 1fr; } }
.sc-inline-controls { display: flex; align-items: center; gap: 14px; margin-top: 16px; flex-wrap: wrap; }
.sc-inline-label { font-size: 13px; color: var(--agent-text-secondary); }
.sc-row-wrap { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.sc-hint { font-size: 12.5px; opacity: 0.65; margin: 10px 0 0; }
.sc-fallback { font-size: 13px; line-height: 1.5; padding: 14px 16px; border-radius: 10px; background: rgba(0,0,0,0.04); border: 1px dashed rgba(0,0,0,0.2); color: #1a1714; }
.sc-root[data-theme="dark"] .sc-fallback { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.22); color: #ece6dc; }
.sc-fallback code { font-family: ui-monospace, Menlo, monospace; font-size: 0.86em; background: rgba(0,0,0,0.08); padding: 1px 5px; border-radius: 4px; }
.sc-group { border: 1px solid rgba(0,0,0,0.1); border-radius: 14px; padding: 16px 18px; margin: 0 0 16px; background: #fff; }
.sc-root[data-theme="dark"] .sc-group { border-color: rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); }
.sc-group-decided { box-shadow: inset 3px 0 0 #2f7a54; }
.sc-group-title { font-size: 15px; font-weight: 650; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sc-decided { font-size: 11.5px; font-weight: 600; color: #2f7a54; background: rgba(47,122,84,0.12); padding: 2px 8px; border-radius: 999px; }
.sc-group-sum { font-size: 12.5px; opacity: 0.72; margin: 5px 0 0; line-height: 1.5; }
.sc-variants { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin: 14px 0; }
.sc-variant { position: relative; border: 1px solid rgba(0,0,0,0.08); border-radius: 10px; overflow: hidden; }
.sc-root[data-theme="dark"] .sc-variant { border-color: rgba(255,255,255,0.08); }
.sc-variant-chosen { border-color: #2f7a54; box-shadow: 0 0 0 1px #2f7a54; }
.sc-variant-badge { position: absolute; top: 8px; right: 8px; z-index: 2; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.5); color: #fff; font-size: 11px; font-weight: 700; display: grid; place-items: center; font-family: ui-monospace, monospace; }
.sc-specimen { display: flex; align-items: center; justify-content: flex-start; min-height: 90px; padding: 18px; }
.sc-variant-name { font-size: 12px; font-weight: 600; padding: 8px 12px; border-top: 1px solid rgba(0,0,0,0.08); font-family: ui-monospace, Menlo, monospace; }
.sc-root[data-theme="dark"] .sc-variant-name { border-top-color: rgba(255,255,255,0.08); }
.sc-controls { display: flex; gap: 7px; flex-wrap: wrap; padding-top: 12px; border-top: 1px dashed rgba(0,0,0,0.12); }
.sc-root[data-theme="dark"] .sc-controls { border-top-color: rgba(255,255,255,0.12); }
.sc-ctrl { font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.18); background: #fff; color: inherit; cursor: pointer; }
.sc-root[data-theme="dark"] .sc-ctrl { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.2); }
.sc-ctrl:hover { border-color: #d84a26; }
.sc-ctrl.on { background: #2f7a54; border-color: #2f7a54; color: #fff; }
.sc-ctrl-clear { margin-left: auto; opacity: 0.6; }
`;

"use client";

// The three portal screens, built on the REAL portal components so the glass
// navs are judged against a faithful portal. Overview reuses PortalOverviewHero
// verbatim; Progress + Updates are rebuilt on PortalGlassCard + the P tokens +
// real copy (the production list components are swipe/server-action heavy, so a
// faithful static rebuild reads identically without the plumbing).

import { Check, Shield } from "@phosphor-icons/react";
import { PortalOverviewHero, type OverviewTile } from "@/components/portal/PortalOverviewHero";
import { PortalGlassCard } from "@/components/portal/PortalGlassCard";
import { PortalProgressHeader } from "@/components/portal/PortalProgressHeader";
import { P, PortalPill, type PortalPillTone } from "@/components/portal/portal-ui";

// Fixed dates (no Date.now, to keep SSR + client identical).
const TARGET = new Date("2026-09-30");
const ESTIMATE = new Date("2026-09-22");

const TILES: OverviewTile[] = [
  { key: "instructed", label: "Instructed", status: "complete", text: "Completed", completedDate: "25 Jun", description: "Your solicitor is instructed and acting for you." },
  { key: "draft", label: "Draft pack", status: "complete", text: "Completed", completedDate: "8 Jul", description: "The draft contract pack has been issued." },
  { key: "searches", label: "Searches", status: "active", text: "Underway", description: "Searches are underway with the local authority." },
  { key: "enquiries", label: "Enquiries", status: "pending", text: "Pending", description: "Your solicitor will raise enquiries next." },
  { key: "exchange", label: "Exchange", status: "pending", text: "TBC", description: "Both sides sign and commit to the sale." },
  { key: "completion", label: "Completion", status: "pending", text: "TBC", locked: true, description: "The day the keys are yours." },
];

export function OverviewScreen() {
  return (
    <div className="space-y-4 portal-reveal-stack ppv-screen ppv-screen--hero">
      <PortalOverviewHero
        address="14 Oakfield Road"
        addressLine2="Bristol, BS6 7PL"
        photoUrl={null}
        status="active"
        tenure="freehold"
        purchaseType="mortgage"
        percent={42}
        currentStepNumber={3}
        currentStage4="Conveyancing"
        currentStageSubLabel="Searches underway"
        tiles={TILES}
        targetDate={TARGET}
        estimateDate={ESTIMATE}
        plannedDate={null}
        daysUntilPredicted={38}
        progressHref="#"
      />
      <PortalGlassCard glassId="latest-updates" label="Latest updates" radius={16} className="px-5 py-4">
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <p className="text-[15px] font-semibold" style={{ color: P.textPrimary }}>Latest updates</p>
          <span className="text-[13px] font-semibold" style={{ color: P.primary }}>See all</span>
        </div>
        <p className="text-[13.5px]" style={{ color: P.textSecondary, lineHeight: 1.5 }}>Your solicitor has received the local authority searches and is reviewing them now.</p>
        <p className="text-[12px]" style={{ color: P.textMuted, marginTop: 8 }}>Yesterday, from your progression team</p>
      </PortalGlassCard>
      <PortalGlassCard glassId="team" label="Your team" radius={16} className="px-5 py-4">
        <p className="text-[15px] font-semibold" style={{ color: P.textPrimary, marginBottom: 4 }}>Your team</p>
        <p className="text-[13.5px]" style={{ color: P.textSecondary, lineHeight: 1.5 }}>Priya is progressing your purchase. Message her any time from the menu.</p>
      </PortalGlassCard>
    </div>
  );
}

// ── Progress ──────────────────────────────────────────────────────────────────
function MilestoneRow({ label, state, date, desc }: { label: string; state: "complete" | "active" | "pending"; date?: string; desc?: string }) {
  const done = state === "complete";
  const active = state === "active";
  return (
    <div className="flex items-start gap-3" style={{ padding: "11px 0", borderTop: `1px solid ${P.border}` }}>
      <span style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1, background: done ? P.success : "transparent", border: done ? "none" : active ? `2px solid ${P.primary}` : `2px solid ${P.border}`, color: "#fff" }}>
        {done ? <Check size={13} weight="bold" /> : active ? <span style={{ width: 7, height: 7, borderRadius: 999, background: P.primary }} /> : null}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: active ? 650 : 600, color: done || active ? P.textPrimary : P.textSecondary }}>{label}</p>
        {desc && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: P.textMuted, lineHeight: 1.45 }}>{desc}</p>}
      </div>
      {date && <span style={{ fontSize: 11.5, color: P.textMuted, flexShrink: 0, marginTop: 2 }}>{date}</span>}
    </div>
  );
}

function Group({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <PortalGlassCard glassId="progress-group" label="Progress group" radius={16} className="px-5 py-2">
      <p style={{ margin: "10px 0 4px", fontSize: 13.5, fontWeight: 700, color: P.textPrimary }}>{emoji}&nbsp;&nbsp;{title}</p>
      <div>{children}</div>
    </PortalGlassCard>
  );
}

export function ProgressScreen() {
  return (
    <div className="space-y-4 portal-reveal-stack ppv-screen">
      <PortalProgressHeader completed={5} total={16} percent={31} showPercent nextLabel="Search results received" />
      <Group emoji="👋" title="Onboarding">
        <MilestoneRow label="Solicitor instructed" state="complete" date="25 Jun" />
        <MilestoneRow label="ID &amp; AML checks" state="complete" date="28 Jun" />
      </Group>
      <Group emoji="📝" title="Contract preparation">
        <MilestoneRow label="Draft contract pack received" state="complete" date="8 Jul" />
        <MilestoneRow label="Enquiries raised" state="pending" desc="Your solicitor will raise enquiries after searches." />
      </Group>
      <Group emoji="🔍" title="Searches &amp; legal">
        <MilestoneRow label="Searches ordered" state="complete" date="12 Jul" />
        <MilestoneRow label="Search results received" state="active" desc="Searches are underway with the local authority." />
      </Group>
      <Group emoji="🔑" title="Ready to exchange">
        <MilestoneRow label="Contract signed" state="pending" desc="You will sign once enquiries settle." />
        <MilestoneRow label="Contracts exchanged" state="pending" desc="Both sides commit and the date is fixed." />
      </Group>
    </div>
  );
}

// ── Updates ──────────────────────────────────────────────────────────────────
function UpdateCard({ initials, color, title, sub, date, tag, tagTone = "grey", isNew }: { initials: string; color: string; title: string; sub?: string; date: string; tag?: string; tagTone?: PortalPillTone; isNew?: boolean }) {
  return (
    <PortalGlassCard glassId="update" label="Update card" radius={16} defaultVariant="v26" className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span style={{ width: 36, height: 36, borderRadius: 999, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: color, color: "#fff", fontSize: 13, fontWeight: 700 }}>{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-start justify-between gap-2">
            <p style={{ margin: 0, fontSize: 14, fontWeight: 650, color: P.textPrimary, lineHeight: 1.35 }}>{title}</p>
            {isNew && <PortalPill tone="coral" size="sm">New</PortalPill>}
          </div>
          {sub && <p style={{ margin: "4px 0 0", fontSize: 13, color: P.textSecondary, lineHeight: 1.45 }}>{sub}</p>}
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 11.5, color: P.textMuted }}>{date}</span>
            {tag && <PortalPill tone={tagTone} size="sm">{tag}</PortalPill>}
          </div>
        </div>
      </div>
    </PortalGlassCard>
  );
}

function DayHeader({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: "6px 2px 0", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: P.textMuted }}>{children}</p>;
}

export function UpdatesScreen() {
  return (
    <div className="space-y-3 portal-reveal-stack ppv-screen">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 14, background: P.primaryBg }}>
        <Shield size={16} weight="fill" style={{ color: P.primary }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: P.primaryText }}>2 new since your last visit</span>
      </div>
      <DayHeader>Today</DayHeader>
      <UpdateCard initials="PT" color="#F0883E" title="Searches are back" sub="Your solicitor has received the local authority searches and is reviewing them now." date="Today · 09:24" tag="Purchase" tagTone="green" isNew />
      <DayHeader>Yesterday</DayHeader>
      <UpdateCard initials="PC" color="#2FB46B" title="You confirmed: ID &amp; AML checks" sub="Thanks, that is logged against your file." date="Yesterday · 16:02" tag="Confirmed" tagTone="grey" isNew />
      <DayHeader>This week</DayHeader>
      <UpdateCard initials="CW" color="#8B91A3" title="Draft contract pack received" sub="Carter &amp; Wells have the pack and will raise enquiries next." date="Mon 7 Jul · 11:40" tag="Their sale" tagTone="blue" />
      <UpdateCard initials="PT" color="#F0883E" title="Searches ordered" sub="We have ordered the local authority, water and environmental searches." date="Sat 12 Jul · 10:10" tag="Purchase" tagTone="green" />
    </div>
  );
}

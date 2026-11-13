"use client";

// /dev/solicitor-profile-preview — the real SolicitorProfileView with mock data,
// for eyeballing the Phase-B visual refinement (light/dark, rich/minimal). No
// backend, no auth. Not a feature; a review harness.

import { useEffect, useState } from "react";
import { SolicitorProfileView, type SolicitorProfileProps } from "@/components/agent/partners/SolicitorProfileView";

const RICH: SolicitorProfileProps = {
  firmId: "dev",
  firmName: "Adam Burrows Solicitors",
  recommendedStatus: "not_recommended",
  recommendedFeePence: null,
  recommendedFeeVat: "plus",
  canManageFirm: true,
  firmNote: "Best to contact Tim by email. His assistant, Sarah, handles initial contract packs.",
  activity: [
    { id: "a1", at: new Date("2026-11-12T14:12:00Z"), type: "email", title: "Email sent", detail: "Contract pack sent", propertyAddress: "1 Green Oak Crescent, Bristol, BS5 6FB", transactionId: "f1" },
    { id: "a2", at: new Date("2026-11-11T10:24:00Z"), type: "call", title: "Call logged", detail: "Spoke with Tim Adams", propertyAddress: "1 Green Oak Crescent, Bristol, BS5 6FB", transactionId: "f1" },
    { id: "a3", at: new Date("2026-11-10T09:00:00Z"), type: "note", title: "Note added", detail: "Enquiries raised", propertyAddress: "33 Milner Road, Bristol, BS7 8QA", transactionId: "f2" },
  ],
  income: { receivedPence: 125_000, pendingPence: 75_000 },
  exchange: { avgDaysToExchange: 104, exchangeCount: 6 },
  metrics: {
    draftPack: { avgDays: 12, n: 8 },
    enquiries: { avgDays: 18, n: 5 },
    exchangeRate: { pct: 87, resolved: 15, stalled: 2 },
    timings: [
      { key: "instruction-draft", label: "Instruction to draft contract pack", avgDays: 12, n: 8 },
      { key: "draft-enquiries", label: "Draft contract pack to enquiries", avgDays: 18, n: 7 },
      { key: "enquiries-exchange", label: "Enquiries to exchange", avgDays: 74, n: 6 },
    ],
    trend: [
      { month: "2026-05", avgDays: 118, n: 2 },
      { month: "2026-06", avgDays: 109, n: 3 },
      { month: "2026-07", avgDays: 121, n: 1 },
      { month: "2026-08", avgDays: 101, n: 2 },
      { month: "2026-09", avgDays: 96, n: 3 },
      { month: "2026-10", avgDays: 92, n: 2 },
    ],
  },
  canAddContact: true,
  contacts: [
    { id: "c1", name: "Tim Adams", role: "Conveyancer", phone: "0117 970 2241", email: "tim.adams@adamsburrows.co.uk", secondaryEmail: "clerk@adamsburrows.co.uk", image: null, activeFileCount: 4 },
    { id: "c2", name: "Sarah Jenkins", role: "Conveyancing Assistant", phone: null, email: "s.jenkins@adamsburrows.co.uk", secondaryEmail: null, image: null, activeFileCount: 2 },
    { id: "c3", name: "Laura Reed", role: "Team Leader", phone: "0117 970 2248", email: null, secondaryEmail: null, image: null, activeFileCount: 0 },
  ],
  files: [
    { id: "f1", propertyAddress: "1 Green Oak Crescent, Bristol, BS5 6FB", status: "active", role: "vendor", isReferral: false, createdAt: new Date("2026-09-16T09:00:00Z"), conveyancerName: "Tim Adams", photoUrl: null, stageLabel: "Enquiries" },
    { id: "f2", propertyAddress: "33 Milner Road, Bristol, BS7 8QA", status: "active", role: "purchaser", isReferral: true, createdAt: new Date("2026-10-02T09:00:00Z"), conveyancerName: "Sarah Jenkins", photoUrl: null, stageLabel: "Contract pack" },
    { id: "f3", propertyAddress: "19 Mervyn Road, Bristol, BS7 9EL", status: "on_hold", role: "vendor", isReferral: false, createdAt: new Date("2026-08-20T09:00:00Z"), conveyancerName: "Tim Adams", photoUrl: null, stageLabel: "Searches" },
    { id: "f4", propertyAddress: "72 Chesterfield Road, St Andrews, Bristol, BS6 5DH", status: "active", role: "purchaser", isReferral: false, createdAt: new Date("2026-10-28T09:00:00Z"), conveyancerName: "Tim Adams", photoUrl: null, stageLabel: "Getting started" },
    { id: "f5", propertyAddress: "8 Saville Place, Clifton, Bristol, BS8 4EJ", status: "completed", role: "vendor", isReferral: false, createdAt: new Date("2026-05-10T09:00:00Z"), conveyancerName: "Sarah Jenkins", photoUrl: null, stageLabel: null },
  ],
};

const MINIMAL: SolicitorProfileProps = {
  firmId: "dev",
  firmName: "Harpenden & Ellwood LLP",
  recommendedStatus: "recommended",
  recommendedFeePence: 25_000,
  recommendedFeeVat: "plus",
  canManageFirm: true,
  firmNote: null,
  activity: [],
  income: null,
  exchange: { avgDaysToExchange: null, exchangeCount: 0 },
  metrics: {
    draftPack: null,
    enquiries: null,
    exchangeRate: { pct: null, resolved: 1, stalled: 0 },
    timings: [],
    trend: [],
  },
  canAddContact: true,
  contacts: [
    { id: "c1", name: "Michael Ellwood", role: "Conveyancer", phone: "01727 100 201", email: "m.ellwood@harpenden-ellwood.co.uk", secondaryEmail: null, image: null, activeFileCount: 1 },
  ],
  files: [
    { id: "f1", propertyAddress: "21 Mandelyns, Northchurch, Berkhamsted, HP4 3XH", status: "active", role: "vendor", isReferral: false, createdAt: new Date("2026-11-01T09:00:00Z"), conveyancerName: "Michael Ellwood", photoUrl: null, stageLabel: "Solicitors instructed" },
  ],
};

export default function Page() {
  const [dark, setDark] = useState(false);
  const [minimal, setMinimal] = useState(false);

  useEffect(() => {
    const v = dark ? "dark" : "custom";
    document.documentElement.dataset.theme = v;
    document.querySelectorAll<HTMLElement>("[data-theme]").forEach((el) => { el.dataset.theme = v; });
    return () => { document.documentElement.dataset.theme = "custom"; };
  }, [dark]);

  const toggle = (label: string, on: boolean, onClick: () => void) => (
    <button type="button" onClick={onClick} style={{
      padding: "6px 13px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
      border: `1px solid ${on ? "var(--agent-coral)" : "var(--agent-border-default)"}`,
      background: on ? "var(--agent-coral-bg-tint)" : "var(--agent-surface-elevated)",
      color: on ? "var(--agent-coral-deep)" : "var(--agent-text-secondary)",
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "14px 20px", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)", marginRight: 2 }}>Theme</span>
        {toggle("Light", !dark, () => setDark(false))}
        {toggle("Dark", dark, () => setDark(true))}
        <span style={{ width: 12 }} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-muted)", marginRight: 2 }}>Data</span>
        {toggle("Rich firm", !minimal, () => setMinimal(false))}
        {toggle("Minimal (1 contact, no exchanges)", minimal, () => setMinimal(true))}
      </div>
      <SolicitorProfileView {...(minimal ? MINIMAL : RICH)} />
    </div>
  );
}

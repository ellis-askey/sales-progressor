"use client";

/*
 * /agent/dev/completions-redesign — sign-off harness for the Completions page
 * redesign (master-detail). Renders the REAL production components
 * (CompletionsMomentum + CompletionsWorkspace + CompletionDetailPanel) against
 * demo data, inside the real agent shell, so what you sign off is what ships.
 *
 * Switcher (top bar): Role (Agency / Internal staff / Progressor) and Dataset
 * (Populated / In-flight empty / Brand-new). Interactive states reach themselves:
 *   • click any row            → neutral shaded selection + detail panel
 *   • Sort / Filters           → the two menus (filters are active-tab only)
 *   • Mark completed           → inline "complete as of" date confirm (in panel)
 *   • Change date / Add fee     → the real popovers (progressor hides Add fee)
 *   • narrow the window < 760  → row reflows; < 560 the panel is a bottom sheet
 *   • light / dark             → the shell's own theme toggle (top bar)
 *
 * Demo data uses fictional addresses / names only (never a real person paired
 * with a real agency). Dates are relative to today so the overdue / due-soon
 * tones stay correct whenever this is opened.
 */

import { useState } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/layout/PageHeader";
import { HeroArt } from "@/components/agent/HeroArt";
import { SetupCard } from "@/components/agent/SetupCard";
import { CompletionsMomentum } from "@/components/completions/CompletionsMomentum";
import { CompletingTodayCard, type TodayFile } from "@/components/completions/CompletingTodayCard";
import { CompletionsWorkspace, type CompletedCompletionRow } from "@/components/completions/CompletionsWorkspace";
import type { CompletionFileRow } from "@/components/completions/CompletionFileRowView";

// ── demo data ────────────────────────────────────────────────────────────────
const DAY = 86_400_000;
function iso(deltaDays: number): string {
  return new Date(Date.now() + deltaDays * DAY).toISOString();
}

function activeFiles(internal: boolean): CompletionFileRow[] {
  const base = (over: Partial<CompletionFileRow>): CompletionFileRow => ({
    id: "", propertyAddress: "", purchasePrice: null, agentFeeAmount: null, agentFeePercent: null,
    agentFeeIsVatInclusive: null, purchasers: [], assignedUserName: null, exchangedAtIso: null,
    completionDateIso: null, vendorSolicitorName: null, purchaserSolicitorName: null, photoUrl: null,
    internal, chainSize: 1, instructedAtIso: null, firstTimeBuyer: null, sellingRelated: null,
    mortgageOfferExpiryIso: null, agentUserName: "Daniel Okafor", ...over,
  });
  return [
    base({ id: "c1", propertyAddress: "27 Sion Hill, Clifton, Bristol, BS8 4BA", purchasePrice: 54_000_000, agentFeeAmount: 495_000,
      purchasers: ["Robert & Anna Hale"], assignedUserName: "Priya Nair", exchangedAtIso: iso(-92), completionDateIso: iso(-80),
      vendorSolicitorName: "Caldwell Law", purchaserSolicitorName: "Harbour & Finch", chainSize: 3, instructedAtIso: iso(-150),
      firstTimeBuyer: false, sellingRelated: true, completionFundsSent: true, fundsInPlace: "yes", depositPence: 5_400_000, mortgagePence: 43_200_000 }),
    base({ id: "c2", propertyAddress: "12 Riverdene Close, Bath, BA2 3HF", purchasePrice: 42_500_000, agentFeeAmount: 425_000,
      purchasers: ["The Pattersons"], assignedUserName: "Priya Nair", exchangedAtIso: iso(-88), completionDateIso: iso(-79),
      vendorSolicitorName: "Oldfield Legal", purchaserSolicitorName: "Mallory & Co", instructedAtIso: iso(-140), completionFundsSent: true, fundsInPlace: "yes" }),
    base({ id: "c3", propertyAddress: "8 The Courtyard, Frome, BA11 2NS", purchasePrice: 37_500_000, agentFeeAmount: null,
      purchasers: ["Jade Okafor"], assignedUserName: "Tom Beckett", exchangedAtIso: iso(-84), completionDateIso: iso(-77),
      instructedAtIso: iso(-130), firstTimeBuyer: true, completionFundsSent: false, fundsInPlace: "not_yet" }),
    base({ id: "c4", propertyAddress: "19 Beeches Road, Bristol, BS9 1RT", purchasePrice: 61_000_000, agentFeeAmount: 610_000,
      purchasers: ["Mr & Mrs Osei"], assignedUserName: "Priya Nair", exchangedAtIso: iso(-70), completionDateIso: iso(-63),
      vendorSolicitorName: "Stonegate", purchaserSolicitorName: "Harbour & Finch", chainSize: 4, instructedAtIso: iso(-120), completionFundsSent: true, fundsInPlace: "yes" }),
    base({ id: "c5", propertyAddress: "4 Elm Grove, Chippenham, SN15 3LD", purchasePrice: 32_000_000, agentFeeAmount: 320_000,
      purchasers: ["Leah Brennan"], assignedUserName: "Tom Beckett", exchangedAtIso: iso(-6), completionDateIso: iso(9),
      vendorSolicitorName: "Westway Law", purchaserSolicitorName: "Quill & Bright", instructedAtIso: iso(-60),
      firstTimeBuyer: true, completionFundsSent: false, fundsInPlace: "not_yet", mortgageOfferExpiryIso: iso(40) }),
    base({ id: "c6", propertyAddress: "16 Oaklands Drive, Bristol, BS16 2QF", purchasePrice: 48_500_000, agentFeeAmount: 485_000,
      purchasers: ["The Delgados"], assignedUserName: "Priya Nair", exchangedAtIso: iso(-13), completionDateIso: iso(0),
      vendorSolicitorName: "Caldwell Law", purchaserSolicitorName: "Mallory & Co", chainSize: 2, instructedAtIso: iso(-55), completionFundsSent: true, fundsInPlace: "yes" }),
    base({ id: "c7", propertyAddress: "31 Mallard Way, Keynsham, BS31 2AP", purchasePrice: 29_800_000, agentFeeAmount: null,
      purchasers: ["Sam & Rae Idowu"], assignedUserName: "Tom Beckett", exchangedAtIso: iso(-2), completionDateIso: iso(20),
      vendorSolicitorName: "Oldfield Legal", purchaserSolicitorName: "Quill & Bright", instructedAtIso: iso(-48), firstTimeBuyer: false, completionFundsSent: false, fundsInPlace: "not_sure" }),
    base({ id: "c8", propertyAddress: "2 Priory Mews, Wells, BA5 2PD", purchasePrice: 56_000_000, agentFeeAmount: 560_000,
      purchasers: ["Nadia & Yusuf Rahman"], assignedUserName: "Priya Nair", exchangedAtIso: iso(-1), completionDateIso: null,
      vendorSolicitorName: "Stonegate", purchaserSolicitorName: "Harbour & Finch", instructedAtIso: iso(-44), completionFundsSent: true, fundsInPlace: "yes" }),
  ];
}

function completedFiles(): CompletedCompletionRow[] {
  return [
    { id: "d1", propertyAddress: "9 Lansdown View, Bath, BA1 5EG", completionDateIso: iso(-3), exchangedAtIso: iso(-17), instructedAtIso: iso(-58), purchasePrice: 45_000_000, agentFeeAmount: 450_000, agentFeePercent: null, agentFeeIsVatInclusive: false, purchasers: ["Grace Whitmore"], vendorSolicitorName: "Caldwell Law", purchaserSolicitorName: "Harbour & Finch", agentUserName: "Daniel Okafor", assignedUserName: "Priya Nair" },
    { id: "d2", propertyAddress: "44 Highfield Road, Bristol, BS6 6HB", completionDateIso: iso(-8), exchangedAtIso: iso(-21), instructedAtIso: iso(-64), purchasePrice: 51_000_000, agentFeeAmount: 510_000, agentFeePercent: null, agentFeeIsVatInclusive: false, purchasers: ["The Nortons"], vendorSolicitorName: "Oldfield Legal", purchaserSolicitorName: "Mallory & Co", agentUserName: "Sofia Marchetti", assignedUserName: "Tom Beckett" },
    { id: "d3", propertyAddress: "7 Weston Lane, Bath, BA1 4AN", completionDateIso: iso(-15), exchangedAtIso: iso(-31), instructedAtIso: iso(-72), purchasePrice: 38_000_000, agentFeeAmount: null, agentFeePercent: null, agentFeeIsVatInclusive: null, purchasers: ["Aiden Clarke"], vendorSolicitorName: "Stonegate", purchaserSolicitorName: "Quill & Bright", agentUserName: "Daniel Okafor", assignedUserName: "Priya Nair" },
    { id: "d4", propertyAddress: "22 Cotham Brow, Bristol, BS6 6AR", completionDateIso: iso(-19), exchangedAtIso: iso(-30), instructedAtIso: iso(-69), purchasePrice: 62_500_000, agentFeeAmount: 625_000, agentFeePercent: null, agentFeeIsVatInclusive: false, purchasers: ["Mr & Mrs Farrell"], vendorSolicitorName: "Caldwell Law", purchaserSolicitorName: "Harrowell & Atkins", agentUserName: "Sofia Marchetti", assignedUserName: "Tom Beckett" },
    { id: "d5", propertyAddress: "3 Mendip Close, Frome, BA11 4DZ", completionDateIso: iso(-26), exchangedAtIso: iso(-39), instructedAtIso: iso(-80), purchasePrice: 30_500_000, agentFeeAmount: 305_000, agentFeePercent: null, agentFeeIsVatInclusive: false, purchasers: ["Hollie Grant"], vendorSolicitorName: "Westway Law", purchaserSolicitorName: "Gough Thorne", agentUserName: "Daniel Okafor", assignedUserName: "Priya Nair" },
  ];
}

type Role = "agency" | "internal" | "progressor";
type Data = "populated" | "inflight_empty" | "brand_new";

const ROLE_META: Record<Role, { label: string; subtitle: string; feeLabel: string; feeNote: string; internal: boolean; hideFeeEdit: boolean }> = {
  agency:     { label: "Agency (director)", subtitle: "Exchanged files, tracking to completion.", feeLabel: "Your fees due", feeNote: "Your commission on the files you manage.", internal: false, hideFeeEdit: false },
  internal:   { label: "Internal (admin)", subtitle: "All exchanged files across every agency.", feeLabel: "TSP fees due", feeNote: "Our progression fee across every outsourced completion heading to the line.", internal: true, hideFeeEdit: false },
  progressor: { label: "Progressor", subtitle: "Your outsourced files, tracking to completion.", feeLabel: "Your fees due", feeNote: "Your rate-card fee, combined across every agency you progress.", internal: true, hideFeeEdit: true },
};

export default function CompletionsRedesignHarness() {
  const [role, setRole] = useState<Role>("agency");
  const [data, setData] = useState<Data>("populated");
  const meta = ROLE_META[role];

  const allActive = activeFiles(meta.internal).map((f) => ({ ...f, hideFeeEdit: meta.hideFeeEdit }));
  const active = data === "populated" ? allActive : [];
  const completed = data === "brand_new" ? [] : completedFiles();

  const totalValue = active.reduce((s, f) => s + (f.purchasePrice ?? 0), 0);
  const totalFees = active.reduce((s, f) => s + (f.agentFeeAmount ?? 0), 0);

  // "Completing today" command card — kept from the current page, sits above the
  // list and self-hides when nothing completes today.
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayFiles: TodayFile[] = active
    .filter((f) => f.completionDateIso && f.completionDateIso.slice(0, 10) === todayStr)
    .map((f) => ({
      id: f.id, propertyAddress: f.propertyAddress, purchasers: f.purchasers, purchasePrice: f.purchasePrice ?? null,
      chainSize: f.chainSize ?? 1, solsOk: !!f.vendorSolicitorName && !!f.purchaserSolicitorName,
      fundsOk: meta.internal ? f.completionFundsSent === true || f.fundsInPlace === "yes" : null, keysReleased: false,
    }));

  return (
    <>
      {/* ── Harness switcher (not part of the design) ───────────────────────── */}
      <div className="crh-bar">
        <span className="crh-tag">Redesign preview</span>
        <div className="crh-group">
          <span className="crh-lab">Role</span>
          {(Object.keys(ROLE_META) as Role[]).map((r) => (
            <button key={r} type="button" className={`crh-pill${role === r ? " on" : ""}`} onClick={() => setRole(r)}>{ROLE_META[r].label}</button>
          ))}
        </div>
        <div className="crh-group">
          <span className="crh-lab">Data</span>
          {([["populated", "Populated"], ["inflight_empty", "In-flight empty"], ["brand_new", "Brand-new"]] as [Data, string][]).map(([k, l]) => (
            <button key={k} type="button" className={`crh-pill${data === k ? " on" : ""}`} onClick={() => setData(k)}>{l}</button>
          ))}
        </div>
        <span className="crh-hint">Click a row → panel · narrow the window for mobile · use the shell toggle for dark</span>
      </div>

      <PageHeader title="Completions" subtitle={meta.subtitle} />

      <div className="px-4 md:px-8 py-2 md:py-4 space-y-7">
        {data === "brand_new" ? (
          <>
            <div style={{ position: "relative", overflow: "hidden", borderRadius: "var(--agent-radius-xl)", minHeight: 210, padding: "28px 30px",
              border: "1px solid var(--agent-border-subtle)",
              background: "linear-gradient(100deg, rgba(var(--agent-coral-rgb),0.14), rgba(var(--agent-coral-rgb),0.05) 52%, transparent 78%)" }}>
              <HeroArt light="/completions-hero.png" dark="/completions-hero-dark.png" maxWidth="46%" maskStart="42%" />
              <div style={{ position: "relative", maxWidth: 480 }}>
                <p style={{ margin: "0 0 8px", fontSize: "var(--agent-text-h2)", fontWeight: 600, color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)" }}>No completions yet</p>
                <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 430 }}>
                  Once files are exchanged, they&rsquo;ll appear here and you&rsquo;ll be able to track them all the way to completion.
                </p>
                <Link href="#" className="agent-btn agent-btn-primary agent-btn-md" style={{ textDecoration: "none", display: "inline-flex", width: "fit-content" }}>
                  <Plus size={16} weight="bold" /> Add your first sale
                </Link>
              </div>
            </div>
            <div>
              <p className="agent-eyebrow" style={{ marginBottom: 12 }}>While you&rsquo;re getting set up</p>
              <div className="setup-cards-3">
                <SetupCard glassId="crh-profile" label="Completions empty · Complete profile" iconSrc="/setup-profile.png" tint="coral" title="Complete your profile" desc="Add your contact details and photo so clients know who they're dealing with." cta="Set up profile" href="#" />
                <SetupCard glassId="crh-agency" label="Completions empty · Set up agency" iconSrc="/setup-agency.png" tint="blue" title="Set up your agency" desc="Add your branding and contact details to personalise the client experience." cta="Agency settings" href="#" />
                <SetupCard glassId="crh-invite" label="Completions empty · Invite team" iconSrc="/setup-invite.png" tint="green" title="Invite your team" desc="Add your negotiators so they're ready when your first sales come in." cta="Invite team" href="#" />
              </div>
            </div>
          </>
        ) : (
          <>
            <CompletionsMomentum
              completed30dCount={completed.length}
              completed30dValuePence={completed.reduce((s, f) => s + (f.purchasePrice ?? 0), 0)}
              avgExchangeToCompletionDays={active.length > 0 ? 6 : null}
              onTimePct={active.length > 0 ? 75 : null}
              inFlightCount={active.length}
              inFlightValuePence={totalValue}
              feesPence={totalFees}
              feeLabel={meta.feeLabel}
              feeNote={meta.feeNote}
            />
            {todayFiles.length > 0 && <CompletingTodayCard files={todayFiles} />}
            <CompletionsWorkspace active={active} completed={completed} internal={meta.internal} />
          </>
        )}
      </div>

      <style>{`
        .crh-bar{ position:sticky; top:0; z-index:40; display:flex; align-items:center; gap:16px; flex-wrap:wrap;
          margin:0 0 4px; padding:10px 16px; background:var(--agent-surface-elevated, rgba(255,255,255,0.7));
          -webkit-backdrop-filter:blur(18px); backdrop-filter:blur(18px); border-bottom:0.5px solid var(--agent-border-subtle); }
        .crh-tag{ font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; color:var(--agent-coral-deep); }
        .crh-group{ display:inline-flex; align-items:center; gap:5px; }
        .crh-lab{ font-size:10.5px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; color:var(--agent-text-muted); margin-right:2px; }
        .crh-pill{ border:1px solid var(--agent-border-default); background:var(--agent-surface-elevated,#fff); cursor:pointer; font-family:inherit;
          font-size:12px; font-weight:600; color:var(--agent-text-secondary); padding:5px 10px; border-radius:8px; }
        .crh-pill:hover{ border-color:var(--agent-border-strong); color:var(--agent-text-primary); }
        .crh-pill.on{ border-color:var(--agent-coral); background:rgba(var(--agent-coral-rgb),0.08); color:var(--agent-coral-deep); }
        .crh-hint{ font-size:11px; color:var(--agent-text-muted); margin-left:auto; }
      `}</style>
    </>
  );
}

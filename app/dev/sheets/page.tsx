// /dev/sheets — review gallery for every modal + drawer on the agent
// file-detail surface (Phase 3 Surface 1).
//
// Each card mounts one component on-demand with realistic mock data so
// the founder can spot-check chrome + behaviour without having to
// navigate the live system to find each one. Mirrors Cadence's
// /dev/sheets pattern.
//
// 9 migrated (Wave B: Modal/Drawer primitive consumers) + 3
// grandfathered (RelistFileModal, ReconciliationDrawer,
// EditSaleDetailsDrawer - bespoke implementations Law-19'd in PLAN).
//
// Blocked in production at the page level. Theme + aurora backdrop
// come from the sheets/ layout.
"use client";

import Link from "next/link";
import { notFound, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

// Wave B migrated (Modal/Drawer primitive consumers)
import { UndoMilestoneModal } from "@/components/milestones/UndoMilestoneModal";
import { AddBrokerModal } from "@/components/brokers/AddBrokerModal";
import { AddFirmModal } from "@/components/solicitors/AddFirmModal";
import { AutomationStopModal } from "@/components/transaction/AutomationStopModal";
import { SwitchServiceTypeModal } from "@/components/transaction/SwitchServiceTypeModal";
import { ClaimWelcomeModal } from "@/components/transaction/ClaimWelcomeModal";
import { MortgageModal } from "@/components/milestones/MortgageModal";
import { SurveyNrConfirmModal } from "@/components/milestones/SurveyNrConfirmModal";
import { ArchivedRoundDrawer } from "@/components/transaction/ArchivedRoundDrawer";

// Phase 3 Surface 1 grandfathers (bespoke - kept for visual review)
import { RelistFileModal } from "@/components/transaction/RelistFileModal";
import { ReconciliationDrawer } from "@/components/milestones/ReconciliationDrawer";
import { EditSaleDetailsDrawer } from "@/components/transaction/EditSaleDetailsDrawer";

import type { UndoImpact } from "@/lib/services/milestones";

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_UNDO_NO_CASCADE: UndoImpact = {
  cascade: [],
  currentPercent: 64,
  targetOnlyPercent: 55,
  cascadePercent: 55,
};

const MOCK_UNDO_WITH_CASCADE: UndoImpact = {
  cascade: [
    { id: "1", code: "PM12", name: "Searches received", side: "purchaser", reconciledAtExchange: false },
    { id: "2", code: "PM13", name: "Searches reviewed", side: "purchaser", reconciledAtExchange: false },
    { id: "3", code: "PM14", name: "Questions raised on searches", side: "purchaser", reconciledAtExchange: true },
    { id: "4", code: "PM15", name: "Mortgage offer issued", side: "purchaser", reconciledAtExchange: false },
    { id: "5", code: "PM16", name: "Contracts signed", side: "purchaser", reconciledAtExchange: true },
    { id: "6", code: "PM17", name: "Deposit transferred", side: "purchaser", reconciledAtExchange: false },
  ],
  currentPercent: 82,
  targetOnlyPercent: 76,
  cascadePercent: 54,
};

const MOCK_RECON_OUTSTANDING = [
  { id: "vm-5", code: "VM5", name: "Title pack ready", side: "vendor", eventDateRequired: false },
  { id: "vm-12", code: "VM12", name: "Searches answered", side: "vendor", eventDateRequired: true },
  { id: "pm-13", code: "PM13", name: "Survey received", side: "purchaser", eventDateRequired: true },
];

const MOCK_RECOMMENDED_FIRMS = [
  { id: "firm-1", name: "Carter & Wells Solicitors", defaultReferralFeePence: 30000 },
  { id: "firm-2", name: "Holman Howe LLP", defaultReferralFeePence: 25000 },
];

const MOCK_ARCHIVED_ROUNDS = [
  { id: "round-2", roundNumber: 2 },
  { id: "round-1", roundNumber: 1 },
];

// ── Page ─────────────────────────────────────────────────────────────────

type OpenName =
  | null
  | "undo-no-cascade"
  | "undo-with-cascade"
  | "add-broker"
  | "add-firm-free"
  | "add-firm-lock"
  | "automation-stop"
  | "switch-to-outsourced"
  | "switch-to-self"
  | "mortgage"
  | "survey-nr"
  | "archived-round"
  | "relist"
  | "reconciliation"
  | "edit-sale-details";

export default function DevSheetsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const router = useRouter();
  const params = useSearchParams();
  const [openName, setOpenName] = useState<OpenName>(null);
  const [claimKey, setClaimKey] = useState(0);

  const close = () => setOpenName(null);

  // ClaimWelcomeModal triggers via ?newUser=1 then router.replace-strips
  // the param. We force-remount the modal each time the user clicks Open
  // so its self-mount useEffect re-fires with the new URL.
  function openClaim() {
    setClaimKey((k) => k + 1);
    router.push("/dev/sheets?newUser=1");
  }

  return (
    <main style={{ minHeight: "100vh", padding: "48px 32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 40 }}>
        <header>
          <Link href="/dev/gallery" style={{ fontSize: 13, color: "var(--agent-text-muted)", textDecoration: "none" }}>
            ← Primitive gallery
          </Link>
          <h1 style={{
            margin: "8px 0 0",
            fontSize: 32,
            fontWeight: 700,
            color: "var(--agent-text-primary)",
            letterSpacing: "var(--agent-tracking-tight)",
          }}>
            File-detail modals + drawers
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 15, color: "var(--agent-text-secondary)", lineHeight: 1.6, maxWidth: 740 }}>
            Every modal and drawer on the agent file-detail surface, mounted on-demand with mock data. Click <strong>Open</strong> on a card to inspect chrome and behaviour without having to find the trigger in the live app. 9 migrated to the canonical Modal / Drawer primitives in Wave B; 3 grandfathered (bespoke) at the bottom.
          </p>
        </header>

        <Section
          title="Migrated to canonical Modal / Drawer (Wave B)"
          subtitle="Modal + Drawer primitives provide createPortal, backdrop, Escape, scroll lock, focus management. Chrome shifted to MODAL_DRAWER_SYSTEM canonical (16px radius, 2px coral accent, solid white, inline ghost X)."
        >
          <Grid>
            <Card
              title="UndoMilestoneModal — no cascade"
              path="components/milestones/UndoMilestoneModal.tsx"
              note="Simple confirm. Backdrop click + Escape don't dismiss (must Cancel or Undo)."
              onOpen={() => setOpenName("undo-no-cascade")}
            />
            <Card
              title="UndoMilestoneModal — with cascade"
              path="components/milestones/UndoMilestoneModal.tsx"
              note="Two-option radio picker with collapsible cascade list (Show N more)."
              onOpen={() => setOpenName("undo-with-cascade")}
            />
            <Card
              title="AddBrokerModal"
              path="components/brokers/AddBrokerModal.tsx"
              note="zLayer='deep' (=2000) for nesting over RelistFileModal. Auto-selects prefilled name."
              onOpen={() => setOpenName("add-broker")}
            />
            <Card
              title="AddFirmModal — new firm"
              path="components/solicitors/AddFirmModal.tsx"
              note="4-field validate() gate. Per-field error helpers."
              onOpen={() => setOpenName("add-firm-free")}
            />
            <Card
              title="AddFirmModal — lockFirm (add handler)"
              path="components/solicitors/AddFirmModal.tsx"
              note="Firm field readonly. Initial focus skips to handler name input."
              onOpen={() => setOpenName("add-firm-lock")}
            />
            <Card
              title="AutomationStopModal"
              path="components/transaction/AutomationStopModal.tsx"
              note="Two-step (choose → hold-date). Escape now always closes (canonical-shift from step-back)."
              onOpen={() => setOpenName("automation-stop")}
            />
            <Card
              title="SwitchServiceTypeModal — to outsourced"
              path="components/transaction/SwitchServiceTypeModal.tsx"
              note="Admin-only. safeClose() blocks Escape / X / backdrop while server action in flight."
              onOpen={() => setOpenName("switch-to-outsourced")}
            />
            <Card
              title="SwitchServiceTypeModal — to self-progress"
              path="components/transaction/SwitchServiceTypeModal.tsx"
              note="Direction-aware copy + confirm label."
              onOpen={() => setOpenName("switch-to-self")}
            />
            <Card
              title="ClaimWelcomeModal"
              path="components/transaction/ClaimWelcomeModal.tsx"
              note="Self-mounts via ?newUser=1 URL param. Open button navigates to that URL and force-remounts."
              onOpen={openClaim}
            />
            <Card
              title="MortgageModal"
              path="components/milestones/MortgageModal.tsx"
              note="Three-button must-choose (showCloseButton + dismissOnBackdrop both false). size='sm'."
              onOpen={() => setOpenName("mortgage")}
            />
            <Card
              title="SurveyNrConfirmModal"
              path="components/milestones/SurveyNrConfirmModal.tsx"
              note="Destructive confirmation. Cancel keeps inline hover swap (preserved grandfather per PLAN)."
              onOpen={() => setOpenName("survey-nr")}
            />
            <Card
              title="ArchivedRoundDrawer (Drawer primitive)"
              path="components/transaction/ArchivedRoundDrawer.tsx"
              note="Read-only drawer. Data fetch will fail (no backend) — you'll see the error state."
              onOpen={() => setOpenName("archived-round")}
            />
          </Grid>
        </Section>

        <Section
          title="Grandfathered — bespoke implementations (Law 19)"
          subtitle="Migration risk too high to bundle into Phase 3 Surface 1. Filed in POLISH_TBD with 2026-09-26 quarterly review. Included here for visual reference only."
        >
          <Grid>
            <Card
              title="RelistFileModal"
              path="components/transaction/RelistFileModal.tsx"
              note="Multi-stage relist form. Branching chain vs no-chain + onward-sale stub. Submit will 4xx — review form chrome only."
              onOpen={() => setOpenName("relist")}
            />
            <Card
              title="ReconciliationDrawer (exchange flow)"
              path="components/milestones/ReconciliationDrawer.tsx"
              note="Per-milestone reconcile checkbox + commit-all rollback. Confirm wired to console.log."
              onOpen={() => setOpenName("reconciliation")}
            />
            <Card
              title="EditSaleDetailsDrawer"
              path="components/transaction/EditSaleDetailsDrawer.tsx"
              note="Per-section unsaved-state with three-option close prompt. Save calls will 4xx — review form chrome only."
              onOpen={() => setOpenName("edit-sale-details")}
            />
          </Grid>
        </Section>
      </div>

      {/* ── Modal/Drawer mounts ──────────────────────────────────────────── */}

      {openName === "undo-no-cascade" && (
        <UndoMilestoneModal
          milestoneName="Buyer's solicitor instructed"
          milestoneId="demo-1"
          undoData={MOCK_UNDO_NO_CASCADE}
          isPending={false}
          onConfirm={close}
          onCancel={close}
        />
      )}

      {openName === "undo-with-cascade" && (
        <UndoMilestoneModal
          milestoneName="Searches received"
          milestoneId="demo-2"
          undoData={MOCK_UNDO_WITH_CASCADE}
          isPending={false}
          onConfirm={close}
          onCancel={close}
        />
      )}

      {openName === "add-broker" && (
        <AddBrokerModal
          prefillName="Bright Future Mortgages"
          onClose={close}
          onCreated={close}
        />
      )}

      {openName === "add-firm-free" && (
        <AddFirmModal
          prefillName="Carter & Wells Solicitors"
          onClose={close}
          onCreated={close}
        />
      )}

      {openName === "add-firm-lock" && (
        <AddFirmModal
          prefillName="Holman Howe LLP"
          onClose={close}
          onCreated={close}
          lockFirm
        />
      )}

      {openName === "automation-stop" && (
        <AutomationStopModal
          onPick={close}
          onClose={close}
          isPending={false}
        />
      )}

      <SwitchServiceTypeModal
        open={openName === "switch-to-outsourced"}
        transactionId="demo-tx-1"
        current="self_managed"
        onClose={close}
      />
      <SwitchServiceTypeModal
        open={openName === "switch-to-self"}
        transactionId="demo-tx-2"
        current="outsourced"
        onClose={close}
      />

      {claimKey > 0 && (
        <ClaimWelcomeModal
          key={claimKey}
          address="14 Example Lane, London"
          originatorAgency="Example Estate Agency"
        />
      )}

      {openName === "mortgage" && (
        <MortgageModal
          onConfirmMortgage={close}
          onConfirmReinstate={close}
          onCancel={close}
        />
      )}

      {openName === "survey-nr" && (
        <SurveyNrConfirmModal
          onConfirm={close}
          onCancel={close}
        />
      )}

      <ArchivedRoundDrawer
        open={openName === "archived-round"}
        transactionId="demo-tx-3"
        archivedRounds={MOCK_ARCHIVED_ROUNDS}
        onClose={close}
      />

      <RelistFileModal
        open={openName === "relist"}
        transactionId="demo-tx-4"
        previousPurchasePrice={47500000}
        inChain
        onClose={close}
      />

      {openName === "reconciliation" && (
        <ReconciliationDrawer
          isExchangeFlow
          outstanding={MOCK_RECON_OUTSTANDING}
          initialEventDate="2026-07-15"
          onConfirm={(eventDate, ids, dates, completionDate) => {
            console.log("[dev/sheets] ReconciliationDrawer confirm", { eventDate, ids, dates, completionDate });
            close();
          }}
          onCancel={close}
        />
      )}

      {openName === "edit-sale-details" && (
        <EditSaleDetailsDrawer
          transactionId="demo-tx-5"
          propertyAddress="14 Example Lane, London"
          tenure="freehold"
          purchaseType="mortgage"
          isShareOfFreehold={false}
          purchasePrice={47500000}
          agentFeeAmount={null}
          agentFeePercent={120}
          agentFeeIsVatInclusive={false}
          referralFee={30000}
          referredFirmName="Carter & Wells Solicitors"
          referredFirmId="firm-1"
          recommendedFirms={MOCK_RECOMMENDED_FIRMS}
          overridePredictedDate={null}
          predictedExchangeDate={null}
          completionDate={null}
          exchangeConfirmed={false}
          onClose={close}
        />
      )}

      {/* Acknowledge useSearchParams use so ESLint doesn't flag it. */}
      {params && null}
    </main>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <h2 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 700,
          color: "var(--agent-text-primary)",
        }}>
          {title}
        </h2>
        <p style={{
          margin: "4px 0 0",
          fontSize: 13,
          color: "var(--agent-text-muted)",
          lineHeight: 1.55,
          maxWidth: 740,
        }}>
          {subtitle}
        </p>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: 12,
    }}>
      {children}
    </div>
  );
}

function Card({ title, path, note, onOpen }: { title: string; path: string; note: string; onOpen: () => void }) {
  return (
    <div className="glass-card rounded-[12px]" style={{
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minHeight: 160,
    }}>
      <div style={{ flex: 1 }}>
        <p style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "var(--agent-text-primary)",
          lineHeight: 1.35,
        }}>
          {title}
        </p>
        <p style={{
          margin: "4px 0 0",
          fontSize: 10,
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          color: "var(--agent-text-muted)",
          wordBreak: "break-all",
        }}>
          {path}
        </p>
        <p style={{
          margin: "10px 0 0",
          fontSize: 11,
          color: "var(--agent-text-secondary)",
          lineHeight: 1.5,
        }}>
          {note}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="agent-btn agent-btn-sm agent-btn-primary"
        style={{ alignSelf: "flex-start" }}
      >
        Open
      </button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ChainSection, type InMemoryStub } from "@/components/chain/ChainSection";
import { LinkCard, ChainConnector } from "@/components/chain/LinkCard";
import { AddNodeDrawer } from "@/components/chain/AddNodeDrawer";
import { getChainLinkStatus, chainLinkStatusLabel } from "@/lib/chain/status";
import type { ChainLinkV2 } from "@/lib/services/chains";

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
  .cw-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
    color: rgba(30,45,74,.45); margin: 52px 0 6px; padding: 9px 16px;
    background: rgba(30,45,74,.05); border-left: 3px solid rgba(30,45,74,.2);
    border-radius: 0 6px 6px 0; font-family: monospace;
  }
  .cw-sub {
    font-size: 11px; color: rgba(30,45,74,.4); font-family: monospace;
    margin: 0 0 18px; padding-left: 2px;
  }
  .cw-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 16px; }
  .cw-bar-label { font-size: 11px; color: rgba(30,45,74,.45); font-family: monospace; white-space: nowrap; }
  .cw-pill {
    padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(30,45,74,.15);
    font-size: 11px; font-weight: 500; cursor: pointer; background: white; color: rgba(30,45,74,.55);
    transition: all 120ms; line-height: 1.4;
  }
  .cw-pill.on { background: #1E2D4A; color: white; border-color: #1E2D4A; }

  /* gap callout */
  .cw-gap {
    border: 1.5px dashed rgba(239,68,68,.35); border-radius: 10px;
    padding: 12px 14px; background: rgba(239,68,68,.04);
    font-family: monospace;
  }
  .cw-gap-title { font-size: 11px; font-weight: 700; color: #dc2626; margin: 0 0 4px; }
  .cw-gap-body { font-size: 11px; color: rgba(30,45,74,.55); margin: 0; line-height: 1.6; }

  /* inline drawer panel */
  .cw-drawer {
    width: 100%; max-width: 440px; border-radius: 14px;
    background: var(--agent-surface-elevated);
    border: 0.5px solid rgba(0,0,0,0.08);
    box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    overflow: hidden;
  }
  .cw-drawer-header {
    display: flex; align-items: center; height: 56px; padding: 0 20px;
    border-bottom: 1px solid rgba(0,0,0,0.08); gap: 12px;
  }
  .cw-drawer-body { padding: 20px 24px; }

  /* claim mockup */
  .cw-claim-shell {
    border-radius: 14px; border: 1px solid #e2e8f0; overflow: hidden;
    max-width: 480px; box-shadow: 0 2px 12px rgba(0,0,0,0.06);
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* status mockup */
  .cw-status-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600;
  }
  .cw-dropdown {
    background: rgba(255,255,255,0.92); backdrop-filter: blur(20px);
    border: 0.5px solid rgba(255,255,255,.60); border-radius: 12px; overflow: hidden;
    box-shadow: 0 8px 40px rgba(0,0,0,0.14); min-width: 140px;
  }
  .cw-dropdown-item {
    padding: 10px 16px; font-size: 14px; color: rgba(15,23,42,.7);
    display: flex; align-items: center; gap: 8px;
  }
  .cw-dropdown-item.active { color: rgba(15,23,42,.9); font-weight: 600; }
  .cw-withdrawal-modal {
    background: white; border-radius: 16px; padding: 24px; max-width: 340px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }

  .cw-email-preview {
    border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 13px; max-width: 480px;
  }
`;

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_USER_ID = "user_originator";
const MOCK_USER2_ID = "user_chainmate";

function mockLink(overrides: Partial<ChainLinkV2> & { id: string; position: number }): ChainLinkV2 {
  return {
    claimedByUserId: null,
    createdByUserId: MOCK_USER_ID,
    transactionId: null,
    claimedAt: null,
    stubPropertyAddress: null,
    stubAgencyName: null,
    stubAgentEmail: null,
    stubAgentName: null,
    stubAgentPhone: null,
    stubNotes: null,
    inviteStatus: "NOT_SENT",
    inviteSentAt: null,
    inviteBouncedAt: null,
    inviteDeclinedAt: null,
    inviteResendCount: 0,
    withdrawalStatus: null,
    withdrawalRespondedAt: null,
    transaction: null,
    progressPercent: null,
    predictedExchangeDate: null,
    isEarlyEstimate: false,
    stuckMilestoneLabel: null,
    claimedBy: null,
    createdBy: { id: MOCK_USER_ID, name: "Sarah Hartwell" },
    ...overrides,
  };
}

// Healthy chain — 4 links
const HEALTHY_LINKS: ChainLinkV2[] = [
  mockLink({
    id: "link_a", position: 0,
    stubPropertyAddress: "14 Westfield Avenue, Harpenden, AL5 3PQ",
    stubAgencyName: "Connells",
    inviteStatus: "INVITED",
    inviteSentAt: new Date(Date.now() - 1000 * 60 * 60 * 18),
  }),
  mockLink({
    id: "link_b", position: 1,
    transactionId: "txn_b",
    claimedByUserId: MOCK_USER_ID,
    claimedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
    inviteStatus: "CLAIMED",
    claimedBy: { id: MOCK_USER_ID, name: "Sarah Hartwell", firmName: "Hartwell & Partners" },
    transaction: { id: "txn_b", propertyAddress: "7 Orchard Close, St Albans, AL1 2HX", status: "active", agencyId: "agency_1", purchasePrice: 62500000, photoUrl: null },
    progressPercent: 32,
  }),
  mockLink({
    id: "link_c", position: 2,
    transactionId: "txn_c",
    claimedByUserId: MOCK_USER2_ID,
    claimedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    inviteStatus: "CLAIMED",
    claimedBy: { id: MOCK_USER2_ID, name: "James Okafor", firmName: "Oakwood Estate Agents" },
    transaction: { id: "txn_c", propertyAddress: "22 Birchwood Lane, Harpenden, AL5 1DP", status: "active", agencyId: "agency_2", purchasePrice: 48000000, photoUrl: null },
    progressPercent: 21,
  }),
  mockLink({
    id: "link_d", position: 3,
    stubPropertyAddress: "5 The Green, Redbourn, AL3 7DB",
    stubAgencyName: "Putterills",
    stubAgentEmail: "agent@putterills.co.uk",
    inviteStatus: "NOT_SENT",
    createdByUserId: MOCK_USER2_ID,
    createdBy: { id: MOCK_USER2_ID, name: "James Okafor" },
  }),
];

// Broken chain — same but link_c is withdrawn
const BROKEN_LINKS: ChainLinkV2[] = HEALTHY_LINKS.map((l) =>
  l.id === "link_c"
    ? { ...l, transaction: { ...l.transaction!, status: "withdrawn" } }
    : l,
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ id, title, sub }: { id: string; title: string; sub?: string }) {
  return (
    <>
      <div id={id} className="cw-label">{title}</div>
      {sub && <p className="cw-sub">{sub}</p>}
    </>
  );
}

function GapCallout({ gap, title, body }: { gap: string; title: string; body: string }) {
  return (
    <div className="cw-gap">
      <p className="cw-gap-title">{gap} — {title}</p>
      <p className="cw-gap-body">{body}</p>
    </div>
  );
}

function Pill({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={`cw-pill${on ? " on" : ""}`} onClick={onClick}>{label}</button>
  );
}

// Inline ChainDrawer panel (no portal, no API calls — uses LinkCard directly)
function DrawerPanel({
  links,
  currentUserId,
  title,
  onOpenAddNode,
}: {
  links: ChainLinkV2[];
  currentUserId: string;
  title?: string;
  onOpenAddNode?: () => void;
}) {
  const isBroken = links.some((l) => l.transaction?.status === "withdrawn");

  return (
    <div className="cw-drawer">
      <div className="cw-drawer-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            {title ?? "Chain progress"}
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 11, color: "var(--agent-text-secondary)" }}>
            Every linked sale, in one place
          </p>
        </div>
        <svg style={{ color: "var(--agent-text-muted)", width: 14, height: 14 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <div className="cw-drawer-body">
        {isBroken && (
          <div style={{
            marginBottom: 12, padding: "10px 12px",
            background: "rgba(239,68,68,0.08)", border: "0.5px solid rgba(239,68,68,0.2)",
            borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>⚠</span>
            <p style={{ fontSize: 12, color: "var(--agent-danger)", margin: 0, lineHeight: 1.5 }}>
              A sale in this chain has withdrawn.
            </p>
          </div>
        )}
        <div className="space-y-0">
          {onOpenAddNode && (
            <button
              onClick={onOpenAddNode}
              className="w-full text-xs text-slate-900/40 agent-hover-link border border-dashed border-white/30 rounded-xl py-2 mb-3 transition-colors"
            >
              + Add sale above
            </button>
          )}
          {links.map((link, i) => (
            <div key={link.id}>
              <LinkCard
                link={link}
                totalLinks={links.length}
                currentUserId={currentUserId}
                isYourFile={
                  link.claimedByUserId === currentUserId ||
                  (link.transactionId !== null && link.createdByUserId === currentUserId)
                }
              />
              {i < links.length - 1 && <ChainConnector />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Static claim landing mockup
function ClaimLandingMockup() {
  const chainLinks = [
    { id: "a", transactionId: "t1", address: "14 Westfield Avenue, Harpenden", agency: "Connells", isStub: false, isMine: false },
    { id: "b", transactionId: null, address: "7 Orchard Close, St Albans", agency: null, isStub: true, isMine: true },
    { id: "c", transactionId: "t2", address: "22 Birchwood Lane, Harpenden", agency: "Oakwood Estate Agents", isStub: false, isMine: false },
  ];
  return (
    <div className="cw-claim-shell">
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#FF6B4A" }}>The Sales Progressor</span>
      </div>
      <div style={{ background: "#f8fafc", padding: "32px 24px 40px" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1d29", margin: "0 0 6px", textAlign: "center" }}>
          You've been invited to join this chain
        </h1>
        <p style={{ fontSize: 13, color: "#8b91a3", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
          Sarah Hartwell at Hartwell &amp; Partners has linked your sale to theirs
        </p>
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "18px", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid #f1f5f9" }}>
            <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8b91a3" }}>Your position</p>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1d29" }}>#2 of 3 in this chain</p>
          </div>
          <div>
            {chainLinks.map((cl, i) => (
              <div key={cl.id}>
                {i > 0 && <div style={{ display: "flex", justifyContent: "center", height: 12 }}><div style={{ width: 1, background: "#e2e8f0" }} /></div>}
                {cl.isMine ? (
                  <div style={{ border: "2px solid #FF6B4A", borderRadius: 10, padding: "10px 13px", background: "#FFF8F6" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1d29" }}>{cl.address}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#FF6B4A" }}>Your sale</span>
                      <span style={{ fontSize: 11, color: "#8b91a3" }}>· Claim to view progress</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ border: "1px solid #d1fae5", borderRadius: 10, padding: "10px 13px", background: "#f0fdf4" }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1a1d29" }}>{cl.address}</p>
                    {cl.agency && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#4a5162" }}>{cl.agency}</p>}
                    <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, color: "#059669", background: "#d1fae5", padding: "2px 8px", borderRadius: 99 }}>Tracking</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#8b91a3" }}>
              Invited by: <strong style={{ color: "#4a5162" }}>Sarah Hartwell</strong> — Hartwell &amp; Partners
            </p>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#4a5162", textAlign: "center" }}>By joining, you'll be able to:</p>
          {[
            "View the full chain structure",
            "See live milestone progress on every sale",
            "Understand what's holding the chain up",
            "Update your own file and keep other agents informed",
          ].map((b) => (
            <div key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#10b981", fontWeight: 700, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: "#4a5162" }}>{b}</span>
            </div>
          ))}
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8b91a3", textAlign: "center" }}>Free to use · Takes 30 seconds</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <div style={{ width: "100%", textAlign: "center", background: "#FF6B4A", color: "#fff", padding: "13px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, boxSizing: "border-box" as const }}>
            Claim this sale →
          </div>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>This isn't mine — decline invite</span>
        </div>
      </div>
    </div>
  );
}

// Static withdrawal modal (visual-only)
function WithdrawalModalMockup({ selectedReason }: { selectedReason: string }) {
  const reasons = [
    "Buyer withdrew", "Seller withdrew", "Chain broke",
    "Mortgage or finance issue", "Survey issues",
    "Gazundering (price chipped)", "Gazumping",
    "Solicitor delays", "Personal circumstances changed", "Other",
  ];
  return (
    <div className="cw-withdrawal-modal">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg style={{ width: 16, height: 16, color: "#ef4444" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#0f172a" }}>Mark as withdrawn</p>
          <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>Record why this sale fell through</p>
        </div>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reason</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 16 }}>
        {reasons.map((r) => (
          <div
            key={r}
            style={{
              padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1px solid",
              borderColor: r === selectedReason ? "#fca5a5" : "#e2e8f0",
              background: r === selectedReason ? "#fef2f2" : "transparent",
              color: r === selectedReason ? "#b91c1c" : "#334155",
              fontWeight: r === selectedReason ? 600 : 400,
            }}
          >
            {r}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, padding: "9px 0", textAlign: "center", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 14, color: "#64748b" }}>Cancel</div>
        <div style={{ flex: 1, padding: "9px 0", textAlign: "center", background: "#ef4444", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#fff" }}>Confirm withdrawal</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChainWalkthroughPage() {
  // Global toggles
  const [viewAs, setViewAs] = useState<"originator" | "chainmate">("originator");
  const [chainState, setChainState] = useState<"healthy" | "withdrawn">("healthy");

  // Section 1 — Chain creation state
  const [chainExpanded, setChainExpanded] = useState(false);
  const [chainStubs, setChainStubs] = useState<InMemoryStub[]>([]);

  // Section 2 — AddNodeDrawer
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeDir, setAddNodeDir] = useState<"above" | "below">("below");

  // Section 5 — withdrawal modal state
  const [withdrawReason, setWithdrawReason] = useState("Chain broke");
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(true);

  const currentUserId = viewAs === "originator" ? MOCK_USER_ID : MOCK_USER2_ID;
  const links = chainState === "healthy" ? HEALTHY_LINKS : BROKEN_LINKS;

  return (
    <>
      <style>{CSS}</style>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 80px" }}>
        <PageHeader
          title="Chain walkthrough"
          subtitle="Chain system · v1 complete · All Phase 1 features shipped"
        />

        {/* Global controls */}
        <div style={{ padding: "14px 16px", background: "rgba(30,45,74,.04)", borderRadius: 10, marginBottom: 8 }}>
          <div className="cw-bar" style={{ marginBottom: 8 }}>
            <span className="cw-bar-label">View as</span>
            <Pill label="Originator" on={viewAs === "originator"} onClick={() => setViewAs("originator")} />
            <Pill label="Claimed chain-mate" on={viewAs === "chainmate"} onClick={() => setViewAs("chainmate")} />
          </div>
          <div className="cw-bar" style={{ marginBottom: 0 }}>
            <span className="cw-bar-label">Chain state</span>
            <Pill label="Healthy" on={chainState === "healthy"} onClick={() => setChainState("healthy")} />
            <Pill label="With withdrawal" on={chainState === "withdrawn"} onClick={() => setChainState("withdrawn")} />
          </div>
        </div>
        <p className="cw-sub" style={{ marginBottom: 0 }}>These toggles apply to sections 2 and 5.</p>

        {/* ── SECTION 1: CHAIN CREATION ─────────────────────────────────────── */}
        <SectionLabel
          id="s1"
          title="§1 · Chain creation — new-sale form"
          sub="ChainSection component. Fully interactive — add, edit, remove stubs."
        />

        <ChainSection
          expanded={chainExpanded}
          onExpand={() => setChainExpanded(true)}
          onCollapse={() => { setChainExpanded(false); setChainStubs([]); }}
          stubs={chainStubs}
          originatorAddress="7 Orchard Close, St Albans, AL1 2HX"
          onAddStub={(stub) => setChainStubs((prev) => [...prev, stub])}
          onEditStub={(id, data) =>
            setChainStubs((prev) => prev.map((s) => s.id === id ? { ...s, ...data } : s))
          }
          onRemoveStub={(id) => setChainStubs((prev) => prev.filter((s) => s.id !== id))}
        />

        {/* ── SECTION 2: CHAIN DRAWER STATES ───────────────────────────────── */}
        <SectionLabel
          id="s2"
          title="§2 · Existing chain — ChainDrawer"
          sub="Uses real LinkCard and ChainConnector. Toggle 'Chain state' above to switch between healthy and withdrawn views."
        />

        <DrawerPanel
          links={links}
          currentUserId={currentUserId}
          onOpenAddNode={viewAs === "originator" ? () => { setAddNodeDir("above"); setAddNodeOpen(true); } : undefined}
        />

        {chainState === "withdrawn" && (
          <p style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(30,45,74,.4)", marginTop: 8 }}>
            ↑ link_c (22 Birchwood Lane) has status=&quot;withdrawn&quot; — banner + Withdrawn tag rendered.
          </p>
        )}

        {/* ── SECTION 3: INVITE FLOW ────────────────────────────────────────── */}
        <SectionLabel
          id="s3"
          title="§3 · Invite flow — AddNodeDrawer"
          sub="Trigger opens the real AddNodeDrawer. In-memory mode (no API call)."
        />

        <div className="cw-bar">
          <button
            onClick={() => { setAddNodeDir("above"); setAddNodeOpen(true); }}
            className="px-4 py-2 text-sm font-medium rounded-xl agent-btn-color-primary transition-colors"
          >
            + Add sale above
          </button>
          <button
            onClick={() => { setAddNodeDir("below"); setAddNodeOpen(true); }}
            className="px-4 py-2 text-sm font-medium rounded-xl border border-white/50 bg-white/30 hover:bg-white/60 text-slate-900/70 transition-all"
          >
            + Add sale below
          </button>
        </div>

        {addNodeOpen && (
          <AddNodeDrawer
            direction={addNodeDir}
            onSaveToMemory={(_data, _dir) => setAddNodeOpen(false)}
            onClose={() => setAddNodeOpen(false)}
            onSaved={() => setAddNodeOpen(false)}
          />
        )}

        <div className="cw-sub" style={{ margin: "16px 0 12px" }}>Invite email — what external agents receive</div>
        <div className="cw-email-preview">
          <div style={{ background: "#1a1d29", padding: "14px 20px" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#FF6B4A" }}>The Sales Progressor</span>
          </div>
          <div style={{ padding: "24px 20px 20px", background: "#fff" }}>
            <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#1a1d29" }}>
              You've been invited to join a property chain
            </p>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "#4a5162", lineHeight: 1.6 }}>
              Sarah Hartwell at Hartwell &amp; Partners is managing a sale at{" "}
              <strong>7 Orchard Close, St Albans</strong> and has identified your property{" "}
              (<strong>14 Westfield Avenue, Harpenden</strong>) as part of the same chain.
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#4a5162", lineHeight: 1.6 }}>
              By joining the chain you can share live progress updates with every agent involved,
              making it faster to identify delays and keep everything on track.
            </p>
            <div style={{ textAlign: "center", margin: "0 0 20px" }}>
              <div style={{ display: "inline-block", background: "#FF6B4A", color: "#fff", padding: "12px 32px", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
                View chain &amp; claim your sale →
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", textAlign: "center" }}>
              This link expires in 90 days · You can decline if this isn't your sale
            </p>
          </div>
        </div>

        <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#065f46", fontFamily: "monospace" }}>
            ✓ SHIPPED — Gap 3: Token expiry. 7d initial / 14d resend enforced server-side. All 5 claim routes check expiry.
          </p>
        </div>

        {/* ── SECTION 4: CLAIM FLOW ─────────────────────────────────────────── */}
        <SectionLabel
          id="s4"
          title="§4 · Claim flow — external agent journey"
          sub="Static mockup of /claim landing. Real pages require a valid invite token."
        />

        <ClaimLandingMockup />

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <p className="cw-sub" style={{ margin: 0 }}>Subsequent steps (require live token to demo):</p>
          {[
            ["/claim/signup", "New agent — registration form, then auto-claim"],
            ["/claim/login", "Existing agent — login, then redirect to /claim/confirm"],
            ["/claim/confirm", "Duplicate detection — matches existing transaction or creates new claim"],
            ["/claim/decline (route handler)", "Decline → sets inviteStatus=DECLINED, shows confirmation"],
          ].map(([route, desc]) => (
            <div key={route} style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(30,45,74,.5)", padding: "6px 10px", background: "rgba(30,45,74,.04)", borderRadius: 6 }}>
              <span style={{ color: "rgba(30,45,74,.75)", fontWeight: 700 }}>{route}</span> — {desc}
            </div>
          ))}
        </div>

        {/* ── SECTION 5: WITHDRAWAL CASCADE ────────────────────────────────── */}
        <SectionLabel
          id="s5"
          title="§5 · Withdrawal cascade"
          sub="Static mockup of the withdrawal modal + post-withdrawal chain state. Toggle 'Chain state: With withdrawal' above to see the drawer."
        />

        <div className="cw-bar" style={{ marginBottom: 16 }}>
          <span className="cw-bar-label">Pre-selected reason</span>
          {["Buyer withdrew", "Chain broke", "Survey issues"].map((r) => (
            <Pill key={r} label={r} on={withdrawReason === r} onClick={() => setWithdrawReason(r)} />
          ))}
        </div>

        <div className="cw-bar" style={{ marginBottom: 20 }}>
          <span className="cw-bar-label">Status badge + dropdown</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className="cw-status-badge" style={{ background: "rgba(234,179,8,.12)", color: "#a16207", border: "0.5px solid rgba(234,179,8,.25)" }}>
              Active
            </span>
            <svg style={{ width: 10, height: 10, color: "rgba(15,23,42,.3)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <span style={{ fontSize: 11, color: "rgba(30,45,74,.4)", fontFamily: "monospace" }}>→ opens dropdown →</span>
          <div className="cw-dropdown" style={{ display: "inline-block" }}>
            {["Active", "On hold", "Completed", "Withdrawn"].map((s) => (
              <div key={s} className={`cw-dropdown-item${s === "Active" ? " active" : ""}`} style={{ fontSize: 13 }}>{s}</div>
            ))}
          </div>
          <span style={{ fontSize: 11, color: "rgba(30,45,74,.4)", fontFamily: "monospace" }}>→ select Withdrawn →</span>
        </div>

        <div className="cw-bar" style={{ marginBottom: 8, alignItems: "flex-start" }}>
          <span className="cw-bar-label" style={{ paddingTop: 4 }}>Modal</span>
          <WithdrawalModalMockup selectedReason={withdrawReason} />
        </div>

        <div style={{ marginTop: 16 }}>
          <p className="cw-sub" style={{ margin: "0 0 10px" }}>After withdrawal — ChainDrawer state (toggle above)</p>
          {chainState === "withdrawn"
            ? <DrawerPanel links={BROKEN_LINKS} currentUserId={currentUserId} />
            : (
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(30,45,74,.4)" }}>
                Switch toggle to &quot;With withdrawal&quot; to see post-withdrawal state.
              </p>
            )
          }
        </div>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 8 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#065f46", fontFamily: "monospace" }}>
              ✓ SHIPPED — Withdrawal response picker: chain-mates now see an in-app prompt in the real ChainDrawer (Going back to market / Waiting). Status shown per-link via REMARKETING/WAITING badges on LinkCard.
            </p>
          </div>
          <GapCallout
            gap="Phase 2 — deferred"
            title="Email notifications not yet wired"
            body="ChainNotificationQueue rows are created on withdrawal (visible in DB). Email send is Phase 2 — queue processor and SendGrid template not yet built. Response tokens + /claim/withdrawal-response also deferred to when email is wired."
          />
        </div>

        {/* ── SECTION 6: GAPS ───────────────────────────────────────────────── */}
        <SectionLabel
          id="s6"
          title="§6 · Phase 1 gap status"
          sub="All Phase 1 gaps shipped. One Phase 2 item open."
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#065f46", fontFamily: "monospace" }}>✓ SHIPPED — Gap 1: Silent chain creation failure</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(30,45,74,.55)", fontFamily: "monospace", lineHeight: 1.6 }}>ChainSetupFailedBanner dismissible warning + scroll-to-chain CTA on transaction detail. chainSetupFailed=1 URL param set by NewSaleFlow on failure.</p>
          </div>
          <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#065f46", fontFamily: "monospace" }}>✓ SHIPPED — Gap 3: Invite token expiry</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(30,45,74,.55)", fontFamily: "monospace", lineHeight: 1.6 }}>7d initial / 14d resend enforced. All 5 claim routes (/claim, /claim/signup, /claim/login, /claim/confirm, /claim/decline) check inviteTokenExpiresAt.</p>
          </div>
          <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", border: "0.5px solid rgba(16,185,129,0.25)", borderRadius: 8 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#065f46", fontFamily: "monospace" }}>✓ SHIPPED — Gap 5: Decline notification</p>
            <p style={{ margin: 0, fontSize: 11, color: "rgba(30,45,74,.55)", fontFamily: "monospace", lineHeight: 1.6 }}>Amber banner in ChainDrawer when an agent declined. Dismiss calls POST /api/chain/dismiss-decline to clear chainDeclineNotificationAddress + chainDeclineNotificationAt.</p>
          </div>
          <GapCallout
            gap="Gap 6 — Phase 2"
            title="No real-time broadcast to chain-mates"
            body="Chain state changes (withdrawal, milestone updates) are not pushed to other agents in real time. Chain-mates see stale data until they manually refresh. Phase 2 scope — requires server-sent events or polling."
          />
        </div>
      </div>
    </>
  );
}

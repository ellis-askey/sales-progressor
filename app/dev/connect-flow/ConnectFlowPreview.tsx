"use client";

import { useState } from "react";
import { Handshake, ArrowRight } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { ProgressorNetworkBusiness } from "@/lib/services/progressor-network";
import { ProgressorCard } from "@/components/agent/progressor-network/ProgressorCard";
import { NetworkConnectModal } from "@/components/agent/progressor-network/connect-flow/NetworkConnectModal";
import { IncomingRequestCard } from "@/components/agent/progressor-network/connect-flow/IncomingRequestCard";
import {
  SentRequestRow,
  ConnectedProgressorRow,
  ClientAgencyRow,
} from "@/components/agent/progressor-network/connect-flow/ConnectFlowRows";

// Interactive, two-sided preview of the connect flow. Mock state only — the role
// switcher drives a single shared request so you can send it on the agency side,
// flip to the progressor side, accept/decline, and watch both reflect.

type Status = "none" | "pending" | "connected" | "declined";
type Side = "agency" | "progressor";

const AGENCY = "Boardwalk";
const PROGRESSOR = "Moves By Wright";
const MONO = "MW";

const STATE_LABEL: Record<Status, string> = {
  none: "Fresh",
  pending: "Request sent",
  connected: "Connected",
  declined: "Declined",
};

const MBW: ProgressorNetworkBusiness = {
  id: "mbw-preview",
  name: PROGRESSOR,
  kind: "Independent sales progression business",
  blurb:
    "Proactive sales progression for estate agents, from sale agreed to completion, coordinating the chain and keeping clients informed.",
  monogram: MONO,
  brandColor: "#334155",
  logoPath: null,
  availability: "accepting",
  stats: { completionRatePct: 88, exchangedFiles12mo: 24, avgTimeToExchangeWeeks: 11, teamSize: 4 },
  tags: ["Nationwide", "Chain management"],
  connectionStatus: "none",
  viaNetwork: false,
  saved: false,
};

function hint(side: Side, status: Status): string {
  if (side === "agency") {
    if (status === "none") return "Click “Request to connect” on the card to send a request.";
    if (status === "pending") return "Request sent — switch to the Progressor view to accept or decline it.";
    if (status === "connected") return "Connected. You can now hand Moves By Wright your sales.";
    return "Moves By Wright declined — you can send a fresh request.";
  }
  if (status === "pending") return "Boardwalk wants to connect. Accept or decline below.";
  if (status === "connected") return "You accepted — Boardwalk is now one of your clients.";
  if (status === "declined") return "You declined Boardwalk’s request.";
  return "No requests right now. Switch to the Agency view and send one.";
}

const SECTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--agent-text-muted)",
  margin: "0 0 10px",
};

export function ConnectFlowPreview() {
  const { toast } = useAgentToast();
  const [side, setSide] = useState<Side>("agency");
  const [status, setStatus] = useState<Status>("none");
  const [note, setNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const send = (n: string) => {
    setNote(n);
    setStatus("pending");
    setModalOpen(false);
    toast.info("Request sent", { description: `Waiting for ${PROGRESSOR} to accept.` });
  };
  const withdraw = () => {
    setStatus("none");
    toast.info("Request withdrawn");
  };
  const accept = () => {
    setStatus("connected");
    toast.success(`${AGENCY} connected`, { description: "They can now hand you sales." });
  };
  const decline = () => {
    setStatus("declined");
    toast.info("Request declined");
  };
  const reset = () => {
    setStatus("none");
    setNote("");
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 20px 72px" }}>
      <PageHeader
        title="Connect flow — preview"
        subtitle="How an agency and a progression business connect, both sides. Mock data — nothing is wired up yet."
      />

      {/* Controls */}
      <div
        className="agent-glass"
        style={{ borderRadius: "var(--agent-radius-xl)", padding: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end", margin: "18px 0 16px" }}
      >
        <div>
          <div style={SECTION}>View as</div>
          <SegmentedSwitch
            options={[
              { id: "agency", label: "Agency (Boardwalk)" },
              { id: "progressor", label: "Progressor (Moves By Wright)" },
            ]}
            value={side}
            onChange={(v) => setSide(v)}
            ariaLabel="Which side to view"
          />
        </div>
        <div>
          <div style={SECTION}>Jump to state</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["none", "pending", "connected", "declined"] as Status[]).map((s) => (
              <button
                key={s}
                type="button"
                className={`agent-btn agent-btn-${status === s ? "primary" : "secondary"} agent-btn-sm`}
                onClick={() => setStatus(s)}
              >
                {STATE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button variant="ghost" size="sm" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Contextual hint */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", marginBottom: 22, borderRadius: "var(--agent-radius-md)", background: "rgba(var(--agent-coral-rgb),0.06)", border: "1px solid rgba(var(--agent-coral-rgb),0.16)" }}
      >
        <ArrowRight size={15} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>{hint(side, status)}</p>
      </div>

      {side === "agency" ? (
        <AgencyView status={status} onRequest={() => setModalOpen(true)} onWithdraw={withdraw} />
      ) : (
        <ProgressorView status={status} note={note} onAccept={accept} onDecline={decline} />
      )}

      <NetworkConnectModal open={modalOpen} onClose={() => setModalOpen(false)} onSend={send} progressorName={PROGRESSOR} />
    </div>
  );
}

function AgencyView({ status, onRequest, onWithdraw }: { status: Status; onRequest: () => void; onWithdraw: () => void }) {
  const business: ProgressorNetworkBusiness = {
    ...MBW,
    connectionStatus: status === "connected" ? "connected" : status === "pending" ? "requested" : "none",
  };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
      <div>
        <p style={SECTION}>The network</p>
        <ProgressorCard business={business} onView={() => {}} onConnect={onRequest} onToggleSave={() => {}} />
      </div>
      <div>
        {status === "pending" && (
          <>
            <p style={SECTION}>Introductions</p>
            <SentRequestRow name={PROGRESSOR} monogram={MONO} onWithdraw={onWithdraw} />
          </>
        )}
        {status === "connected" && (
          <>
            <p style={SECTION}>My progressors</p>
            <ConnectedProgressorRow name={PROGRESSOR} monogram={MONO} />
          </>
        )}
        {status === "declined" && (
          <>
            <p style={SECTION}>Introductions</p>
            <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "16px 18px" }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                {PROGRESSOR} declined your request. You can send a fresh one from the card.
              </p>
            </div>
          </>
        )}
        {status === "none" && (
          <div className="agent-glass agent-empty-card" style={{ borderRadius: "var(--agent-radius-xl)", padding: "36px 24px", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
              Sent requests and connected progressors will show here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressorView({ status, note, onAccept, onDecline }: { status: Status; note: string; onAccept: () => void; onDecline: () => void }) {
  return (
    <div style={{ maxWidth: 620 }}>
      <p style={SECTION}>Connection requests</p>
      {status === "pending" && <IncomingRequestCard agencyName={AGENCY} note={note} onAccept={onAccept} onDecline={onDecline} />}
      {status === "connected" && (
        <>
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "14px 16px", marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
              You accepted {AGENCY}&apos;s request. They&apos;re now one of your clients and can hand you sales.
            </p>
          </div>
          <p style={SECTION}>Your clients</p>
          <ClientAgencyRow name={AGENCY} />
        </>
      )}
      {(status === "none" || status === "declined") && (
        <div className="agent-glass agent-empty-card" style={{ borderRadius: "var(--agent-radius-xl)", padding: "44px 28px" }}>
          <EmptyState
            title="No connection requests"
            description="When an agency asks to connect, it'll appear here."
            icon={<Handshake size={24} weight="regular" />}
          />
        </div>
      )}
    </div>
  );
}

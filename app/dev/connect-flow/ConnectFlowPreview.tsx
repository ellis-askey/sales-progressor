"use client";

import { useState } from "react";
import { Handshake, ArrowRight } from "@phosphor-icons/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PremiumBusinessCard } from "@/components/agent/progressor-network/connect-flow/PremiumBusinessCard";
import { BusinessProfile } from "@/components/agent/progressor-network/connect-flow/BusinessProfile";
import { NetworkConnectModal } from "@/components/agent/progressor-network/NetworkConnectModal";
import { IncomingRequestCard } from "@/components/agent/progressor-network/connect-flow/IncomingRequestCard";
import {
  SentRequestRow,
  ConnectedRelationshipCard,
  ConnectedAgencyCard,
} from "@/components/agent/progressor-network/connect-flow/ConnectFlowRows";
import { PROGRESSOR, AGENCY, RELATIONSHIP, SAMPLE_INTRO, type RelState } from "@/components/agent/progressor-network/connect-flow/fixtures";

type Side = "agency" | "progressor";
type AgencyScreen = "discover" | "profile";

const STATE_LABEL: Record<RelState, string> = {
  none: "Fresh",
  pending: "Request sent",
  connected: "Connected",
  declined: "Declined",
};

const SECTION: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--agent-text-muted)",
  margin: "0 0 12px",
};

function hint(side: Side, status: RelState, screen: AgencyScreen): string {
  if (side === "agency") {
    if (screen === "profile") return "The business storefront. Request a connection from the header.";
    if (status === "pending") return "Request sent. Switch to the Progressor view to accept or decline it.";
    if (status === "connected") return "Connected. The relationship card shows assigned sales; Assign a sale hands work over.";
    if (status === "declined") return "Declined. You can send a fresh request.";
    return "Open the profile to explore the business, or Connect to send a request.";
  }
  if (status === "pending") return "An agency wants to connect. Review their introduction, then accept or decline.";
  if (status === "connected") return "You accepted. The agency is now an active client.";
  return "No requests right now. Switch to the Agency view and send one.";
}

export function ConnectFlowPreview() {
  const { toast } = useAgentToast();
  const [side, setSide] = useState<Side>("agency");
  const [status, setStatus] = useState<RelState>("none");
  const [screen, setScreen] = useState<AgencyScreen>("discover");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const openModal = () => setModalOpen(true);
  const send = (n: string) => {
    setNote(n);
    setStatus("pending");
    setModalOpen(false);
    setScreen("discover");
    toast.info("Connection request sent", { description: `Waiting for ${PROGRESSOR.name} to accept.` });
  };
  const withdraw = () => {
    setStatus("none");
    toast.info("Request withdrawn");
  };
  const accept = () => {
    setStatus("connected");
    toast.success(`${AGENCY.name} connected`, { description: "They can now hand you sales." });
  };
  const decline = () => {
    setStatus("declined");
    toast.info("Request declined");
  };
  const reset = () => {
    setStatus("none");
    setNote("");
    setSaved(false);
    setScreen("discover");
  };

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 20px 80px" }}>
      <PageHeader
        title="Connect flow preview"
        subtitle="The full agency / progressor journey, both sides. Fictional data, nothing is wired up."
      />

      {/* Dev controls (not part of the production UI) */}
      <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-end", margin: "18px 0 16px" }}>
        <div>
          <div style={SECTION}>View as</div>
          <SegmentedSwitch
            options={[
              { id: "agency", label: `Agency (${AGENCY.name})` },
              { id: "progressor", label: `Progressor (${PROGRESSOR.name})` },
            ]}
            value={side}
            onChange={(v) => setSide(v)}
            ariaLabel="Which side to view"
          />
        </div>
        <div>
          <div style={SECTION}>Jump to state</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["none", "pending", "connected", "declined"] as RelState[]).map((s) => (
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

      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", marginBottom: 24, borderRadius: "var(--agent-radius-md)", background: "rgba(var(--agent-coral-rgb),0.06)", border: "1px solid rgba(var(--agent-coral-rgb),0.16)" }}>
        <ArrowRight size={15} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)" }}>{hint(side, status, screen)}</p>
      </div>

      {side === "agency" ? (
        screen === "profile" ? (
          <BusinessProfile business={PROGRESSOR} relState={status} onBack={() => setScreen("discover")} onConnect={openModal} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 400px) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
            <div>
              <p style={SECTION}>The network</p>
              <PremiumBusinessCard
                business={PROGRESSOR}
                relState={status}
                saved={saved}
                onToggleSave={() => setSaved((s) => !s)}
                onViewProfile={() => setScreen("profile")}
                onConnect={openModal}
              />
            </div>
            <div>
              {status === "pending" && (
                <>
                  <p style={SECTION}>Introductions</p>
                  <SentRequestRow name={PROGRESSOR.name} onWithdraw={withdraw} />
                </>
              )}
              {status === "connected" && (
                <>
                  <p style={SECTION}>My progressors</p>
                  <ConnectedRelationshipCard name={PROGRESSOR.name} metrics={RELATIONSHIP} accepting={PROGRESSOR.availability === "accepting"} />
                </>
              )}
              {status === "declined" && (
                <>
                  <p style={SECTION}>Introductions</p>
                  <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "16px 18px" }}>
                    <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                      {PROGRESSOR.name} declined your request. You can send a fresh one from the card.
                    </p>
                  </div>
                </>
              )}
              {status === "none" && (
                <div className="agent-glass agent-empty-card" style={{ borderRadius: "var(--agent-radius-xl)", padding: "36px 24px", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
                    Sent requests and connected progressors show here.
                  </p>
                </div>
              )}
            </div>
          </div>
        )
      ) : (
        <div style={{ maxWidth: 560 }}>
          <p style={SECTION}>Connection requests</p>
          {status === "pending" && (
            <IncomingRequestCard
              agencyName={AGENCY.name}
              agencyDescriptor={AGENCY.descriptor}
              agencyRegion={AGENCY.region}
              note={note || SAMPLE_INTRO}
              onAccept={accept}
              onDecline={decline}
              onViewAgency={() => toast.info("Agency profile", { description: "A future enhancement, not built yet." })}
            />
          )}
          {status === "connected" && (
            <>
              <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-lg)", padding: "14px 16px", marginBottom: 18 }}>
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
                  You accepted {AGENCY.name}&apos;s request. They&apos;re now an active client and can hand you sales.
                </p>
              </div>
              <ConnectedAgencyCard name={AGENCY.name} descriptor={AGENCY.descriptor} region={AGENCY.region} activeInstructions={0} />
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
      )}

      <NetworkConnectModal open={modalOpen} onClose={() => setModalOpen(false)} onSend={send} agencyName={AGENCY.name} progressorName={PROGRESSOR.name} />
    </div>
  );
}

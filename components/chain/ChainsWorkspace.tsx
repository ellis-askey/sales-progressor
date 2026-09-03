"use client";

// The /agent/chains workspace. Two lists behind a toggle: the chains our sales
// sit in, and the live sales not yet in a chain. Each row opens the existing
// ChainDrawer (via ViewChainButton) so all editing/inviting happens in the one
// canonical place. Read-only surface otherwise; scoped upstream by the page.

import { useState, Fragment } from "react";
import { CaretRight, Warning } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import type { ChainsWorkspaceChain, NoChainSale } from "@/lib/services/chains";

const STATUS_LABEL: Record<string, string> = { active: "Active", on_hold: "On hold" };

function ChainRow({
  chain,
  currentUserId,
  currentUserRole,
}: {
  chain: ChainsWorkspaceChain;
  currentUserId: string;
  currentUserRole?: string | null;
}) {
  return (
    <GlassCard glassId="chains-row" label="Chains · row" defaultVariant="v05" style={{ padding: "14px 16px", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* The run of properties, our file emphasised, uninvited stubs flagged */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {chain.links.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <CaretRight size={11} weight="bold" aria-hidden style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />}
                <span
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 13, lineHeight: 1.3,
                    fontWeight: l.isOurs ? 700 : 500,
                    color: l.isOurs ? "var(--agent-coral-deep)" : l.claimed ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                  }}
                >
                  {l.label}
                  {l.needsInvite && <Warning size={12} weight="fill" aria-label="Needs an agent invite" style={{ color: "var(--agent-warning)" }} />}
                </span>
              </Fragment>
            ))}
          </div>
          {/* Meta: our position + invite-needed count */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
            {chain.ourPosition != null && (
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
                Your file: link {chain.ourPosition} of {chain.length}
              </span>
            )}
            {chain.needsInviteCount > 0 && (
              <Pill glass tone="warning" size="sm">
                {chain.needsInviteCount} to invite
              </Pill>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <ViewChainButton transactionId={chain.openTransactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} />
        </div>
      </div>
    </GlassCard>
  );
}

function NoChainRow({
  sale,
  first,
  currentUserId,
  currentUserRole,
}: {
  sale: NoChainSale;
  first: boolean;
  currentUserId: string;
  currentUserRole?: string | null;
}) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
        borderTop: first ? undefined : "0.5px solid var(--agent-border-default)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div data-sensitive="true" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {sale.address}
        </div>
        <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1 }}>Not in a chain</div>
      </div>
      <Pill glass tone={sale.status === "on_hold" ? "warning" : "success"} size="sm">
        {STATUS_LABEL[sale.status] ?? sale.status}
      </Pill>
      <div style={{ flexShrink: 0 }}>
        <ViewChainButton transactionId={sale.transactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} label="Set up chain" />
      </div>
    </div>
  );
}

export function ChainsWorkspace({
  chains,
  noChain,
  currentUserId,
  currentUserRole,
}: {
  chains: ChainsWorkspaceChain[];
  noChain: NoChainSale[];
  currentUserId: string;
  currentUserRole?: string | null;
}) {
  const [tab, setTab] = useState<"chains" | "none">("chains");
  const needsInviteTotal = chains.reduce((n, c) => n + c.needsInviteCount, 0);

  return (
    <div className="space-y-4">
      {/* Toggle + at-a-glance invite count */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 6 }}>
          <button type="button" onClick={() => setTab("chains")} className={`agent-segment-pill${tab === "chains" ? " on" : ""}`}>
            In a chain {chains.length}
          </button>
          <button type="button" onClick={() => setTab("none")} className={`agent-segment-pill${tab === "none" ? " on" : ""}`}>
            No chain {noChain.length}
          </button>
        </div>
        {needsInviteTotal > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--agent-warning)", fontWeight: 600 }}>
            <Warning size={13} weight="fill" aria-hidden />
            {needsInviteTotal} agent{needsInviteTotal === 1 ? "" : "s"} still to invite
          </span>
        )}
      </div>

      {tab === "chains" ? (
        chains.length === 0 ? (
          <EmptyState
            compact
            title="No chains yet"
            description="Sales you link into a chain will appear here. Set one up from a sale in the No chain tab."
          />
        ) : (
          <div className="space-y-3">
            {chains.map((c) => (
              <ChainRow key={c.chainId} chain={c} currentUserId={currentUserId} currentUserRole={currentUserRole} />
            ))}
          </div>
        )
      ) : noChain.length === 0 ? (
        <EmptyState compact title="Every sale is in a chain" description="No live sales are sitting outside a chain right now." />
      ) : (
        <GlassCard glassId="chains-nochain" label="Chains · no chain" defaultVariant="v05" className="overflow-hidden" style={{ borderRadius: 12 }}>
          {noChain.map((s, i) => (
            <NoChainRow key={s.transactionId} sale={s} first={i === 0} currentUserId={currentUserId} currentUserRole={currentUserRole} />
          ))}
        </GlassCard>
      )}
    </div>
  );
}

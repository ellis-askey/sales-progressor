"use client";

// Compact, property-led card for one chain our sale sits in. Replaces the old
// breadcrumb row. Shows our file's photo + address, when the sale was agreed, the
// agency, a small chain visual with our position, and concise below/above +
// connected/to-invite metadata. All editing still happens in the ChainDrawer,
// opened via ViewChainButton. Used only by the chains workspace.

import { Fragment } from "react";
import { CaretUp, CaretDown, UsersThree, Warning, CheckCircle, LinkSimpleHorizontal, ArrowUpRight } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { ChainMiniMap } from "@/components/chain/ChainMiniMap";
import { ViewChainButton } from "@/components/chain/ViewChainButton";
import { saleAgreedAgo } from "@/components/chain/chain-format";
import type { ChainsWorkspaceChain } from "@/lib/services/chains";

function MetaItem({
  icon,
  children,
  tone = "muted",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone?: "muted" | "warning" | "success";
}) {
  const color =
    tone === "warning" ? "var(--agent-warning)" : tone === "success" ? "var(--agent-success)" : "var(--agent-text-muted)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color, fontWeight: tone === "muted" ? 500 : 600, whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-flex", color }} aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

function Divider() {
  return <span aria-hidden style={{ width: 1, height: 11, background: "var(--agent-border-subtle)", flexShrink: 0 }} />;
}

export function ChainCard({
  chain,
  currentUserId,
  currentUserRole,
}: {
  chain: ChainsWorkspaceChain;
  currentUserId: string;
  currentUserRole?: string | null;
}) {
  const agreed = saleAgreedAgo(chain.saleAgreedAt);
  const { linksAbove, linksBelow, agentsConnected, needsInviteCount, length, onwardCount } = chain;

  // Connected = a link with a real transaction (matches the drawer's claim rate).
  // "All agents connected" only when every link is claimed — never inferred from
  // the invite count.
  const allConnected = agentsConnected >= length;

  const meta: React.ReactNode[] = [];
  if (linksBelow > 0) {
    meta.push(<MetaItem key="below" icon={<CaretDown size={12} weight="bold" />}>{linksBelow} below you</MetaItem>);
  }
  if (linksAbove > 0) {
    meta.push(<MetaItem key="above" icon={<CaretUp size={12} weight="bold" />}>{linksAbove} above you</MetaItem>);
  }
  if (onwardCount > 0) {
    meta.push(<MetaItem key="onward" icon={<ArrowUpRight size={12} weight="bold" />}>{onwardCount} onward</MetaItem>);
  }
  if (allConnected) {
    meta.push(
      <MetaItem key="allconnected" icon={<CheckCircle size={13} weight="fill" />} tone="success">
        All agents connected
      </MetaItem>,
    );
  } else {
    meta.push(
      <MetaItem key="connected" icon={<UsersThree size={13} weight="regular" />}>
        {agentsConnected} of {length} connected
      </MetaItem>,
    );
    if (needsInviteCount > 0) {
      meta.push(
        <MetaItem key="invite" icon={<Warning size={12} weight="fill" />} tone="warning">
          {needsInviteCount} to invite
        </MetaItem>,
      );
    }
  }

  return (
    <GlassCard glassId="chains-card" label="Chains · chain card" defaultVariant="v05" style={{ padding: 16, borderRadius: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <PropertyThumb photoUrl={chain.ourPhotoUrl} size={62} />

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
          {/* Header: our address + Your sale tag, and the open-chain action */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span
                  data-sensitive="true"
                  style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                >
                  {chain.ourAddress ?? "Your sale"}
                </span>
                {chain.ourPosition != null && (
                  <Pill glass tone="brand" size="sm" style={{ flexShrink: 0 }}>Your sale</Pill>
                )}
              </div>
              {(agreed || chain.ourAgencyName) && (
                <div style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[agreed, chain.ourAgencyName].filter(Boolean).join("  ·  ")}
                </div>
              )}
            </div>
            <div style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-secondary)", whiteSpace: "nowrap" }}>
                <LinkSimpleHorizontal size={13} weight="bold" aria-hidden style={{ color: "var(--agent-coral-deep)" }} />
                {length} {length === 1 ? "link" : "links"}
              </span>
              <ViewChainButton transactionId={chain.openTransactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} />
            </div>
          </div>

          {/* Chain visual */}
          <ChainMiniMap links={chain.links} />

          {/* Concise chain metadata */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 6 }}>
            {meta.map((m, i) => (
              <Fragment key={i}>
                {i > 0 && <Divider />}
                {m}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

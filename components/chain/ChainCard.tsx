"use client";

// Compact, property-led card for one chain our sale sits in. Replaces the old
// breadcrumb row. Shows our file's photo + address, when the sale was agreed, the
// agency, a small chain visual with our position, and concise below/above +
// connected/to-invite metadata. All editing still happens in the ChainDrawer,
// opened via ViewChainButton. Used only by the chains workspace.

import { Fragment } from "react";
import { CaretUp, CaretDown, UsersThree, Warning, CheckCircle, LinkSimpleHorizontal, XCircle } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
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
  tone?: "muted" | "warning" | "success" | "danger";
}) {
  const color =
    tone === "warning" ? "var(--agent-warning)"
      : tone === "success" ? "var(--agent-success)"
        : tone === "danger" ? "var(--agent-danger)"
          : "var(--agent-text-muted)";
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
  showAgency,
}: {
  chain: ChainsWorkspaceChain;
  currentUserId: string;
  currentUserRole?: string | null;
  // Agency users only ever see their own agency, so the name is redundant for
  // them. Internal staff span agencies, so they keep it.
  showAgency: boolean;
}) {
  const agreed = saleAgreedAgo(chain.saleAgreedAt);
  const { linksAbove, linksBelow, agentsConnected, needsInviteCount, bouncedCount, declinedCount, length } = chain;
  const agencyName = showAgency ? chain.ourAgencyName : null;

  // Split the address like the rest of the app: street on line 1, town/postcode
  // smaller underneath.
  const full = chain.ourAddress ?? "Your sale";
  const commaIdx = full.indexOf(",");
  const addrLine1 = commaIdx >= 0 ? full.slice(0, commaIdx).trim() : full;
  const addrLine2 = commaIdx >= 0 ? full.slice(commaIdx + 1).trim() : "";

  // Connected = a link with a real transaction (matches the drawer's claim rate).
  // "All agents connected" only when every link is claimed — never inferred from
  // the invite count.
  const allConnected = agentsConnected >= length;

  // Each note carries a mobile priority (lower = more important). Desktop renders
  // every note; mobile keeps only the top three so the row never wraps to leave a
  // lone note stranded (critique #299). Danger flags outrank everything; the plain
  // "connected" status is the lowest, so it's the first to drop on mobile.
  const metaItems: { key: string; prio: number; node: React.ReactNode }[] = [];
  if (linksBelow > 0) {
    metaItems.push({ key: "below", prio: 4, node: <MetaItem icon={<CaretDown size={12} weight="bold" />}>{linksBelow} below you</MetaItem> });
  }
  if (linksAbove > 0) {
    metaItems.push({ key: "above", prio: 5, node: <MetaItem icon={<CaretUp size={12} weight="bold" />}>{linksAbove} above you</MetaItem> });
  }
  if (allConnected) {
    metaItems.push({
      key: "allconnected",
      prio: 6,
      node: (
        <MetaItem icon={<CheckCircle size={13} weight="fill" />} tone="success">
          All agents connected
        </MetaItem>
      ),
    });
  } else {
    metaItems.push({
      key: "connected",
      prio: 8,
      node: (
        <MetaItem icon={<UsersThree size={13} weight="regular" />}>
          {agentsConnected} of {length} connected
        </MetaItem>
      ),
    });
    if (needsInviteCount > 0) {
      metaItems.push({
        key: "invite",
        prio: 3,
        node: (
          <MetaItem icon={<Warning size={12} weight="fill" />} tone="warning">
            {needsInviteCount} to invite
          </MetaItem>
        ),
      });
    }
  }
  // A dead neighbour (bounced email / declined invite) is more urgent than a
  // never-sent one — flag it in danger so it can't hide as a muted dot.
  if (bouncedCount > 0) {
    metaItems.push({
      key: "bounced",
      prio: 1,
      node: (
        <MetaItem icon={<Warning size={12} weight="fill" />} tone="danger">
          {bouncedCount} bounced
        </MetaItem>
      ),
    });
  }
  if (declinedCount > 0) {
    metaItems.push({
      key: "declined",
      prio: 2,
      node: (
        <MetaItem icon={<XCircle size={13} weight="fill" />} tone="danger">
          {declinedCount} declined
        </MetaItem>
      ),
    });
  }

  // Top three by priority, rendered back in insertion order so the mobile row
  // reads left-to-right the same way the desktop row does.
  const mobileKeys = new Set(
    [...metaItems].sort((a, b) => a.prio - b.prio).slice(0, 3).map((m) => m.key),
  );
  const mobileItems = metaItems.filter((m) => mobileKeys.has(m.key));

  return (
    <GlassCard glassId="chains-card" label="Chains · chain card" defaultVariant="v05" className={`chain-prop-card${length <= 4 ? " chain-tight-ok" : ""}`} data-bloom style={{ padding: 16, borderRadius: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Header: photo + address, and the open-chain action */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <PropertyThumb photoUrl={chain.ourPhotoUrl} size={60} />
          <div className="chain-head-content" style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div className="chain-head-addr" style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span
                  data-sensitive="true"
                  className="chain-addr-text"
                  style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}
                >
                  {addrLine1}
                </span>
              </div>
              {addrLine2 && (
                <div data-sensitive="true" className="chain-addr-text" style={{ fontSize: 11.5, color: "var(--agent-text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {addrLine2}
                </div>
              )}
              {(agreed || agencyName) && (
                <div className="chain-addr-text" style={{ fontSize: 10.5, color: "var(--agent-text-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[agreed, agencyName].filter(Boolean).join("  ·  ")}
                </div>
              )}
            </div>
            <div className="chain-head-side" style={{ flexShrink: 0, textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--agent-text-secondary)", whiteSpace: "nowrap" }}>
                <LinkSimpleHorizontal size={13} weight="bold" aria-hidden style={{ color: "var(--agent-coral-deep)" }} />
                {length} {length === 1 ? "link" : "links"}
              </span>
              {/* Desktop: open-chain sits under the links chip. On mobile it moves
                  to a bottom-right footer (chain-open-bottom) for room. */}
              <span className="chain-open-top">
                <ViewChainButton transactionId={chain.openTransactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} />
              </span>
            </div>
          </div>
        </div>

        {/* Chain visual — full width, first node left-aligned under the photo.
            On mobile, short chains (<=4 links) let Open chain ride this row on the
            right, vertically centred; longer chains keep it in the bottom footer
            below so the circle strip gets the full width (critique #299). */}
        <div className="chain-map-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="chain-map-strip" style={{ flex: 1, minWidth: 0 }}>
            <ChainMiniMap spine={chain.spine} branches={chain.branches} />
          </div>
          <span className="chain-open-inline">
            <ViewChainButton transactionId={chain.openTransactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} />
          </span>
        </div>

        {/* Concise chain metadata. Desktop: every note. Mobile: top three only. */}
        <div className="chain-meta chain-meta-desktop" style={{ alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 6 }}>
          {metaItems.map((m, i) => (
            <Fragment key={m.key}>
              {i > 0 && <Divider />}
              {m.node}
            </Fragment>
          ))}
        </div>
        <div className="chain-meta chain-meta-mobile" style={{ alignItems: "center", gap: 8, flexWrap: "wrap", rowGap: 6 }}>
          {mobileItems.map((m, i) => (
            <Fragment key={m.key}>
              {i > 0 && <Divider />}
              {m.node}
            </Fragment>
          ))}
        </div>

        {/* Mobile-only open-chain, bottom-right — shown only for longer chains
            that can't fit it on the circle row (hidden on desktop). */}
        <div className="chain-open-bottom">
          <ViewChainButton transactionId={chain.openTransactionId} currentUserId={currentUserId} currentUserRole={currentUserRole} />
        </div>
      </div>
    </GlassCard>
  );
}

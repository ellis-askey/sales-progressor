"use client";

// PropertyChainCard — the file's chain, as one card (the "chain spine").
//
// Replaces three stacked boxes on the Overview tab (the property-chain summary,
// the onward-purchase card and the related-sale card) with a single card that
// reads as a chain: what's up the chain (the seller's onward purchase), this
// sale in the middle, and what's down the chain (the buyer's related sale),
// threaded on one continuous spine line, with the uninvited-neighbours nudge as
// a footer. This sale's node is the property photo (or the chain house
// fallback), sitting on the centre line.
//
// The onward/related nodes reuse OnwardPurchaseCard in `embedded` mode (Law 4).
// The chain drawer itself is untouched — `openChain` is the existing
// ViewChainButton, passed straight through.

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { OnwardPurchaseCard } from "@/components/transaction/OnwardPurchaseCard";
import type { OnwardTrackerView } from "@/lib/services/onward";

type Side = { view: OnwardTrackerView; signalActive: boolean; address: string | null };

export function PropertyChainCard({
  transactionId,
  thisSaleAddress,
  photoUrl = null,
  onward,
  related,
  showRelated,
  uninvitedCount,
  openChain,
}: {
  transactionId: string;
  thisSaleAddress: string;
  // Signed URL for this file's property photo, or null → chain house fallback.
  photoUrl?: string | null;
  onward: Side;
  related: Side;
  // Related sale only shows once the buyer signals they're selling or a tracker
  // exists — keeps it quiet on files where it doesn't apply.
  showRelated: boolean;
  uninvitedCount: number;
  openChain: ReactNode;
}) {
  return (
    <Card id="chain-section" padding="none">
      {/* Header — sized to match Contacts / Activity & notes */}
      <div className="cspine-hd">
        <h3 className="cspine-heading">Property chain</h3>
        {openChain}
      </div>

      {/* Spine */}
      <div className="cspine">
        {/* Up the chain — the seller's onward purchase */}
        <SpineRow
          pos="first"
          node={
            <span className="cspine-node node-up" aria-hidden>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </span>
          }
          kicker="Up the chain"
          title="Onward purchase"
          address={onward.address}
        >
          <OnwardPurchaseCard
            embedded
            transactionId={transactionId}
            initialView={onward.view}
            signalActive={onward.signalActive}
            onwardAddress={onward.address}
            direction="onward"
          />
        </SpineRow>

        {/* This sale — the property photo / fallback on the centre line */}
        <div className="cspine-row">
          <div className="cspine-rail" data-pos={showRelated ? "mid" : "last"}>
            <span className="cspine-node node-here" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl ?? "/chain-empty-photo.png"} alt="" className="cspine-photo" />
            </span>
          </div>
          <div className="cspine-content">
            <div className="cspine-here">
              <div className="cspine-lvl">This sale</div>
              <div className="cspine-title">{thisSaleAddress}</div>
            </div>
          </div>
        </div>

        {/* Down the chain — the buyer's related sale */}
        {showRelated && (
          <SpineRow
            pos="last"
            node={
              <span className="cspine-node node-down" aria-hidden>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M6 13l6 6 6-6" />
                </svg>
              </span>
            }
            kicker="Down the chain"
            title="Related sale"
            address={related.address}
          >
            <OnwardPurchaseCard
              embedded
              transactionId={transactionId}
              initialView={related.view}
              signalActive={related.signalActive}
              onwardAddress={related.address}
              direction="related"
            />
          </SpineRow>
        )}
      </div>

      {/* Footer nudge — uninvited neighbours (lost pipeline) */}
      {uninvitedCount > 0 && (
        <div className="cspine-nudge">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M12 9v4M12 17h.01" />
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {uninvitedCount === 1 ? "1 neighbour is added but not invited yet" : `${uninvitedCount} neighbours are added but not invited yet`}
        </div>
      )}

      <style>{`
        .cspine-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px}
        .cspine-heading{margin:0;font-size:14px;font-weight:600;color:var(--agent-text-primary)}

        .cspine{padding:2px 16px 12px}
        .cspine-row{display:flex;gap:14px;align-items:center;padding:13px 0}
        /* Continuous centre line through every node's middle. */
        .cspine-rail{position:relative;width:44px;flex-shrink:0;align-self:stretch;display:flex;align-items:center;justify-content:center}
        .cspine-rail::before{content:"";position:absolute;left:50%;top:0;bottom:0;transform:translateX(-50%);width:2px;background:rgba(255,107,74,0.22)}
        .cspine-row:first-child .cspine-rail::before{top:50%}
        .cspine-row:last-child .cspine-rail::before{bottom:50%}

        .cspine-node{position:relative;z-index:1;width:44px;height:44px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
        .cspine-node.node-up{background:var(--agent-coral-bg-tint, rgba(255,107,74,0.10));color:var(--agent-coral-deep, #E8542F)}
        .cspine-node.node-down{background:var(--agent-info-bg, rgba(62,99,232,0.10));color:var(--agent-info, #3E63E8)}
        .cspine-node.node-here{overflow:hidden;background:var(--agent-coral-bg-tint, rgba(255,107,74,0.12));box-shadow:0 0 0 2px var(--agent-coral, #FF6B4A)}
        .cspine-photo{width:100%;height:100%;object-fit:cover;display:block}

        .cspine-content{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:8px 16px;justify-content:space-between;align-items:center}
        .cspine-main{flex:1 1 230px;min-width:0}
        .cspine-action{flex:0 1 auto;min-width:0}
        .cspine-lvl{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--agent-text-muted)}
        .cspine-title{font-size:14px;font-weight:640;color:var(--agent-text-primary);margin-top:1px}
        .cspine-addr{font-size:12px;color:var(--agent-text-secondary);margin-top:1px}

        .cspine-here{flex:1 1 auto;background:var(--agent-coral-bg-tint, rgba(255,107,74,0.10));border:1px solid rgba(255,107,74,0.22);border-radius:12px;padding:9px 12px}

        .cspine-nudge{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:550;color:var(--agent-warning, #93590A);background:rgba(213,153,41,0.14);border-top:1px solid rgba(213,153,41,0.34);padding:10px 16px}
        .cspine-nudge svg{flex-shrink:0}
      `}</style>
    </Card>
  );
}

function SpineRow({
  pos,
  node,
  kicker,
  title,
  address,
  children,
}: {
  pos: "first" | "last";
  node: ReactNode;
  kicker: string;
  title: string;
  address: string | null;
  children: ReactNode;
}) {
  return (
    <div className="cspine-row">
      <div className="cspine-rail" data-pos={pos}>{node}</div>
      <div className="cspine-content">
        <div className="cspine-main">
          <div className="cspine-lvl">{kicker}</div>
          <div className="cspine-title">{title}</div>
          {address && <div className="cspine-addr">{address}</div>}
        </div>
        {/* Buttons / tracker on the right; wraps below the text when cramped. */}
        <div className="cspine-action">{children}</div>
      </div>
    </div>
  );
}

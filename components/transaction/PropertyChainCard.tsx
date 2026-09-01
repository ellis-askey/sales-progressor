"use client";

// PropertyChainCard — the file's chain, as one card (the "chain spine").
//
// Replaces three stacked boxes on the Overview tab (the property-chain summary,
// the onward-purchase card and the related-sale card) with a single card that
// reads as a chain: what's up the chain (the seller's onward purchase), this
// sale in the middle, and what's down the chain (the buyer's related sale),
// threaded on one spine, with the uninvited-neighbours nudge as a footer.
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
  onward,
  related,
  showRelated,
  uninvitedCount,
  openChain,
}: {
  transactionId: string;
  thisSaleAddress: string;
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
      {/* Header */}
      <div className="cspine-hd">
        <p className="cspine-kicker">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M9 12a3 3 0 0 1 3-3h1a3 3 0 0 1 0 6h-1" />
            <path d="M15 12a3 3 0 0 1-3 3h-1a3 3 0 0 1 0-6h1" />
          </svg>
          Property chain
        </p>
        {openChain}
      </div>

      {/* Spine */}
      <div className="cspine">
        {/* Up the chain — the seller's onward purchase */}
        <SpineRow
          pos="first"
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M6 11l6-6 6 6" />
            </svg>
          }
          iconClass="ico-up"
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

        {/* This sale */}
        <div className="cspine-row">
          <div className="cspine-rail" data-pos={showRelated ? "mid" : "last"}>
            <span className="cspine-ico ico-here" aria-hidden>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 4l9 6.5" />
                <path d="M5 9.5V20h14V9.5" />
              </svg>
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
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            }
            iconClass="ico-down"
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
        .cspine-hd{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 16px}
        .cspine-kicker{display:flex;align-items:center;gap:8px;margin:0;font-size:12px;font-weight:600;color:var(--agent-text-secondary)}
        .cspine-kicker svg{color:var(--agent-coral, #FF6B4A)}

        .cspine{padding:2px 16px 12px}
        .cspine-row{display:flex;gap:13px;align-items:flex-start;padding:11px 0}
        .cspine-rail{position:relative;width:34px;flex-shrink:0;display:flex;justify-content:center}
        .cspine-rail::before{content:"";position:absolute;top:-11px;bottom:-11px;left:50%;transform:translateX(-50%);width:2px;background:rgba(255,107,74,0.18)}
        .cspine-rail[data-pos="first"]::before{top:17px}
        .cspine-rail[data-pos="last"]::before{bottom:calc(100% - 17px)}
        .cspine-ico{width:34px;height:34px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
        .cspine-ico.ico-up{background:var(--agent-coral-bg-tint, rgba(255,107,74,0.10));color:var(--agent-coral-deep, #E8542F)}
        .cspine-ico.ico-here{background:var(--agent-coral, #FF6B4A);color:#fff}
        .cspine-ico.ico-down{background:var(--agent-info-bg, rgba(62,99,232,0.10));color:var(--agent-info, #3E63E8)}

        .cspine-content{flex:1;min-width:0}
        .cspine-lvl{font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--agent-text-muted)}
        .cspine-title{font-size:14px;font-weight:640;color:var(--agent-text-primary);margin-top:1px}
        .cspine-addr{font-size:12px;color:var(--agent-text-secondary);margin-top:1px}
        .cspine-body{margin-top:9px}

        .cspine-here{background:var(--agent-coral-bg-tint, rgba(255,107,74,0.10));border:1px solid rgba(255,107,74,0.22);border-radius:12px;padding:9px 12px}

        .cspine-nudge{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:550;color:var(--agent-warning, #93590A);background:rgba(213,153,41,0.14);border-top:1px solid rgba(213,153,41,0.34);padding:10px 16px}
        .cspine-nudge svg{flex-shrink:0}
      `}</style>
    </Card>
  );
}

function SpineRow({
  pos,
  icon,
  iconClass,
  kicker,
  title,
  address,
  children,
}: {
  pos: "first" | "last";
  icon: ReactNode;
  iconClass: string;
  kicker: string;
  title: string;
  address: string | null;
  children: ReactNode;
}) {
  return (
    <div className="cspine-row">
      <div className="cspine-rail" data-pos={pos}>
        <span className={`cspine-ico ${iconClass}`} aria-hidden>{icon}</span>
      </div>
      <div className="cspine-content">
        <div className="cspine-lvl">{kicker}</div>
        <div className="cspine-title">{title}</div>
        {address && <div className="cspine-addr">{address}</div>}
        <div className="cspine-body">{children}</div>
      </div>
    </div>
  );
}

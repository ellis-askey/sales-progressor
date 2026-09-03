"use client";

// PropertyChainCard — the file's chain, as one card (the "chain spine").
//
// Reads top-to-bottom as a chain: the seller's onward purchase (up), this sale
// in the middle, the buyer's related sale (down), threaded on one dotted spine.
// Rebuilt 2026-09-02 to the approved mock: direction kickers, property title +
// address split, a highlighted current-sale row with the photo + status, a
// per-link tracking status with an inline "Set up tracking" disclosure, and a
// footer explainer. Each link's tracker reuses OnwardPurchaseCard (Law 4); the
// chain drawer is the passed-through ViewChainButton (`openChain`).

import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { OnwardPurchaseCard } from "@/components/transaction/OnwardPurchaseCard";
import { useTabContext } from "@/components/transaction/TabContext";
import type { OnwardTrackerView } from "@/lib/services/onward";

type Side = { view: OnwardTrackerView; signalActive: boolean; address: string | null };
type CurrentStatus = { label: string; tone: "active" | "hold" | "done" | "off" };

// Split "14 Beaumont Rise, Harpenden, Hertfordshire, AL5 2RT" into a bold
// property line + a muted rest-of-address line, like the mock.
function splitAddr(a: string | null): { title: string; rest: string } {
  if (!a) return { title: "", rest: "" };
  const i = a.indexOf(",");
  if (i === -1) return { title: a.trim(), rest: "" };
  return { title: a.slice(0, i).trim(), rest: a.slice(i + 1).trim() };
}

const ArrowGlyph = () => (
  <svg className="agent-arrow-i" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export function PropertyChainCard({
  transactionId,
  thisSaleAddress,
  photoUrl = null,
  currentStatus,
  currentSubtext,
  onward,
  related,
  showRelated,
  openChain,
}: {
  transactionId: string;
  thisSaleAddress: string;
  photoUrl?: string | null;
  currentStatus: CurrentStatus;
  currentSubtext: string;
  onward: Side;
  related: Side;
  showRelated: boolean;
  // uninvitedCount kept in the caller; the nudge moved out of this card's mock.
  openChain: ReactNode;
}) {
  const { setActiveTab } = useTabContext();
  const [learnOpen, setLearnOpen] = useState(false);
  const here = splitAddr(thisSaleAddress);

  return (
    <Card id="chain-section" padding="none">
      <div className="cx">
        {/* Header */}
        <div className="cx-hd">
          <div className="cx-hd-text">
            <h3 className="cx-heading">Property chain</h3>
            <p className="cx-sub">See how this sale fits into the chain and track the other links.</p>
          </div>
          <div className="cx-open">{openChain}</div>
        </div>

        {/* Spine */}
        <div className="cx-spine">
          {/* Up the chain — the seller's onward purchase */}
          <TrackRow
            direction="onward"
            first
            transactionId={transactionId}
            kicker="Onward purchase"
            side={onward}
          />

          {/* This sale — highlighted, with the property photo + status */}
          <div className="cx-row">
            <div className="cx-rail">
              <span className="cx-conn" aria-hidden />
              <span className="cx-tile cx-tile-here" aria-hidden>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11.2 12 4l9 7.2" />
                  <path d="M5.5 9.5V20h13V9.5" />
                  <path d="M10 20v-5h4v5" />
                </svg>
              </span>
              <span className="cx-conn" aria-hidden data-hide={showRelated ? undefined : "true"} />
            </div>
            <button type="button" className="cx-here" onClick={() => setActiveTab("milestones")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl ?? "/chain-empty-photo.png"} alt="" className="cx-photo" />
              <div className="cx-here-main">
                <Pill glass tone="brand" size="sm" style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>Current sale</Pill>
                <div className="cx-title cx-title-lg">{here.title}</div>
                {here.rest && <div className="cx-addr">{here.rest}</div>}
              </div>
              <div className="cx-here-status">
                <div className="cx-status-line">
                  <span className="cx-dot" data-tone={currentStatus.tone} />
                  <span className="cx-status-label">{currentStatus.label}</span>
                </div>
                <span className="cx-status-sub">{currentSubtext}</span>
              </div>
              <svg className="cx-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          </div>

          {/* Down the chain — the buyer's related sale */}
          {showRelated && (
            <TrackRow
              direction="related"
              last
              transactionId={transactionId}
              kicker="Related sale"
              side={related}
            />
          )}
        </div>

        {/* Footer — what tracking gives you */}
        <div className="cx-foot">
          <div className="cx-foot-row">
            <span className="cx-foot-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4.5" y="11" width="15" height="9" rx="2" />
                <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
              </svg>
              Tracking gives you visibility and progress updates on the linked properties.
            </span>
            <button type="button" className="cx-learn" onClick={() => setLearnOpen((o) => !o)} aria-expanded={learnOpen}>
              Learn more<LinkArrow style={{ marginLeft: 0 }} />
            </button>
          </div>
          <div className="cx-learn-wrap" data-open={learnOpen ? "true" : undefined}>
            <div className="cx-learn-inner">
              <p className="cx-learn-body">
                Set up tracking on a link and we&rsquo;ll keep its reported progress here. Your client can also keep you updated on their related sale or purchase through their portal. Anything reported stays on your file and isn&rsquo;t shared with other agencies.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cx{display:flex;flex-direction:column}
        .cx-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px 6px}
        .cx-heading{margin:0;font-size:20px;font-weight:700;letter-spacing:-0.01em;color:var(--agent-text-primary)}
        .cx-sub{margin:5px 0 0;font-size:13.5px;color:var(--agent-text-secondary);line-height:1.45}
        .cx-open{flex-shrink:0;padding-top:3px}

        .cx-spine{padding:10px 24px 4px}
        .cx-row{display:flex;gap:18px;align-items:stretch}
        .cx-rail{position:relative;width:60px;flex-shrink:0;display:flex;flex-direction:column;align-items:center}
        .cx-conn{width:0;flex:1 1 auto;min-height:14px;border-left:3px dotted var(--agent-border-strong, rgba(15,23,42,0.16))}
        .cx-conn[data-hide="true"]{visibility:hidden}

        .cx-tile{flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;margin:6px 0}
        .cx-tile-dir{width:52px;height:52px;border-radius:15px}
        .cx-tile-onward{background:rgba(255,107,74,0.12);color:var(--agent-coral-deep, #E8542F)}
        .cx-tile-related{background:rgba(62,99,232,0.11);color:var(--agent-info, #3E63E8)}
        .cx-tile-here{width:60px;height:60px;border-radius:50%;background:var(--agent-coral, #FF6B4A);color:#fff;box-shadow:0 6px 18px rgba(255,107,74,0.35)}

        /* Direction rows (onward / related) */
        .cx-dirrow{flex:1;min-width:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;flex-wrap:wrap}
        .cx-kicker{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--agent-text-muted)}
        .cx-title{font-size:17px;font-weight:600;letter-spacing:-0.01em;color:var(--agent-text-primary);margin-top:2px}
        .cx-title-lg{font-size:22px;font-weight:700}
        .cx-addr{font-size:14px;color:var(--agent-text-secondary);margin-top:2px}

        /* Right-hand tracking status */
        .cx-track{flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
        .cx-status-line{display:inline-flex;align-items:center;gap:7px}
        .cx-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--agent-text-muted)}
        .cx-dot[data-tone="active"],.cx-dot[data-tone="done"]{background:var(--agent-success, #16a34a)}
        .cx-dot[data-tone="hold"]{background:var(--agent-warning, #D59929)}
        .cx-dot[data-tone="off"]{background:var(--agent-text-muted)}
        .cx-status-label{font-size:14px;color:var(--agent-text-primary)}
        .cx-status-muted .cx-status-label{color:var(--agent-text-secondary)}
        .cx-status-sub{font-size:13px;color:var(--agent-text-secondary)}
        .cx-track-btn{display:inline-flex;align-items:center;gap:5px;background:none;border:none;padding:0;cursor:pointer;font-size:13.5px;font-weight:600;color:var(--agent-coral-deep, #E8542F)}
        .cx-track-btn:focus-visible{outline:2px solid var(--agent-coral);outline-offset:2px;border-radius:4px}

        /* Current-sale highlighted row */
        .cx-here{flex:1;min-width:0;display:flex;align-items:center;gap:16px;text-align:left;cursor:pointer;
          background:rgba(255,107,74,0.06);border:1px solid rgba(255,107,74,0.30);border-radius:16px;
          padding:14px 16px;margin:6px 0;transition:background 160ms ease,border-color 160ms ease}
        .cx-here:hover{background:rgba(255,107,74,0.10);border-color:rgba(255,107,74,0.45)}
        .cx-here:focus-visible{outline:2px solid var(--agent-coral);outline-offset:2px}
        .cx-photo{width:88px;height:72px;border-radius:12px;object-fit:cover;flex-shrink:0;display:block;background:var(--agent-surface-nested, rgba(15,23,42,0.04))}
        .cx-here-main{flex:1;min-width:0}
        .cx-here-main .cx-title-lg{margin-top:5px}
        .cx-here-status{flex-shrink:0;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:3px}
        .cx-chev{color:var(--agent-text-muted);flex-shrink:0;transition:transform 200ms cubic-bezier(0.22,1,0.36,1)}
        .cx-here:hover .cx-chev{transform:translateX(3px)}

        /* Inline tracker disclosure */
        .cx-disclosure{margin:2px 0 12px 78px;padding:12px 14px;border-radius:12px;background:var(--agent-surface-nested, rgba(15,23,42,0.03));border:1px solid var(--agent-border-default)}

        /* Footer */
        .cx-foot{border-top:0.5px solid var(--agent-border-default);padding:14px 24px 18px;margin-top:8px}
        .cx-foot-row{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cx-foot-left{display:inline-flex;align-items:center;gap:9px;font-size:13.5px;color:var(--agent-text-secondary);min-width:0}
        .cx-foot-left svg{flex-shrink:0;color:var(--agent-text-muted)}
        .cx-learn{display:inline-flex;align-items:center;gap:5px;background:none;border:none;padding:0;cursor:pointer;font-size:13px;font-weight:500;color:var(--agent-coral-deep, #E8542F);flex-shrink:0}
        .cx-learn:focus-visible{outline:2px solid var(--agent-coral);outline-offset:2px;border-radius:4px}
        /* Smooth reveal: animate the grid row from 0fr to 1fr so the panel
           slides open/closed instead of snapping. */
        .cx-learn-wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows 260ms cubic-bezier(0.22,1,0.36,1)}
        .cx-learn-wrap[data-open="true"]{grid-template-rows:1fr}
        .cx-learn-inner{overflow:hidden;min-height:0}
        .cx-learn-body{margin:0;padding-top:10px;font-size:13px;color:var(--agent-text-secondary);line-height:1.5;max-width:640px}
        @media (prefers-reduced-motion: reduce){.cx-learn-wrap{transition:none}}

        @media (max-width: 560px){
          .cx-hd,.cx-spine,.cx-foot{padding-left:16px;padding-right:16px}
          .cx-rail{width:48px}
          .cx-tile-here{width:52px;height:52px}
          .cx-tile-dir{width:46px;height:46px}
          .cx-dirrow,.cx-here-status,.cx-track{text-align:left;align-items:flex-start}
          .cx-here{flex-wrap:wrap}
          .cx-disclosure{margin-left:0}
        }
      `}</style>
    </Card>
  );

  function TrackRow({
    direction,
    kicker,
    side,
    first,
    last,
    transactionId,
  }: {
    direction: "onward" | "related";
    kicker: string;
    side: Side;
    first?: boolean;
    last?: boolean;
    transactionId: string;
  }) {
    const [open, setOpen] = useState(false);
    const addr = splitAddr(side.address);
    const tracked = side.view.exists;
    const isOnward = direction === "onward";

    return (
      <>
        <div className="cx-row">
          <div className="cx-rail">
            <span className="cx-conn" aria-hidden data-hide={first ? "true" : undefined} />
            <span className={`cx-tile cx-tile-dir ${isOnward ? "cx-tile-onward" : "cx-tile-related"}`} aria-hidden>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {isOnward ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
              </svg>
            </span>
            <span className="cx-conn" aria-hidden data-hide={last ? "true" : undefined} />
          </div>

          <div className="cx-dirrow">
            <div style={{ minWidth: 0 }}>
              <div className="cx-kicker">{kicker}</div>
              <div className="cx-title">{addr.title || (isOnward ? "Onward purchase" : "Related sale")}</div>
              {addr.rest ? <div className="cx-addr">{addr.rest}</div> : <div className="cx-addr">Not linked yet</div>}
            </div>

            <div className={`cx-track ${tracked ? "" : "cx-status-muted"}`}>
              <div className="cx-status-line">
                <span className="cx-dot" data-tone={tracked ? "active" : "off"} />
                <span className="cx-status-label">
                  {tracked ? `Tracking · ${side.view.completeCount}/${side.view.applicableCount}` : "Not tracked"}
                </span>
              </div>
              <button type="button" className="cx-track-btn" onClick={() => setOpen((o) => !o)}>
                {open ? "Hide" : tracked ? "View" : "Set up tracking"}
                <ArrowGlyph />
              </button>
            </div>
          </div>
        </div>

        {open && (
          <div className="cx-disclosure">
            <OnwardPurchaseCard
              embedded
              transactionId={transactionId}
              initialView={side.view}
              signalActive={side.signalActive}
              onwardAddress={side.address}
              direction={direction}
            />
          </div>
        )}
      </>
    );
  }
}

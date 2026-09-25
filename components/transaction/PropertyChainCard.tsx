"use client";

// PropertyChainCard — the file's chain as three property-photo link cards.
//
// Direction C (approved 2026-09-15, see the redesign artifact): the outer card
// is the normal agent card; inside, the chain reads as three small photo cards
// — related sale (left) · this sale (middle) · onward purchase (right) — each
// with its content on a thin-glass inset (GlassCard, default v04) so the
// property photo shows through. Tapping a card focuses it; the focus panel below
// shows that link's detail. Every link's tracker reuses OnwardPurchaseCard
// (Law 4) so nothing behavioural is lost: set-up, steps, confirm, chase agent,
// edit type, buyer's/seller's toggle all live there.
//
// Layout: the strip is a container query, not a viewport media query — it stacks
// (onward → this sale → related) the moment the CARD is too narrow to hold three
// across without squishing, regardless of the browser width.

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { LinkArrow } from "@/components/ui/LinkArrow";
import { GlassCard } from "@/components/glass/GlassCard";
import { OnwardPurchaseCard } from "@/components/transaction/OnwardPurchaseCard";
import { useTabContext } from "@/components/transaction/TabContext";
import type { OnwardTrackerView } from "@/lib/services/onward";

type Side = {
  view: OnwardTrackerView;
  farView: OnwardTrackerView;
  signalActive: boolean;
  address: string | null;
  // Optional property photo for the link card. Absent → the universal fallback.
  photoUrl?: string | null;
};
type CurrentStatus = { label: string; tone: "active" | "hold" | "done" | "off" };
type FocusKey = "onward" | "current" | "related";

function splitAddr(a: string | null): { title: string; rest: string } {
  if (!a) return { title: "", rest: "" };
  const i = a.indexOf(",");
  if (i === -1) return { title: a.trim(), rest: "" };
  return { title: a.slice(0, i).trim(), rest: a.slice(i + 1).trim() };
}

// Progress ring — same look on every link card.
function Ring({ pct, tone }: { pct: number; tone: "coral" | "blue" }) {
  const r = 19, c = 2 * Math.PI * r, off = c * (1 - Math.min(100, Math.max(0, pct)) / 100);
  const col = tone === "blue" ? "var(--agent-info, #3E63E8)" : "var(--agent-coral, #FF6B4A)";
  return (
    <svg className="cx2-ring" width="46" height="46" viewBox="0 0 46 46" aria-hidden>
      <circle cx="23" cy="23" r={r} fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="4.5" />
      <circle cx="23" cy="23" r={r} fill="none" stroke={col} strokeWidth="4.5" strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)} transform="rotate(-90 23 23)"
        style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }} />
      <text x="23" y="27" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="#fff" style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</text>
    </svg>
  );
}

function LockCircle() {
  return (
    <span className="cx2-lock" aria-hidden>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      </svg>
    </span>
  );
}

// Settled marker for a sale confirmed chain-free — a calm check, not the lock
// nag, so a resolved "no onward purchase" reads as done rather than pending.
function FreeCircle() {
  return (
    <span className="cx2-free" aria-hidden>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  );
}

export function PropertyChainCard({
  transactionId,
  thisSaleAddress,
  photoUrl = null,
  currentStatus,
  currentSubtext,
  currentPercent = null,
  onward,
  related,
  showRelated,
  noChainConfirmed = false,
}: {
  transactionId: string;
  thisSaleAddress: string;
  photoUrl?: string | null;
  currentStatus: CurrentStatus;
  currentSubtext: string;
  // The live sale's weighted milestone % — drives the current card's ring.
  currentPercent?: number | null;
  onward: Side;
  related: Side;
  showRelated: boolean;
  // The sale was marked "No chain" on the Chains page (noChainNeededAt set).
  // Lets the onward slot read as settled chain-free instead of a setup nag.
  noChainConfirmed?: boolean;
}) {
  const { setActiveTab } = useTabContext();
  const [focus, setFocus] = useState<FocusKey>("current");
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const focusFired = useRef(false);
  // Arriving from a chain drawer's "Set up / View onward" link: focus that
  // sub-card and scroll the chain card into view, then drop the param so a
  // refresh doesn't re-trigger. Waits a beat for the overview to lay out.
  useEffect(() => {
    if (focusFired.current) return;
    const f = params.get("focus");
    if (f !== "onward" && f !== "related") return;
    focusFired.current = true;
    setFocus(f);
    const t = setTimeout(() => {
      document.getElementById("chain-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    router.replace(pathname, { scroll: false });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [farSide, setFarSide] = useState<{ onward: boolean; related: boolean }>({ onward: false, related: false });
  const [learnOpen, setLearnOpen] = useState(false);
  const [reopenedOnward, setReopenedOnward] = useState(false);
  const here = splitAddr(thisSaleAddress);

  // A sale confirmed chain-free on the Chains page has no onward purchase, so the
  // onward slot reads as settled rather than nagging to set up — unless a tracker
  // already exists, the client has since signalled they're buying on, or the
  // agent has clicked through here to reopen setup.
  const onwardChainFree =
    noChainConfirmed && !reopenedOnward && !onward.view.exists && !onward.signalActive;

  function selectFocus(k: FocusKey) { setFocus(k); }
  function keyActivate(e: React.KeyboardEvent, k: FocusKey) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectFocus(k); }
  }

  // ── One photo link card ─────────────────────────────────────────────────────
  function LinkCard({ which }: { which: FocusKey }) {
    const isCurrent = which === "current";
    const side = which === "onward" ? onward : which === "related" ? related : null;
    const isOnward = which === "onward";
    const kicker = isCurrent ? "Current sale" : isOnward ? "Onward purchase" : "Related sale";
    const addr = isCurrent ? here : splitAddr(side!.address);
    const photo = isCurrent ? photoUrl : side?.photoUrl ?? null;
    const sel = focus === which;

    let visual: React.ReactNode;
    let statusText: string;
    let linkTitle = addr.title || (isOnward ? "Onward purchase" : "Related sale");
    if (isCurrent) {
      visual = <Ring pct={currentPercent ?? 0} tone="coral" />;
      statusText = currentSubtext;
    } else if (side!.view.exists) {
      const pct = side!.view.applicableCount > 0
        ? Math.round((side!.view.completeCount / side!.view.applicableCount) * 100) : 0;
      visual = <Ring pct={pct} tone={isOnward ? "coral" : "blue"} />;
      statusText = `Tracking ${side!.view.completeCount}/${side!.view.applicableCount}`;
    } else if (isOnward && onwardChainFree) {
      visual = <FreeCircle />;
      statusText = "No onward purchase";
      linkTitle = "Chain-free";
    } else {
      visual = <LockCircle />;
      statusText = "Not tracked";
    }

    return (
      <div
        className={`cx2-link cx2-${which}${sel ? " sel" : ""}${isCurrent ? " here" : ""}`}
        role="button"
        tabIndex={0}
        aria-pressed={sel}
        aria-label={`${kicker}: ${addr.title || "chain link"}`}
        onClick={() => selectFocus(which)}
        onKeyDown={(e) => keyActivate(e, which)}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="cx2-bg" />
        ) : (
          <span className="cx2-bg property-photo-fallback" aria-hidden />
        )}
        <span className="cx2-scrim" aria-hidden />
        <GlassCard glassId="chain-link-frost" label="Chain link · frost inset" defaultVariant="v04" className="cx2-frost">
          <span className="cx2-txt">
            {isCurrent
              ? <span className="cx2-badge">Current sale</span>
              : <span className="cx2-kicker">{kicker}</span>}
            <span className="cx2-linktitle">{linkTitle}</span>
            <span className="cx2-linkstat">{statusText}</span>
          </span>
          {visual}
        </GlassCard>
      </div>
    );
  }

  // ── The focus panel (detail for the selected link) ──────────────────────────
  function FocusPanel() {
    if (focus === "current") {
      return (
        <div className="cx2-focus">
          <div className="cx2-focus-hd">
            <div style={{ minWidth: 0 }}>
              {/* Coral label (primary colour), not a pill — matches the kicker
                  form of onward/related while marking it as the current sale. */}
              <div className="cx2-fkicker cur">Current sale</div>
              <div className="cx2-ftitle">{here.title}</div>
              {here.rest && <div className="cx2-faddr">{here.rest}</div>}
            </div>
            <button type="button" className="agent-link cx2-openfile" onClick={() => setActiveTab("milestones")}>
              Open the file<LinkArrow style={{ marginLeft: 0 }} />
            </button>
          </div>
          <div className="cx2-fstatus">
            <span className="cx2-dot" data-tone={currentStatus.tone} />
            <span>{currentStatus.label}</span>
            <span className="cx2-fsub">· {currentSubtext}</span>
          </div>
        </div>
      );
    }

    const which = focus; // "onward" | "related"
    const side = which === "onward" ? onward : related;
    const isOnward = which === "onward";
    const far = farSide[which];
    const addr = splitAddr(side.address);
    const nearLabel = isOnward ? "Buyer's steps" : "Seller's steps";
    const farLabel = isOnward ? "Seller's steps" : "Buyer's steps";
    const farDirection: "onward_seller" | "related_buyer" = isOnward ? "onward_seller" : "related_buyer";

    // Settled chain-free onward: this sale was marked "No chain" on the Chains
    // page, so instead of the setup prompt we confirm the decision and offer a
    // quiet way back in. Clicking through reveals the normal setup; actually
    // opening the tracker clears the No-chain flag server-side (openOnwardTracker).
    if (isOnward && onwardChainFree) {
      return (
        <div className="cx2-focus">
          <div className="cx2-focus-hd">
            <div style={{ minWidth: 0 }}>
              <div className="cx2-fkicker">Onward purchase</div>
              <div className="cx2-ftitle">Chain-free</div>
              <div className="cx2-faddr">
                You confirmed this seller isn&rsquo;t buying another property, so there&rsquo;s no onward purchase to track.
              </div>
            </div>
          </div>
          <button type="button" className="agent-link cx2-reopen" onClick={() => setReopenedOnward(true)}>
            They&rsquo;re buying onward after all<LinkArrow style={{ marginLeft: 0 }} />
          </button>
        </div>
      );
    }

    return (
      <div className="cx2-focus">
        <div className="cx2-focus-hd">
          <div style={{ minWidth: 0 }}>
            <div className="cx2-fkicker">{isOnward ? "Onward purchase" : "Related sale"}</div>
            <div className="cx2-ftitle">{addr.title || (isOnward ? "Onward purchase" : "Related sale")}</div>
            {addr.rest && <div className="cx2-faddr">{addr.rest}</div>}
          </div>
          {side.view.exists && (
            <div className="cx2-sidetoggle" role="tablist" aria-label="Which side of this deal">
              <button
                type="button" role="tab" aria-selected={!far}
                className={`agent-segment-pill agent-segment-pill-sm${!far ? " on" : ""}`}
                onClick={() => setFarSide((s) => ({ ...s, [which]: false }))}
              >{nearLabel}</button>
              <button
                type="button" role="tab" aria-selected={far}
                className={`agent-segment-pill agent-segment-pill-sm${far ? " on" : ""}`}
                onClick={() => setFarSide((s) => ({ ...s, [which]: true }))}
              >{farLabel}</button>
            </div>
          )}
        </div>
        <OnwardPurchaseCard
          key={`${which}-${far ? "far" : "near"}`}
          embedded
          defaultStepsOpen
          transactionId={transactionId}
          initialView={far ? side.farView : side.view}
          signalActive={far ? false : side.signalActive}
          onwardAddress={side.address}
          direction={far ? farDirection : which}
          seedTenure={far ? side.view.tenure : null}
          seedShareOfFreehold={far ? side.view.isShareOfFreehold : false}
        />
      </div>
    );
  }

  return (
    <Card id="chain-section" padding="none">
      <div className="cx2">
        {/* Header */}
        <div className="cx2-hd">
          <div>
            <h3 className="cx2-heading">Property chain</h3>
            <p className="cx2-sub">See how this sale fits into the chain and track the other links.</p>
          </div>
          <button type="button" onClick={() => setActiveTab("chain")} className="agent-link cx2-open">
            Open chain<LinkArrow style={{ marginLeft: 0 }} />
          </button>
        </div>

        {/* Strip of photo link cards — related (left) · this sale · onward (right).
            A connector bar sits in EVERY gap (never just one side) so spacing is
            even and no two cards touch. DOM order is [onward, current, related];
            row-reverse flips it to the visual order, and collapses to
            onward → current → related top-to-bottom when stacked. */}
        <div className="cx2-strip">
          <LinkCard which="onward" />
          <span className="cx2-bar" aria-hidden />
          <LinkCard which="current" />
          {showRelated && <span className="cx2-bar" aria-hidden />}
          {showRelated && <LinkCard which="related" />}
        </div>

        {/* Focus panel for the selected link */}
        <div className="cx2-panelwrap"><FocusPanel /></div>

        {/* Footer */}
        <div className="cx2-foot">
          <div className="cx2-foot-row">
            <span className="cx2-foot-left" data-open={learnOpen ? "true" : undefined}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="4.5" y="11" width="15" height="9" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
              </svg>
              Reported progress stays on your file and isn&rsquo;t shared with other agencies.
            </span>
            <button type="button" className="agent-link cx2-learn" onClick={() => setLearnOpen((o) => !o)} aria-expanded={learnOpen}>
              Learn more<LinkArrow style={{ marginLeft: 0 }} />
            </button>
          </div>
          <div className="cx2-learn-wrap" data-open={learnOpen ? "true" : undefined}>
            <div className="cx2-learn-inner">
              <p className="cx2-learn-body">
                Set up tracking on a link and we&rsquo;ll keep its reported progress here. Your client can also keep you updated on their related sale or purchase through their portal. Anything reported stays on your file and isn&rsquo;t shared with other agencies.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .cx2{display:flex;flex-direction:column;container-type:inline-size}
        .cx2-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:20px 22px 4px}
        .cx2-heading{margin:0;font-size:18px;font-weight:700;letter-spacing:-0.015em;color:var(--agent-text-primary)}
        .cx2-sub{margin:4px 0 0;font-size:13px;color:var(--agent-text-secondary);line-height:1.45}
        .cx2-open{flex-shrink:0;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px}

        /* Strip: related (left) · current (middle) · onward (right) via row-reverse
           over DOM order [onward, current, related]. */
        .cx2-strip{display:flex;flex-direction:row-reverse;align-items:stretch;gap:0;padding:14px 22px 6px}
        .cx2-bar{align-self:center;height:2px;flex:0 0 20px;min-width:12px;background:var(--agent-border-strong, rgba(15,23,42,0.16));border-radius:2px}

        .cx2-link{flex:1;min-width:0;position:relative;border-radius:14px;overflow:hidden;min-height:126px;cursor:pointer;
          isolation:isolate;background:var(--agent-surface-nested, rgba(15,23,42,0.04));
          transition:transform 160ms cubic-bezier(0.22,1,0.36,1),box-shadow 160ms ease}
        .cx2-link:hover{transform:translateY(-1px)}
        .cx2-link:focus-visible{outline:2px solid var(--agent-coral);outline-offset:2px}
        .cx2-link.sel{box-shadow:0 0 0 2px rgba(var(--agent-coral-rgb),0.5)}
        .cx2-link.sel.here{box-shadow:0 0 0 2px var(--agent-coral)}
        .cx2-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;display:block}
        .cx2-scrim{position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(16,20,28,0.20),rgba(16,20,28,0.52))}

        /* Frost inset (GlassCard v04 thin-glass default) — light text over the photo */
        .cx2-frost{position:absolute;inset:10px;border-radius:11px;display:flex;align-items:center;justify-content:center;
          gap:12px;padding:0 13px;overflow:hidden}
        .cx2-txt{min-width:0;text-align:left;display:flex;flex-direction:column;gap:2px}
        .cx2-kicker{font-size:9.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,0.72)}
        .cx2-linktitle{font-size:13.5px;font-weight:650;line-height:1.2;color:#fff}
        .cx2-linkstat{font-size:11px;color:rgba(255,255,255,0.82)}
        .cx2-ring{flex-shrink:0}
        .cx2-lock{width:46px;height:46px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;
          border-radius:50%;border:1.5px solid rgba(255,255,255,0.35);color:rgba(255,255,255,0.75)}
        .cx2-free{width:46px;height:46px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;
          border-radius:50%;border:1.5px solid rgba(255,255,255,0.45);color:#fff}
        .cx2-reopen{margin-top:12px;font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px}
        /* Filled coral badge so the current-sale marker stays visible on any frost */
        .cx2-badge{align-self:flex-start;display:inline-flex;align-items:center;font-size:9.5px;font-weight:800;
          letter-spacing:.06em;text-transform:uppercase;padding:3px 9px;border-radius:999px;color:#fff;margin-bottom:3px;
          background:var(--agent-coral, #FF6B4A);
          background-image:linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0) 62%);
          box-shadow:0 1px 3px rgba(0,0,0,0.28),inset 0 1px 0 rgba(255,255,255,0.4)}

        /* Focus panel */
        .cx2-panelwrap{padding:2px 22px 4px}
        .cx2-focus{padding:14px 15px;border-radius:14px;background:var(--agent-surface-nested, rgba(15,23,42,0.03));border:1px solid var(--agent-border-default)}
        .cx2-focus-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .cx2-fkicker{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--agent-text-muted)}
        .cx2-fkicker.cur{color:var(--agent-coral-deep, #E8542F)}
        .cx2-ftitle{font-size:16px;font-weight:700;letter-spacing:-0.01em;color:var(--agent-text-primary);margin-top:2px}
        .cx2-faddr{font-size:12.5px;color:var(--agent-text-secondary);margin-top:1px}
        .cx2-openfile{font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px;flex-shrink:0}
        .cx2-fstatus{display:flex;align-items:center;gap:7px;margin-top:8px;font-size:13px;color:var(--agent-text-primary)}
        .cx2-fsub{color:var(--agent-text-secondary)}
        .cx2-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;background:var(--agent-text-muted)}
        .cx2-dot[data-tone="active"],.cx2-dot[data-tone="done"]{background:var(--agent-success, #16a34a)}
        .cx2-dot[data-tone="hold"]{background:var(--agent-warning, #D59929)}
        .cx2-sidetoggle{display:inline-flex;gap:3px;padding:3px;border-radius:10px;background:var(--agent-border-default, rgba(15,23,42,0.06));flex-shrink:0}

        /* Footer */
        .cx2-foot{border-top:0.5px solid var(--agent-border-default);padding:13px 22px 16px;margin-top:8px}
        .cx2-foot-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .cx2-foot-left{display:inline-flex;align-items:center;gap:9px;font-size:12.5px;color:var(--agent-text-secondary);min-width:0;transition:color 220ms ease,font-weight 220ms ease}
        .cx2-foot-left svg{flex-shrink:0;color:var(--agent-text-muted);transition:color 220ms ease}
        .cx2-foot-left[data-open="true"]{color:var(--agent-text-primary);font-weight:600}
        .cx2-foot-left[data-open="true"] svg{color:var(--agent-text-primary)}
        .cx2-learn{font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:5px;flex-shrink:0}
        .cx2-learn-wrap{display:grid;grid-template-rows:0fr;transition:grid-template-rows 260ms cubic-bezier(0.22,1,0.36,1)}
        .cx2-learn-wrap[data-open="true"]{grid-template-rows:1fr}
        .cx2-learn-inner{overflow:hidden;min-height:0}
        .cx2-learn-body{margin:0;padding-top:10px;font-size:13px;color:var(--agent-text-secondary);line-height:1.5;max-width:760px}
        @media (prefers-reduced-motion:reduce){.cx2-learn-wrap,.cx2-link,.cx2-ring circle,.cx2-foot-left,.cx2-foot-left svg{transition:none}}

        /* Stack when the CARD (not the viewport) is too narrow for three across —
           onward on top, then this sale, then related, all full width. */
        @container (max-width: 560px){
          .cx2-strip{flex-direction:column;gap:8px}
          .cx2-bar{display:none}
        }
        /* Fallback for browsers without container queries */
        @supports not (container-type: inline-size){
          @media (max-width: 720px){
            .cx2-strip{flex-direction:column;gap:8px}
            .cx2-bar{display:none}
          }
        }
      `}</style>
    </Card>
  );
}

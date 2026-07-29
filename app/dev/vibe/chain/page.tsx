"use client";

// /dev/vibe/chain — deep-dive chain page in the Elevra light language.
// Preview only. Real drawer fields (status labels, position, descriptor)
// mirror ChainDrawer.tsx + LinkCard.tsx. Enrichments (price, agent person,
// milestone, activity) are page-level additions clearly marked in the data.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { PropertyScene } from "../PropertyScene";
import { fullChain, chainSummary, chainBanners, chainActivity } from "./chain-data";
import styles from "./chain.module.css";

export default function VibeChainPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onScroll = () => {
      if (!rootRef.current) return;
      rootRef.current.dataset.scrolled = window.scrollY > 20 ? "true" : "false";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={styles.root} ref={rootRef}>
      <header className={styles.header}>
        <div className={styles.headerCrumbs}>
          <Link href="/dev/vibe">Hub</Link>
          <span className={styles.crumbSep}>/</span>
          <Link href="/dev/vibe/file">12 Oakfield Road</Link>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.crumbCurrent}>Chain</span>
        </div>
        <div className={styles.headerActions}>
          <Link href="/dev/vibe/file" className={styles.headerBtn}>← Back to file</Link>
        </div>
      </header>

      <div className={styles.pageHead}>
        <div className={styles.pageEyebrow}>Property chain</div>
        <h1 className={styles.pageTitle}>The Berkhamsted chain</h1>
        <p className={styles.pageLede}>
          Four linked sales, top to bottom. Your file sits in the middle. When one moves,
          everything below moves with it. When one stalls, the whole chain waits.
        </p>
      </div>

      <div className={styles.body}>
        {/* Main column — the chain itself */}
        <div>
          {/* Real ChainDrawer banners at the top */}
          {chainBanners.map((b) => (
            <div key={b.id} className={styles.warningCard} data-tone={b.tone} style={{ marginBottom: 12 }}>
              <div className={styles.warningIcon}>{b.tone === "danger" ? "!" : "⚠"}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--c-text)" }}>{b.title}</div>
                <div className={styles.warningLine}>{b.body}</div>
                {b.actionLabel && (
                  <a href="#" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "var(--c-accent)", fontWeight: 600, textDecoration: "none" }}>
                    {b.actionLabel} →
                  </a>
                )}
              </div>
            </div>
          ))}

          <div className={styles.chain}>
            <div className={styles.chainHead}>
              <div className={styles.chainHeadTitle}>Chain of {chainSummary.linkCount}</div>
              <div className={styles.chainHeadMeta}>
                <div className={styles.chainHeadValue}>{chainSummary.totalValue}</div>
                <div>Total value</div>
              </div>
            </div>

            <div className={styles.chainStack}>
              {fullChain.map((link, i) => (
                <div key={link.id} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {i > 0 && <div className={styles.chainConnector} />}
                  <ChainLinkCard link={link} index={i} />
                </div>
              ))}
            </div>

            <div className={styles.actionsBar}>
              <button className={styles.actionsBtn}>+ Add sale above</button>
              <button className={styles.actionsBtn}>+ Add sale below</button>
              <button className={styles.actionsBtn} data-primary="true">Send all pending invites</button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.summaryCard}>
            <div className={styles.summaryLabel}>Chain value</div>
            <div className={styles.summaryValue}>{chainSummary.totalValue}</div>
            <div className={styles.summaryMeta}>Across {chainSummary.linkCount} linked sales</div>

            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: "var(--c-text-muted)" }}>Claim rate</span>
                <span style={{ color: "var(--c-text)", fontWeight: 700 }}>{chainSummary.claimedCount} of {chainSummary.linkCount}</span>
              </div>
              <div className={styles.claimRateBar}>
                <div className={styles.claimRateFill} style={{ width: `${chainSummary.claimRate}%` }} />
              </div>
            </div>

            <div className={styles.summaryRow}>
              <span className={styles.summaryRowLabel}>Weakest link</span>
              <span className={styles.summaryRowValue} data-tone="danger">Link {chainSummary.weakestLinkPosition}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryRowLabel}>Predicted completion</span>
              <span className={styles.summaryRowValue}>{chainSummary.predictedCompletion}</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryRowLabel}>Oldest sale</span>
              <span className={styles.summaryRowValue}>{chainSummary.daysOldest} days</span>
            </div>
            <div className={styles.summaryRow}>
              <span className={styles.summaryRowLabel}>Chain risk</span>
              <span className={styles.summaryRowValue} data-tone="warn">{chainSummary.chainRisk}</span>
            </div>
          </div>

          <div className={styles.warningCard} data-tone="info">
            <div className={styles.warningIcon}>i</div>
            <div className={styles.warningLine}>
              This is enriched over the drawer. Sale prices, agent person, milestone, and the
              cross-link activity feed are page-level additions.
            </div>
          </div>

          <div className={styles.activityCard}>
            <div className={styles.cardHead}>
              <div className={styles.cardTitle}>Chain activity</div>
            </div>
            <div className={styles.activityList}>
              {chainActivity.map((a) => (
                <div key={a.id} className={styles.activityRow} data-kind={a.kind}>
                  <div className={styles.activityDot} />
                  <div className={styles.activityLink}>{a.link}</div>
                  <div className={styles.activityEvent}>{a.event}</div>
                  <div className={styles.activityTime}>{a.timeAgo}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className={styles.footer}>
        /dev/vibe/chain · not linked from production · fabricated data · status labels mirror real drawer
      </div>
    </div>
  );
}

function ChainLinkCard({ link, index }: { link: (typeof fullChain)[number]; index: number }) {
  return (
    <div
      className={styles.link}
      data-viewer={link.isViewer}
      data-status={link.status}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className={styles.linkCard}>
        <div className={styles.linkScene}>
          <PropertyScene palette={link.scene} seed={index * 2} />
        </div>

        <div className={styles.linkBody}>
          <div className={styles.linkPosition}>Position {link.position} of {fullChain.length}</div>
          <div className={styles.linkAddress}>{link.address1}</div>
          <div className={styles.linkAgent}>
            {link.address2}, {link.postcode} · <strong>{link.agencyName}</strong>
            {link.agentPerson && link.status !== "Unclaimed" && link.status !== "Declined" && (
              <> · {link.agentPerson}</>
            )}
          </div>
          {link.progress !== undefined && (
            <>
              <div className={styles.linkMilestone}>
                <strong>{link.currentMilestone ?? "In progress"}</strong>
                <span>· {link.progress}%</span>
                {link.lastActivity && <span>· active {link.lastActivity}</span>}
              </div>
              <div className={styles.linkProgress}>
                <div className={styles.linkProgressFill} style={{ width: `${link.progress}%` }} />
              </div>
            </>
          )}
          {link.descriptorLine && link.progress === undefined && (
            <div className={styles.linkMilestone}>{link.descriptorLine}</div>
          )}
        </div>

        <div className={styles.linkRight}>
          {link.price && <div className={styles.linkPrice}>{link.price}</div>}
          <div className={styles.linkStatus} data-status={link.status}>
            {link.status}
          </div>
        </div>

        {link.status === "Declined" && link.declinedReason && (
          <div className={styles.linkDeclineReason}>
            <strong>Declined:</strong> {link.declinedReason}
            <a href="#" className={styles.linkAction} style={{ marginLeft: "auto" }}>Resend invite</a>
          </div>
        )}

        {link.status === "Unclaimed" && (
          <div className={styles.linkExtra}>
            <div>
              <div className={styles.linkExtraLabel}>Suggested contact</div>
              <div className={styles.linkExtraValue}>{link.agencyName} · {link.contactHint}</div>
            </div>
            <a href="#" className={styles.linkAction}>Send invite</a>
          </div>
        )}

        {(link.status === "Claimed" || link.status === "Your file") && link.agentEmail && (
          <div className={styles.linkExtra}>
            <div>
              <div className={styles.linkExtraLabel}>Email</div>
              <div className={styles.linkExtraValue}>{link.agentEmail}</div>
            </div>
            <div>
              <div className={styles.linkExtraLabel}>Phone</div>
              <div className={styles.linkExtraValue}>{link.agentPhone}</div>
            </div>
            <a href={link.isYourFile ? "/dev/vibe/file" : "#"} className={styles.linkActionSecondary}>
              {link.isYourFile ? "Open file →" : "View progress →"}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

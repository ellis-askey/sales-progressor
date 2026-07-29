"use client";

// /dev/vibe/file — the property file page in the "About Houses" language.
// Preview only. Content mirrors the real production file page's fields;
// anything additive is clearly marked "PROPOSED".

import { useState, useEffect } from "react";
import Link from "next/link";
import { PropertyScene } from "../PropertyScene";
import { PhaseIcon } from "../PhaseIcon";
import { detailFile, chainLinks, chainIntel, phases } from "../data";
import {
  fileContacts, solicitor, broker, fees, saleHealth, riskScore, fileHealth,
  keyDates, reminders, activity, tabCounts, notes, automation,
  propertyIntel, smartCallouts, nextAction,
  vendorSections, purchaserSections, stepsProgress,
  automatedEmails, fullReminders, snoozedReminders, completedReminders,
  agentTodos, agentRequests, fullActivity,
} from "./file-data";
import type {
  MilestoneSection, Milestone, MilestoneSide, ReminderUrgency, ReminderSide,
  Todo, AgentRequest, ActivityFilter, FullActivityEntry,
} from "./file-data";
import styles from "./file.module.css";

type TabKey = "overview" | "steps" | "reminders" | "todo" | "activity";

const RING_RADIUS = 34;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

// Card entrance stagger — same rhythm as the hub v3.1
function delay(idx: number) {
  return { animationDelay: `${100 + idx * 70}ms` } as React.CSSProperties;
}

export default function VibeFilePage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [holdVisible, setHoldVisible] = useState(false);
  const [holdModalOpen, setHoldModalOpen] = useState(false);

  // Ring fill from empty → target after mount
  const [ringOffset, setRingOffset] = useState(RING_CIRC);
  useEffect(() => {
    const t = setTimeout(() => {
      setRingOffset(RING_CIRC * (1 - detailFile.progress / 100));
    }, 60);
    return () => clearTimeout(t);
  }, []);

  const healthTitle = fileHealth.overdueCount > 0
    ? `${fileHealth.overdueCount} reminder${fileHealth.overdueCount > 1 ? "s" : ""} overdue`
    : fileHealth.actionableCount > 0
      ? `${fileHealth.actionableCount} reminder${fileHealth.actionableCount > 1 ? "s" : ""} need${fileHealth.actionableCount > 1 ? "" : "s"} attention`
      : "File may be behind schedule";
  const healthSub = fileHealth.actionableCount > 0 && fileHealth.isBehind
    ? "File may be behind schedule too — take a look."
    : null;

  return (
    <div className={styles.root}>
      {/* ─── Header ─── */}
      <header className={styles.header}>
        <div className={styles.headerCrumbs}>
          <Link href="/dev/vibe">Hub</Link>
          <span className={styles.crumbSep}>/</span>
          <span className={styles.crumbCurrent}>12 Oakfield Road</span>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.headerBtn} onClick={() => setHoldModalOpen(true)}>
            Put on hold
          </button>
          <button className={styles.headerBtn} onClick={() => setHoldVisible((h) => !h)}>
            {holdVisible ? "Hide hold banner" : "Show hold banner"}
          </button>
          <Link href="/dev/vibe" className={styles.headerBtn}>← Back to hub</Link>
        </div>
      </header>

      {/* Optional on-hold banner — niche state demo */}
      {holdVisible && (
        <div className={styles.holdBanner}>
          <div className={styles.holdBannerIcon}>⏸</div>
          <div className={styles.holdBannerBody}>
            <div className={styles.holdBannerTitle}>On hold until 8 August</div>
            <div className={styles.holdBannerMeta}>
              Paused on 3 Jul by Ellis · vendor requested a two-week break for family reasons
            </div>
          </div>
          <div className={styles.holdBannerActions}>
            <button className={styles.holdInlineBtn}>Extend by 1 week</button>
            <button className={styles.holdInlineBtn}>Change date</button>
            <button className={styles.holdInlineBtn} data-primary="true">Take off hold</button>
          </div>
        </div>
      )}

      {/* ─── Property Hero — light glass card with framed scene ─── */}
      <div className={styles.hero}>
        <div className={styles.heroScene}>
          <PropertyScene palette={detailFile.scene} />
          <div className={styles.heroTopBar}>
            <div className={styles.heroPills}>
              <span className={styles.heroPill} data-tone="danger">
                <span className={styles.heroPillDot} />
                Escalated
              </span>
              <span className={styles.heroPill}>Freehold</span>
              <span className={styles.heroPill}>Onward purchase</span>
            </div>
          </div>
        </div>

        <div className={styles.heroBottom}>
          <div className={styles.heroAddressBlock}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <span className={styles.heroPill}>Self-managed</span>
              <span className={styles.heroPill} data-tone="chain">Link 2 of 4</span>
            </div>
            <div className={styles.heroAddressLine1}>{detailFile.address1}</div>
            <div className={styles.heroAddressLine2}>
              {detailFile.address2}, {detailFile.postcode}
            </div>
            <div className={styles.heroAgent}>
              <div className={styles.heroAgentAvatar}>EL</div>
              Ellis Laurent · Akeman Residential · added 12 May · 74 days on file
            </div>
          </div>

          <div className={styles.heroPriceBlock}>
            <div>
              <div className={styles.heroPrice}>{detailFile.price}</div>
              <div className={styles.heroPriceMeta}>Sale price · Exchange in {detailFile.exchangeIn}</div>
            </div>
            <div className={styles.progressRing}>
              <svg viewBox="0 0 80 80">
                <defs>
                  <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#7ba4ff" />
                    <stop offset="100%" stopColor="#3d7df7" />
                  </linearGradient>
                </defs>
                <circle cx="40" cy="40" r={RING_RADIUS} className={styles.progressRingTrack} />
                <circle
                  cx="40" cy="40" r={RING_RADIUS}
                  className={styles.progressRingFill}
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className={styles.progressRingText}>
                {detailFile.progress}%
                <div className={styles.progressRingLabel}>Progress</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stat strip — real facts only ─── */}
      <div className={styles.statStrip}>
        <div className={styles.statTile} style={delay(0)}>
          <div className={styles.statLabel}>Predicted exchange</div>
          <div className={styles.statValue}>15 Aug</div>
          <div className={styles.statMeta}>21 days from today</div>
        </div>
        <div className={styles.statTile} style={delay(1)}>
          <div className={styles.statLabel}>Predicted completion</div>
          <div className={styles.statValue}>5 Sep</div>
          <div className={styles.statMeta}>3 weeks after exchange</div>
        </div>
        <div className={styles.statTile} style={delay(2)}>
          <div className={styles.statLabel}>Time on file</div>
          <div className={styles.statValue}>{saleHealth.timeOnFile}</div>
          <div className={styles.statMeta}>Since 12 May</div>
        </div>
        <div className={styles.statTile} style={delay(3)}>
          <div className={styles.statLabel}>Fall-through risk</div>
          <div className={styles.statValue}>{riskScore.score}/100</div>
          <div className={styles.statMeta}>{riskScore.label}</div>
        </div>
      </div>

      {/* ─── Tabs ─── */}
      <div className={styles.tabBar}>
        <button className={styles.tab} data-active={tab === "overview"} onClick={() => setTab("overview")}>
          Overview
        </button>
        <button className={styles.tab} data-active={tab === "steps"} onClick={() => setTab("steps")}>
          Steps {tabCounts.steps && <span className={styles.tabCount}>{tabCounts.steps}</span>}
        </button>
        <button className={styles.tab} data-active={tab === "reminders"} onClick={() => setTab("reminders")}>
          Reminders {tabCounts.reminders && <span className={styles.tabCount} data-tone="danger">{tabCounts.reminders}</span>}
        </button>
        <button className={styles.tab} data-active={tab === "todo"} onClick={() => setTab("todo")}>
          To-do {tabCounts.todo && <span className={styles.tabCount}>{tabCounts.todo}</span>}
        </button>
        <button className={styles.tab} data-active={tab === "activity"} onClick={() => setTab("activity")}>
          Activity
        </button>
      </div>

      {/* ─── Milestone strip ─── */}
      <div className={styles.milestoneStrip}>
        {phases.map((phase) => (
          <div key={phase.id} className={styles.milestoneStep} data-state={phase.state}>
            <div className={styles.milestoneBadge}>
              <PhaseIcon kind={phase.icon} size={24} />
            </div>
            <div className={styles.milestoneName}>{phase.name}</div>
            <div className={styles.milestoneDetail}>{phase.detail}</div>
          </div>
        ))}
      </div>

      {/* ─── Body ─── */}
      {tab === "overview" && (
        <div className={styles.body + " " + styles.tabPanel} key="overview">
          {/* MAIN column — order mirrors real OverviewPanel */}
          <div className={styles.main}>
            {/* FileHealthBanner — real */}
            <div className={styles.healthBanner} data-kind={fileHealth.kind} style={delay(0)}>
              <div className={styles.healthBannerIcon}>!</div>
              <div className={styles.healthBannerBody}>
                <div className={styles.healthBannerTitle}>{healthTitle}</div>
                {healthSub && <div className={styles.healthBannerSub}>{healthSub}</div>}
              </div>
              <a href="#" className={styles.healthBannerAction} onClick={(e) => { e.preventDefault(); setTab("reminders"); }}>
                View reminders →
              </a>
            </div>

            {/* Smart callouts — PROPOSED (kept as additive intelligence) */}
            <div className={styles.callouts}>
              {smartCallouts.map((c, i) => (
                <div key={i} className={styles.callout} data-tone={c.tone} style={delay(1 + i)}>
                  <div className={styles.calloutDot} />
                  <div className={styles.calloutBody}>
                    <div className={styles.calloutLine}>{c.line}</div>
                  </div>
                  <a href="#" className={styles.calloutBtn}>{c.action}</a>
                </div>
              ))}
            </div>

            {/* Contacts — real ContactsSection */}
            <div className={styles.card} style={delay(3)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>People on this sale</div>
                <a href="#" className={styles.cardAction}>Add contact</a>
              </div>
              <div className={styles.contactList}>
                {fileContacts.map((c) => (
                  <div
                    key={c.name}
                    className={styles.contactRow}
                    style={{ ["--h" as string]: c.hue } as React.CSSProperties}
                  >
                    <div className={styles.contactAvatar}>{c.initials}</div>
                    <div>
                      <div className={styles.contactName}>
                        {c.name}
                        {c.isLead && <span className={styles.contactLead}>Lead</span>}
                      </div>
                      <div className={styles.contactRole}>{c.role} · {c.email}</div>
                    </div>
                    <div className={styles.contactChevron}>›</div>

                    <div className={styles.contactPreview}>
                      <div className={styles.contactPreviewRow}>
                        <span className={styles.contactPreviewLabel}>Phone</span>
                        <span className={styles.contactPreviewValue}>{c.phone}</span>
                      </div>
                      <div className={styles.contactPreviewRow}>
                        <span className={styles.contactPreviewLabel}>Last contact</span>
                        <span className={styles.contactPreviewValue}>{c.lastContact}</span>
                      </div>
                      <div className={styles.contactPreviewRow}>
                        <span className={styles.contactPreviewLabel}>Response</span>
                        <span
                          className={styles.contactPreviewValue}
                          data-tone={c.responseAvg.includes("fast") ? "good" : c.responseAvg.includes("no reply") ? "warn" : undefined}
                        >
                          {c.responseAvg}
                        </span>
                      </div>
                      <div className={styles.contactPreviewRow}>
                        <span className={styles.contactPreviewLabel}>Portal login</span>
                        <span
                          className={styles.contactPreviewValue}
                          data-tone={c.portalLogin === "not yet" ? "warn" : "good"}
                        >
                          {c.portalLogin}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NextActionCard — redesigned to mirror the real component */}
            <div className={styles.nextAction} style={delay(4)}>
              <div style={{ flex: 1 }}>
                <div className={styles.nextActionHead}>
                  <div className={styles.nextActionFlame}>
                    <div className={styles.nextActionFlameGlyph}>◈</div>
                    Next action
                  </div>
                  <button className={styles.nextActionRescheduleBtn} title="Reschedule">⌸</button>
                </div>
                <div className={styles.nextActionCardTitle}>{nextAction.ruleName}</div>
                <div className={styles.nextActionDesc}>{nextAction.waitingOn}</div>
                <div className={styles.nextActionDueBadge} data-tone={nextAction.dueTone}>
                  {nextAction.dueLabel}
                </div>
                <div className={styles.nextActionButtonRow}>
                  <button className={styles.nextActionSecondaryBtn} onClick={() => setTab("reminders")}>
                    View reminders
                  </button>
                  <button className={styles.nextActionSecondaryBtn}>
                    ✓ Mark complete
                  </button>
                </div>
              </div>
            </div>

            {/* Reminders — real RemindersWidget */}
            <div className={styles.card} style={delay(5)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Reminders</div>
                <a href="#" className={styles.cardAction}>Edit schedule</a>
              </div>
              <div className={styles.reminderList}>
                {reminders.map((r) => (
                  <div key={r.id} className={styles.reminderRow} data-overdue={r.overdue}>
                    <div className={styles.reminderIcon}>
                      {r.channel === "email" ? "✉" : r.channel === "sms" ? "◍" : "◐"}
                    </div>
                    <div className={styles.reminderMain}>
                      <div className={styles.reminderWho}>{r.who}</div>
                      <div className={styles.reminderWhat}>{r.what}</div>
                    </div>
                    <div className={styles.reminderDue}>{r.due}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI summary — real AiSummaryCard (Ellis-only in prod) */}
            <div className={styles.aiCard} style={delay(6)}>
              <div className={styles.aiCardHead}>
                <div className={styles.aiCardEyebrow}>
                  <span className={styles.aiCardDot} />
                  AI summary · updated 3h ago
                </div>
                <a href="#" className={styles.cardAction}>Regenerate</a>
              </div>
              <div className={styles.aiCardBody}>
                Sale is <strong>26 days into the enquiries stage</strong>. The single biggest drag is
                <strong> Grange Legal</strong>: they&rsquo;ve had search results outstanding since 12 May
                and haven&rsquo;t replied to two chases. Buyer&rsquo;s finance is <strong>secured</strong>
                (Meridian offer to 31 Oct). Vendor mood is co-operative. Recommended move: escalate
                to a partner at Grange Legal by end of week.
              </div>
            </div>

            {/* Recent activity */}
            <div className={styles.card} style={delay(7)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Recent activity</div>
                <a href="#" className={styles.cardAction} onClick={(e) => { e.preventDefault(); setTab("activity"); }}>
                  Full timeline
                </a>
              </div>
              <div className={styles.activityList}>
                {activity.map((a) => (
                  <div key={a.id} className={styles.activityRow} data-kind={a.kind}>
                    <div className={styles.activityDot} />
                    <div className={styles.activityHead}>
                      <span className={styles.activityActor}>{a.actor}</span>
                      <span className={styles.activityEvent}>{a.event}</span>
                      <span className={styles.activityTime}>{a.timeAgo}</span>
                    </div>
                    {a.detail && <div className={styles.activityDetail}>{a.detail}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Property chain — mini + link out */}
            <div className={styles.chainPreview} style={delay(8)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Property chain</div>
                <Link href="/dev/vibe#chain" className={styles.cardAction}>Open full chain →</Link>
              </div>
              <div className={styles.chainMini}>
                {chainLinks.map((link, i) => (
                  <div key={link.id} style={{ display: "flex", alignItems: "center" }}>
                    {i > 0 && <div className={styles.chainConnector} />}
                    <a
                      href="#"
                      className={styles.chainMiniLink}
                      data-viewer={link.isViewer}
                      data-declined={link.status === "DECLINED"}
                    >
                      <div className={styles.chainMiniScene}>
                        <PropertyScene palette={link.scene} seed={i * 2} />
                      </div>
                      <div className={styles.chainMiniLabel}>{link.status}</div>
                      <div className={styles.chainMiniValue}>{link.price}</div>
                    </a>
                  </div>
                ))}
              </div>
              <div className={styles.chainSummary}>
                <div className={styles.chainSummaryText}>
                  Chain of 4 · <strong>{chainIntel.claimedCount}</strong> claimed · weakest link: <strong>{chainIntel.weakestLink}</strong>
                </div>
                <div className={styles.chainSummaryText}>
                  Total value <strong>{chainIntel.totalValue}</strong>
                </div>
              </div>
            </div>

            {/* Solicitor — real SolicitorSection */}
            <div className={styles.partyCard} style={delay(9)}>
              <div className={styles.partyHead}>
                <div>
                  <div className={styles.partyLabel}>Vendor solicitor</div>
                  <div className={styles.partyFirm}>{solicitor.firm}</div>
                  <div className={styles.partyContact}>{solicitor.contact} · {solicitor.email}</div>
                </div>
                <div className={styles.partyStatusPill} data-tone="warn">
                  Silent {solicitor.lastResponse}
                </div>
              </div>
              <div className={styles.partyOutstanding}>
                Outstanding: <strong style={{ color: "rgba(255,255,255,0.95)" }}>{solicitor.outstanding}</strong> ·
                We&rsquo;ve chased three times this cycle.
              </div>
            </div>

            {/* Broker — real BrokerSection */}
            <div className={styles.partyCard} style={delay(10)}>
              <div className={styles.partyHead}>
                <div>
                  <div className={styles.partyLabel}>Buyer&rsquo;s broker</div>
                  <div className={styles.partyFirm}>{broker.firm}</div>
                  <div className={styles.partyContact}>{broker.contact} · {broker.email}</div>
                </div>
                <div className={styles.partyStatusPill} data-tone="good">
                  {broker.status}
                </div>
              </div>
              <div className={styles.partyOutstanding}>
                Offer received <strong style={{ color: "rgba(255,255,255,0.95)" }}>{broker.offerDate}</strong> ·
                Valid to 31 Oct 2026.
              </div>
            </div>

            {/* Fall-through risk — real RiskScoreWidget */}
            <div id="risk-score" className={styles.card} style={delay(11)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Fall-through risk</div>
              </div>
              <div className={styles.riskScoreLine}>
                <span>Risk score</span>
                <span className={styles.riskScoreValue}>{riskScore.score} / 100</span>
              </div>
              <div className={styles.riskBar}>
                <div
                  className={styles.riskBarFill}
                  data-band={riskScore.band}
                  style={{ width: `${riskScore.score}%` }}
                />
              </div>
              <div className={styles.riskTicks}>
                <span>Low</span>
                <span>High</span>
              </div>
              <div className={styles.riskLabel} data-band={riskScore.band}>{riskScore.label}</div>
              <div className={styles.riskBody}>{riskScore.body}</div>
            </div>

            {/* Property intel — real PropertyIntelCard fields */}
            <div className={styles.card} style={delay(12)}>
              <div className={styles.cardHead}>
                <div>
                  <div className={styles.cardTitle}>Property Intel</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>
                    {propertyIntel.postcode}
                  </div>
                </div>
                <div className={styles.intelPills}>
                  <a href="#" className={styles.intelPill} style={{ background: "#00deb6", color: "#0a0a0a" }}>Rightmove</a>
                  <a href="#" className={styles.intelPill} style={{ background: "#8c1d82" }}>Zoopla</a>
                  <a href="#" className={styles.intelPill} style={{ background: "#1d70b8" }}>Title info</a>
                </div>
              </div>
              <div className={styles.intelCaveat}>{propertyIntel.caveat}</div>

              <div className={styles.intelSectionHead}>Price paid history</div>
              {propertyIntel.priceHistory.map((h, i) => (
                <div key={i} className={styles.priceHistoryRow}>
                  <div className={styles.priceHistoryDate}>{h.date}</div>
                  <div className={styles.priceHistoryPrice}>{h.price}</div>
                  <div className={styles.priceHistoryType}>{h.type} · {h.extras}</div>
                </div>
              ))}

              <div className={styles.intelSectionHead}>EPC</div>
              <div className={styles.epcBlock}>
                <div className={styles.epcBadge} data-rating={propertyIntel.epc.rating}>
                  {propertyIntel.epc.rating}
                </div>
                <div>
                  <div className={styles.epcAddress}>{propertyIntel.epc.address}</div>
                  <div className={styles.epcInspected}>
                    <span className={styles.epcScore}>{propertyIntel.epc.score} / 100</span>
                    &nbsp; · Inspected {propertyIntel.epc.inspected}
                  </div>
                </div>
                <a href="#" className={styles.epcLink}>View on GOV.UK →</a>
              </div>
            </div>

            {/* Notes — real TransactionNotes */}
            <div className={styles.card} style={delay(13)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Notes</div>
                <a href="#" className={styles.cardAction}>+ Add note</a>
              </div>
              <div className={styles.noteList}>
                {notes.map((n) => (
                  <div key={n.id} className={styles.note}>
                    <div className={styles.noteMeta}>
                      <strong>{n.author}</strong><span>·</span><span>{n.timeAgo}</span>
                    </div>
                    <div className={styles.noteBody}>{n.body}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Automation — real AutomationControls (trimmed to real fields) */}
            <div className={styles.card} style={delay(14)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Automation</div>
                <a href="#" className={styles.cardAction}>Change</a>
              </div>
              <div className={styles.automation}>
                <div className={styles.autoRow}>
                  <span className={styles.autoLabel}>Chase emails</span>
                  <span className={styles.autoValue} data-tone={automation.emailsPaused ? "warn" : "good"}>
                    {automation.emailsPaused ? "Paused" : "Running"}
                  </span>
                </div>
                <div className={styles.autoRow}>
                  <span className={styles.autoLabel}>Service tier</span>
                  <span className={styles.autoValue}>Self-managed</span>
                </div>
              </div>
            </div>
          </div>

          {/* SIDEBAR — mirrors AgentFileSidebar */}
          <aside className={styles.sidebar}>
            {/* Sale health — real card fields */}
            <div className={styles.healthCard} style={delay(0)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Sale health</div>
              </div>
              <div className={styles.saleHealthTop}>
                <div className={styles.saleHealthGlyph}>{saleHealth.glyph}</div>
                <div>
                  <div className={styles.saleHealthPhase}>{saleHealth.phase}</div>
                  <div className={styles.saleHealthPhaseMeta}>{saleHealth.timeOnFile} on file</div>
                </div>
              </div>
              <div className={styles.saleHealthRow}>
                <span className={styles.saleHealthRowLabel}>Risk</span>
                <span className={styles.saleHealthRowValue} data-tone={saleHealth.risk === "Medium" || saleHealth.risk === "High" ? "warn" : undefined}>
                  {saleHealth.risk}
                </span>
              </div>
              <div className={styles.saleHealthRow}>
                <span className={styles.saleHealthRowLabel}>Last activity</span>
                <span className={styles.saleHealthRowValue}>{saleHealth.lastActivity}</span>
              </div>
              <div className={styles.saleHealthMeter}>
                <div className={styles.saleHealthMeterFill} style={{ width: `${saleHealth.score}%` }} />
              </div>
              <a href="#risk-score" className={styles.saleHealthDetailsLink}>View health details →</a>
            </div>

            {/* Key dates */}
            <div className={styles.card} style={delay(1)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Key dates</div>
              </div>
              <div className={styles.dateList}>
                {keyDates.map((d) => (
                  <div
                    key={d.label}
                    className={styles.dateRow}
                    data-state={d.state}
                    data-highlight={"highlight" in d && d.highlight ? "true" : "false"}
                  >
                    <span className={styles.dateLabel}>{d.label}</span>
                    <span className={styles.dateValue}>{d.date}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agent card */}
            <div className={styles.agentCard} style={delay(2)}>
              <div className={styles.agentAvatar}>EL</div>
              <div className={styles.agentCardBody}>
                <div className={styles.agentName}>Ellis Laurent</div>
                <div className={styles.agentFirm}>Akeman Residential</div>
              </div>
              <a href="#" className={styles.agentAction}>Message</a>
            </div>

            {/* Fees — real labels, superadmin view (showOurFee=true) */}
            <div className={styles.card} style={delay(3)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Fees</div>
                <a href="#" className={styles.cardAction}>Edit</a>
              </div>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Purchase price</span>
                <span className={styles.feeValue}>{fees.purchasePrice}</span>
              </div>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Agent fee</span>
                <span className={styles.feeValue}>{fees.agentFee}</span>
              </div>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Solicitor referral</span>
                <span className={styles.feeValue}>{fees.solicitorReferral}</span>
              </div>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Broker referral</span>
                <span className={styles.feeValue}>{fees.brokerReferral}</span>
              </div>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Progressor fee</span>
                <span className={styles.feeValue}>{fees.progressorFee}</span>
              </div>
              <div className={styles.feeDivider} />
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Gross income</span>
                <span className={styles.feeValue + " " + styles.feeGross}>{fees.grossIncome}</span>
              </div>
              <div className={styles.feeRow}>
                <span className={styles.feeLabel + " " + styles.feeNetLabel}>Net income</span>
                <span className={styles.feeValue + " " + styles.feeNet}>{fees.netIncome}</span>
              </div>
            </div>

            {/* Quick links */}
            <div className={styles.card} style={delay(4)}>
              <div className={styles.cardHead}>
                <div className={styles.cardTitle}>Quick links</div>
              </div>
              <div className={styles.quickLinks}>
                <a href="#" className={styles.quickLink}>
                  Open in client portal <span className={styles.quickLinkChevron}>›</span>
                </a>
                <a href="#" className={styles.quickLink}>
                  Documents (12) <span className={styles.quickLinkChevron}>›</span>
                </a>
                <a href="#" className={styles.quickLink}>
                  Secure message <span className={styles.quickLinkChevron}>›</span>
                </a>
                <a href="#" className={styles.quickLink}>
                  Memo of sale (PDF) <span className={styles.quickLinkChevron}>›</span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}

      {tab === "steps" && (
        <div className={styles.body + " " + styles.tabPanel} key="steps">
          <div className={styles.main}>
            <StepsTab />
          </div>
        </div>
      )}

      {tab === "reminders" && (
        <div className={styles.body + " " + styles.tabPanel} key="reminders">
          <div className={styles.main}>
            <RemindersTab />
          </div>
        </div>
      )}

      {tab === "todo" && (
        <div className={styles.body + " " + styles.tabPanel} key="todo">
          <div className={styles.main}>
            <TodoTab />
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div className={styles.body + " " + styles.tabPanel} key="activity">
          <div className={styles.main}>
            <ActivityTab />
          </div>
        </div>
      )}

      {holdModalOpen && <PutOnHoldModal onClose={() => setHoldModalOpen(false)} />}

      <div className={styles.footer}>
        /dev/vibe/file · not linked from production · fabricated data · fields mirror real components
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STEPS TAB
// ═══════════════════════════════════════════════════════════════════

function StepsTab() {
  const [side, setSide] = useState<MilestoneSide>("vendor");
  const sections = side === "vendor" ? vendorSections : purchaserSections;
  const doneCount = side === "vendor" ? stepsProgress.vendorDone : stepsProgress.purchaserDone;
  const totalCount = side === "vendor" ? stepsProgress.vendorTotal : stepsProgress.purchaserTotal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={styles.stepsProgress}>
        <div className={styles.stepsProgressHead}>
          <div className={styles.stepsProgressTitle}>Exchange progress</div>
          <div className={styles.stepsProgressPct}>{stepsProgress.percentAll}%</div>
        </div>
        <div className={styles.stepsProgressBar}>
          <div className={styles.stepsProgressFill} style={{ width: `${stepsProgress.percentAll}%` }} />
        </div>
        <div className={styles.stepsProgressMeta}>
          {stepsProgress.doneAll} of {stepsProgress.totalAll} steps complete
        </div>
      </div>

      <div className={styles.sideSwitch}>
        <button className={styles.sideSwitchBtn} data-active={side === "vendor"} onClick={() => setSide("vendor")}>
          ▲ Seller <span className={styles.sideSwitchCount}>{stepsProgress.vendorDone}/{stepsProgress.vendorTotal}</span>
        </button>
        <button className={styles.sideSwitchBtn} data-active={side === "purchaser"} onClick={() => setSide("purchaser")}>
          ▼ Buyer <span className={styles.sideSwitchCount}>{stepsProgress.purchaserDone}/{stepsProgress.purchaserTotal}</span>
        </button>
      </div>

      <div className={styles.tabPanel} key={side} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {sections.map((section, idx) => (
          <MilestoneSectionBlock key={section.id} section={section} idx={idx} />
        ))}
      </div>
    </div>
  );
}

function MilestoneSectionBlock({ section, idx }: { section: MilestoneSection; idx: number }) {
  const done = section.milestones.filter((m) => m.state === "done").length;
  const allDone = done === section.milestones.length;
  const [open, setOpen] = useState(!allDone);

  return (
    <div className={styles.milestoneSection} style={{ animationDelay: `${idx * 60}ms` }}>
      <div className={styles.msSectionHead} data-open={open} onClick={() => setOpen(!open)}>
        <div className={styles.msSectionDot} data-color={allDone ? "emerald" : section.color} />
        <div className={styles.msSectionTitle}>{section.label}</div>
        <div className={styles.msSectionBadge} data-alldone={allDone}>
          {allDone ? "All done" : `${done}/${section.milestones.length}`}
        </div>
        <div className={styles.msSectionChevron}>›</div>
      </div>
      {open && (
        <div className={styles.msSectionBody}>
          {section.milestones.map((m) => (
            <MilestoneRow key={m.code} milestone={m} />
          ))}
        </div>
      )}
    </div>
  );
}

function MilestoneRow({ milestone: m }: { milestone: Milestone }) {
  return (
    <div className={styles.msRow} data-state={m.state}>
      <div className={styles.msRowDot} data-state={m.state} />
      <div>
        <div className={styles.msRowName}>{m.name}</div>
        <div className={styles.msRowMeta}>
          {m.state === "done" && (
            <>
              <span>Completed {m.completedDate}</span>
              {m.eventDate && <span>· Event: {m.eventDate}</span>}
              {m.confirmedByPortal && (
                <span className={styles.msRowChip} data-tone="portal">✓ Client confirmed</span>
              )}
            </>
          )}
          {m.state === "blocked" && <span>Previous steps must be completed first</span>}
          {m.chips?.map((c, i) => (
            <span key={i} className={styles.msRowChip} data-tone={c.tone}>{c.text}</span>
          ))}
        </div>
      </div>
      <div>
        {m.state === "available" && (
          <>
            <button className={styles.msRowConfirm}>Confirm</button>
            <div><a href="#" className={styles.msRowNr}>N/R</a></div>
          </>
        )}
        {m.state === "done" && <button className={styles.msRowUndo}>Undo</button>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REMINDERS TAB
// ═══════════════════════════════════════════════════════════════════

function RemindersTab() {
  const [showAll, setShowAll] = useState(true);
  const urgencies: ReminderUrgency[] = ["escalated", "overdue", "due_today", "coming_up"];
  const urgencyLabel: Record<ReminderUrgency, string> = {
    escalated: "Escalated",
    overdue: "Overdue",
    due_today: "Due today",
    coming_up: "Coming up",
  };
  const grouped = urgencies.map((u) => ({
    urgency: u,
    seller: fullReminders.filter((r) => r.urgency === u && r.side === "seller"),
    buyer: fullReminders.filter((r) => r.urgency === u && r.side === "buyer"),
  })).filter((g) => g.seller.length + g.buyer.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Automated emails card */}
      <div className={styles.automatedEmailsCard}>
        <div className={styles.automatedEmailsHead}>
          <div className={styles.automatedEmailsIcon}>✉</div>
          <div className={styles.automatedEmailsSummary}>{automatedEmails.summary}</div>
          <button className={styles.automatedEmailsToggle} onClick={() => setShowAll(!showAll)}>
            {showAll ? "Hide" : "Show"}
          </button>
        </div>
        {showAll && (
          <>
            <div className={styles.automatedEmailsSection}>
              <div className={styles.automatedEmailsSectionHead}>Pending now</div>
              {automatedEmails.pendingNow.map((e) => (
                <div key={e.id} className={styles.automatedEmailsRow}>
                  <span className={styles.automatedEmailsChip} data-kind={e.chip}>{e.chip}</span>
                  <div>
                    <div className={styles.automatedEmailsSubject}>{e.subject}</div>
                    <div className={styles.automatedEmailsTo}>To {e.to} · {e.role}</div>
                  </div>
                  <div className={styles.automatedEmailsSend}>{e.send}</div>
                </div>
              ))}
            </div>
            <div className={styles.automatedEmailsSection}>
              <div className={styles.automatedEmailsSectionHead}>Sent today</div>
              {automatedEmails.sentToday.map((e) => (
                <div key={e.id} className={styles.automatedEmailsRow}>
                  <span className={styles.automatedEmailsChip} data-kind={e.chip}>{e.chip}</span>
                  <div>
                    <div className={styles.automatedEmailsSubject}>{e.subject}</div>
                    <div className={styles.automatedEmailsTo}>To {e.to} · {e.role}</div>
                  </div>
                  <div className={styles.automatedEmailsSend}>{e.send}</div>
                </div>
              ))}
            </div>
            <div className={styles.automatedEmailsSection}>
              <div className={styles.automatedEmailsSectionHead}>Upcoming (predicted)</div>
              {automatedEmails.upcoming.map((e) => (
                <div key={e.id} className={styles.automatedEmailsRow}>
                  <span className={styles.automatedEmailsChip} data-kind={e.chip}>{e.chip}</span>
                  <div>
                    <div className={styles.automatedEmailsSubject}>{e.subject}</div>
                    <div className={styles.automatedEmailsTo}>
                      To {e.to} · {e.role}
                      {"extra" in e && e.extra && <> · {e.extra}</>}
                    </div>
                  </div>
                  <div className={styles.automatedEmailsSend}>{e.send}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Urgency accordions */}
      {grouped.map((g, idx) => (
        <div key={g.urgency} className={styles.reminderUrgencyCard} data-urgency={g.urgency} style={{ animationDelay: `${idx * 60}ms` }}>
          <div className={styles.reminderUrgencyHead}>
            <div className={styles.reminderUrgencyTitle}>{urgencyLabel[g.urgency]}</div>
            <div className={styles.reminderUrgencyCount}>{g.seller.length + g.buyer.length}</div>
          </div>
          <div className={styles.reminderTwoCol}>
            <ReminderColumn side="seller" rows={g.seller} />
            <ReminderColumn side="buyer" rows={g.buyer} />
          </div>
        </div>
      ))}

      {/* Snoozed */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle} style={{ color: "#D4C4FF" }}>Snoozed</div>
        </div>
        {snoozedReminders.map((r) => (
          <div key={r.id} className={styles.reminderColRow}>
            <div className={styles.reminderColTitle}>{r.title}</div>
            <div className={styles.reminderColUrgency}>Wakes {r.wakes} · <a href="#" style={{ color: "#B8CCFF" }}>Wake up</a></div>
          </div>
        ))}
      </div>

      {/* Completed */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Completed</div>
        </div>
        {completedReminders.map((r) => (
          <div key={r.id} className={styles.reminderColRow}>
            <div className={styles.reminderColTitle}>{r.title}</div>
            <div className={styles.reminderColUrgency}>{r.status} · {r.reason}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReminderColumn({ side, rows }: { side: ReminderSide; rows: typeof fullReminders }) {
  return (
    <div className={styles.reminderCol}>
      <div className={styles.reminderColHead} data-side={side}>
        <span>{side === "seller" ? "▲" : "▼"}</span>
        <span>{side}</span>
        <span className={styles.reminderColCount}>· {rows.length} items</span>
      </div>
      {rows.length === 0 && (
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", padding: "4px 0" }}>
          {side === "seller" ? "Seller" : "Buyer"} is all up to date
        </div>
      )}
      {rows.map((r) => (
        <div key={r.id} className={styles.reminderColRow}>
          <div className={styles.reminderColTitle}>{r.title}</div>
          <div className={styles.reminderColUrgency} data-tone={r.urgency}>{r.urgencyLine}</div>
          {r.chased > 0 && <div className={styles.reminderColChased}>Chased {r.chased}×</div>}
          {r.manualChip && (
            <div style={{ marginTop: 4 }}>
              <span className={styles.msRowChip} data-tone="amber">{r.manualChip}</span>
            </div>
          )}
          <div className={styles.reminderRowActions}>
            <button className={styles.reminderActionBtn}>🕐 Snooze</button>
            <button className={styles.reminderActionBtn}>↻ Chased</button>
            <button className={styles.reminderActionBtn} data-primary="true">→ Chase now</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TO-DO TAB
// ═══════════════════════════════════════════════════════════════════

function TodoTab() {
  const [showDone, setShowDone] = useState(false);
  const visible = agentTodos.filter((t) => showDone || !t.done);
  const doneCount = agentTodos.filter((t) => t.done).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className={styles.todoCard}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>To-do</div>
          <a href="#" className={styles.cardAction}>+ Add</a>
        </div>
        {visible.map((t) => (
          <div key={t.id} className={styles.todoRow} data-done={t.done}>
            <div className={styles.todoCheck}>✓</div>
            <div>
              <div className={styles.todoTitle}>{t.title}</div>
              {t.notes && <div className={styles.todoNotes}>{t.notes}</div>}
            </div>
            {t.due && <div className={styles.todoDue}>{t.due}</div>}
          </div>
        ))}
        {doneCount > 0 && (
          <a href="#" onClick={(e) => { e.preventDefault(); setShowDone(!showDone); }} style={{ display: "inline-block", marginTop: 10, fontSize: 11.5, color: "rgba(255,255,255,0.55)" }}>
            {showDone ? "Hide done" : `Show ${doneCount} done`}
          </a>
        )}
      </div>

      <div className={styles.todoCard}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>With Sales Progressor</div>
          <a href="#" className={styles.cardAction}>+ Ask</a>
        </div>
        {agentRequests.map((r) => (
          <div key={r.id} className={styles.agentRequestRow} data-done={r.done}>
            <div className={styles.agentRequestHead}>
              <div className={styles.agentRequestDot} />
              <div>
                <div className={styles.agentRequestTitle}>{r.title}</div>
                {r.done && !r.spReply && (
                  <div style={{ fontSize: 11, color: "#86EFAC", marginTop: 4, fontWeight: 500 }}>✓ Taken care of</div>
                )}
              </div>
            </div>
            {r.yourNote && (
              <div className={styles.agentRequestNoteBlock}>
                <div className={styles.agentRequestNoteEyebrow}>Your note · {r.yourNoteTime}</div>
                <div className={styles.agentRequestNoteBody}>{r.yourNote}</div>
              </div>
            )}
            {r.spReply && (
              <div className={styles.agentRequestReplyBlock}>
                <div className={styles.agentRequestReplyEyebrow}>Sales Progressor · {r.spReplyTime}</div>
                <div className={styles.agentRequestNoteBody}>{r.spReply}</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ACTIVITY TAB
// ═══════════════════════════════════════════════════════════════════

function ActivityTab() {
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [composeTab, setComposeTab] = useState<"note" | "email" | "call" | "meeting">("note");
  const [contactActive, setContactActive] = useState<Record<string, boolean>>({ Ben: true });
  const [portalVisible, setPortalVisible] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = fullActivity.filter((e) => {
    if (filter === "all") return true;
    if (filter === "steps") return e.kind === "milestone" || e.kind === "milestone_nr";
    if (filter === "comms") return e.kind.startsWith("comm_");
    if (filter === "automated") return e.kind === "automated";
    if (filter === "notes") return e.kind === "note";
    return true;
  }).filter((e) => !search || e.summary.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filter bar + search */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div className={styles.activityFilterBar}>
          {(["all", "steps", "comms", "automated", "notes"] as ActivityFilter[]).map((f) => (
            <button
              key={f}
              className={styles.activityFilterPill}
              data-active={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className={styles.activityFilterPill}>
            Portal visits (3 hidden)
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          style={{
            padding: "6px 12px", borderRadius: 999,
            background: "rgba(255,255,255,0.04)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            color: "#fff", fontSize: 12, fontFamily: "inherit", outline: "none",
            minWidth: 160,
          }}
        />
      </div>

      {/* Compose */}
      <div className={styles.activityCompose}>
        <div className={styles.activityComposeTabs}>
          {(["note", "email", "call", "meeting"] as const).map((t) => (
            <button
              key={t}
              className={styles.activityComposeTab}
              data-active={composeTab === t}
              onClick={() => setComposeTab(t)}
            >
              {t === "note" ? "Note" : t === "email" ? "Email" : t === "call" ? "Call log" : "Meeting"}
            </button>
          ))}
        </div>
        <textarea
          className={styles.activityComposeInput}
          placeholder={composeTab === "note" ? "Add an internal note…" : composeTab === "email" ? "Compose email…" : composeTab === "call" ? "Log a call…" : "Log a meeting…"}
        />
        <div className={styles.activityComposeFoot}>
          <div className={styles.activityComposePills}>
            {fileContacts.map((c) => {
              const short = c.name.split(" ")[0];
              return (
                <button
                  key={c.name}
                  className={styles.activityComposePill}
                  data-active={contactActive[short] || false}
                  onClick={() => setContactActive({ ...contactActive, [short]: !contactActive[short] })}
                >
                  {short}
                </button>
              );
            })}
            <button className={styles.activityComposePill}>+ Solicitor</button>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label className={styles.activityPortalCheckbox}>
              <input type="checkbox" checked={portalVisible} onChange={(e) => setPortalVisible(e.target.checked)} />
              Visible in client portal
            </label>
            <button className={styles.activityComposeSubmit}>Post</button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div className={styles.cardTitle}>Timeline</div>
        </div>
        <div className={styles.activityList}>
          {filtered.length === 0 && (
            <div style={{ padding: "16px 0", fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
              No entries match.
            </div>
          )}
          {filtered.map((e) => (
            <FullActivityRow key={e.id} entry={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FullActivityRow({ entry: e }: { entry: FullActivityEntry }) {
  return (
    <div className={styles.fullActivityEntry} data-kind={e.kind}>
      <div className={styles.fullActivityDot} />
      <div className={styles.fullActivityContent}>
        {e.toneChip && (
          <span className={styles.fullActivityChip} data-color={e.toneChipColor}>
            {e.toneChip}
          </span>
        )}
        <div className={styles.fullActivitySummary}>
          {e.summary}
          {e.contactPills && (
            <span className={styles.fullActivityContactPills}>
              {e.contactPills.map((p) => (
                <span key={p} className={styles.fullActivityContactPill}>{p}</span>
              ))}
            </span>
          )}
          {e.hasMosLink && (
            <a href="#" className={styles.fullActivityMosLink}>
              📄 View Memo
            </a>
          )}
        </div>
        <div className={styles.fullActivityMeta}>{e.meta}</div>
        {e.content && <div className={styles.fullActivityText}>{e.content}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PUT-ON-HOLD MODAL — mirrors real StatusControl modal
// ═══════════════════════════════════════════════════════════════════

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function PutOnHoldModal({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState("");
  const [inPast, setInPast] = useState(false);

  const disabled = !date || inPast;

  return (
    <div className={styles.modalScrim} onClick={onClose}>
      <div className={styles.modal} onClick={(ev) => ev.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Put file on hold</div>
          <div className={styles.modalSubtitle}>
            Pick a return date and we&rsquo;ll surface this file on the hub when it&rsquo;s due — so it
            doesn&rsquo;t get forgotten.
          </div>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.modalField}>
            <label className={styles.modalFieldLabel}>Return date</label>
            <input
              type="date"
              className={styles.modalInput}
              min={tomorrowISO()}
              value={date}
              onChange={(ev) => {
                setDate(ev.target.value);
                setInPast(ev.target.value !== "" && ev.target.value < tomorrowISO());
              }}
              autoFocus
            />
            {inPast && (
              <div style={{ marginTop: 8, fontSize: 12, color: "#FFB08A" }}>
                Pick a future date — the file needs to come back to you, not behind you.
              </div>
            )}
          </div>
          <a
            href="#"
            className={styles.modalSecondaryLink}
            onClick={(ev) => { ev.preventDefault(); onClose(); }}
          >
            Or hold indefinitely (won&rsquo;t auto-surface)
          </a>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.modalCancel} onClick={onClose}>Cancel</button>
          <button className={styles.modalPrimary} disabled={disabled} onClick={onClose}>
            Put on hold
          </button>
        </div>
      </div>
    </div>
  );
}

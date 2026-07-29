"use client";

// /dev/vibe · v3 · "About Houses"
// Fresh direction. Property scenes as the visual anchor. Editorial
// spacing, real avatar slots, big cards, visual chain drawer,
// milestone journey with illustrated icons. Dev preview only —
// contained to /dev/vibe. Middleware exempts /dev/*.

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { PropertyScene } from "./PropertyScene";
import { PhaseIcon } from "./PhaseIcon";
import { files, detailFile, chainLinks, phases, chainIntel, weekRhythm, greetingInsight } from "./data";
import styles from "./vibe.module.css";

const STATUS_LABEL: Record<string, string> = {
  escalated: "Escalated",
  overdue: "Overdue",
  due_today: "Due today",
  on_track: "On track",
  on_hold: "On hold",
  completed: "Completed",
};

export default function VibePage() {
  const attentionCount = files.filter(
    (f) => f.status === "escalated" || f.status === "overdue" || f.status === "due_today",
  ).length;

  // Sticky-header shadow: sets data-scrolled on root when window scrolls
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
      {/* ─── Header ─── */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <span className={styles.headerDot} />
          Sales Progressor <span>/ dev preview · light theme</span>
        </div>
        <div className={styles.headerMeta}>
          <Link href="/dev/vibe/file" className={styles.metaChip} style={{ textDecoration: "none", color: "inherit" }}>
            Open a file →
          </Link>
          <Link href="/dev/vibe/chain" className={styles.metaChip} style={{ textDecoration: "none", color: "inherit" }}>
            Chain view →
          </Link>
        </div>
      </header>

      {/* ─── Hub ─── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>Your hub</div>
          <h1 className={styles.sectionTitle}>Where you start your morning</h1>
          <p className={styles.sectionLede}>
            Every file is a real property with a real photo, real people, real money. This is
            what a caseload should look like when it&rsquo;s about houses — not a spreadsheet
            about houses.
          </p>
        </div>

        <div className={styles.hubGreet}>
          <div className={styles.hubGreetInner}>
            <div className={styles.greetEyebrow}>Good morning, Ellis</div>
            <div className={styles.greetTitle}>
              <CountUp target={attentionCount} className={styles.num} /> files need you today
            </div>
            <div className={styles.greetSub}>
              One escalated, one overdue, one due today. The rest of your pipeline is holding
              steady — nothing on hold has drifted past its date.
            </div>
            {/* Contextual insight — the app noticed something */}
            <div className={styles.greetInsight}>
              <div className={styles.greetInsightDot} />
              <div className={styles.greetInsightBody}>
                <div className={styles.greetInsightPrimary}>{greetingInsight.primary}</div>
                <div className={styles.greetInsightSecondary}>{greetingInsight.secondary}</div>
              </div>
            </div>
          </div>
          <a href="#" className={styles.newSaleBtn}>+ New sale</a>
        </div>

        {/* This week's rhythm — activity heartbeat */}
        <div className={styles.rhythmWrap}>
          <div className={styles.rhythmLabel}>
            <span className={styles.rhythmLabelEyebrow}>This week</span>
            <span className={styles.rhythmLabelTitle}>Your rhythm</span>
          </div>
          <div className={styles.rhythmBars}>
            {weekRhythm.days.map((d, i) => {
              const max = Math.max(...weekRhythm.days.map((x) => x.value), 1);
              const heightPct = d.value === 0 ? 8 : 25 + (d.value / max) * 75;
              return (
                <div
                  key={d.label}
                  className={styles.rhythmDay}
                  data-today={i === weekRhythm.today ? "true" : "false"}
                  data-empty={d.value === 0 ? "true" : "false"}
                >
                  <div
                    className={styles.rhythmBar}
                    data-today={i === weekRhythm.today ? "true" : "false"}
                    data-empty={d.value === 0 ? "true" : "false"}
                    style={{ height: `${heightPct}%`, animationDelay: `${100 + i * 50}ms` }}
                  />
                  <div className={styles.rhythmDayLabel}>{d.label}</div>
                </div>
              );
            })}
          </div>
          <div className={styles.rhythmSummary}>
            <strong>26 things done</strong> so far this week
          </div>
        </div>

        <div className={styles.hubGrid}>
          {files.map((f, idx) => {
            const isHighValue = f.priceNumeric >= 500000;
            const progressTone = f.progressContext.includes("ahead") ? "ahead"
              : f.progressContext.includes("behind") ? "behind"
              : "neutral";
            return (
            <a
              key={f.id}
              href="#"
              className={styles.fileCard}
              data-weight={isHighValue ? "high" : "normal"}
              style={{ animationDelay: `${idx * 60}ms`, position: "relative" }}
            >
              <div className={styles.fileCardSceneWrap}>
                <PropertyScene palette={f.scene} className={styles.fileCardScene} seed={idx} />
                <div className={styles.fileCardStatus} data-status={f.status}>
                  {STATUS_LABEL[f.status]}
                </div>
                <div className={styles.fileCardAddress}>
                  <div className={styles.fileCardAddressLine1}>{f.address1}</div>
                  <div className={styles.fileCardAddressLine2}>{f.address2} · {f.postcode}</div>
                </div>
              </div>

              <div className={styles.fileCardBody}>
                <div className={styles.fileCardPriceRow}>
                  <div className={styles.fileCardPrice}>{f.price}</div>
                  <div className={styles.fileCardExchange}>
                    Exchange <strong>{f.exchangeIn}</strong>
                  </div>
                </div>

                <div className={styles.fileCardAction} data-status={f.status}>
                  <div className={styles.fileCardActionText}>{f.nextAction}</div>
                  <div className={styles.fileCardActionMeta}>{f.nextActionMeta}</div>
                </div>

                <div>
                  <div className={styles.fileCardProgressRow}>
                    <span className={styles.fileCardProgressLabel}>
                      <strong>{f.progress}%</strong>
                    </span>
                    <div className={styles.fileCardProgressBar}>
                      <div
                        className={styles.fileCardProgressFill}
                        style={{ width: `${f.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className={styles.progressInTime} data-tone={progressTone}>
                    {f.progressContext}
                  </div>
                </div>

                <div className={styles.fileCardContacts}>
                  <div className={styles.avatarRow}>
                    {f.contacts.slice(0, 4).map((c, i) => (
                      <div
                        key={i}
                        className={styles.avatar}
                        style={{ ["--h" as string]: c.hue } as React.CSSProperties}
                        title={c.name}
                      >
                        {c.initials}
                      </div>
                    ))}
                  </div>
                  <span className={styles.contactsMeta}>
                    {f.contacts.length} {f.contacts.length === 1 ? "person" : "people"}
                  </span>
                </div>
              </div>

              {/* Hover preview — reveals extra intelligence */}
              <div className={styles.hoverPreview}>
                <div className={styles.hoverPreviewGrid}>
                  <div className={styles.hoverPreviewCell}>
                    <div className={styles.hoverPreviewLabel}>Last chase</div>
                    <div className={styles.hoverPreviewValue}>{f.lastChasedAgo}</div>
                  </div>
                  <div className={styles.hoverPreviewCell}>
                    <div className={styles.hoverPreviewLabel}>Response</div>
                    <div className={styles.hoverPreviewValue}>{f.responseTime}</div>
                  </div>
                </div>
                <div className={styles.hoverPreviewChainRow}>
                  <span className={styles.hoverPreviewChainLabel}>Chain</span>
                  <span className={styles.hoverPreviewChainStatus} data-status={f.chainStatus}>
                    {f.chainStatus}
                  </span>
                </div>
                <div className={styles.hoverPreviewActivity}>
                  <span className={styles.hoverPreviewActivityLabel}>Week</span>
                  <div className={styles.hoverPreviewDots}>
                    {f.weekActivity.map((heat, i) => (
                      <div key={i} className={styles.hoverPreviewDot} data-heat={heat} />
                    ))}
                  </div>
                </div>
              </div>
            </a>
          );})}
        </div>
      </section>

      {/* ─── File Detail ─── */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionEyebrow}>File detail</div>
          <h1 className={styles.sectionTitle}>The main working surface</h1>
          <p className={styles.sectionLede}>
            The property is the subject. Address and price sit on top of the photo. The dashboard
            lives beneath. Feels like opening a listing you now have to progress — not a database
            row.
          </p>
        </div>

        <div className={styles.detailHero}>
          <div className={styles.detailHeroSceneWrap}>
            <PropertyScene palette={detailFile.scene} className={styles.detailHeroScene} />
            <div className={styles.detailHeroOverlay} />
            <div className={styles.detailHeroStatus} data-status={detailFile.status}>
              <span className={styles.statusDot} />
              {STATUS_LABEL[detailFile.status]} · {detailFile.reason}
            </div>
            <div className={styles.detailHeroText}>
              <div>
                <div className={styles.detailHeroTitle}>{detailFile.address1}</div>
                <div className={styles.detailHeroSubtitle}>
                  {detailFile.address2}, {detailFile.postcode}
                </div>
              </div>
              <div>
                <div className={styles.detailHeroPrice}>{detailFile.price}</div>
                <div className={styles.detailHeroPriceMeta}>Sale price</div>
              </div>
            </div>
          </div>
        </div>

        {/* KPI bar + CTAs */}
        <div className={styles.detailBar}>
          <div className={styles.detailKpiRow}>
            <div className={styles.detailKpi}>
              <div className={styles.detailKpiLabel}>Exchange</div>
              <div className={styles.detailKpiValue}>{detailFile.exchangeIn}</div>
            </div>
            <div className={styles.detailKpi}>
              <div className={styles.detailKpiLabel}>In system</div>
              <div className={styles.detailKpiValue}>{detailFile.daysInSystem}d</div>
            </div>
            <div className={styles.detailKpi}>
              <div className={styles.detailKpiLabel}>Progress</div>
              <div className={styles.detailKpiValue}>{detailFile.progress}%</div>
            </div>
            <div className={styles.detailKpi}>
              <div className={styles.detailKpiLabel}>People</div>
              <div className={styles.detailKpiValue}>{detailFile.contacts.length}</div>
            </div>
          </div>
          <div className={styles.detailCtaRow}>
            <a href="#" className={styles.detailCtaPrimary}>Chase Grange Legal →</a>
            <a href="#" className={styles.detailCtaSecondary}>Open chain</a>
          </div>
        </div>

        {/* Body: milestone journey + sidebar */}
        <div className={styles.detailBody}>
          <div className={styles.detailPanel}>
            <div className={styles.detailPanelHead}>
              <div className={styles.detailPanelEyebrow}>The sale, at a glance</div>
              <div className={styles.detailPanelTitle}>Where the file is right now</div>
            </div>
            <div className={styles.journey}>
              {phases.map((phase) => (
                <div key={phase.id} className={styles.journeyStep} data-state={phase.state}>
                  <div className={styles.journeyBadge}>
                    <PhaseIcon kind={phase.icon} size={28} />
                  </div>
                  <div className={styles.journeyName}>{phase.name}</div>
                  <div className={styles.journeyDetail}>{phase.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.sidebar}>
            <div className={styles.detailPanel} style={{ padding: "22px 24px" }}>
              <div className={styles.sidebarLabel + " " + styles.sidebarNextAction}>Next action</div>
              <div className={styles.nextActionTitle}>Chase Grange Legal</div>
              <div className={styles.nextActionSub}>
                Waiting 8 days on search results. Solicitor hasn&rsquo;t responded to two prior chases.
              </div>
              <a href="#" className={styles.detailCtaPrimary} style={{ width: "100%", justifyContent: "center", display: "flex" }}>Send chase →</a>
            </div>

            <div className={styles.detailPanel + " " + styles.sidebarCard}>
              <div className={styles.sidebarLabel}>People on this sale</div>
              <div className={styles.peopleList}>
                {detailFile.contacts.map((c) => (
                  <div key={c.name} className={styles.personRow}>
                    <div
                      className={styles.personAvatar}
                      style={{ ["--h" as string]: c.hue } as React.CSSProperties}
                    >
                      {c.initials}
                    </div>
                    <div className={styles.personName}>{c.name}</div>
                    <div className={styles.personRole}>{c.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Chain drawer (rendered inline for the preview) ─── */}
      <ChainSection />

      <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 11, position: "relative", zIndex: 1 }}>
        /dev/vibe · v3 · not linked from production · fabricated data
      </div>
    </div>
  );
}

function ChainSection() {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className={styles.chainSection}>
      <div className={styles.sectionHeader + " " + styles.chainIntro}>
        <div className={styles.sectionEyebrow}>Chain drawer</div>
        <h1 className={styles.sectionTitle}>The actual chain of houses</h1>
        <p className={styles.sectionLede} style={{ margin: "0 auto" }}>
          Not a list of database rows — a visible chain of properties, top to bottom.
          Your file glows in the middle. Declined ones fade back.
        </p>
      </div>

      {expanded && (
        <>
          {/* Chain intelligence — the chain feels smart */}
          <div className={styles.chainIntel}>
            <div className={styles.chainIntelHead}>
              <div>
                <div className={styles.chainIntelTotal}>{chainIntel.totalValue}</div>
                <div className={styles.chainIntelTotalLabel}>Chain value</div>
              </div>
              <div className={styles.chainIntelLinks}>
                <strong>{chainIntel.claimedCount}</strong> of <strong>{chainIntel.linkCount}</strong> claimed
              </div>
            </div>
            <div className={styles.chainIntelRow + " " + styles.warn}>
              <span>Weakest link</span>
              <strong>{chainIntel.weakestLink}</strong>
            </div>
            <div className={styles.chainIntelRow}>
              <span>Predicted completion</span>
              <strong>{chainIntel.predictedCompletion}</strong>
            </div>
            <div className={styles.chainIntelRow}>
              <span>Oldest sale in chain</span>
              <strong>{chainIntel.daysOldest} days</strong>
            </div>
          </div>

          <div className={styles.chainStack}>
            {chainLinks.map((link, i) => (
              <div key={link.id} className={styles.chainLink} data-viewer={link.isViewer} data-declined={link.status === "DECLINED"}>
                {i > 0 && <div className={styles.chainConnector} style={{ margin: "0 auto" }} />}
                <a href="#" className={styles.chainLinkCard}>
                  <div className={styles.chainLinkScene}>
                    <PropertyScene palette={link.scene} seed={i * 2} />
                  </div>
                  <div className={styles.chainLinkBody}>
                    <div className={styles.chainLinkTag}>{link.status} · {link.price}</div>
                    <div className={styles.chainLinkAddress}>{link.address}</div>
                    <div className={styles.chainLinkAgent}>{link.agent}</div>
                  </div>
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            padding: "8px 16px", borderRadius: 999,
            background: "rgba(15,26,46,0.05)",
            border: "1px solid rgba(15,26,46,0.14)",
            color: "#5a6478", fontSize: 12, fontFamily: "inherit", cursor: "pointer",
          }}
        >
          {expanded ? "Collapse chain" : "Expand chain"}
        </button>
      </div>
    </section>
  );
}

// ─── Number counter ──────────────────────────────────────────────
// Counts up from 0 to target over 900ms — used on the greeting hero
// number so it lands with a beat when the page loads.
function CountUp({ target, className }: { target: number; className?: string }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);   // easeOutCubic
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span className={className}>{value}</span>;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PROPOSAL_SECTIONS, CLOSING_SECTION_ID } from "@/lib/proposal/config";
import { ProposalAnalyticsProvider, useBeacon } from "./analytics-client";
import { ThemeToggle } from "./ThemeToggle";
import { Drawer } from "./ui";

import { CoverSection } from "./sections/cover";
import { OpportunitySection } from "./sections/opportunity";
import { PlatformSection } from "./sections/platform";
import { PartnershipSection } from "./sections/partnership";
import { CycleSection } from "./sections/cycle";
import { FormsSection } from "./sections/forms";
import { FlywheelSection } from "./sections/flywheel";
import { ChainSection } from "./sections/chain";
import { CommercialSection } from "./sections/commercial";
import { BoardwalkSection } from "./sections/boardwalk";
import { ProgressorSection } from "./sections/progressor";
import { SoftwareSection } from "./sections/software";
import { CombinedSection } from "./sections/combined";
import { AiSection } from "./sections/ai";
import { InvestmentSection } from "./sections/investment";
import { EquitySection } from "./sections/equity";
import { RoadmapSection } from "./sections/roadmap";
import { GovernanceSection } from "./sections/governance";
import { ClosingSection } from "./sections/closing";

const NAV = PROPOSAL_SECTIONS.filter((s) => s.inNav);

function Shell({ pdfAvailable }: { pdfAvailable: boolean }) {
  const { trackSectionView, track } = useBeacon();
  const [active, setActive] = useState("cover");
  const [progress, setProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeReached = useRef(false);

  // Active section + per-section view beacons via a single observer.
  useEffect(() => {
    const els = PROPOSAL_SECTIONS.map((s) => document.getElementById(`sec-${s.id}`)).filter(
      (e): e is HTMLElement => !!e,
    );
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace("sec-", "");
          if (e.isIntersecting) {
            trackSectionView(id);
            if (id === CLOSING_SECTION_ID && !closeReached.current) {
              closeReached.current = true;
              track("reached_close", { sectionId: CLOSING_SECTION_ID });
            }
          }
        }
        // Pick the entry nearest the top of the viewport as "active".
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id.replace("sec-", ""));
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [trackSectionView, track]);

  // Scroll progress.
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goto = useCallback((id: string) => {
    setMenuOpen(false);
    document.getElementById(`sec-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const onDownload = () => track("pdf_download", { detail: "topbar" });

  return (
    <>
      <div className="prop-progress" style={{ width: `${progress}%` }} aria-hidden />

      <header className="prop-topbar">
        <button
          type="button"
          onClick={() => goto("cover")}
          style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: 0, cursor: "pointer", padding: 0 }}
          aria-label="Back to top"
        >
          <span style={{ width: 26, height: 26, borderRadius: 7, background: "var(--prop-coral)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 12 }}>
            T
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--prop-ink)", letterSpacing: "0.02em" }}>
            TSP <span style={{ color: "var(--prop-ink-3)", fontWeight: 600 }}>× Boardwalk</span>
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {pdfAvailable ? (
            <a className="prop-btn prop-btn--ghost prop-btn--sm" href="/api/proposal/pdf" onClick={onDownload} style={{ textDecoration: "none" }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="prop-pdf-label">PDF</span>
            </a>
          ) : null}
          <ThemeToggle />
          <button
            type="button"
            className="prop-iconbtn prop-menu-btn"
            aria-label="Open contents"
            onClick={() => setMenuOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className="prop-shell">
        <nav className="prop-rail prop-rail-desktop" aria-label="Contents">
          {NAV.map((s) => (
            <button key={s.id} type="button" className="prop-rail-item" data-active={active === s.id} onClick={() => goto(s.id)}>
              <span className="prop-rail-tick" aria-hidden />
              <span className="prop-rail-num">{String(s.index).padStart(2, "0")}</span>
              <span>{s.nav}</span>
            </button>
          ))}
        </nav>

        <main className="prop-main">
          <CoverSection onExplore={() => goto("opportunity")} />
          <OpportunitySection />
          <PlatformSection />
          <PartnershipSection />
          <CycleSection />
          <FormsSection />
          <FlywheelSection />
          <ChainSection />
          <CommercialSection />
          <BoardwalkSection />
          <ProgressorSection />
          <SoftwareSection />
          <CombinedSection />
          <AiSection />
          <InvestmentSection />
          <EquitySection />
          <RoadmapSection />
          <GovernanceSection />
          <ClosingSection pdfAvailable={pdfAvailable} onDownload={onDownload} />
        </main>
      </div>

      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} title="Contents">
        <nav aria-label="Contents" className="prop-stack-sm">
          {NAV.map((s) => (
            <button
              key={s.id}
              type="button"
              className="prop-rail-item"
              data-active={active === s.id}
              onClick={() => goto(s.id)}
              style={{ padding: "0.6rem 0.5rem", fontSize: "0.9375rem" }}
            >
              <span className="prop-rail-num">{String(s.index).padStart(2, "0")}</span>
              <span>{s.nav}</span>
            </button>
          ))}
        </nav>
      </Drawer>

      <style>{`
        .prop-shell { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 0; max-width: 1380px; margin-inline: auto; }
        .prop-rail-desktop { padding-left: clamp(1rem, 2vw, 1.75rem); }
        .prop-main { min-width: 0; border-left: 1px solid var(--prop-line); }
        .prop-menu-btn { display: none; }
        @media (max-width: 1023px) {
          .prop-shell { grid-template-columns: minmax(0, 1fr); }
          .prop-rail-desktop { display: none; }
          .prop-main { border-left: 0; }
          .prop-menu-btn { display: grid; }
        }
        @media (max-width: 560px) { .prop-pdf-label { display: none; } }
      `}</style>
    </>
  );
}

export function ProposalExperience({ pdfAvailable }: { pdfAvailable: boolean }) {
  return (
    <ProposalAnalyticsProvider>
      <Shell pdfAvailable={pdfAvailable} />
    </ProposalAnalyticsProvider>
  );
}

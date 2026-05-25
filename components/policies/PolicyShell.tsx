"use client";

// components/policies/PolicyShell.tsx
//
// Shared layout for every legal/policy page (privacy, cookies, terms,
// billing, DPA). One component renders all of them so a layout fix
// touches all surfaces at once.
//
// Composition:
//   - Sticky slim top bar with back-link
//   - Hero: title, description, last-updated · version, hairline divider
//   - Two-column body: sticky sidebar (sections) + main content (~70ch wide)
//   - Scrollspy: sidebar active item highlights as you scroll; click smooth-scrolls
//   - Reading-progress bar: thin coral bar at top, fills as you scroll
//   - Mobile (<900px): sidebar collapses into "Jump to section" accordion
//   - Tables, lists, links, strong text styled consistently via .policy-prose
//   - Respects reduced-motion: data-rm contract suppresses smooth-scroll +
//     the progress-bar tween. Active-state colour change still happens
//     (non-spatial — per ANIMATION_STANDARDS).
//
// Theme: hardcoded near-white canvas (#fafafa) with coral accent via the
// --agent-coral CSS var (theme-aware where the agent theme is present;
// falls back to brand coral on public pages where no theme context exists).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type PolicySection = {
  /** Stable URL fragment for the section (no leading #). */
  id: string;
  /** Display title — shown in sidebar nav AND as the section's <h2>. */
  title: string;
  /** Section body. Plain JSX (paragraphs, lists, tables). Styled by .policy-prose. */
  body: React.ReactNode;
};

export type PolicyShellProps = {
  title: string;
  description?: string;
  /** Display string for "Last updated …" — e.g. "25 May 2026". */
  lastUpdated: string;
  /** Display string for version — e.g. "1.0". */
  version: string;
  sections: PolicySection[];
  /** Back-link target (default: home). */
  backHref?: string;
  backLabel?: string;
  /** Show a "Download as PDF" action in the hero. Triggers window.print()
   *  with a print-friendly stylesheet that hides chrome (topbar, sidebar,
   *  progress bar, footer, buttons) and prints only the hero + content.
   *  Users save the result as PDF via their browser's print dialog —
   *  works in every modern browser without server-side PDF infrastructure.
   *  For documents that warrant a true server-rendered PDF later, swap
   *  this for a direct download link to an API route. */
  showPdfDownload?: boolean;
};

export function PolicyShell({
  title,
  description,
  lastUpdated,
  version,
  sections,
  backHref = "/",
  backLabel = "Sales Progressor",
  showPdfDownload = false,
}: PolicyShellProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const tickingRef = useRef(false);

  // Scrollspy + reading-progress, throttled via rAF.
  useEffect(() => {
    function update() {
      tickingRef.current = false;

      // Reading progress — % of total document scrolled
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      setProgress(docHeight > 0 ? Math.min(100, (scrolled / docHeight) * 100) : 0);

      // Scrollspy — section whose top is closest to the viewport top (with offset)
      const offset = 120;
      const els = sections
        .map((s) => document.getElementById(s.id))
        .filter((el): el is HTMLElement => el !== null);
      // Walk in order; the last section whose top has passed the offset wins.
      let current: HTMLElement | null = null;
      for (const el of els) {
        if (el.getBoundingClientRect().top - offset <= 0) current = el;
      }
      // If nothing has passed the offset yet (page top), fall back to first section
      if (!current && els[0]) current = els[0];
      if (current) setActiveId(current.id);
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [sections]);

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const reducedMotion =
      typeof document !== "undefined" && document.documentElement.dataset.rm === "1";
    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    // Update URL hash without navigating
    if (typeof history !== "undefined") {
      history.replaceState(null, "", `#${id}`);
    }
    setMobileNavOpen(false);
  }

  return (
    <div className="policy-root">
      {/* Reading-progress bar */}
      <div
        aria-hidden="true"
        className="policy-progress"
        style={{ width: `${progress}%` }}
      />

      {/* Slim top bar */}
      <header className="policy-topbar">
        <Link href={backHref} className="policy-back-link">
          <span aria-hidden="true">←</span> {backLabel}
        </Link>
        <Link href="/legal" className="policy-hub-link">
          All policies
        </Link>
      </header>

      {/* Hero */}
      <div className="policy-hero">
        <h1 className="policy-hero-title">{title}</h1>
        {description && <p className="policy-hero-description">{description}</p>}
        <p className="policy-hero-meta">
          Last updated {lastUpdated} · Version {version}
        </p>
        {showPdfDownload && (
          <div className="policy-hero-actions">
            <button
              type="button"
              className="policy-pdf-button"
              onClick={() => {
                if (typeof window !== "undefined") window.print();
              }}
            >
              Download as PDF
            </button>
            <p className="policy-pdf-hint">
              Opens your browser&rsquo;s print dialog — choose &ldquo;Save as PDF&rdquo; as the destination.
            </p>
          </div>
        )}
        <div className="policy-hero-divider" aria-hidden="true" />
      </div>

      {/* Mobile "Jump to section" */}
      <div className="policy-mobile-nav">
        <button
          type="button"
          className="policy-mobile-nav-trigger"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-expanded={mobileNavOpen}
        >
          Jump to section
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              marginLeft: 6,
              transform: mobileNavOpen ? "rotate(180deg)" : "none",
              transition: "transform 180ms",
            }}
          >
            ▾
          </span>
        </button>
        {mobileNavOpen && (
          <ul className="policy-mobile-nav-list">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(e) => handleNavClick(e, s.id)}
                  className={`policy-mobile-nav-item${activeId === s.id ? " is-active" : ""}`}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Body: sidebar + content */}
      <div className="policy-body">
        <aside className="policy-sidebar" aria-label="Table of contents">
          <nav>
            <ul className="policy-sidebar-list">
              {sections.map((s, i) => {
                const isActive = activeId === s.id;
                return (
                  <li
                    key={s.id}
                    className="policy-sidebar-item"
                    style={{
                      borderTop: i === 0 ? "none" : "0.5px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <a
                      href={`#${s.id}`}
                      onClick={(e) => handleNavClick(e, s.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`policy-sidebar-link${isActive ? " is-active" : ""}`}
                    >
                      {s.title}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <main className="policy-main">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="policy-section">
              <h2 className="policy-h2">{s.title}</h2>
              <div className="policy-prose">{s.body}</div>
            </section>
          ))}
        </main>
      </div>

      {/* Footer */}
      <footer className="policy-footer">
        <p>
          Sales Progressor ·{" "}
          <Link href="/legal" className="policy-footer-link">
            All policies
          </Link>
        </p>
      </footer>

      <style>{`
        .policy-root {
          min-height: 100vh;
          background: #fafafa;
          color: #111827;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
        }
        .policy-progress {
          position: fixed;
          top: 0;
          left: 0;
          height: 2px;
          background: var(--agent-coral, #FF6B4A);
          z-index: 100;
          transition: width 80ms linear;
          pointer-events: none;
        }
        .policy-topbar {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 32px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: saturate(140%) blur(8px);
          -webkit-backdrop-filter: saturate(140%) blur(8px);
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
          min-height: 52px;
        }
        .policy-back-link {
          font-size: 13px;
          color: #374151;
          text-decoration: none;
          transition: color 150ms;
        }
        .policy-back-link:hover { color: #111827; }
        .policy-hub-link {
          font-size: 12.5px;
          color: #9ca3af;
          text-decoration: none;
          transition: color 150ms;
        }
        .policy-hub-link:hover { color: #6b7280; }

        .policy-hero {
          max-width: 720px;
          margin: 0 auto;
          padding: 72px 32px 40px;
          text-align: center;
        }
        .policy-hero-title {
          font-size: 36px;
          font-weight: 700;
          color: #111827;
          margin: 0;
          letter-spacing: -0.02em;
          line-height: 1.15;
        }
        .policy-hero-description {
          font-size: 16px;
          color: #6b7280;
          margin: 14px auto 0;
          max-width: 520px;
          line-height: 1.55;
        }
        .policy-hero-meta {
          font-size: 13px;
          color: #9ca3af;
          margin: 22px 0 0;
        }
        .policy-hero-divider {
          width: 60px;
          height: 0.5px;
          background: rgba(0, 0, 0, 0.18);
          margin: 36px auto 0;
        }
        .policy-hero-actions {
          margin: 28px 0 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .policy-pdf-button {
          display: inline-flex;
          align-items: center;
          padding: 9px 18px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          background: #fff;
          border: 0.5px solid rgba(0, 0, 0, 0.18);
          border-radius: 8px;
          cursor: pointer;
          transition: background 150ms, border-color 150ms;
        }
        .policy-pdf-button:hover {
          background: #f9fafb;
          border-color: rgba(0, 0, 0, 0.28);
        }
        .policy-pdf-hint {
          font-size: 11.5px;
          color: #9ca3af;
          margin: 0;
        }

        .policy-mobile-nav { display: none; }

        .policy-body {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 32px;
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 64px;
          align-items: start;
        }
        .policy-sidebar {
          position: sticky;
          top: 72px;
          padding: 8px 0 24px;
          max-height: calc(100vh - 96px);
          overflow-y: auto;
        }
        .policy-sidebar-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }
        .policy-sidebar-item { margin: 0; padding: 0; }
        .policy-sidebar-link {
          display: block;
          padding: 10px 0 10px 14px;
          font-size: 13px;
          color: #6b7280;
          text-decoration: none;
          border-left: 2px solid transparent;
          transition: color 150ms, border-color 150ms;
          line-height: 1.45;
        }
        .policy-sidebar-link:hover { color: #374151; }
        .policy-sidebar-link.is-active {
          color: var(--agent-coral-deep, #E84F2D);
          font-weight: 600;
          border-left-color: var(--agent-coral, #FF6B4A);
        }

        .policy-main {
          min-width: 0;
          max-width: 680px;
        }
        .policy-section {
          padding: 28px 0 40px;
          scroll-margin-top: 88px;
        }
        .policy-section:first-child { padding-top: 12px; }
        .policy-h2 {
          font-size: 22px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 18px;
          letter-spacing: -0.01em;
          line-height: 1.3;
        }
        .policy-prose {
          font-size: 15px;
          line-height: 1.7;
          color: #374151;
        }
        .policy-prose > * + * { margin-top: 16px; }
        .policy-prose p { margin: 0; }
        .policy-prose strong { color: #111827; font-weight: 600; }
        .policy-prose ul, .policy-prose ol {
          margin: 0;
          padding-left: 22px;
        }
        .policy-prose li { margin-bottom: 6px; }
        .policy-prose li:last-child { margin-bottom: 0; }
        .policy-prose h3 {
          font-size: 16px;
          font-weight: 600;
          color: #111827;
          margin: 28px 0 12px;
          letter-spacing: -0.005em;
        }
        .policy-prose h4 {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 20px 0 8px;
        }
        .policy-prose a {
          color: var(--agent-coral-deep, #E84F2D);
          text-decoration: underline;
          text-underline-offset: 2px;
          text-decoration-thickness: 0.5px;
          transition: color 150ms;
        }
        .policy-prose a:hover { color: var(--agent-coral, #FF6B4A); }
        .policy-prose code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 12.5px;
          background: #f3f4f6;
          padding: 2px 6px;
          border-radius: 4px;
          color: #374151;
          word-break: break-word;
        }

        /* Tables — sub-processor lists, cookie inventory, pricing bands.
           Must render as proper tables, not raw markdown. */
        .policy-prose table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0 0;
          font-size: 13.5px;
          line-height: 1.55;
          border: 0.5px solid rgba(0, 0, 0, 0.08);
          border-radius: 8px;
          overflow: hidden;
        }
        .policy-prose thead { background: #f9fafb; }
        .policy-prose th {
          font-weight: 600;
          color: #374151;
          text-align: left;
          padding: 11px 14px;
          font-size: 11.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.08);
          vertical-align: top;
        }
        .policy-prose td {
          padding: 11px 14px;
          border-bottom: 0.5px solid rgba(0, 0, 0, 0.05);
          vertical-align: top;
          color: #374151;
        }
        .policy-prose tbody tr:last-child td { border-bottom: none; }
        .policy-prose th:first-child, .policy-prose td:first-child { padding-left: 16px; }
        .policy-prose th:last-child, .policy-prose td:last-child { padding-right: 16px; }

        /* Placeholder marker — visually subtle pending fill */
        .policy-prose .pending {
          background: #fef3c7;
          color: #78350f;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 12.5px;
          font-style: normal;
          font-weight: 500;
        }

        .policy-footer {
          max-width: 880px;
          margin: 80px auto 0;
          padding: 40px 32px 48px;
          border-top: 0.5px solid rgba(0, 0, 0, 0.08);
          text-align: center;
          font-size: 13px;
          color: #9ca3af;
        }
        .policy-footer p { margin: 0; }
        .policy-footer-link {
          color: #6b7280;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 150ms;
        }
        .policy-footer-link:hover { color: #374151; }

        @media (max-width: 900px) {
          .policy-body {
            grid-template-columns: 1fr;
            gap: 0;
            padding: 0 24px;
          }
          .policy-sidebar { display: none; }
          .policy-mobile-nav {
            display: block;
            max-width: 720px;
            margin: 0 auto 16px;
            padding: 0 24px;
          }
          .policy-mobile-nav-trigger {
            display: inline-flex;
            align-items: center;
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 500;
            color: #374151;
            background: #fff;
            border: 0.5px solid rgba(0, 0, 0, 0.12);
            border-radius: 8px;
            cursor: pointer;
            min-height: 40px;
          }
          .policy-mobile-nav-list {
            list-style: none;
            margin: 8px 0 0;
            padding: 8px 0;
            background: #fff;
            border: 0.5px solid rgba(0, 0, 0, 0.08);
            border-radius: 8px;
            max-height: 60vh;
            overflow-y: auto;
          }
          .policy-mobile-nav-item {
            display: block;
            padding: 12px 16px;
            font-size: 14px;
            color: #374151;
            text-decoration: none;
            min-height: 44px;
            border-bottom: 0.5px solid rgba(0, 0, 0, 0.04);
          }
          .policy-mobile-nav-item:last-child { border-bottom: none; }
          .policy-mobile-nav-item.is-active {
            color: var(--agent-coral-deep, #E84F2D);
            font-weight: 600;
            background: rgba(var(--agent-coral-rgb, 255, 107, 74), 0.05);
          }
          .policy-hero { padding: 48px 24px 32px; }
          .policy-hero-title { font-size: 28px; }
          .policy-topbar { padding: 12px 20px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .policy-progress { transition: none; }
          .policy-sidebar-link,
          .policy-mobile-nav-trigger span,
          .policy-back-link,
          .policy-hub-link,
          .policy-prose a {
            transition-property: color;
          }
          html { scroll-behavior: auto !important; }
        }

        /* Print stylesheet — used when user clicks "Download as PDF" (which
           triggers window.print()). Hides chrome and prints only the
           document content. Browser saves the result as PDF via its
           native print dialog ("Save as PDF" destination). */
        @media print {
          .policy-progress,
          .policy-topbar,
          .policy-sidebar,
          .policy-mobile-nav,
          .policy-footer,
          .policy-hero-actions {
            display: none !important;
          }
          .policy-root {
            background: #fff !important;
          }
          .policy-body {
            display: block !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .policy-main {
            max-width: 100% !important;
          }
          .policy-hero {
            padding: 0 0 24px !important;
          }
          .policy-hero-title {
            font-size: 28px !important;
          }
          .policy-section {
            page-break-inside: avoid;
            padding: 16px 0 24px !important;
          }
          .policy-prose table {
            page-break-inside: avoid;
          }
          .policy-prose a {
            color: #111827 !important;
            text-decoration: underline;
          }
          /* Show URL alongside links in print so PDF readers know where they go */
          .policy-prose a[href^="http"]::after,
          .policy-prose a[href^="mailto"]::after {
            content: " (" attr(href) ")";
            font-size: 11px;
            color: #6b7280;
          }
          /* Strip the .pending placeholder styling — keep the text but render
             plainly so it's clear in the printed contract */
          .policy-prose .pending {
            background: transparent !important;
            color: inherit !important;
            padding: 0 !important;
            border-radius: 0 !important;
            font-weight: inherit !important;
          }
        }
      `}</style>
    </div>
  );
}

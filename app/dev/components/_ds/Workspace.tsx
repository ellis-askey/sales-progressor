"use client";
// TSP Design System — workspace shell.
//
// The permanent home for the canonical system we build from the real app. This
// file is the SHELL only: the real AppBackground, a theme switcher, the
// progressive-disclosure nav over the five areas, and the content frame. The
// categories are empty and clearly awaiting review — nothing here invents a
// component, token, variant or decision (see docs/design-system/README.md).

import { useEffect, useRef, useState } from "react";
import { AppBackground } from "@/components/decor/AppBackground";
import { AREAS, SIGNED_OFF, type Area, type Category } from "./registry";
import { entriesFor, searchLibrary } from "./components";
import { EntryCard } from "./EntryCard";
import "./workspace.css";

type Theme = "light" | "dark";

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function Workspace() {
  // Theme is applied to <html data-theme> so the real AppBackground and panels
  // react — then RESTORED on unmount so reviewing in dark never changes the
  // user's actual app preference (same contract as /dev/design-system).
  const [theme, setTheme] = useState<Theme>("light");
  const restore = useRef<string | null>(null);
  useEffect(() => {
    const html = document.documentElement;
    restore.current = html.getAttribute("data-theme");
    setTheme(readTheme());
    return () => {
      if (restore.current) html.setAttribute("data-theme", restore.current);
      else html.removeAttribute("data-theme");
    };
  }, []);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const [selected, setSelected] = useState<{ area: string; category: string } | null>(null);
  const [openAreas, setOpenAreas] = useState<Set<string>>(() => new Set([AREAS[0].id]));
  const [navOpen, setNavOpen] = useState(false); // mobile drawer
  const [signedOff, setSignedOff] = useState(false); // "Signed off" view
  const [query, setQuery] = useState(""); // nav search

  const toggleArea = (id: string) =>
    setOpenAreas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const pick = (area: string, category: string) => {
    setSelected({ area, category });
    setOpenAreas((prev) => new Set(prev).add(area));
    setNavOpen(false);
    setSignedOff(false);
  };

  const activeArea = selected && AREAS.find((a) => a.id === selected.area);
  const activeCategory = activeArea?.categories.find((c) => c.id === selected?.category) ?? null;

  return (
    <div className="ds-root" data-theme={theme}>
      <AppBackground />

      <header className="ds-topbar">
        <button className="ds-nav-toggle" aria-label="Toggle navigation" onClick={() => setNavOpen((o) => !o)}>
          <span /><span /><span />
        </button>
        <div className="ds-brand">
          <span className="ds-brand-mark" aria-hidden="true" />
          <div className="ds-brand-text">
            <strong>Design System</strong>
            <span className="ds-brand-track">The Library · canonical</span>
          </div>
        </div>
        <div className="ds-topbar-spacer" />
        <button className="ds-link ds-signoff-btn" data-active={signedOff} onClick={() => { setSignedOff(true); setSelected(null); setNavOpen(false); }} title="Flows confirmed 100% complete">Signed&nbsp;off&nbsp;✓</button>
        <a className="ds-link" href="/dev/design-system" title="The forward Liquid Glass system — migration source">Liquid&nbsp;Glass&nbsp;↗</a>
        <a className="ds-link" href="/dev/components/gallery" title="The imported uiarc component gallery — a raw source to draw from">Gallery&nbsp;↗</a>
        <button className="ds-theme" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} aria-label="Switch theme">
          {theme === "dark" ? "☀︎ Light" : "☾ Dark"}
        </button>
      </header>

      <div className="ds-body">
        <nav className={`ds-nav${navOpen ? " is-open" : ""}`} aria-label="Design system areas">
          <div className="ds-search" role="search">
            <svg className="ds-search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <input
              className="ds-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search — e.g. orange, arrow, password"
              aria-label="Search the library"
            />
            {query && (
              <button className="ds-search-clear" onClick={() => setQuery("")} aria-label="Clear search">×</button>
            )}
          </div>

          {query.trim() ? (
            <SearchResults query={query} onPick={(area, cat) => pick(area, cat)} />
          ) : (
            <>
              <button className="ds-home" data-active={selected === null && !signedOff} onClick={() => { setSelected(null); setNavOpen(false); setSignedOff(false); }}>
                Overview
              </button>
              {AREAS.map((area) => (
                <NavArea
                  key={area.id}
                  area={area}
                  open={openAreas.has(area.id)}
                  onToggle={() => toggleArea(area.id)}
                  activeCategory={selected?.category ?? null}
                  onPick={(cat) => pick(area.id, cat)}
                />
              ))}
            </>
          )}
        </nav>

        <main className="ds-content">
          {signedOff ? (
            <SignedOff />
          ) : activeCategory ? (
            <CategoryView area={activeArea!} category={activeCategory} theme={theme} />
          ) : (
            <Overview />
          )}
        </main>
      </div>

      {navOpen && <div className="ds-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}
    </div>
  );
}

function NavArea({ area, open, onToggle, activeCategory, onPick }: {
  area: Area; open: boolean; onToggle: () => void; activeCategory: string | null; onPick: (cat: string) => void;
}) {
  return (
    <div className="ds-nav-area" data-open={open}>
      <button className="ds-nav-area-head" aria-expanded={open} onClick={onToggle}>
        <span className="ds-chevron" aria-hidden="true">›</span>
        <span className="ds-nav-area-label">{area.label}</span>
        <span className="ds-nav-area-count">{area.categories.length}</span>
      </button>
      {open && (
        <ul className="ds-nav-cats">
          {area.categories.map((cat) => {
            const count = entriesFor(cat.id).length;
            return (
              <li key={cat.id}>
                <button className="ds-nav-cat" data-active={activeCategory === cat.id} onClick={() => onPick(cat.id)}>
                  <span>{cat.label}</span>
                  {count > 0 ? <span className="ds-nav-cat-count">{count}</span> : <span className="ds-dot" title="Awaiting review" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SearchResults({ query, onPick }: { query: string; onPick: (area: string, cat: string) => void }) {
  const hits = searchLibrary(query);
  const entries = hits.filter((h) => h.kind === "entry");
  const cats = hits.filter((h) => h.kind === "category");

  if (!hits.length) {
    return (
      <div className="ds-search-empty">
        No matches for <strong>“{query.trim()}”</strong>.
        <span>Try a colour, shape or word you&rsquo;d see on screen.</span>
      </div>
    );
  }

  return (
    <div className="ds-results">
      <div className="ds-results-count">{hits.length} result{hits.length === 1 ? "" : "s"}</div>
      {entries.map((h, i) => (
        <button key={`e-${h.categoryId}-${h.title}-${i}`} className="ds-result" onClick={() => onPick(h.areaId, h.categoryId)}>
          <span className="ds-result-title">{h.title}</span>
          <span className="ds-result-crumb">{h.areaLabel} · {h.categoryLabel}</span>
        </button>
      ))}
      {cats.length > 0 && <div className="ds-results-sub">Categories</div>}
      {cats.map((h) => (
        <button key={`c-${h.categoryId}`} className="ds-result" data-cat onClick={() => onPick(h.areaId, h.categoryId)}>
          <span className="ds-result-title">{h.categoryLabel}</span>
          <span className="ds-result-crumb">{h.areaLabel}</span>
        </button>
      ))}
    </div>
  );
}

function CategoryView({ area, category, theme }: { area: Area; category: Category; theme: Theme }) {
  const entries = entriesFor(category.id);
  return (
    <div className="ds-category">
      <div className="ds-breadcrumb">{area.label}</div>
      <h1 className="ds-h1">{category.label}</h1>
      {category.blurb && <p className="ds-lede">{category.blurb}</p>}

      {entries.length === 0 ? (
        <div className="ds-empty">
          <div className="ds-empty-mark" aria-hidden="true" />
          <h2>Awaiting its first review</h2>
          <p>
            Nothing has been canonicalised here yet. When we open this category together we&rsquo;ll <strong>discover</strong> the
            existing implementations across the app, <strong>compare</strong> them, <strong>decide</strong> the canonical form,
            and record it here — with its variants, states and protected exceptions intact.
          </p>
          <div className="ds-empty-steps">
            {["Discover", "Compare", "Decide", "Document", "Prepare", "Validate", "Migrate", "Verify"].map((s, i) => (
              <span key={s} className="ds-step"><em>{i + 1}</em>{s}</span>
            ))}
          </div>
        </div>
      ) : (
        <div className="ds-entries">
          {entries.map((e) => <EntryCard key={e.id} entry={e} theme={theme} />)}
        </div>
      )}
    </div>
  );
}

function SignedOff() {
  return (
    <div className="ds-category">
      <div className="ds-breadcrumb">Governance</div>
      <h1 className="ds-h1">Signed off</h1>
      <p className="ds-lede">
        Flows and pages confirmed 100% complete — spacing, canonicals, and every element, container, popup and state
        accounted for in the library (bar anything deliberately kept bespoke). One lands here the moment you sign it off.
      </p>
      {SIGNED_OFF.length === 0 ? (
        <div className="ds-empty">
          <div className="ds-empty-mark" aria-hidden="true" />
          <h2>Nothing signed off yet</h2>
          <p>When a flow — the login page, sign-up step 1, step 2 — is confirmed down to the last detail, say the word and it&rsquo;s recorded here with the date.</p>
        </div>
      ) : (
        <div className="ds-entries">
          {SIGNED_OFF.map((s) => (
            <article key={s.flow} className="ds-entry">
              <div className="ds-entry-id"><h3>{s.flow}</h3><span className="ds-badge" data-tone="success">Signed off</span></div>
              {(s.date || s.note) && <p className="ds-entry-summary">{s.date}{s.note ? ` — ${s.note}` : ""}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Overview() {
  const totalCats = AREAS.reduce((n, a) => n + a.categories.length, 0);
  return (
    <div className="ds-overview">
      <div className="ds-breadcrumb">The Sales Progressor</div>
      <h1 className="ds-h1">Design System</h1>
      <p className="ds-lede">
        The canonical record of what The Sales Progressor already is — built from the real, shipped product, one reviewed
        decision at a time. Not a redesign and not a generic kit: consistency without unnecessary uniformity, with every
        deliberate detail preserved.
      </p>

      <div className="ds-overview-grid">
        <section className="ds-panel">
          <h2>Two systems, one destination</h2>
          <p><strong>This library</strong> is the law-in-waiting — the canonical system of what exists today. It becomes the single source of truth once we&rsquo;ve been through the whole app.</p>
          <p><a className="ds-inline-link" href="/dev/design-system">Liquid&nbsp;Glass</a> is the forward system and the migration source. As a component moves here, it&rsquo;s retired from there; when the app is fully covered, Liquid Glass is removed.</p>
        </section>

        <section className="ds-panel">
          <h2>How a category is filled</h2>
          <ol className="ds-ol">
            <li>Discover existing implementations in the real app</li>
            <li>Compare the variants, sizes, states and behaviour</li>
            <li>Decide the canonical form — you approve</li>
            <li>Document it, with protected exceptions</li>
            <li>Prepare the canonical component</li>
            <li>Validate states, responsive &amp; accessibility</li>
            <li>Migrate production — only with your approval</li>
            <li>Verify the migrated pages</li>
          </ol>
        </section>

        <section className="ds-panel">
          <h2>What&rsquo;s here now</h2>
          <p>Five areas, <strong>{totalCats}</strong> categories, all empty and awaiting review. Existing sizing, proportions and behaviour are the baseline — nothing changes without your sign-off.</p>
          <p className="ds-muted">Durable records live in <code>docs/design-system/</code>: mission, decisions, registry, exceptions and progress. A fresh session resumes from there.</p>
        </section>
      </div>

      <p className="ds-pickprompt">Choose an area on the left to begin, or we&rsquo;ll pick the first component to review together.</p>
    </div>
  );
}

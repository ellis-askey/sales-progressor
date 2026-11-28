"use client";
// /dev/card-system — CONCEPT. The full solid-card system for the agent app.
// Dev-only (blocks in production). Not wired to the live design system.
//
// Builds on the founder-approved direction (/dev/solid-cards, 2026-11-28):
// SOLID surfaces — white in light, true black (#0a0b0f) in dark — separated by
// a hairline + a soft layered shadow, never translucency. One hard rule carried
// through: an accent NEVER fills a card background. Tone lives in a rail, an
// icon, a dot or a ring. The single exception is the Promo card, which is a
// deliberate solid-coral tile.
//
// This page is the taxonomy: every structurally-distinct card the app needs,
// each with when-to-use, anatomy and states, rendered over the real
// <AppBackground /> with a light/dark toggle. Nothing here writes anything.

import { useState, useEffect, useRef, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, House, CheckCircle, Clock, CalendarBlank, Users, NotePencil,
  ArrowUpRight, CaretRight, TrendUp, TrendDown, ChatCircle, Warning, Info, Bell,
  FileText, Scales, Check, CurrencyGbp, Sparkle, ArrowRight, Megaphone, Lock,
} from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";

type Theme = "dark" | "light";

const SECTIONS = [
  { id: "foundations", label: "Foundations" },
  { id: "hero", label: "Hero" },
  { id: "section", label: "Section" },
  { id: "metric", label: "Metric" },
  { id: "list", label: "List & feed" },
  { id: "interactive", label: "Interactive" },
  { id: "status", label: "Status" },
  { id: "nested", label: "Nested" },
  { id: "selectable", label: "Selectable" },
  { id: "empty", label: "Empty state" },
  { id: "promo", label: "Promo" },
  { id: "states", label: "States" },
];

export default function CardSystem() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<Theme>("light");
  const [active, setActive] = useState("foundations");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  // Scroll-spy for the sticky contents rail.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: [0, 0.3, 1] },
    );
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="cs-root" data-theme={theme} ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBackground />

      <div className="cs-shell">
        {/* Sticky contents rail */}
        <aside className="cs-nav">
          <div className="cs-nav-head">Card system</div>
          <nav>
            {SECTIONS.map((s) => (
              <button key={s.id} className={`cs-nav-link ${active === s.id ? "on" : ""}`} onClick={() => go(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="cs-main">
          {/* Header */}
          <header className="cs-top">
            <div>
              <div className="cs-eyebrow">Design system · agent app</div>
              <h1>Cards</h1>
              <p className="cs-lede">
                Solid surfaces over the live background. White in light, true black in dark, separated by a hairline
                and a soft shadow. An accent never fills a card: tone lives in a rail, an icon, a dot or a ring. Ten
                types, one language.
              </p>
            </div>
            <button
              className={`cs-themesw ${theme === "light" ? "on" : ""}`}
              role="switch" aria-checked={theme === "light"} aria-label="Toggle light mode"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              <span className="cs-themesw-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
            </button>
          </header>

          {/* ── Foundations ──────────────────────────────────────── */}
          <Section id="foundations" n="00" title="Foundations" lede="The primitives every card is built from. Three elevations, a radius scale, five tones, and one anatomy.">
            <div className="cs-found-grid">
              <div className="cs-found-block">
                <h4>Elevation</h4>
                <div className="cs-elev-row">
                  {[["sm", "Flat / nested"], ["md", "Default"], ["lg", "Hero / overlay"]].map(([k, label]) => (
                    <div key={k} className={`cs-swatch cs-elev-${k}`}>
                      <span className="cs-swatch-tag">{k}</span>
                      <span className="cs-swatch-sub">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cs-found-block">
                <h4>Radius</h4>
                <div className="cs-rad-row">
                  {[["12", "nested"], ["16", "card"], ["22", "hero"]].map(([r, label]) => (
                    <div key={r} className="cs-rad-item">
                      <div className="cs-rad-box" style={{ borderRadius: `${r}px` }} />
                      <span>{r}px<em>{label}</em></span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="cs-found-block">
                <h4>Tone</h4>
                <div className="cs-tone-row">
                  {[["accent", "Accent"], ["ok", "Success"], ["warn", "Warning"], ["danger", "Danger"], ["info", "Info"]].map(([k, label]) => (
                    <span key={k} className="cs-tone"><span className={`cs-tone-dot t-${k}`} />{label}</span>
                  ))}
                </div>
                <p className="cs-micro">Tones mark state with a dot, rail, icon or ring. They never wash the surface.</p>
              </div>
              <div className="cs-found-block">
                <h4>Anatomy</h4>
                <div className="cs-card cs-md cs-anat">
                  <div className="cs-anat-zone"><span className="cs-anat-tag">Header</span><CardHead icon={<Users weight="regular" />} title="Title" action="Action" /></div>
                  <div className="cs-anat-zone"><span className="cs-anat-tag">Body</span><p className="cs-anat-body">Content sits here, on its own vertical rhythm.</p></div>
                  <div className="cs-anat-zone cs-anat-foot"><span className="cs-anat-tag">Footer</span><span className="cs-anat-metaline">Meta · optional action</span></div>
                </div>
              </div>
            </div>
          </Section>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <Section id="hero" n="01" title="Hero" lede="One per page: the file header, the thing you land on. Maximum presence: generous padding, the largest radius, the deepest shadow, and the accent earning its place on the CTA.">
            <HeroCard />
          </Section>

          {/* ── Section ──────────────────────────────────────────── */}
          <Section id="section" n="02" title="Section" lede="The workhorse. A titled container that wraps most of the app: people, key dates, solicitors, documents. Header (icon + title + optional action), body, optional footer.">
            <div className="cs-trio">
              <div className="cs-card cs-md"><PeopleCard /></div>
              <div className="cs-card cs-md"><KeyDatesCard /></div>
              <div className="cs-card cs-md"><NotesCard /></div>
            </div>
          </Section>

          {/* ── Metric ───────────────────────────────────────────── */}
          <Section id="metric" n="03" title="Metric" lede="Compact KPI tiles, read as a row. A single number does the talking; an optional delta shows movement. Used under a hero and across analytics.">
            <div className="cs-stat-row">
              <StatTile icon={<House weight="regular" />} value="63%" label="Complete" />
              <StatTile icon={<CheckCircle weight="regular" />} value="10/14" label="Seller steps" />
              <StatTile icon={<CurrencyGbp weight="regular" />} value="£4,250" label="Fee at exchange" delta="up" deltaLabel="+£150" />
              <StatTile icon={<Clock weight="regular" />} value="59d" label="To exchange" delta="down" deltaLabel="4d faster" />
            </div>
          </Section>

          {/* ── List & feed ──────────────────────────────────────── */}
          <Section id="list" n="04" title="List & feed" lede="A card whose body is a stream of rows: activity, updates, reminders. The internal rhythm is the point: a leading avatar or badge, hairline dividers, a per-row hover. Distinct from Section because rows, not prose, set the spacing.">
            <div className="cs-card cs-md cs-feed">
              <CardHead icon={<Bell weight="regular" />} title="Recent activity" action="View all" />
              <div className="cs-feed-rows">
                <FeedRow role="staff" who="E" title="Chased the buyer's solicitor for search results" time="2h ago" />
                <FeedRow role="sol" who="M" title="Matthew Waite & Co issued the draft contract pack" time="Yesterday" />
                <FeedRow role="seller" who="J" title="Seller returned their property information forms" time="2d ago" />
                <FeedRow role="buyer" who="M" title="Buyer's mortgage valuation booked" time="3d ago" />
              </div>
            </div>
          </Section>

          {/* ── Interactive ──────────────────────────────────────── */}
          <Section id="interactive" n="05" title="Interactive" lede="The whole card is the control: a file in My Files, a chain link. Hover lifts it, an arrow signals the destination, and it carries a real focus ring and a pressed state. Tab to one to see the ring.">
            <div className="cs-pair">
              <FileCard />
              <FileCard addr="Flat 4, Kings Court" place="St Albans, AL1" status="warn" statusLabel="On hold" pct={41} next="Chase enquiry replies" />
            </div>
          </Section>

          {/* ── Status ───────────────────────────────────────────── */}
          <Section id="status" n="06" title="Status" lede="Carries a tone without a coloured fill. A left rail plus a toned icon and label does the work. Legible in both themes, and never the muddy tinted-box look. Success, warning, danger.">
            <div className="cs-trio">
              <StatusCard tone="ok" icon={<CheckCircle weight="fill" />} title="On track" body="Every step is where it should be. Nothing needs you today." />
              <StatusCard tone="warn" icon={<Warning weight="fill" />} title="Needs attention" body="Enquiry replies are 4 days overdue with the seller's solicitor." action="Chase now" />
              <StatusCard tone="danger" icon={<Warning weight="fill" />} title="At risk" body="Mortgage offer expires in 6 days and exchange is not booked." action="Open file" />
            </div>
          </Section>

          {/* ── Nested ───────────────────────────────────────────── */}
          <Section id="nested" n="07" title="Nested" lede="A card inside a card. The inner surface drops the shadow (no double elevation) and sits on a faint inset fill with a hairline, so grouping reads without stacking shadows.">
            <div className="cs-card cs-md">
              <CardHead icon={<Scales weight="regular" />} title="Fee breakdown" />
              <div className="cs-nest-grid">
                <div className="cs-card cs-inset cs-nest-item"><span className="cs-nest-label">Agency fee</span><span className="cs-nest-value">£3,600</span></div>
                <div className="cs-card cs-inset cs-nest-item"><span className="cs-nest-label">Referral</span><span className="cs-nest-value">£400</span></div>
                <div className="cs-card cs-inset cs-nest-item"><span className="cs-nest-label">Add-ons</span><span className="cs-nest-value">£250</span></div>
              </div>
            </div>
          </Section>

          {/* ── Selectable ───────────────────────────────────────── */}
          <Section id="selectable" n="08" title="Selectable" lede="A radio or checkbox the size of a card: choosing a transaction type, a plan. Selected means a ring and an accent tick, not a fill. Includes hover, focus and a disabled state.">
            <div className="cs-select-row" role="radiogroup" aria-label="Transaction type">
              <OptionCard icon={<House weight="regular" />} title="Standard sale" sub="Freehold or leasehold" selected />
              <OptionCard icon={<Users weight="regular" />} title="Chain" sub="Linked onward purchase" />
              <OptionCard icon={<Lock weight="regular" />} title="Auction" sub="Not available yet" disabled />
            </div>
          </Section>

          {/* ── Empty state ──────────────────────────────────────── */}
          <Section id="empty" n="09" title="Empty state" lede="The first-run card. A pill, a title, a line of reassurance, and three sub-cards that teach what will appear here. The one place a card is allowed to be mostly space, but composed, not blank.">
            <EmptyStateCard />
          </Section>

          {/* ── Promo ────────────────────────────────────────────── */}
          <Section id="promo" n="10" title="Promo" lede="The deliberate exception. A solid-coral tile for a feature announcement or upsell. The only card that fills with accent, used sparingly so it still lands.">
            <PromoCard />
          </Section>

          {/* ── States ───────────────────────────────────────────── */}
          <Section id="states" n="11" title="States" lede="Every interactive surface ships four states. Here they are forced side by side so the treatment is documented, not left to chance.">
            <div className="cs-states-row">
              {[["rest", "Rest"], ["hover", "Hover"], ["focus", "Focus"], ["active", "Active"], ["disabled", "Disabled"]].map(([k, label]) => (
                <div key={k} className="cs-state-item">
                  <div className={`cs-card cs-md cs-interactive is-${k}`} tabIndex={-1}>
                    <div className="cs-state-face"><span className="cs-ch-icon"><FileText weight="regular" /></span><span className="cs-state-title">Card</span></div>
                  </div>
                  <span className="cs-state-label">{label}</span>
                </div>
              ))}
            </div>
          </Section>

          <footer className="cs-foot">
            Prototype at <code>/dev/card-system</code>. No live styles changed. The Section and Hero surfaces are
            already baked into the Design Lab as <strong>Solid White / Solid Black · Card / Hero</strong>; the rest
            (status rail, option ring, promo tile, feed rhythm) are component-level patterns to apply as each page is
            migrated. Tell me which page to take first and I&apos;ll wire it.
          </footer>
        </main>
      </div>
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────
function Section({ id, n, title, lede, children }: { id: string; n: string; title: string; lede: string; children: ReactNode }) {
  return (
    <section id={id} className="cs-section">
      <div className="cs-sechead">
        <div className="cs-kicker">{n}</div>
        <h2>{title}</h2>
        <p>{lede}</p>
      </div>
      {children}
    </section>
  );
}

// ── Shared pieces ──────────────────────────────────────────────────
function CardHead({ icon, title, action }: { icon: ReactNode; title: string; action?: string }) {
  return (
    <div className="cs-ch">
      <span className="cs-ch-icon">{icon}</span>
      <span className="cs-ch-title">{title}</span>
      {action && <button className="cs-ch-action">{action} <CaretRight weight="bold" /></button>}
    </div>
  );
}

function Avatar({ role, children }: { role: "seller" | "buyer" | "sol" | "staff"; children: ReactNode }) {
  return <span className={`cs-ava cs-ava--${role}`}>{children}</span>;
}

function HeroCard() {
  return (
    <figure className="cs-figure">
      <div className="cs-card cs-lg cs-hero">
        <div className="cs-hero-media"><House weight="regular" /></div>
        <div className="cs-hero-body">
          <div className="cs-hero-eyebrow">Managing this file · 3 weeks</div>
          <h3 className="cs-hero-title">12 Orchard Rise</h3>
          <p className="cs-hero-sub">Hemel Hempstead, HP2 · Freehold · Mortgage</p>
          <div className="cs-hero-meta">
            <span className="cs-chip cs-chip--ok"><CheckCircle weight="fill" /> On track</span>
            <span className="cs-chip"><Clock weight="regular" /> Exchange ~26 Jan</span>
            <span className="cs-chip"><TrendUp weight="regular" /> 63% complete</span>
          </div>
          <div className="cs-progress"><span style={{ width: "63%" }} /></div>
        </div>
        <button className="cs-cta">Open file <ArrowUpRight weight="bold" /></button>
      </div>
      <figcaption>Hero · the file header. Largest radius, deepest shadow, accent on the CTA only.</figcaption>
    </figure>
  );
}

function PeopleCard() {
  const people = [
    { who: "J. Sharp", role: "seller" as const, label: "Seller" },
    { who: "M. Down", role: "buyer" as const, label: "Buyer" },
    { who: "Matthew Waite & Co", role: "sol" as const, label: "Solicitor" },
  ];
  return (
    <>
      <CardHead icon={<Users weight="regular" />} title="People" action="Manage" />
      <ul className="cs-people">
        {people.map((p) => (
          <li key={p.label}>
            <Avatar role={p.role}>{p.who.charAt(0)}</Avatar>
            <span className="cs-people-text"><strong>{p.who}</strong><span>{p.label}</span></span>
          </li>
        ))}
      </ul>
    </>
  );
}

function KeyDatesCard() {
  const rows = [
    { label: "Instructed", value: "5 Nov", done: true },
    { label: "Draft pack", value: "6 Nov", done: true },
    { label: "Target exchange", value: "26 Jan", done: false },
  ];
  return (
    <>
      <CardHead icon={<CalendarBlank weight="regular" />} title="Key dates" />
      <ul className="cs-dates">
        {rows.map((r) => (
          <li key={r.label}>
            <span className={`cs-dot ${r.done ? "done" : ""}`} />
            <span className="cs-dates-label">{r.label}</span>
            <span className="cs-dates-value">{r.value}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function NotesCard() {
  return (
    <>
      <CardHead icon={<NotePencil weight="regular" />} title="Latest note" />
      <p className="cs-note-body">Spoke to the buyer&apos;s solicitor. Searches are back and enquiries go over this week. Nothing outstanding our side.</p>
      <div className="cs-note-foot">
        <Avatar role="staff">E</Avatar>
        <span className="cs-note-meta">Ellis · 2 days ago</span>
        <button className="cs-note-reply"><ChatCircle weight="regular" /> Reply</button>
      </div>
    </>
  );
}

function StatTile({ icon, value, label, delta, deltaLabel }: { icon: ReactNode; value: string; label: string; delta?: "up" | "down"; deltaLabel?: string }) {
  return (
    <div className="cs-card cs-md cs-stat">
      <span className="cs-stat-icon">{icon}</span>
      <span className="cs-stat-value">{value}</span>
      <span className="cs-stat-foot">
        <span className="cs-stat-label">{label}</span>
        {delta && <span className={`cs-delta ${delta}`}>{delta === "up" ? <TrendUp weight="bold" /> : <TrendDown weight="bold" />}{deltaLabel}</span>}
      </span>
    </div>
  );
}

function FeedRow({ role, who, title, time }: { role: "seller" | "buyer" | "sol" | "staff"; who: string; title: string; time: string }) {
  return (
    <div className="cs-feed-row">
      <Avatar role={role}>{who}</Avatar>
      <span className="cs-feed-text">{title}</span>
      <span className="cs-feed-time">{time}</span>
    </div>
  );
}

function FileCard({ addr = "12 Orchard Rise", place = "Hemel Hempstead, HP2", status = "ok", statusLabel = "On track", pct = 63, next = "Awaiting search results" }:
  { addr?: string; place?: string; status?: "ok" | "warn"; statusLabel?: string; pct?: number; next?: string }) {
  return (
    <button className="cs-card cs-md cs-interactive cs-file">
      <span className="cs-file-marker"><House weight="regular" /></span>
      <span className="cs-file-body">
        <span className="cs-file-addr">{addr}</span>
        <span className="cs-file-place">{place}</span>
        <span className="cs-file-status"><span className={`cs-tone-dot t-${status}`} />{statusLabel} · {pct}%</span>
        <span className="cs-file-next">Next: {next}</span>
        <span className="cs-file-progress"><span style={{ width: `${pct}%` }} /></span>
      </span>
      <ArrowUpRight weight="bold" className="cs-file-go" />
    </button>
  );
}

function StatusCard({ tone, icon, title, body, action }: { tone: "ok" | "warn" | "danger"; icon: ReactNode; title: string; body: string; action?: string }) {
  return (
    <div className={`cs-card cs-md cs-status t-${tone}`}>
      <span className="cs-status-rail" />
      <span className="cs-status-icon">{icon}</span>
      <div className="cs-status-body">
        <strong>{title}</strong>
        <p>{body}</p>
        {action && <button className="cs-status-action">{action} <ArrowRight weight="bold" /></button>}
      </div>
    </div>
  );
}

function OptionCard({ icon, title, sub, selected, disabled }: { icon: ReactNode; title: string; sub: string; selected?: boolean; disabled?: boolean }) {
  return (
    <button
      className={`cs-card cs-md cs-option ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}`}
      role="radio" aria-checked={!!selected} aria-disabled={disabled} disabled={disabled}
    >
      <span className="cs-option-tick">{selected ? <Check weight="bold" /> : null}</span>
      <span className="cs-option-icon">{icon}</span>
      <span className="cs-option-text"><strong>{title}</strong><span>{sub}</span></span>
    </button>
  );
}

function EmptyStateCard() {
  const feats = [
    ["Solicitor replies land here", "The moment they arrive, no chasing."],
    ["Every file's progress", "Each sale's stage and next step, at a glance."],
    ["Who confirmed each step", "Every confirmation, with the person behind it."],
  ];
  return (
    <div className="cs-card cs-lg cs-empty">
      <span className="cs-empty-pill">Nothing here yet</span>
      <h3>Nothing to catch up on yet</h3>
      <p>Everything happening across your sales, including the work done for you, shows up here as it happens.</p>
      <div className="cs-empty-sub">
        {feats.map(([t, b]) => (
          <div key={t} className="cs-card cs-inset cs-empty-feat"><strong>{t}</strong><span>{b}</span></div>
        ))}
      </div>
    </div>
  );
}

function PromoCard() {
  return (
    <div className="cs-promo">
      <span className="cs-promo-badge"><Sparkle weight="fill" /> New</span>
      <h3>Weekly briefing, written for you</h3>
      <p>A plain-English summary of what moved across every file this week, in your inbox each Monday.</p>
      <button className="cs-promo-cta"><Megaphone weight="fill" /> Turn it on</button>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const CSS = `
.cs-root{
  --accent:#FF6B4A; --accent-press:#f0562f; --accent-ink:#fff;
  --ok:#1fa963; --warn:#c77a11; --danger:#d93b42; --info:#2f6fe0;
  --ink:#10131a; --ink2:rgba(16,19,26,0.60); --ink3:rgba(16,19,26,0.42);
  --surface:#ffffff;
  --inset:rgba(16,20,34,0.028);
  --fill-icon:rgba(16,20,34,0.05);
  --fill-soft:rgba(16,20,34,0.035);
  --hair:rgba(16,20,34,0.08);
  --hair-2:rgba(16,20,34,0.06);
  --shadow-sm:0 1px 2px rgba(16,24,48,0.06);
  --shadow-md:0 1px 2px rgba(16,24,48,0.045), 0 10px 30px rgba(16,24,48,0.08);
  --shadow-lg:0 2px 4px rgba(16,24,48,0.05), 0 26px 60px rgba(16,24,48,0.13);
  --shadow-hover:0 2px 8px rgba(16,24,48,0.07), 0 20px 48px rgba(16,24,48,0.14);
  --ring:0 0 0 3px rgba(255,107,74,0.32);
  --nav-on:rgba(16,20,34,0.05);

  position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate; color:var(--ink);
  font-family:-apple-system, BlinkMacSystemFont, "SF Pro Display","SF Pro Text","Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased; letter-spacing:-0.011em;
}
.cs-root[data-theme="dark"]{
  --ok:#35c879; --warn:#f3a533; --danger:#ff5a60; --info:#5b9bff;
  --ink:#f3f5f8; --ink2:rgba(243,245,248,0.62); --ink3:rgba(243,245,248,0.40);
  --surface:#0a0b0f;
  --inset:rgba(255,255,255,0.045);
  --fill-icon:rgba(255,255,255,0.07);
  --fill-soft:rgba(255,255,255,0.05);
  --hair:rgba(255,255,255,0.10);
  --hair-2:rgba(255,255,255,0.07);
  --shadow-sm:0 1px 2px rgba(0,0,0,0.5);
  --shadow-md:0 1px 2px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.5);
  --shadow-lg:0 2px 6px rgba(0,0,0,0.55), 0 30px 70px rgba(0,0,0,0.6);
  --shadow-hover:0 2px 10px rgba(0,0,0,0.55), 0 24px 56px rgba(0,0,0,0.62);
  --ring:0 0 0 3px rgba(255,107,74,0.42);
  --nav-on:rgba(255,255,255,0.08);
}
.t-accent{ color:var(--accent); } .t-ok{ color:var(--ok); } .t-warn{ color:var(--warn); } .t-danger{ color:var(--danger); } .t-info{ color:var(--info); }

/* Shell: sticky nav + content */
.cs-shell{ position:relative; z-index:2; max-width:1180px; margin:0 auto; padding:0 24px; display:grid; grid-template-columns:184px minmax(0,1fr); gap:44px; }
.cs-nav{ position:sticky; top:0; align-self:start; height:100vh; padding:52px 0 40px; display:flex; flex-direction:column; }
.cs-nav-head{ font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--ink3); padding:0 12px 12px; }
.cs-nav nav{ display:flex; flex-direction:column; gap:1px; overflow-y:auto; }
.cs-nav-link{ text-align:left; font-size:13px; font-weight:540; color:var(--ink3); background:none; border:none; padding:7px 12px; border-radius:8px; cursor:pointer; transition:color .2s, background .2s; }
.cs-nav-link:hover{ color:var(--ink2); background:var(--fill-soft); }
.cs-nav-link.on{ color:var(--ink); background:var(--nav-on); font-weight:600; }
@media (max-width:900px){ .cs-shell{ grid-template-columns:1fr; gap:0; } .cs-nav{ display:none; } }

.cs-main{ padding:52px 0 120px; min-width:0; }

/* Header */
.cs-top{ display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:12px; }
.cs-eyebrow{ font-size:12px; font-weight:600; color:var(--accent); margin-bottom:10px; }
.cs-top h1{ font-size:clamp(34px,5vw,48px); font-weight:800; letter-spacing:-.04em; line-height:1; }
.cs-lede{ font-size:16px; line-height:1.55; color:var(--ink2); margin-top:16px; max-width:620px; }

/* Theme switch */
.cs-themesw{ flex-shrink:0; width:52px; height:31px; border-radius:999px; border:1px solid var(--hair); background:var(--fill-soft); position:relative; cursor:pointer; padding:0; }
.cs-themesw-knob{ position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.3); transition:transform .4s cubic-bezier(.3,1.35,.4,1); }
.cs-themesw-knob svg{ width:13px; height:13px; color:#33343c; }
.cs-themesw.on .cs-themesw-knob{ transform:translateX(21px); }

/* Sections */
.cs-section{ padding-top:56px; scroll-margin-top:24px; }
.cs-sechead{ margin-bottom:24px; }
.cs-kicker{ font-size:12px; font-weight:700; letter-spacing:.08em; color:var(--ink3); margin-bottom:10px; }
.cs-sechead h2{ font-size:26px; font-weight:760; letter-spacing:-.03em; }
.cs-sechead p{ font-size:14.5px; color:var(--ink2); margin-top:9px; line-height:1.6; max-width:680px; }

/* ── Base card + elevations ───────────────────────────── */
.cs-card{ background:var(--surface); border:1px solid var(--hair); border-radius:16px; transition:transform .4s cubic-bezier(.2,.8,.2,1), box-shadow .4s ease, border-color .3s; }
.cs-sm{ box-shadow:var(--shadow-sm); }
.cs-md{ box-shadow:var(--shadow-md); padding:18px; }
.cs-lg{ box-shadow:var(--shadow-lg); border-radius:22px; }
.cs-inset{ box-shadow:none; background:var(--inset); border-color:var(--hair-2); border-radius:12px; }

/* Layout helpers */
.cs-trio{ display:grid; grid-template-columns:repeat(3,1fr); gap:18px; align-items:start; }
.cs-pair{ display:grid; grid-template-columns:repeat(2,1fr); gap:18px; }
@media (max-width:760px){ .cs-trio,.cs-pair{ grid-template-columns:1fr; } }
.cs-figure{ margin:0; } .cs-figure figcaption{ font-size:12.5px; color:var(--ink3); margin-top:12px; }

/* ── Foundations ──────────────────────────────────────── */
.cs-found-grid{ display:grid; grid-template-columns:repeat(2,1fr); gap:22px; }
@media (max-width:760px){ .cs-found-grid{ grid-template-columns:1fr; } }
.cs-found-block h4{ font-size:12px; font-weight:680; letter-spacing:.02em; color:var(--ink3); text-transform:uppercase; margin-bottom:13px; }
.cs-elev-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.cs-swatch{ height:84px; border-radius:14px; background:var(--surface); border:1px solid var(--hair); padding:12px; display:flex; flex-direction:column; justify-content:flex-end; }
.cs-elev-sm{ box-shadow:var(--shadow-sm); } .cs-elev-md{ box-shadow:var(--shadow-md); } .cs-elev-lg{ box-shadow:var(--shadow-lg); }
.cs-swatch-tag{ font-size:13px; font-weight:700; } .cs-swatch-sub{ font-size:11px; color:var(--ink3); margin-top:2px; }
.cs-rad-row{ display:flex; gap:16px; }
.cs-rad-item{ display:flex; flex-direction:column; gap:8px; align-items:flex-start; }
.cs-rad-box{ width:58px; height:58px; background:var(--fill-icon); border:1px solid var(--hair); }
.cs-rad-item span{ font-size:12px; font-weight:620; } .cs-rad-item em{ display:block; font-style:normal; font-size:11px; font-weight:400; color:var(--ink3); margin-top:1px; }
.cs-tone-row{ display:flex; flex-wrap:wrap; gap:14px; }
.cs-tone{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:540; color:var(--ink2); }
.cs-tone-dot{ width:11px; height:11px; border-radius:50%; flex-shrink:0; }
.cs-tone-dot.t-accent{ background:var(--accent); } .cs-tone-dot.t-ok{ background:var(--ok); } .cs-tone-dot.t-warn{ background:var(--warn); } .cs-tone-dot.t-danger{ background:var(--danger); } .cs-tone-dot.t-info{ background:var(--info); }
.cs-micro{ font-size:11.5px; color:var(--ink3); margin-top:12px; line-height:1.5; }
.cs-anat{ display:flex; flex-direction:column; gap:0; padding:0; }
.cs-anat-zone{ position:relative; padding:14px 16px 14px 74px; }
.cs-anat-zone + .cs-anat-zone{ border-top:1px dashed var(--hair); }
.cs-anat-tag{ position:absolute; left:14px; top:14px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color:var(--ink3); }
.cs-anat-body{ font-size:13px; color:var(--ink2); }
.cs-anat-foot{ display:flex; align-items:center; }
.cs-anat-metaline{ font-size:12px; color:var(--ink3); }

/* ── Card internals (shared) ──────────────────────────── */
.cs-ch{ display:flex; align-items:center; gap:9px; margin-bottom:14px; }
.cs-ch-icon{ width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background:var(--fill-icon); border:1px solid var(--hair); flex-shrink:0; }
.cs-ch-icon svg{ width:15px; height:15px; color:var(--ink2); }
.cs-ch-title{ font-size:13.5px; font-weight:650; flex:1; }
.cs-ch-action{ display:inline-flex; align-items:center; gap:3px; font-size:12px; font-weight:580; color:var(--accent); background:none; border:none; cursor:pointer; padding:0; }
.cs-ch-action svg{ width:11px; height:11px; }

.cs-ava{ width:34px; height:34px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-size:13px; font-weight:650; color:#fff; }
.cs-ava--seller{ background:#3b7de0; } .cs-ava--buyer{ background:#2fa968; } .cs-ava--sol{ background:#8a8f9c; } .cs-ava--staff{ background:var(--accent); }

.cs-people{ display:flex; flex-direction:column; gap:12px; list-style:none; }
.cs-people li{ display:flex; align-items:center; gap:11px; }
.cs-people-text{ display:flex; flex-direction:column; min-width:0; }
.cs-people-text strong{ font-size:13.5px; font-weight:580; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cs-people-text span{ font-size:11.5px; color:var(--ink3); }

.cs-dates{ display:flex; flex-direction:column; gap:12px; list-style:none; }
.cs-dates li{ display:flex; align-items:center; gap:10px; }
.cs-dot{ width:9px; height:9px; border-radius:50%; background:var(--fill-icon); border:1.5px solid var(--ink3); flex-shrink:0; }
.cs-dot.done{ background:var(--ok); border-color:var(--ok); }
.cs-dates-label{ flex:1; font-size:13px; color:var(--ink2); }
.cs-dates-value{ font-size:13px; font-weight:600; }

.cs-note-body{ font-size:13px; line-height:1.55; color:var(--ink2); }
.cs-note-foot{ display:flex; align-items:center; gap:9px; margin-top:14px; padding-top:13px; border-top:1px solid var(--hair); }
.cs-note-foot .cs-ava{ width:26px; height:26px; font-size:11px; }
.cs-note-meta{ flex:1; font-size:12px; color:var(--ink3); }
.cs-note-reply{ display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:560; color:var(--ink2); background:var(--fill-soft); border:1px solid var(--hair); border-radius:8px; padding:5px 10px; cursor:pointer; transition:color .2s, border-color .2s; }
.cs-note-reply svg{ width:13px; height:13px; }
.cs-note-reply:hover{ color:var(--ink); border-color:var(--ink3); }

/* ── Hero ─────────────────────────────────────────────── */
.cs-hero{ position:relative; display:flex; align-items:center; gap:22px; padding:26px 28px; overflow:hidden; }
.cs-hero-media{ width:68px; height:68px; border-radius:16px; flex-shrink:0; display:grid; place-items:center; background:var(--fill-icon); border:1px solid var(--hair); }
.cs-hero-media svg{ width:30px; height:30px; color:var(--ink2); }
.cs-hero-body{ flex:1; min-width:0; }
.cs-hero-eyebrow{ font-size:12px; font-weight:600; color:var(--ink3); margin-bottom:5px; }
.cs-hero-title{ font-size:26px; font-weight:760; letter-spacing:-.03em; line-height:1.05; }
.cs-hero-sub{ font-size:13.5px; color:var(--ink2); margin-top:4px; }
.cs-hero-meta{ display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.cs-chip{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:560; color:var(--ink2); background:var(--fill-soft); border:1px solid var(--hair); border-radius:999px; padding:5px 11px; }
.cs-chip svg{ width:13px; height:13px; }
.cs-chip--ok{ color:var(--ok); }
.cs-progress{ height:5px; border-radius:999px; background:var(--fill-icon); margin-top:16px; overflow:hidden; }
.cs-progress > span{ display:block; height:100%; border-radius:999px; background:var(--accent); }
.cs-cta{ flex-shrink:0; align-self:flex-start; display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:620; color:var(--accent-ink); background:var(--accent); border:none; border-radius:12px; padding:11px 18px; cursor:pointer; box-shadow:0 6px 18px rgba(255,107,74,0.32); transition:transform .3s cubic-bezier(.2,.9,.2,1.2), filter .2s; }
.cs-cta svg{ width:14px; height:14px; }
.cs-cta:hover{ filter:brightness(1.05); } .cs-cta:active{ transform:scale(.97); }
@media (max-width:620px){ .cs-hero{ flex-wrap:wrap; } .cs-cta{ width:100%; justify-content:center; } }

/* ── Metric ───────────────────────────────────────────── */
.cs-stat-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
@media (max-width:760px){ .cs-stat-row{ grid-template-columns:repeat(2,1fr); } }
.cs-stat{ display:flex; flex-direction:column; gap:3px; }
.cs-stat-icon{ width:30px; height:30px; border-radius:9px; display:grid; place-items:center; background:var(--fill-icon); border:1px solid var(--hair); margin-bottom:8px; }
.cs-stat-icon svg{ width:16px; height:16px; color:var(--ink2); }
.cs-stat-value{ font-size:22px; font-weight:740; letter-spacing:-.02em; }
.cs-stat-foot{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
.cs-stat-label{ font-size:12px; color:var(--ink3); }
.cs-delta{ display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:650; }
.cs-delta svg{ width:11px; height:11px; }
.cs-delta.up{ color:var(--ok); } .cs-delta.down{ color:var(--info); }

/* ── List & feed ──────────────────────────────────────── */
.cs-feed{ padding:18px 0 6px; }
.cs-feed .cs-ch{ padding:0 18px; margin-bottom:10px; }
.cs-feed-row{ display:flex; align-items:center; gap:12px; padding:12px 18px; border-top:1px solid var(--hair-2); transition:background .2s; cursor:default; }
.cs-feed-row:hover{ background:var(--fill-soft); }
.cs-feed .cs-ava{ width:30px; height:30px; font-size:12px; }
.cs-feed-text{ flex:1; min-width:0; font-size:13px; line-height:1.4; color:var(--ink); }
.cs-feed-time{ flex-shrink:0; font-size:11.5px; color:var(--ink3); white-space:nowrap; }

/* ── Interactive ──────────────────────────────────────── */
.cs-interactive{ cursor:pointer; text-align:left; font-family:inherit; color:inherit; display:block; width:100%; }
.cs-interactive:hover{ transform:translateY(-2px); box-shadow:var(--shadow-hover); }
.cs-interactive:active{ transform:translateY(0); box-shadow:var(--shadow-sm); }
.cs-interactive:focus-visible{ outline:none; border-color:var(--accent); box-shadow:var(--ring), var(--shadow-md); }
.cs-file{ display:flex; align-items:flex-start; gap:14px; position:relative; }
.cs-file-marker{ width:40px; height:40px; border-radius:11px; display:grid; place-items:center; flex-shrink:0; background:var(--fill-icon); border:1px solid var(--hair); }
.cs-file-marker svg{ width:19px; height:19px; color:var(--ink2); }
.cs-file-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.cs-file-addr{ font-size:15px; font-weight:650; letter-spacing:-.01em; }
.cs-file-place{ font-size:12px; color:var(--ink3); }
.cs-file-status{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:580; color:var(--ink2); margin-top:4px; }
.cs-file-next{ font-size:11.5px; color:var(--ink3); }
.cs-file-progress{ height:4px; border-radius:999px; background:var(--fill-icon); margin-top:8px; overflow:hidden; }
.cs-file-progress > span{ display:block; height:100%; border-radius:999px; background:var(--accent); }
.cs-file-go{ width:15px; height:15px; color:var(--ink3); flex-shrink:0; margin-top:2px; }

/* ── Status ───────────────────────────────────────────── */
.cs-status{ position:relative; display:flex; gap:13px; padding-left:22px; overflow:hidden; }
.cs-status-rail{ position:absolute; left:0; top:0; bottom:0; width:4px; }
.cs-status.t-ok .cs-status-rail{ background:var(--ok); } .cs-status.t-warn .cs-status-rail{ background:var(--warn); } .cs-status.t-danger .cs-status-rail{ background:var(--danger); }
.cs-status-icon{ width:30px; height:30px; border-radius:9px; display:grid; place-items:center; flex-shrink:0; background:var(--fill-icon); border:1px solid var(--hair); }
.cs-status-icon svg{ width:16px; height:16px; }
.cs-status.t-ok .cs-status-icon svg{ color:var(--ok); } .cs-status.t-warn .cs-status-icon svg{ color:var(--warn); } .cs-status.t-danger .cs-status-icon svg{ color:var(--danger); }
.cs-status-body{ min-width:0; }
.cs-status-body strong{ font-size:14px; font-weight:660; }
.cs-status-body p{ font-size:12.5px; color:var(--ink2); margin-top:4px; line-height:1.5; }
.cs-status-action{ display:inline-flex; align-items:center; gap:4px; margin-top:11px; font-size:12px; font-weight:620; color:var(--accent); background:none; border:none; padding:0; cursor:pointer; }
.cs-status-action svg{ width:11px; height:11px; transition:transform .2s; }
.cs-status-action:hover svg{ transform:translateX(2px); }

/* ── Nested ───────────────────────────────────────────── */
.cs-nest-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
@media (max-width:560px){ .cs-nest-grid{ grid-template-columns:1fr; } }
.cs-nest-item{ padding:14px; display:flex; flex-direction:column; gap:4px; }
.cs-nest-label{ font-size:11.5px; color:var(--ink3); }
.cs-nest-value{ font-size:18px; font-weight:700; letter-spacing:-.01em; }

/* ── Selectable ───────────────────────────────────────── */
.cs-select-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
@media (max-width:640px){ .cs-select-row{ grid-template-columns:1fr; } }
.cs-option{ position:relative; display:flex; align-items:center; gap:13px; cursor:pointer; text-align:left; font-family:inherit; color:inherit; }
.cs-option:hover{ border-color:var(--ink3); transform:translateY(-1px); }
.cs-option:focus-visible{ outline:none; border-color:var(--accent); box-shadow:var(--ring), var(--shadow-md); }
.cs-option.is-selected{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent), var(--shadow-md); }
.cs-option.is-disabled{ opacity:.5; cursor:not-allowed; }
.cs-option.is-disabled:hover{ transform:none; border-color:var(--hair); }
.cs-option-tick{ position:absolute; top:12px; right:12px; width:20px; height:20px; border-radius:50%; border:1.5px solid var(--hair-2); display:grid; place-items:center; transition:background .2s, border-color .2s; }
.cs-option.is-selected .cs-option-tick{ background:var(--accent); border-color:var(--accent); }
.cs-option-tick svg{ width:12px; height:12px; color:#fff; }
.cs-option-icon{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center; flex-shrink:0; background:var(--fill-icon); border:1px solid var(--hair); }
.cs-option-icon svg{ width:19px; height:19px; color:var(--ink2); }
.cs-option.is-selected .cs-option-icon svg{ color:var(--accent); }
.cs-option-text{ min-width:0; } .cs-option-text strong{ display:block; font-size:14px; font-weight:620; } .cs-option-text span{ font-size:12px; color:var(--ink3); }

/* ── Empty state ──────────────────────────────────────── */
.cs-empty{ padding:38px 34px; text-align:center; }
.cs-empty-pill{ display:inline-block; font-size:12px; font-weight:600; color:var(--ink2); background:var(--fill-soft); border:1px solid var(--hair); padding:5px 13px; border-radius:999px; }
.cs-empty h3{ font-size:25px; font-weight:750; letter-spacing:-.025em; margin:16px 0 10px; }
.cs-empty > p{ font-size:14.5px; color:var(--ink2); line-height:1.5; max-width:440px; margin:0 auto; }
.cs-empty-sub{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-top:28px; text-align:left; }
@media (max-width:640px){ .cs-empty-sub{ grid-template-columns:1fr; } }
.cs-empty-feat{ padding:16px; } .cs-empty-feat strong{ display:block; font-size:13px; font-weight:640; margin-bottom:5px; } .cs-empty-feat span{ font-size:12px; color:var(--ink2); line-height:1.45; }

/* ── Promo ────────────────────────────────────────────── */
.cs-promo{ position:relative; overflow:hidden; border-radius:20px; padding:30px 32px; color:#fff; background:linear-gradient(135deg,#FF7A5C,#F0562F); box-shadow:0 18px 44px rgba(240,86,47,0.34); }
.cs-promo::after{ content:""; position:absolute; top:-40%; right:-10%; width:280px; height:280px; border-radius:50%; background:radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%); pointer-events:none; }
.cs-promo-badge{ display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; letter-spacing:.02em; background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.28); padding:5px 11px; border-radius:999px; }
.cs-promo-badge svg{ width:12px; height:12px; }
.cs-promo h3{ font-size:24px; font-weight:760; letter-spacing:-.025em; margin:16px 0 8px; max-width:420px; position:relative; }
.cs-promo p{ font-size:14px; line-height:1.55; color:rgba(255,255,255,0.9); max-width:440px; position:relative; }
.cs-promo-cta{ display:inline-flex; align-items:center; gap:7px; margin-top:20px; font-size:13.5px; font-weight:650; color:var(--accent); background:#fff; border:none; border-radius:11px; padding:11px 18px; cursor:pointer; position:relative; transition:transform .3s cubic-bezier(.2,.9,.2,1.2); }
.cs-promo-cta svg{ width:14px; height:14px; }
.cs-promo-cta:active{ transform:scale(.97); }

/* ── States appendix ──────────────────────────────────── */
.cs-states-row{ display:grid; grid-template-columns:repeat(5,1fr); gap:14px; }
@media (max-width:760px){ .cs-states-row{ grid-template-columns:repeat(2,1fr); } }
.cs-state-item{ display:flex; flex-direction:column; align-items:center; gap:10px; }
.cs-state-item .cs-interactive{ width:100%; }
.cs-state-face{ display:flex; flex-direction:column; align-items:flex-start; gap:10px; }
.cs-state-title{ font-size:13px; font-weight:620; }
.cs-state-label{ font-size:12px; font-weight:560; color:var(--ink3); }
/* forced states */
.cs-interactive.is-hover{ transform:translateY(-2px); box-shadow:var(--shadow-hover); }
.cs-interactive.is-focus{ border-color:var(--accent); box-shadow:var(--ring), var(--shadow-md); }
.cs-interactive.is-active{ transform:translateY(0); box-shadow:var(--shadow-sm); }
.cs-interactive.is-disabled{ opacity:.5; }

/* Footer */
.cs-foot{ font-size:12px; line-height:1.7; color:var(--ink3); max-width:680px; margin-top:64px; padding-top:22px; border-top:1px solid var(--hair); }
.cs-foot code{ font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:11.5px; background:var(--fill-soft); padding:2px 6px; border-radius:5px; }
.cs-foot strong{ color:var(--ink2); font-weight:600; }

@media (prefers-reduced-motion: reduce){
  .cs-card, .cs-themesw-knob, .cs-cta, .cs-promo-cta, .cs-status-action svg{ transition:none !important; }
  html{ scroll-behavior:auto; }
}
`;

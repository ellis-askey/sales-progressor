"use client";
// /dev/solid-cards — CONCEPT. A solid card system to replace the glassy cards.
// Dev-only (blocks in production). Not wired to the live design system.
//
// WHY: the live "Light Main Card" (cs-b7c9ec28) is white at 50% opacity + 50px
// blur — i.e. frosted glass, which washes out over the iridescent background.
// This harness proposes going the other way: SOLID white cards in light, SOLID
// lifted-black cards in dark. Clean through craft (hairline + layered shadow +
// crisp type), not through translucency. Both themes designed as peers.
//
// It renders over the real TSP <AppBackground /> (iridescence in light, northern-
// lights aurora in dark) so the cards are judged against the actual backdrop,
// driven by this page's own theme toggle. Nothing here writes anything.

import { useState, useEffect, type ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  Sun, MoonStars, House, CheckCircle, Clock, CalendarBlank, Users, NotePencil,
  ArrowUpRight, CaretRight, TrendUp, ChatCircle,
} from "@phosphor-icons/react";
import { AppBackground } from "@/components/decor/AppBackground";

type Theme = "dark" | "light";
type DarkSurface = "lifted" | "true-black";

export default function SolidCards() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<Theme>("light");
  const [darkSurface, setDarkSurface] = useState<DarkSurface>("lifted");

  // Drive the real AppBackground (reads <html data-theme>) from the toggle.
  // Restored on unmount so leaving the route doesn't leave html retinted.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.getAttribute("data-theme");
    html.setAttribute("data-theme", theme);
    return () => { if (prev) html.setAttribute("data-theme", prev); else html.removeAttribute("data-theme"); };
  }, [theme]);

  return (
    <div className="sc-root" data-theme={theme} data-surface={theme === "dark" ? darkSurface : "lifted"}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <AppBackground />

      <main className="sc-wrap">
        {/* ── Top bar ─────────────────────────────────────────────── */}
        <header className="sc-top">
          <div className="sc-top-title">
            <div className="sc-eyebrow">Prototype · solid cards, no glass</div>
            <h1>Card system</h1>
            <p>White in light, lifted black in dark. Rendered on the real app background.</p>
          </div>
          <div className="sc-top-ctl">
            {theme === "dark" && (
              <div className="sc-seg" style={{ ["--i" as string]: darkSurface === "lifted" ? "0" : "1" }}>
                <span className="sc-seg-thumb" />
                <button className={`sc-seg-btn ${darkSurface === "lifted" ? "on" : ""}`} onClick={() => setDarkSurface("lifted")}>Lifted</button>
                <button className={`sc-seg-btn ${darkSurface === "true-black" ? "on" : ""}`} onClick={() => setDarkSurface("true-black")}>True black</button>
              </div>
            )}
            <button
              className={`sc-themesw ${theme === "light" ? "on" : ""}`}
              role="switch" aria-checked={theme === "light"} aria-label="Toggle light mode"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              <span className="sc-themesw-knob">{theme === "dark" ? <MoonStars weight="fill" /> : <Sun weight="fill" />}</span>
            </button>
          </div>
        </header>

        {/* ── Hero card ───────────────────────────────────────────── */}
        <section className="sc-section">
          <SectionHead
            kicker="1 · Hero"
            title="The hero card"
            body="One per page: the file header, the thing you land on. More presence: generous padding, a slightly larger radius, a deeper shadow, and a coral accent earning its place. Two directions."
          />

          {/* Hero A — Clean */}
          <figure className="sc-figure">
            <div className="sc-card sc-card--hero sc-hero">
              <div className="sc-hero-media"><House weight="regular" /></div>
              <div className="sc-hero-body">
                <div className="sc-hero-eyebrow">Managing this file · 3 weeks</div>
                <h2 className="sc-hero-title">12 Orchard Rise</h2>
                <p className="sc-hero-sub">Hemel Hempstead, HP2 · Freehold · Mortgage</p>
                <div className="sc-hero-meta">
                  <span className="sc-chip sc-chip--ok"><CheckCircle weight="fill" /> On track</span>
                  <span className="sc-chip"><Clock weight="regular" /> Exchange ~26 Jan</span>
                  <span className="sc-chip"><TrendUp weight="regular" /> 63% complete</span>
                </div>
                <div className="sc-progress"><span style={{ width: "63%" }} /></div>
              </div>
              <button className="sc-hero-cta">Open file <ArrowUpRight weight="bold" /></button>
            </div>
            <figcaption>Hero · Clean — solid surface, coral only on the CTA + status.</figcaption>
          </figure>

          {/* Hero B — Accent */}
          <figure className="sc-figure">
            <div className="sc-card sc-card--hero sc-hero sc-hero--accent">
              <span className="sc-hero-rail" />
              <div className="sc-hero-media sc-hero-media--accent"><House weight="regular" /></div>
              <div className="sc-hero-body">
                <div className="sc-hero-eyebrow sc-hero-eyebrow--accent">Managing this file · 3 weeks</div>
                <h2 className="sc-hero-title">12 Orchard Rise</h2>
                <p className="sc-hero-sub">Hemel Hempstead, HP2 · Freehold · Mortgage</p>
                <div className="sc-hero-meta">
                  <span className="sc-chip sc-chip--ok"><CheckCircle weight="fill" /> On track</span>
                  <span className="sc-chip"><Clock weight="regular" /> Exchange ~26 Jan</span>
                  <span className="sc-chip"><TrendUp weight="regular" /> 63% complete</span>
                </div>
                <div className="sc-progress"><span style={{ width: "63%" }} /></div>
              </div>
              <button className="sc-hero-cta">Open file <ArrowUpRight weight="bold" /></button>
            </div>
            <figcaption>Hero · Accent — a coral left rail + warm top wash. Same bones, more identity.</figcaption>
          </figure>
        </section>

        {/* ── Standard card ───────────────────────────────────────── */}
        <section className="sc-section">
          <SectionHead
            kicker="2 · Standard"
            title="The everything-else card"
            body="The workhorse that wraps most of the app: people, key dates, notes, stats. Three treatments so you can decide how a card separates from the background: a soft shadow, a hairline border, or both."
          />

          <div className="sc-std-grid">
            {STD_VARIANTS.map((v) => (
              <div key={v.key} className="sc-std-col">
                <div className="sc-std-label">{v.label}<span>{v.note}</span></div>
                <div className={`sc-card sc-card--std ${v.cls}`}>
                  <PeopleCard />
                </div>
                <div className={`sc-card sc-card--std ${v.cls}`}>
                  <KeyDatesCard />
                </div>
                <div className={`sc-card sc-card--std ${v.cls}`}>
                  <NotesCard />
                </div>
              </div>
            ))}
          </div>

          <p className="sc-rec">
            Recommended workhorse: <strong>Elevated</strong> — hairline + soft layered shadow. It lifts off the
            iridescence in light and off the aurora in dark without any translucency. Use <strong>Flat</strong>
            {" "}for cards nested inside another card (no double shadow).
          </p>
        </section>

        {/* ── Stat row ────────────────────────────────────────────── */}
        <section className="sc-section">
          <SectionHead
            kicker="3 · In context"
            title="A row of the standard card"
            body="How the Elevated workhorse reads as a set: a stat strip, the kind that sits under a hero."
          />
          <div className="sc-stat-row">
            {STATS.map((s) => (
              <div key={s.label} className="sc-card sc-card--std sc-std-elevated sc-stat">
                <span className="sc-stat-icon">{s.icon}</span>
                <span className="sc-stat-value">{s.value}</span>
                <span className="sc-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Before / after ──────────────────────────────────────── */}
        <section className="sc-section">
          <SectionHead
            kicker="4 · Why"
            title="Glass vs solid, side by side"
            body="Left is today's Light Main Card (white at 50% + 50px blur). Right is the proposed solid card. Toggle the theme: the glass is where the washed-out feeling comes from, most of all in dark."
          />
          <div className="sc-ba">
            <figure className="sc-figure">
              <div className="sc-card sc-glass-legacy"><PeopleCard /></div>
              <figcaption>Before — frosted glass (cs-b7c9ec28)</figcaption>
            </figure>
            <figure className="sc-figure">
              <div className="sc-card sc-card--std sc-std-elevated"><PeopleCard /></div>
              <figcaption>After — solid Elevated</figcaption>
            </figure>
          </div>
        </section>

        <footer className="sc-foot">
          Prototype at <code>/dev/solid-cards</code>. No live styles changed. Once you pick a hero direction and a
          standard treatment, I&apos;ll bake them as the new card baseline (the glass recipes stay until every page
          is moved over, one at a time).
        </footer>
      </main>
    </div>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────
function SectionHead({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div className="sc-sechead">
      <div className="sc-kicker">{kicker}</div>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  );
}

const STD_VARIANTS = [
  { key: "elevated", cls: "sc-std-elevated", label: "Elevated", note: "hairline + shadow" },
  { key: "bordered", cls: "sc-std-bordered", label: "Bordered", note: "hairline only" },
  { key: "soft", cls: "sc-std-soft", label: "Soft", note: "shadow only" },
];

function CardHead({ icon, title, action }: { icon: ReactNode; title: string; action?: string }) {
  return (
    <div className="sc-ch">
      <span className="sc-ch-icon">{icon}</span>
      <span className="sc-ch-title">{title}</span>
      {action && <button className="sc-ch-action">{action} <CaretRight weight="bold" /></button>}
    </div>
  );
}

function PeopleCard() {
  const people = [
    { name: "Seller", who: "J. Sharp", role: "seller" as const },
    { name: "Buyer", who: "M. Down", role: "buyer" as const },
    { name: "Solicitor", who: "Matthew Waite & Co", role: "sol" as const },
  ];
  return (
    <>
      <CardHead icon={<Users weight="regular" />} title="People" action="Manage" />
      <ul className="sc-people">
        {people.map((p) => (
          <li key={p.name}>
            <span className={`sc-ava sc-ava--${p.role}`}>{p.who.charAt(0)}</span>
            <span className="sc-people-text"><strong>{p.who}</strong><span>{p.name}</span></span>
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
      <ul className="sc-dates">
        {rows.map((r) => (
          <li key={r.label}>
            <span className={`sc-dot ${r.done ? "done" : ""}`} />
            <span className="sc-dates-label">{r.label}</span>
            <span className="sc-dates-value">{r.value}</span>
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
      <p className="sc-note-body">Spoke to the buyer&apos;s solicitor — searches are back and enquiries go over this week. Nothing outstanding our side.</p>
      <div className="sc-note-foot">
        <span className="sc-ava sc-ava--staff">E</span>
        <span className="sc-note-meta">Ellis · 2 days ago</span>
        <button className="sc-note-reply"><ChatCircle weight="regular" /> Reply</button>
      </div>
    </>
  );
}

const STATS = [
  { icon: <House weight="regular" />, value: "63%", label: "Complete" },
  { icon: <CheckCircle weight="regular" />, value: "10/14", label: "Seller steps" },
  { icon: <Clock weight="regular" />, value: "59d", label: "To exchange" },
  { icon: <TrendUp weight="regular" />, value: "On track", label: "Status" },
];

// ── Styles ─────────────────────────────────────────────────────────
const CSS = `
.sc-root{
  /* Shared */
  --accent:#FF6B4A; --accent-ink:#ffffff;
  --ok:#2fb86a;

  /* Light theme (default) */
  --ink:#11141b; --ink2:rgba(17,20,27,0.60); --ink3:rgba(17,20,27,0.42);
  --card-bg:#ffffff;
  --card-border:rgba(16,20,34,0.08);
  --hairline:rgba(16,20,34,0.07);
  --shadow:0 1px 2px rgba(16,24,48,0.045), 0 10px 30px rgba(16,24,48,0.07);
  --shadow-hover:0 2px 6px rgba(16,24,48,0.06), 0 18px 46px rgba(16,24,48,0.12);
  --shadow-hero:0 2px 4px rgba(16,24,48,0.05), 0 24px 60px rgba(16,24,48,0.12);
  --fill-soft:rgba(16,20,34,0.035);
  --fill-icon:rgba(16,20,34,0.05);
  --accent-wash:linear-gradient(180deg, rgba(255,107,74,0.07), transparent 120px);
  --seg-bg:rgba(16,20,34,0.05); --seg-thumb:#ffffff; --seg-line:rgba(16,20,34,0.08);

  position:relative; min-height:100vh; overflow-x:hidden; isolation:isolate;
  color:var(--ink);
  font-family:-apple-system, BlinkMacSystemFont, "SF Pro Display","SF Pro Text","Segoe UI", system-ui, sans-serif;
  -webkit-font-smoothing:antialiased; letter-spacing:-0.011em;
}
.sc-root[data-theme="dark"]{
  --ink:#f4f5f8; --ink2:rgba(244,245,248,0.62); --ink3:rgba(244,245,248,0.40);
  --card-bg:#14161d;
  --card-border:rgba(255,255,255,0.09);
  --hairline:rgba(255,255,255,0.08);
  --shadow:0 1px 2px rgba(0,0,0,0.4), 0 14px 36px rgba(0,0,0,0.5);
  --shadow-hover:0 2px 6px rgba(0,0,0,0.45), 0 22px 52px rgba(0,0,0,0.6);
  --shadow-hero:0 2px 4px rgba(0,0,0,0.5), 0 30px 70px rgba(0,0,0,0.62);
  --fill-soft:rgba(255,255,255,0.045);
  --fill-icon:rgba(255,255,255,0.07);
  --accent-wash:linear-gradient(180deg, rgba(255,107,74,0.10), transparent 120px);
  --seg-bg:rgba(255,255,255,0.06); --seg-thumb:rgba(255,255,255,0.16); --seg-line:rgba(255,255,255,0.1);
}
/* Dark · true black surface override */
.sc-root[data-theme="dark"][data-surface="true-black"]{
  --card-bg:#0a0b0f;
  --card-border:rgba(255,255,255,0.11);
  --hairline:rgba(255,255,255,0.09);
}

.sc-wrap{ position:relative; z-index:2; max-width:1080px; margin:0 auto; padding:52px 24px 120px; }

/* Top bar */
.sc-top{ display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin-bottom:44px; flex-wrap:wrap; }
.sc-eyebrow{ font-size:12px; font-weight:600; color:var(--accent); margin-bottom:9px; }
.sc-top-title h1{ font-size:clamp(30px,4vw,40px); font-weight:780; letter-spacing:-.035em; line-height:1; }
.sc-top-title p{ font-size:15px; color:var(--ink2); margin-top:10px; max-width:460px; }
.sc-top-ctl{ display:flex; align-items:center; gap:10px; }

.sc-seg{ --i:0; position:relative; display:grid; grid-auto-flow:column; padding:3px; border-radius:11px; background:var(--seg-bg); border:1px solid var(--seg-line); }
.sc-seg-thumb{ position:absolute; top:3px; left:3px; bottom:3px; width:calc((100% - 6px)/2); border-radius:9px; background:var(--seg-thumb); box-shadow:0 1px 3px rgba(16,24,48,0.14); transform:translateX(calc(var(--i)*100%)); transition:transform .4s cubic-bezier(.3,1.25,.4,1); }
.sc-seg-btn{ position:relative; z-index:1; padding:7px 14px; font-size:12.5px; font-weight:560; color:var(--ink3); background:none; border:none; cursor:pointer; transition:color .3s; }
.sc-seg-btn.on{ color:var(--ink); }

.sc-themesw{ width:52px; height:31px; border-radius:999px; border:1px solid var(--seg-line); background:var(--seg-bg); position:relative; cursor:pointer; padding:0; }
.sc-themesw-knob{ position:absolute; top:2px; left:2px; width:25px; height:25px; border-radius:50%; background:linear-gradient(180deg,#fff,#e9ebf2); display:grid; place-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.3); transition:transform .4s cubic-bezier(.3,1.35,.4,1); }
.sc-themesw-knob svg{ width:13px; height:13px; color:#33343c; }
.sc-themesw.on .sc-themesw-knob{ transform:translateX(21px); }

/* Sections */
.sc-section{ margin-bottom:56px; }
.sc-sechead{ margin-bottom:22px; }
.sc-kicker{ font-size:11.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--ink3); margin-bottom:8px; }
.sc-sechead h2{ font-size:22px; font-weight:740; letter-spacing:-.025em; }
.sc-sechead p{ font-size:14px; color:var(--ink2); margin-top:8px; line-height:1.55; max-width:620px; }

/* ── Base card ──────────────────────────────────────────── */
.sc-card{ background:var(--card-bg); border-radius:18px; transition:transform .4s cubic-bezier(.2,.8,.2,1), box-shadow .4s ease, border-color .3s; }

/* Standard treatments */
.sc-card--std{ padding:18px; }
.sc-std-elevated{ border:1px solid var(--card-border); box-shadow:var(--shadow); }
.sc-std-bordered{ border:1px solid var(--card-border); }
.sc-std-soft{ border:1px solid transparent; box-shadow:var(--shadow); }
.sc-std-elevated:hover, .sc-std-soft:hover{ transform:translateY(-2px); box-shadow:var(--shadow-hover); }
.sc-std-bordered:hover{ border-color:var(--ink3); }

/* Legacy glass (before) — the real cs-b7c9ec28 recipe */
.sc-glass-legacy{ padding:18px; background:rgba(255,255,255,0.5); border:1px solid rgba(255,255,255,0.12); -webkit-backdrop-filter:blur(50px); backdrop-filter:blur(50px); box-shadow:0 5px 30px rgba(15,23,42,0.12); }
.sc-root[data-theme="dark"] .sc-glass-legacy{ background:rgba(255,255,255,0.06); border-color:rgba(255,255,255,0.12); }

/* ── Hero ───────────────────────────────────────────────── */
.sc-figure{ margin:0 0 20px; }
.sc-figure figcaption{ font-size:12.5px; color:var(--ink3); margin-top:11px; }
.sc-card--hero{ border:1px solid var(--card-border); box-shadow:var(--shadow-hero); border-radius:22px; }
.sc-card--hero:hover{ transform:translateY(-2px); box-shadow:var(--shadow-hover); }
.sc-hero{ position:relative; display:flex; align-items:center; gap:22px; padding:26px 28px; overflow:hidden; }
.sc-hero-media{ width:68px; height:68px; border-radius:16px; flex-shrink:0; display:grid; place-items:center; background:var(--fill-icon); border:1px solid var(--hairline); }
.sc-hero-media svg{ width:30px; height:30px; color:var(--ink2); }
.sc-hero-body{ flex:1; min-width:0; }
.sc-hero-eyebrow{ font-size:12px; font-weight:600; color:var(--ink3); margin-bottom:5px; }
.sc-hero-title{ font-size:26px; font-weight:760; letter-spacing:-.03em; line-height:1.05; }
.sc-hero-sub{ font-size:13.5px; color:var(--ink2); margin-top:4px; }
.sc-hero-meta{ display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
.sc-chip{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:560; color:var(--ink2); background:var(--fill-soft); border:1px solid var(--hairline); border-radius:999px; padding:5px 11px; }
.sc-chip svg{ width:13px; height:13px; }
.sc-chip--ok{ color:var(--ok); } .sc-chip--ok svg{ color:var(--ok); }
.sc-progress{ height:5px; border-radius:999px; background:var(--fill-icon); margin-top:16px; overflow:hidden; }
.sc-progress > span{ display:block; height:100%; border-radius:999px; background:var(--accent); }
.sc-hero-cta{ flex-shrink:0; align-self:flex-start; display:inline-flex; align-items:center; gap:7px; font-size:13.5px; font-weight:620; color:var(--accent-ink); background:var(--accent); border:none; border-radius:12px; padding:11px 18px; cursor:pointer; box-shadow:0 6px 18px rgba(255,107,74,0.32); transition:transform .3s cubic-bezier(.2,.9,.2,1.2), filter .2s; }
.sc-hero-cta svg{ width:14px; height:14px; }
.sc-hero-cta:hover{ filter:brightness(1.05); } .sc-hero-cta:active{ transform:scale(.97); }

/* Hero · accent variant */
.sc-hero--accent{ background:var(--card-bg); }
.sc-hero--accent::before{ content:""; position:absolute; inset:0; background:var(--accent-wash); pointer-events:none; }
.sc-hero-rail{ position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--accent); }
.sc-hero--accent .sc-hero-body, .sc-hero--accent .sc-hero-media, .sc-hero--accent .sc-hero-cta{ position:relative; z-index:1; }
.sc-hero-media--accent{ background:rgba(255,107,74,0.1); border-color:rgba(255,107,74,0.2); }
.sc-hero-media--accent svg{ color:var(--accent); }
.sc-hero-eyebrow--accent{ color:var(--accent); }

@media (max-width:620px){
  .sc-hero{ flex-wrap:wrap; }
  .sc-hero-cta{ width:100%; justify-content:center; }
}

/* ── Standard grid ──────────────────────────────────────── */
.sc-std-grid{ display:grid; grid-template-columns:repeat(3,1fr); gap:20px; align-items:start; }
.sc-std-col{ display:flex; flex-direction:column; gap:14px; }
.sc-std-label{ font-size:13px; font-weight:680; color:var(--ink); margin-bottom:2px; display:flex; align-items:baseline; gap:8px; }
.sc-std-label span{ font-size:11.5px; font-weight:500; color:var(--ink3); }
@media (max-width:860px){ .sc-std-grid{ grid-template-columns:1fr; } }

.sc-rec{ font-size:13px; color:var(--ink2); margin-top:20px; line-height:1.6; max-width:640px; }
.sc-rec strong{ color:var(--ink); font-weight:650; }

/* Card internals */
.sc-ch{ display:flex; align-items:center; gap:9px; margin-bottom:14px; }
.sc-ch-icon{ width:28px; height:28px; border-radius:8px; display:grid; place-items:center; background:var(--fill-icon); border:1px solid var(--hairline); flex-shrink:0; }
.sc-ch-icon svg{ width:15px; height:15px; color:var(--ink2); }
.sc-ch-title{ font-size:13.5px; font-weight:650; flex:1; }
.sc-ch-action{ display:inline-flex; align-items:center; gap:3px; font-size:12px; font-weight:580; color:var(--accent); background:none; border:none; cursor:pointer; padding:0; }
.sc-ch-action svg{ width:11px; height:11px; }

.sc-people{ display:flex; flex-direction:column; gap:12px; list-style:none; }
.sc-people li{ display:flex; align-items:center; gap:11px; }
.sc-ava{ width:34px; height:34px; border-radius:50%; flex-shrink:0; display:grid; place-items:center; font-size:13px; font-weight:650; color:#fff; }
.sc-ava--seller{ background:#3b7de0; } .sc-ava--buyer{ background:#2fa968; } .sc-ava--sol{ background:#8a8f9c; } .sc-ava--staff{ background:var(--accent); }
.sc-people-text{ display:flex; flex-direction:column; min-width:0; }
.sc-people-text strong{ font-size:13.5px; font-weight:580; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sc-people-text span{ font-size:11.5px; color:var(--ink3); }

.sc-dates{ display:flex; flex-direction:column; gap:12px; list-style:none; }
.sc-dates li{ display:flex; align-items:center; gap:10px; }
.sc-dot{ width:9px; height:9px; border-radius:50%; background:var(--fill-icon); border:1.5px solid var(--ink3); flex-shrink:0; }
.sc-dot.done{ background:var(--ok); border-color:var(--ok); }
.sc-dates-label{ flex:1; font-size:13px; color:var(--ink2); }
.sc-dates-value{ font-size:13px; font-weight:600; color:var(--ink); }

.sc-note-body{ font-size:13px; line-height:1.55; color:var(--ink2); }
.sc-note-foot{ display:flex; align-items:center; gap:9px; margin-top:14px; padding-top:13px; border-top:1px solid var(--hairline); }
.sc-note-foot .sc-ava{ width:26px; height:26px; font-size:11px; }
.sc-note-meta{ flex:1; font-size:12px; color:var(--ink3); }
.sc-note-reply{ display:inline-flex; align-items:center; gap:5px; font-size:12px; font-weight:560; color:var(--ink2); background:var(--fill-soft); border:1px solid var(--hairline); border-radius:8px; padding:5px 10px; cursor:pointer; transition:color .2s, border-color .2s; }
.sc-note-reply svg{ width:13px; height:13px; }
.sc-note-reply:hover{ color:var(--ink); border-color:var(--ink3); }

/* Stat row */
.sc-stat-row{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
@media (max-width:720px){ .sc-stat-row{ grid-template-columns:repeat(2,1fr); } }
.sc-stat{ display:flex; flex-direction:column; gap:3px; padding:18px; }
.sc-stat-icon{ width:30px; height:30px; border-radius:9px; display:grid; place-items:center; background:var(--fill-icon); border:1px solid var(--hairline); margin-bottom:8px; }
.sc-stat-icon svg{ width:16px; height:16px; color:var(--ink2); }
.sc-stat-value{ font-size:22px; font-weight:740; letter-spacing:-.02em; }
.sc-stat-label{ font-size:12px; color:var(--ink3); }

/* Before / after */
.sc-ba{ display:grid; grid-template-columns:1fr 1fr; gap:20px; }
@media (max-width:720px){ .sc-ba{ grid-template-columns:1fr; } }

/* Footer */
.sc-foot{ font-size:12px; line-height:1.7; color:var(--ink3); max-width:640px; margin-top:12px; }
.sc-foot code{ font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:11.5px; background:var(--fill-soft); padding:2px 6px; border-radius:5px; }

@media (prefers-reduced-motion: reduce){
  .sc-card, .sc-seg-thumb, .sc-themesw-knob, .sc-hero-cta{ transition:none !important; }
}
`;

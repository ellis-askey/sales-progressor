"use client";

// /dev/stat-cards — PROTOTYPE. The All-Files summary bar as individual cards
// instead of one connected glass strip, with a width slider so you can watch it
// break down 4 → 2 → 1 at smaller breakpoints. The reflow is driven by CONTAINER
// width (not the viewport), so the slider is a faithful stand-in for the real
// page getting narrower. Mock data; no wiring. Compares the current connected row
// against the proposed separate cards in both themes.

import { useState } from "react";
import { notFound } from "next/navigation";
import { HouseLine, CalendarBlank, Warning, ChatDots, Users, CurrencyGbp, Handshake } from "@phosphor-icons/react";

type Tone = "coral" | "info" | "warning" | "danger" | "success" | "neutral";
type Tile = {
  icon: typeof HouseLine;
  weight?: "regular" | "fill";
  tone: Tone;
  val: string;
  label: string;
  sub: string;
  interactive?: "link" | "toggle";
  on?: boolean;
};

// The four All-Files tiles from the live bar.
const FILES_TILES: Tile[] = [
  { icon: HouseLine, tone: "coral", val: "36", label: "Active sales", sub: "£8k fees" },
  { icon: CalendarBlank, tone: "info", val: "6", label: "Exchanging November", sub: "£1k fees", interactive: "link" },
  { icon: Warning, weight: "fill", tone: "danger", val: "8", label: "At risk", sub: "£2k fees", interactive: "toggle" },
  { icon: ChatDots, tone: "warning", val: "1", label: "Gone quiet", sub: "£220 fees", interactive: "toggle" },
];

// Clients — a 4-tile set with longer labels, to stress-test wrapping + the
// awkward reflow counts.
const CLIENTS_TILES: Tile[] = [
  { icon: Users, tone: "neutral", val: "12", label: "Agencies", sub: "across the book" },
  { icon: HouseLine, tone: "coral", val: "214", label: "Active sales", sub: "£412k fees" },
  { icon: CurrencyGbp, tone: "success", val: "£38m", label: "Pipeline value", sub: "exchange + completion" },
  { icon: Handshake, tone: "info", val: "19", label: "Exchanged this month", sub: "£47k fees" },
];

function StatCircle({ icon: Icon, tone, weight = "regular" }: { icon: typeof HouseLine; tone: Tone; weight?: "regular" | "fill" }) {
  return (
    <span className={`sc sc--${tone}`} aria-hidden>
      <Icon size={22} weight={weight} />
    </span>
  );
}

function TileInner({ t }: { t: Tile }) {
  return (
    <>
      <StatCircle icon={t.icon} tone={t.tone} weight={t.weight} />
      <span className="txt">
        <span className="val">{t.val}</span>
        <span className="label">{t.label}</span>
        <span className="sub">{t.sub}</span>
      </span>
    </>
  );
}

// ── Connected row (current production look) ─────────────────────────────────
function ConnectedRow({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="glasscard">
      <div className="fstats">
        {tiles.map((t) => (
          <div key={t.label} className={`fcell${t.on ? " on" : ""}`}>
            <TileInner t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Individual cards (proposal) ─────────────────────────────────────────────
function CardGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="cardgrid">
      {tiles.map((t) => (
        <div
          key={t.label}
          className={`statcard${t.interactive ? " statcard--i" : ""}${t.on ? " on" : ""}`}
        >
          <TileInner t={t} />
        </div>
      ))}
    </div>
  );
}

export default function StatCardsPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [width, setWidth] = useState(1180);
  const [set, setSet] = useState<"files" | "clients">("files");

  const tiles = (set === "files" ? FILES_TILES : CLIENTS_TILES).map((t) =>
    // show one toggle tile in its active state so you can see the "on" treatment
    t.label === "At risk" ? { ...t, on: true } : t
  );

  const presets = [
    { w: 1180, name: "Desktop" },
    { w: 820, name: "Tablet" },
    { w: 560, name: "Small" },
    { w: 380, name: "Phone" },
  ];

  const dark = theme === "dark";

  return (
    <div className={`page ${dark ? "t-dark" : "t-light"}`} data-theme={theme}>
      <style>{CSS}</style>

      <header className="head">
        <h1>Stat bar → individual cards</h1>
        <p>
          The All-Files summary as separate cards instead of one connected strip. Drag the width to watch it break down.
          The reflow is driven by the card container&rsquo;s width (container queries), so it mirrors the real page getting narrower
          — 4 across, then 2&times;2, then a single column, with no divider bookkeeping.
        </p>
      </header>

      <div className="controls">
        <div className="seg">
          <button className={!dark ? "on" : ""} onClick={() => setTheme("light")}>Light</button>
          <button className={dark ? "on" : ""} onClick={() => setTheme("dark")}>Dark</button>
        </div>
        <div className="seg">
          <button className={set === "files" ? "on" : ""} onClick={() => setSet("files")}>All Files</button>
          <button className={set === "clients" ? "on" : ""} onClick={() => setSet("clients")}>Clients</button>
        </div>
        <div className="slider">
          <input
            type="range"
            min={320}
            max={1180}
            step={10}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
          />
          <span className="wlabel">{width}px</span>
        </div>
        <div className="seg">
          {presets.map((p) => (
            <button key={p.w} className={width === p.w ? "on" : ""} onClick={() => setWidth(p.w)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="stage">
        <div className="frame" style={{ width }}>
          <section className="block">
            <div className="blabel">Proposed &mdash; individual cards</div>
            <CardGrid tiles={tiles} />
          </section>

          <section className="block">
            <div className="blabel">Current &mdash; connected strip (for reference)</div>
            <ConnectedRow tiles={tiles} />
          </section>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.page {
  --coral-rgb: 255,107,74; --coral-deep: #E8542F;
  --info-rgb: 13,148,136; --info-ic: #0d9488;
  --warn-rgb: 201,125,26; --warn-ic: #b06a12;
  --dang-rgb: 199,62,62; --dang-ic: #c73e3e;
  --succ-rgb: 31,138,74; --succ-ic: #1f8a4a;
  --neut-rgb: 100,116,139; --neut-ic: #475569;
  min-height: 100vh; padding: 40px 32px 120px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  transition: background 200ms ease, color 200ms ease;
}
.t-light {
  --bg: #f4f1ec; --card: rgba(255,255,255,0.72); --card-border: rgba(45,24,16,0.10);
  --txt: #2d1810; --txt2: #5a3a28; --mut: rgba(45,24,16,0.5); --divider: rgba(45,24,16,0.10);
  --hover: rgba(45,24,16,0.04); --shadow: 0 1px 2px rgba(45,24,16,0.05), 0 8px 24px rgba(45,24,16,0.06);
  background:
    radial-gradient(1200px 600px at 15% -10%, rgba(255,107,74,0.10), transparent 60%),
    radial-gradient(1000px 500px at 100% 0%, rgba(13,148,136,0.08), transparent 55%),
    var(--bg);
  color: var(--txt);
}
.t-dark {
  --bg: #171513; --card: rgba(40,37,34,0.62); --card-border: rgba(255,255,255,0.10);
  --txt: #f3efe9; --txt2: #cdbfb3; --mut: rgba(243,239,233,0.5); --divider: rgba(255,255,255,0.09);
  --hover: rgba(255,255,255,0.05); --shadow: 0 1px 2px rgba(0,0,0,0.4), 0 10px 30px rgba(0,0,0,0.45);
  background:
    radial-gradient(1200px 600px at 15% -10%, rgba(255,107,74,0.14), transparent 60%),
    radial-gradient(1000px 500px at 100% 0%, rgba(13,148,136,0.10), transparent 55%),
    var(--bg);
  color: var(--txt);
}
.head { max-width: 760px; margin: 0 auto 26px; }
.head h1 { font-size: 24px; font-weight: 650; letter-spacing: -0.02em; margin: 0 0 8px; }
.head p { font-size: 14px; line-height: 1.55; color: var(--txt2); margin: 0; }

.controls {
  max-width: 1180px; margin: 0 auto 26px; display: flex; flex-wrap: wrap; align-items: center;
  gap: 14px; justify-content: center;
}
.seg { display: inline-flex; background: var(--card); border: 1px solid var(--card-border); border-radius: 10px; padding: 3px; gap: 2px; }
.seg button {
  appearance: none; border: none; background: none; font: inherit; font-size: 12.5px; font-weight: 550;
  color: var(--txt2); padding: 6px 12px; border-radius: 7px; cursor: pointer; transition: all 140ms ease;
}
.seg button:hover { color: var(--txt); }
.seg button.on { background: rgba(var(--coral-rgb), 0.14); color: var(--coral-deep); }
.t-dark .seg button.on { color: #ff8a6f; }
.slider { display: inline-flex; align-items: center; gap: 10px; }
.slider input { width: 220px; accent-color: var(--coral-deep); }
.wlabel { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--mut); min-width: 48px; }

.stage { display: flex; justify-content: center; }
.frame {
  max-width: 100%; transition: width 160ms ease; display: flex; flex-direction: column; gap: 28px;
  container-type: inline-size;
}
.block { }
.blabel { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--mut); margin: 0 2px 10px; }

/* ── stat-circle (reproduced from agent-system.css) ── */
.sc {
  width: 40px; height: 40px; border-radius: 999px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center; color: var(--sc-ic);
  background: linear-gradient(145deg, rgba(var(--sc-rgb), 0.22), rgba(var(--sc-rgb), 0.06));
  border: 0.5px solid rgba(var(--sc-rgb), 0.22);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.55), 0 2px 7px rgba(var(--sc-rgb), 0.20);
}
.t-dark .sc {
  background: linear-gradient(145deg, rgba(var(--sc-rgb), 0.30), rgba(var(--sc-rgb), 0.10));
  border-color: rgba(var(--sc-rgb), 0.28);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 2px 8px rgba(0,0,0,0.35);
}
.sc--coral   { --sc-rgb: var(--coral-rgb); --sc-ic: var(--coral-deep); }
.sc--info    { --sc-rgb: var(--info-rgb);  --sc-ic: var(--info-ic); }
.sc--warning { --sc-rgb: var(--warn-rgb);  --sc-ic: var(--warn-ic); }
.sc--danger  { --sc-rgb: var(--dang-rgb);  --sc-ic: var(--dang-ic); }
.sc--success { --sc-rgb: var(--succ-rgb);  --sc-ic: var(--succ-ic); }
.sc--neutral { --sc-rgb: var(--neut-rgb);  --sc-ic: var(--neut-ic); }

/* ── shared tile text ── */
.txt { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.val { font-size: 22px; font-weight: 600; line-height: 1; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.label { font-size: 12.5px; font-weight: 600; line-height: 1.2; }
.sub { font-size: 10.5px; color: var(--mut); line-height: 1.2; }

/* ── current connected strip ── */
.glasscard {
  background: var(--card); border: 1px solid var(--card-border); border-radius: 14px;
  box-shadow: var(--shadow); overflow: hidden; backdrop-filter: blur(16px) saturate(1.3);
}
.fstats { display: grid; grid-template-columns: repeat(4, 1fr); }
.fcell { display: flex; align-items: center; gap: 12px; padding: 14px 16px; min-width: 0; }
.fcell + .fcell { border-left: 1px solid var(--divider); }
.fcell.on { background: rgba(var(--coral-rgb), 0.09); }
@container (max-width: 720px) {
  .fstats { grid-template-columns: repeat(2, 1fr); }
  .fcell:nth-child(odd) { border-left: none; }
  .fcell:nth-child(n+3) { border-top: 1px solid var(--divider); }
}

/* ── proposed individual cards ── */
.cardgrid {
  display: grid; gap: 14px;
  grid-template-columns: repeat(4, 1fr);
}
/* Hold 2-up on phones so cards stay compact and fill the width (no empty
   full-bleed rows). Only drop to a single column below any real phone width. */
@container (max-width: 720px) { .cardgrid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
@container (max-width: 340px) { .cardgrid { grid-template-columns: 1fr; } }
.statcard {
  display: flex; align-items: center; gap: 12px; padding: 16px 18px; min-width: 0;
  background: var(--card); border: 1px solid var(--card-border); border-radius: 14px;
  box-shadow: var(--shadow); backdrop-filter: blur(16px) saturate(1.3);
  transition: transform 160ms cubic-bezier(0.22,1,0.36,1), box-shadow 160ms ease, border-color 160ms ease;
}
@container (max-width: 720px) { .statcard { padding: 14px 15px; } }
.statcard--i { cursor: pointer; }
.statcard--i:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(45,24,16,0.08), 0 14px 34px rgba(45,24,16,0.10); }
.t-dark .statcard--i:hover { box-shadow: 0 4px 10px rgba(0,0,0,0.5), 0 14px 34px rgba(0,0,0,0.55); }
/* Active = coral ring + border only. No background colour wash. */
.statcard.on {
  border-color: rgba(var(--coral-rgb), 0.55);
  box-shadow: inset 0 0 0 1px rgba(var(--coral-rgb), 0.45), var(--shadow);
}
`;

"use client";

// Icon Design Laboratory — isolated /dev tool. Previews GENUINE icon artwork from
// real open collections (resolved via the Iconify icon-sets, baked in as data), so
// the artwork itself differs — not Phosphor glyphs with coloured boxes behind them.
// Imports nothing from the production app and changes nothing in it.

import * as React from "react";
import { useMemo, useState } from "react";
import styles from "./icon-lab.module.css";
import { renderFamilyIcon, familyPalette } from "./render";
import { REAL_FAMILIES, REAL_MISSING, type RealFamily } from "./data/realIcons.generated";
import { FAMILY_META, FAMILY_ORDER, type Suit } from "./data/familyInfo";
import { SEMANTIC } from "./data/semantic";
import { INVENTORY, AUDIT_META, type InventoryIcon } from "./data/inventory.generated";
import { NON_LIBRARY, NON_LIBRARY_META } from "./data/nonLibrary";
import { PH, LU } from "./data/glyphMap.generated";
import { MagnifyingGlass, Sun, Moon } from "@phosphor-icons/react";

type Surface = "light" | "dark";
type Tab = "overview" | "gallery" | "compare" | "catalogue" | "dashboard" | "sizes" | "backgrounds" | "viability";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "gallery", label: "Family Gallery" },
  { id: "compare", label: "Side-by-Side" },
  { id: "catalogue", label: "Current Inventory" },
  { id: "dashboard", label: "Dashboard Preview" },
  { id: "sizes", label: "Sizes" },
  { id: "backgrounds", label: "Light / Dark" },
  { id: "viability", label: "Viability" },
];

const CURRENT: RealFamily = {
  id: "current", label: "Current — Phosphor", prefix: "ph", palette: "mono",
  license: "MIT", licenseUrl: "https://github.com/phosphor-icons/core/blob/main/LICENSE",
  coverage: SEMANTIC.length, total: 1512, freemium: false,
};
const BY_ID: Record<string, RealFamily> = Object.fromEntries(REAL_FAMILIES.map((f) => [f.id, f]));
const FAMILIES: RealFamily[] = FAMILY_ORDER.map((id) => (id === "current" ? CURRENT : BY_ID[id])).filter(Boolean);

const GALLERY_KEYS = ["property", "buyer", "seller", "solicitor", "mortgage", "email", "whatsapp", "calendar", "tasks", "chain", "settings", "warning", "success", "money"];

function Icon({ fam, k, size }: { fam: string; k: string; size: number }) {
  const node = renderFamilyIcon(fam, k, size);
  if (node === null) return <span className={styles.miss} title="no equivalent in this collection">–</span>;
  return <>{node}</>;
}

function CoverageBadge({ f }: { f: RealFamily }) {
  const full = f.coverage >= SEMANTIC.length - 1;
  return (
    <span className={`${styles.famBadge} ${full ? styles.badgeReal : styles.badgeExp}`} title="meanings resolved in this collection">
      {f.coverage}/{SEMANTIC.length}
    </span>
  );
}
function PaletteBadge({ f }: { f: RealFamily }) {
  const color = f.palette === "color";
  return <span className={`${styles.famBadge} ${color ? styles.badgeEmoji : styles.badgeMono}`}>{color ? "Multicolour" : "Mono"}</span>;
}

export default function IconLab() {
  const [surface, setSurface] = useState<Surface>("light");
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className={styles.root} data-surface={surface}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <p className={styles.kicker}>Dev · Visual Exploration</p>
            <h1 className={styles.title}>Icon Design Laboratory</h1>
            <p className={styles.sub}>
              Genuine icon artwork from {REAL_FAMILIES.length} real open-source collections, shown against our current
              Phosphor set. The artwork itself differs — different silhouettes, proportions, fill and colour — with no
              tiles, gradients or containers added. Nothing here touches the live app.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <span className={styles.devTag}>isolated · read-only</span>
            <div className={styles.surfaceToggle}>
              <button className={`${styles.surfaceBtn} ${surface === "light" ? styles.surfaceBtnOn : ""}`} onClick={() => setSurface("light")}><Sun size={14} weight="fill" /> Light</button>
              <button className={`${styles.surfaceBtn} ${surface === "dark" ? styles.surfaceBtnOn : ""}`} onClick={() => setSurface("dark")}><Moon size={14} weight="fill" /> Dark</button>
            </div>
          </div>
        </header>

        <div className={styles.stats}>
          <div className={styles.stat}><div className={styles.statNum}>{FAMILIES.length}</div><div className={styles.statLabel}>families (incl. current)</div></div>
          <div className={styles.stat}><div className={styles.statNum}>{REAL_FAMILIES.filter((f) => f.palette === "mono").length}/{REAL_FAMILIES.filter((f) => f.palette === "color").length}</div><div className={styles.statLabel}>mono / multicolour</div></div>
          <div className={styles.stat}><div className={styles.statNum}>{SEMANTIC.length}</div><div className={styles.statLabel}>meanings compared</div></div>
          <div className={styles.stat}><div className={styles.statNum}>{AUDIT_META.uniqueLibraryIcons}</div><div className={styles.statLabel}>current app icons</div></div>
        </div>

        <nav className={styles.tabs}>
          {TABS.map((t) => (
            <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        {tab === "overview" && <Overview />}
        {tab === "gallery" && <Gallery />}
        {tab === "compare" && <Compare />}
        {tab === "catalogue" && <Catalogue />}
        {tab === "dashboard" && <DashboardPreview />}
        {tab === "sizes" && <Sizes />}
        {tab === "backgrounds" && <Backgrounds />}
        {tab === "viability" && <Viability />}
      </div>
    </div>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────────── */
function Overview() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Real artwork, not treatments</h2>
          <p className={styles.sectionSub}>
            Each family below is the genuine SVG from that collection, drawn directly. Mono sets inherit the ink colour
            (so they&rsquo;d tint to the TSP coral); multicolour sets keep their own palette. The &ldquo;Current&rdquo; family is our
            live Phosphor icon, for honest comparison. Previewed via the open-source Iconify icon-sets — no package was
            installed and the app is unchanged.
          </p>
        </div>
        <div className={styles.famRow} style={{ gap: 26 }}>
          {["property", "email", "whatsapp", "calendar", "tasks", "money"].map((k) => (
            <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <Icon fam="plump-color" k={k} size={30} />
              <span className={styles.cellMeta}>{SEMANTIC.find((s) => s.key === k)!.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Licensing &amp; coverage — honest notes</h2>
          <p className={styles.sectionSub}>
            All previewed sets are free/open (CC BY 4.0, Apache 2.0 or MIT). Four are marked <b>freemium</b>: Streamline
            and Hugeicons publish a free subset on Iconify and sell the full library — so a production rollout would need
            a licence check. Two sets (Kameleon, Fluent Color) don&rsquo;t fully cover our meanings and are flagged as
            <b> partial</b>. Nothing here is a licensing commitment — that&rsquo;s your call.
          </p>
        </div>
      </section>
    </>
  );
}

/* ── A. Family gallery ─────────────────────────────────────────────────────── */
function Gallery() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>A · Icon family gallery</h2>
        <p className={styles.sectionSub}>Every family with the same representative TSP meanings. A &ldquo;–&rdquo; means that collection has no equivalent for that meaning.</p>
      </div>
      <div className={styles.famGrid}>
        {FAMILIES.map((f) => {
          const meta = FAMILY_META[f.id];
          return (
            <div key={f.id} className={styles.famCard}>
              <div className={styles.famHead}>
                <span className={styles.famName}>{f.label}</span>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <PaletteBadge f={f} />
                  <CoverageBadge f={f} />
                </div>
              </div>
              <p className={styles.famPersona}>{meta?.personality}</p>
              <div className={styles.famRow}>
                {GALLERY_KEYS.map((k) => <Icon key={k} fam={f.id} k={k} size={30} />)}
              </div>
              <p className={styles.famPowered}>
                <b>{f.license}</b>{f.freemium ? " · freemium (free subset shown)" : ""} · {f.total.toLocaleString()} icons in set
                {meta?.note ? <><br />{meta.note}</> : null}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── B. Side-by-side ───────────────────────────────────────────────────────── */
function Compare() {
  const [focus, setFocus] = useState("property");
  const [picked, setPicked] = useState<string[]>(["current", "solar-duotone", "mingcute-fill", "plump-color", "fe-3d"]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>B · One meaning, every family</h2>
          <p className={styles.sectionSub}>Pick a meaning and compare the real artwork across all {FAMILIES.length} families at a glance.</p>
        </div>
        <div className={styles.pickRow}>
          {SEMANTIC.map((s) => (
            <button key={s.key} className={`${styles.chip} ${focus === s.key ? styles.chipOn : ""}`} onClick={() => setFocus(s.key)}>{s.label}</button>
          ))}
        </div>
        <div className={styles.sxs}>
          {FAMILIES.map((f) => (
            <div key={f.id} className={styles.sxsCell}>
              <div className={styles.sxsIcon}><Icon fam={f.id} k={focus} size={44} /></div>
              <span className={styles.sxsFam}>{f.label.replace("Current — ", "")}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Compare chosen families across the full set</h2>
          <p className={styles.sectionSub}>Tick families to study them against every meaning side by side.</p>
        </div>
        <div className={styles.pickRow}>
          {FAMILIES.map((f) => (
            <button key={f.id} className={`${styles.chip} ${picked.includes(f.id) ? styles.chipOn : ""}`} onClick={() => toggle(f.id)}>{f.label.replace("Current — ", "")}</button>
          ))}
        </div>
        <div className={styles.scrollX}>
          <div className={styles.sizeTable} style={{ minWidth: 160 + picked.length * 120 }}>
            <div className={styles.sizeRow} style={{ gridTemplateColumns: `160px repeat(${picked.length}, 1fr)` }}>
              <div className={`${styles.sizeHeadCell} ${styles.sizeHeadRow}`} style={{ textAlign: "left" }}>Meaning</div>
              {picked.map((id) => <div key={id} className={`${styles.sizeHeadCell} ${styles.sizeHeadRow}`}>{FAMILIES.find((f) => f.id === id)!.label.replace("Current — ", "")}</div>)}
            </div>
            {SEMANTIC.map((s) => (
              <div key={s.key} className={styles.sizeRow} style={{ gridTemplateColumns: `160px repeat(${picked.length}, 1fr)` }}>
                <div className={styles.sizeFam}>{s.label}</div>
                {picked.map((id) => <div key={id} className={styles.sizeCell}><Icon fam={id} k={s.key} size={28} /></div>)}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

/* ── C. Current inventory (real current-app icons — unchanged audit) ───────── */
function CatIcon({ i, size }: { i: InventoryIcon; size: number }) {
  const C = i.lib === "phosphor" ? PH[i.name] : LU[i.name];
  if (!C) return <span className={styles.miss}>–</span>;
  return i.lib === "phosphor" ? <C size={size} weight="regular" /> : <C size={size} />;
}
function Catalogue() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [lib, setLib] = useState("all");
  const [active, setActive] = useState<InventoryIcon | null>(null);
  const cats = useMemo(() => ["all", ...Object.keys(AUDIT_META.categoryCounts)], []);
  const filtered = useMemo(
    () => INVENTORY.filter((i) => (cat === "all" || i.category === cat) && (lib === "all" || i.lib === lib) && (q === "" || i.name.toLowerCase().includes(q.toLowerCase()) || i.category.includes(q.toLowerCase()))),
    [q, cat, lib],
  );
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>C · Current app inventory</h2>
        <p className={styles.sectionSub}>The {AUDIT_META.uniqueLibraryIcons} real icons the dashboards use today (Phosphor + Lucide). Click one to see where it&rsquo;s used. This is the set any new family would need to cover.</p>
      </div>
      <div className={styles.controls}>
        <label className={styles.search}><MagnifyingGlass size={16} /><input placeholder={`Search ${AUDIT_META.uniqueLibraryIcons} icons…`} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className={styles.select} value={lib} onChange={(e) => setLib(e.target.value)}>
          <option value="all">All libraries</option><option value="phosphor">Phosphor</option><option value="lucide">Lucide</option>
        </select>
        <span className={styles.count}>{filtered.length} shown</span>
      </div>
      <div className={styles.chips} style={{ marginBottom: 20 }}>
        {cats.map((c) => <button key={c} className={`${styles.chip} ${cat === c ? styles.chipOn : ""}`} onClick={() => setCat(c)}>{c}{c !== "all" ? ` · ${(AUDIT_META.categoryCounts as Record<string, number>)[c]}` : ""}</button>)}
      </div>
      <div className={styles.grid}>
        {filtered.map((i) => (
          <button key={`${i.lib}:${i.name}`} className={styles.cell} onClick={() => setActive(i)}>
            <span className={styles.cellLib}>{i.lib === "phosphor" ? "PH" : "LU"}</span>
            <span className={styles.cellIcon}><CatIcon i={i} size={26} /></span>
            <span className={styles.cellName}>{i.name}</span>
            <span className={styles.cellMeta}>{i.category} · {i.fileCount} {i.fileCount === 1 ? "file" : "files"}</span>
          </button>
        ))}
      </div>
      {active && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setActive(null)}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.28)" }} />
          <div className={styles.pop} style={{ left: "50%", top: "50%", transform: "translate(-50%,-50%)" }} onClick={(e) => e.stopPropagation()}>
            <p className={styles.popTitle}><CatIcon i={active} size={22} /> {active.name}</p>
            <p className={styles.popSub}>{active.lib} · {active.category} · {active.fileCount} files · ~{active.usages} usages</p>
            <ul className={styles.popList}>
              {active.files.map((f) => <li key={f}>{f}</li>)}
              {active.fileCount > active.files.length && <li>… and {active.fileCount - active.files.length} more</li>}
            </ul>
          </div>
        </div>
      )}
      <div className={styles.sectionHead} style={{ marginTop: 44 }}>
        <h2 className={styles.sectionTitle}>Outside the icon libraries</h2>
        <p className={styles.sectionSub}>Hand-rolled SVG, custom components, emoji-as-icon and CSS-drawn marks in the dashboards. {NON_LIBRARY_META.otherLibraries}</p>
      </div>
      <div className={styles.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
        {NON_LIBRARY.map((n) => (
          <div key={n.name} className={styles.cell} style={{ cursor: "default", alignItems: "flex-start", textAlign: "left", minHeight: 0 }}>
            <span className={styles.cellLib}>{n.kind}</span>
            <span className={styles.cellName} style={{ fontSize: 12 }}>{n.name}</span>
            <span className={styles.cellMeta} style={{ textAlign: "left" }}>{n.represents}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── D. Dashboard preview ──────────────────────────────────────────────────── */
function DashboardPreview() {
  const [family, setFamily] = useState("solar-duotone");
  const f = FAMILIES.find((x) => x.id === family)!;
  // Missing icon in the chosen family falls back to the current icon, dimmed.
  const g = (key: string, size = 18) => {
    const node = renderFamilyIcon(family, key, size);
    if (node) return node;
    return <span style={{ opacity: 0.28 }}>{renderFamilyIcon("current", key, size)}</span>;
  };
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>D · Dashboard context preview</h2>
        <p className={styles.sectionSub}>A fabricated TSP dashboard (no real data). Switch the family and every icon becomes that collection&rsquo;s real artwork while the layout stays put. Demonstration only.</p>
      </div>
      <div className={styles.controls}>
        <select className={styles.select} value={family} onChange={(e) => setFamily(e.target.value)}>
          {FAMILIES.map((x) => <option key={x.id} value={x.id}>Icon family: {x.label.replace("Current — ", "Current / ")}</option>)}
        </select>
        <PaletteBadge f={f} /><CoverageBadge f={f} />
        {REAL_MISSING[family]?.length ? <span className={styles.count}>missing here shown dimmed as current</span> : null}
      </div>
      <div className={styles.dash}>
        <aside className={styles.dashSide}>
          <div className={styles.dashBrand}><span className={styles.dashBrandDot}>S</span> Sales Progressor</div>
          {[{ k: "property", label: "Properties", on: true }, { k: "people", label: "Clients" }, { k: "tasks", label: "Tasks" }, { k: "chain", label: "Chains" }, { k: "calendar", label: "Calendar" }, { k: "reminders", label: "Reminders" }, { k: "settings", label: "Settings" }].map((n) => (
            <div key={n.k} className={`${styles.navItem} ${n.on ? styles.navOn : ""}`}>{g(n.k, 18)} {n.label}</div>
          ))}
        </aside>
        <main className={styles.dashMain}>
          <div className={styles.dashTopbar}>
            <span className={styles.dashH}>Your properties</span>
            <div className={styles.dashActions}>
              <span className={styles.dashBtn}>{g("search", 15)} Search</span>
              <span className={`${styles.dashBtn} ${styles.dashBtnPrimary}`}>{g("add", 15)} New sale</span>
            </div>
          </div>
          <div className={styles.propGrid}>
            {[{ addr: "10 High Street", meta: "Freehold · Mortgage", status: "milestones", statusText: "Enquiries" }, { addr: "42 Oakmere Close", meta: "Leasehold · Cash", status: "success", statusText: "Exchanged" }, { addr: "7 Elm Gardens", meta: "Freehold · Mortgage", status: "warning", statusText: "At risk" }].map((p) => (
              <div key={p.addr} className={styles.propCard}>
                <div className={styles.propTop}><span className={styles.propIcon}>{g("property", 24)}</span><div><div className={styles.propAddr}>{p.addr}</div><div className={styles.propMeta}>{p.meta}</div></div></div>
                <div className={styles.propRow}>{g("email", 16)} Buyer · {g("whatsapp", 16)} Seller</div>
                <span className={styles.statusPill}>{g(p.status, 14)} {p.statusText}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div className={styles.taskList} style={{ flex: "1 1 320px" }}>
              {[{ k: "tasks", t: "Chase solicitor for draft contract" }, { k: "reminders", t: "Mortgage offer expires in 5 days" }, { k: "documents", t: "Upload property information form" }, { k: "completion", t: "Confirm completion date" }].map((t) => (
                <div key={t.t} className={styles.taskRow}><span className={styles.taskIcon}>{g(t.k, 18)}</span><span className={styles.taskText}>{t.t}</span>{g("edit", 16)}</div>
              ))}
            </div>
            <div className={styles.menuCard}>
              {[{ k: "edit", t: "Edit sale" }, { k: "people", t: "Manage parties" }, { k: "money", t: "Fees & invoice" }, { k: "delete", t: "Remove sale" }].map((m) => (
                <div key={m.t} className={styles.menuItem}>{g(m.k, 18)} {m.t}</div>
              ))}
            </div>
          </div>
          <div className={styles.emptyBox}>
            <span className={styles.emptyIcon}>{g("chain", 40)}</span>
            <span className={styles.emptyText}>No chain linked yet. Add the onward purchase to see the full chain.</span>
            <span className={`${styles.dashBtn} ${styles.dashBtnPrimary}`}>{g("add", 15)} Link a chain</span>
          </div>
        </main>
      </div>
    </section>
  );
}

/* ── E. Sizes ──────────────────────────────────────────────────────────────── */
const SIZES = [16, 20, 24, 32, 40];
function Sizes() {
  const [focus, setFocus] = useState("property");
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>E · Size legibility</h2>
        <p className={styles.sectionSub}>The same meaning at the sizes TSP uses. Watch the multicolour and 3D sets lose detail small — fine at 40px, mud at 16px.</p>
      </div>
      <div className={styles.pickRow}>
        {SEMANTIC.map((s) => <button key={s.key} className={`${styles.chip} ${focus === s.key ? styles.chipOn : ""}`} onClick={() => setFocus(s.key)}>{s.label}</button>)}
      </div>
      <div className={styles.sizeTable}>
        <div className={`${styles.sizeRow} ${styles.sizeHeadRow}`}>
          <div className={styles.sizeHeadCell} style={{ textAlign: "left" }}>Family</div>
          {SIZES.map((s) => <div key={s} className={styles.sizeHeadCell}>{s}px</div>)}
        </div>
        {FAMILIES.map((f) => (
          <div key={f.id} className={styles.sizeRow}>
            <div className={styles.sizeFam}>{f.label.replace("Current — ", "")}</div>
            {SIZES.map((s) => <div key={s} className={styles.sizeCell}><Icon fam={f.id} k={focus} size={s} /></div>)}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── F. Light / dark ───────────────────────────────────────────────────────── */
function Backgrounds() {
  const [family, setFamily] = useState("solar-duotone");
  const keys = ["property", "email", "whatsapp", "tasks", "warning", "success", "settings", "money"];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>F · Light &amp; dark surfaces</h2>
        <p className={styles.sectionSub}>Mono sets flip with the ink; multicolour sets keep fixed colours, so check they still read on dark.</p>
      </div>
      <div className={styles.controls}>
        <select className={styles.select} value={family} onChange={(e) => setFamily(e.target.value)}>
          {FAMILIES.map((f) => <option key={f.id} value={f.id}>Family: {f.label.replace("Current — ", "Current / ")}</option>)}
        </select>
        <PaletteBadge f={FAMILIES.find((f) => f.id === family)!} />
      </div>
      <div className={styles.bgSplit}>
        <div className={styles.root} data-surface="light" style={{ minHeight: 0, background: "transparent" }}>
          <div className={`${styles.bgPane} ${styles.bgLight}`}><div className={styles.bgLabel}>Light surface</div><div className={styles.bgRow}>{keys.map((k) => <Icon key={k} fam={family} k={k} size={34} />)}</div></div>
        </div>
        <div className={styles.root} data-surface="dark" style={{ minHeight: 0, background: "transparent" }}>
          <div className={`${styles.bgPane} ${styles.bgDark}`}><div className={styles.bgLabel}>Dark surface</div><div className={styles.bgRow}>{keys.map((k) => <Icon key={k} fam={family} k={k} size={34} />)}</div></div>
        </div>
      </div>
    </section>
  );
}

/* ── Viability ─────────────────────────────────────────────────────────────── */
function Dot({ v }: { v: Suit }) {
  const cls = v === "strong" ? styles.dotStrong : v === "ok" ? styles.dotOk : styles.dotWeak;
  return <span className={`${styles.dot} ${cls}`} title={v} />;
}
function Viability() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Practical suitability</h2>
        <p className={styles.sectionSub}>
          <span className={`${styles.dot} ${styles.dotStrong}`} /> strong · <span className={`${styles.dot} ${styles.dotOk}`} /> ok · <span className={`${styles.dot} ${styles.dotWeak}`} /> weak. &ldquo;Recommend&rdquo;: could it realistically go app-wide, suit selective use, or only accents/illustrations.
        </p>
      </div>
      <div className={styles.scrollX}>
        <table className={styles.viaTable}>
          <thead><tr><th>Family</th><th>Palette</th><th>Coverage</th><th>Small</th><th>Nav</th><th>Status</th><th>Dense</th><th>Tone</th><th>Recommend</th><th>Licence</th><th>Note</th></tr></thead>
          <tbody>
            {FAMILIES.map((f) => {
              const m = FAMILY_META[f.id];
              return (
                <tr key={f.id}>
                  <td className={styles.viaName}>{f.label.replace("Current — ", "")}</td>
                  <td style={{ textTransform: "capitalize" }}>{f.palette}</td>
                  <td>{f.coverage}/{SEMANTIC.length}{f.coverage < SEMANTIC.length - 1 ? " ⚠" : ""}</td>
                  <td><Dot v={m.small} /></td><td><Dot v={m.nav} /></td><td><Dot v={m.status} /></td><td><Dot v={m.dense} /></td>
                  <td style={{ textTransform: "capitalize" }}>{m.tone}</td>
                  <td style={{ textTransform: "capitalize" }}>{m.recommend.replace("-", " ")}</td>
                  <td>{f.license}{f.freemium ? " ·freemium" : ""}</td>
                  <td>{m.note}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

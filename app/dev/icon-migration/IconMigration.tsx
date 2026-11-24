"use client";

// /dev/icon-migration — app-wide Solar Bold Duotone migration PREVIEW. Shows every
// in-scope icon occurrence alongside exactly how it would look after the swap, at
// the same size + colour. Preview only — imports nothing from the live app and
// changes nothing in it. See migration-config.ts for the prepared (inactive) map.

import * as React from "react";
import { useMemo, useState } from "react";
import styles from "./icon-migration.module.css";
import { CurrentIcon, SolarIcon, resolveColor } from "./render";
import { CURRENT_ICONS, SCAN_STATS, type CurrentIcon as CI, type Occurrence } from "./data/occurrences.generated";
import { SOLAR_MAP, STATUS_UNIQUE, STATUS_OCC, type MapStatus } from "./data/solar.generated";
import { MagnifyingGlass, Sun, Moon, ArrowRight } from "@phosphor-icons/react";

type Surface = "light" | "dark";
type Tab = "overview" | "inventory" | "beforeafter" | "dashboard" | "decisions" | "coverage";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "beforeafter", label: "Before / After" },
  { id: "dashboard", label: "Dashboard Preview" },
  { id: "decisions", label: "Decisions" },
  { id: "coverage", label: "Coverage" },
];
const STATUS_LABEL: Record<MapStatus, string> = { exact: "Exact match", alternative: "Suitable alternative", decision: "Needs decision", keep: "Keep existing" };
const key = (i: { lib: string; name: string }) => `${i.lib}:${i.name}`;

function StatusChip({ s }: { s: MapStatus }) {
  const cls = s === "exact" ? styles.stExact : s === "alternative" ? styles.stAlt : s === "decision" ? styles.stDec : styles.stKeep;
  return <span className={`${styles.chipBadge} ${cls}`}>{STATUS_LABEL[s]}</span>;
}

function Pair({ i, size, color }: { i: CI; size: number; color?: string }) {
  const m = SOLAR_MAP[key(i)];
  return (
    <span className={styles.pair}>
      <span className={styles.pairCell}><CurrentIcon lib={i.lib} name={i.name} size={size} color={color} /></span>
      <ArrowRight size={13} className={styles.pairArrow} />
      <span className={styles.pairCell}>{m.solar ? <SolarIcon solar={m.solar} size={size} color={color} /> : <CurrentIcon lib={i.lib} name={i.name} size={size} color={color} />}</span>
    </span>
  );
}

export default function IconMigration() {
  const [surface, setSurface] = useState<Surface>("light");
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <div className={styles.root} data-surface={surface}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <p className={styles.kicker}>Dev · Migration Preview</p>
            <h1 className={styles.title}>Solar Bold Duotone — App-wide Migration</h1>
            <p className={styles.sub}>
              Every current icon across the three dashboards, next to its proposed Solar Bold Duotone replacement at the
              same size and colour. Preview and preparation only — the live app, its components, styling and behaviour
              are unchanged. Nothing applies until you approve it.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
            <span className={styles.devTag}>isolated · read-only · prepared not activated</span>
            <div className={styles.surfaceToggle}>
              <button className={`${styles.surfaceBtn} ${surface === "light" ? styles.surfaceBtnOn : ""}`} onClick={() => setSurface("light")}><Sun size={14} weight="fill" /> Light</button>
              <button className={`${styles.surfaceBtn} ${surface === "dark" ? styles.surfaceBtnOn : ""}`} onClick={() => setSurface("dark")}><Moon size={14} weight="fill" /> Dark</button>
            </div>
          </div>
        </header>
        <div className={styles.stats}>
          <Stat n={SCAN_STATS.uniqueIcons} l="unique icons" />
          <Stat n={SCAN_STATS.totalOccurrences} l="total occurrences" />
          <Stat n={STATUS_UNIQUE.exact ?? 0} l="exact matches" />
          <Stat n={(STATUS_UNIQUE.alternative ?? 0)} l="alternatives" />
          <Stat n={(STATUS_UNIQUE.decision ?? 0) + (STATUS_UNIQUE.keep ?? 0)} l="decide / keep" />
          <Stat n={SCAN_STATS.iconsSharedWithExcluded} l="shared w/ excluded" />
        </div>
        <nav className={styles.tabs}>
          {TABS.map((t) => <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </nav>
        {tab === "overview" && <Overview />}
        {tab === "inventory" && <Inventory />}
        {tab === "beforeafter" && <BeforeAfter />}
        {tab === "dashboard" && <DashboardPreview />}
        {tab === "decisions" && <Decisions />}
        {tab === "coverage" && <Coverage />}
      </div>
    </div>
  );
}
function Stat({ n, l }: { n: number; l: string }) {
  return <div className={styles.stat}><div className={styles.statNum}>{n.toLocaleString()}</div><div className={styles.statLabel}>{l}</div></div>;
}

/* ── Overview ──────────────────────────────────────────────────────────────── */
function Overview() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>What this preview is</h2>
          <p className={styles.sectionSub}>
            A read-only, calculated preview of swapping the dashboards&rsquo; icons to <b>Solar Bold Duotone</b> (real Solar
            artwork). Scope: TSP internal, Agent and External Progressor — which all run on the <code>/agent/*</code> surface,
            role-gated — plus Account, Business Settings and the shared components they use. Excluded entirely: Command
            Centre, client/solicitor/broker portals, auth, Boardwalk and marketing.
          </p>
        </div>
        <div className={styles.famRow} style={{ gap: 30 }}>
          {["House", "EnvelopeSimple", "CalendarBlank", "Bell", "Trash", "MagnifyingGlass", "UsersThree"].map((n) => {
            const i = CURRENT_ICONS.find((x) => x.name === n);
            return i ? <div key={n} style={{ textAlign: "center" }}><Pair i={i} size={30} /><div className={styles.cellMeta} style={{ marginTop: 6 }}>{n}</div></div> : null;
          })}
        </div>
      </section>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>How to read it</h2>
          <p className={styles.sectionSub}>
            Left = current icon, right = proposed Solar. Both render at the occurrence&rsquo;s real size and colour — Solar&rsquo;s
            duotone inherits the existing colour (primary = that colour, secondary = a lighter opacity of the same hue),
            with <b>no backgrounds or containers added</b>. Statuses: <b>exact</b>, <b>suitable alternative</b>,
            <b> needs decision</b>, <b>keep existing</b> (brand/animated/custom). Start with <b>Decisions</b>.
          </p>
        </div>
      </section>
    </>
  );
}

/* ── A. Inventory ──────────────────────────────────────────────────────────── */
function Inventory() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [lib, setLib] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const filtered = useMemo(() => CURRENT_ICONS.filter((i) => {
    const m = SOLAR_MAP[key(i)];
    return (status === "all" || m.status === status) && (lib === "all" || i.lib === lib) &&
      (q === "" || i.name.toLowerCase().includes(q.toLowerCase()) || (m.solar || "").includes(q.toLowerCase()));
  }), [q, status, lib]);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>A · Complete inventory</h2>
        <p className={styles.sectionSub}>Every current icon, its proposed Solar, status, where it&rsquo;s used and how many times. Click a row to expand every individual occurrence (file, line, size, colour, shared flag).</p>
      </div>
      <div className={styles.controls}>
        <label className={styles.search}><MagnifyingGlass size={16} /><input placeholder={`Search ${CURRENT_ICONS.length} icons…`} value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className={styles.select} value={lib} onChange={(e) => setLib(e.target.value)}><option value="all">All libraries</option><option value="phosphor">Phosphor</option><option value="lucide">Lucide</option></select>
        <span className={styles.count}>{filtered.length} icons · {filtered.reduce((s, i) => s + i.count, 0)} occurrences</span>
      </div>
      <div className={styles.chips} style={{ marginBottom: 16 }}>
        {["all", "exact", "alternative", "decision", "keep"].map((s) => <button key={s} className={`${styles.chip} ${status === s ? styles.chipOn : ""}`} onClick={() => setStatus(s)}>{s === "all" ? "all" : STATUS_LABEL[s as MapStatus]}{s !== "all" ? ` · ${(STATUS_UNIQUE as Record<string, number>)[s] ?? 0}` : ""}</button>)}
      </div>
      <div className={styles.invHead}>
        <span>Current → Solar</span><span>Icon</span><span>Status</span><span>Uses</span><span>Sizes</span><span>Colours</span><span>Shared</span>
      </div>
      {filtered.map((i) => {
        const m = SOLAR_MAP[key(i)];
        const id = key(i);
        return (
          <div key={id} className={styles.invRowWrap}>
            <button className={styles.invRow} onClick={() => setOpen(open === id ? null : id)}>
              <span className={styles.pair}><span className={styles.pairCell}><CurrentIcon lib={i.lib} name={i.name} size={24} /></span><ArrowRight size={12} className={styles.pairArrow} /><span className={styles.pairCell}>{m.solar ? <SolarIcon solar={m.solar} size={24} /> : <span className={styles.keepTxt}>keep</span>}</span></span>
              <span className={styles.invName}>{i.name}<span className={styles.invSolar}>{m.solar ? m.solar : "— existing —"}</span></span>
              <span><StatusChip s={m.status} /></span>
              <span className={styles.invNum}>{i.count}</span>
              <span className={styles.invMeta}>{i.sizes.length ? i.sizes.sort((a, b) => +a - +b).join(", ") : "inherit"}</span>
              <span className={styles.invMeta}>{i.colors.length ? `${i.colors.length}` : "inherit"}</span>
              <span>{i.leakCount > 0 ? <span className={`${styles.chipBadge} ${styles.stDec}`}>excluded ×{i.leakCount}</span> : i.sharedCount > 0 ? <span className={styles.invMeta}>shared</span> : <span className={styles.invMeta}>—</span>}</span>
            </button>
            {open === id && (
              <div className={styles.occPanel}>
                {m.note && <p className={styles.occNote}>{m.note}</p>}
                <div className={styles.occTable}>
                  <div className={`${styles.occLine} ${styles.occHeadLine}`}><span>File</span><span>Line</span><span>Area</span><span>Size</span><span>Colour</span><span>Tag</span></div>
                  {i.occ.map((o, idx) => <OccRow key={idx} o={o} />)}
                  {i.count > i.occ.length && <div className={styles.occMore}>… and {i.count - i.occ.length} more occurrences</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
function OccRow({ o }: { o: Occurrence }) {
  return (
    <div className={styles.occLine}>
      <span className={styles.occFile}>{o.file.replace(/^(app|components)\//, "")}</span>
      <span>{o.line}</span>
      <span>{o.area.replace("-component", "").replace("agent-pages", "agent")}</span>
      <span>{o.size || "—"}</span>
      <span>{o.color || "inherit"}{o.leaks ? " ⚠" : ""}</span>
      <span className={styles.occTag}>{o.tag}</span>
    </div>
  );
}

/* ── B. Before / After ─────────────────────────────────────────────────────── */
function BeforeAfter() {
  const [sel, setSel] = useState("House");
  const i = CURRENT_ICONS.find((x) => x.name === sel) || CURRENT_ICONS[0];
  const m = SOLAR_MAP[key(i)];
  // distinct (size,color) variations across this icon's captured occurrences
  const variations = useMemo(() => {
    const seen = new Set<string>(); const out: { size: number; color?: string; raw: string | null }[] = [];
    for (const o of i.occ) { const sz = o.size ? +o.size : 20; const c = resolveColor(o.color); const k = `${sz}|${c || ""}`; if (!seen.has(k)) { seen.add(k); out.push({ size: sz, color: c, raw: o.color }); } }
    if (!out.length) out.push({ size: 20, color: undefined, raw: null });
    return out.sort((a, b) => a.size - b.size);
  }, [i]);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>B · Before / After at real sizes &amp; colours</h2>
        <p className={styles.sectionSub}>Pick an icon to see current vs Solar at every size and colour it actually appears in across the dashboards.</p>
      </div>
      <div className={styles.controls}>
        <select className={styles.select} value={sel} onChange={(e) => setSel(e.target.value)} style={{ minWidth: 220 }}>
          {CURRENT_ICONS.map((x) => <option key={key(x)} value={x.name}>{x.name} ({x.count})</option>)}
        </select>
        <StatusChip s={m.status} />
        <span className={styles.count}>{m.solar ? `→ ${m.solar}` : "→ keep existing"}</span>
      </div>
      {m.note && <p className={styles.sectionSub} style={{ marginBottom: 16 }}>{m.note}</p>}
      <div className={styles.baGrid}>
        {variations.map((v, idx) => (
          <div key={idx} className={styles.baCard}>
            <div className={styles.baPairRow}>
              <div className={styles.baSide}><CurrentIcon lib={i.lib} name={i.name} size={v.size} color={v.color} /><span className={styles.baLbl}>current</span></div>
              <ArrowRight size={16} className={styles.pairArrow} />
              <div className={styles.baSide}>{m.solar ? <SolarIcon solar={m.solar} size={v.size} color={v.color} /> : <CurrentIcon lib={i.lib} name={i.name} size={v.size} color={v.color} />}<span className={styles.baLbl}>{m.solar ? "solar" : "kept"}</span></div>
            </div>
            <div className={styles.baMeta}>{v.size}px · {v.raw || "inherits colour"}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── C. Dashboard preview ──────────────────────────────────────────────────── */
function DashboardPreview() {
  const [mode, setMode] = useState<"current" | "solar">("current");
  const g = (name: string, size = 18, color?: string) => {
    const i = CURRENT_ICONS.find((x) => x.name === name);
    const lib = (i?.lib as "phosphor" | "lucide") || "phosphor";
    const m = SOLAR_MAP[`${lib}:${name}`];
    if (mode === "current" || !m?.solar) return <CurrentIcon lib={lib} name={name} size={size} color={color} />;
    return <SolarIcon solar={m.solar} size={size} color={color} />;
  };
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>C · Dashboard context</h2>
        <p className={styles.sectionSub}>A faithful reproduction of common TSP dashboard surfaces (no real data, no production components touched). Toggle the icon set — only the icons change; layout, text, colours and sizes stay identical.</p>
      </div>
      <div className={styles.controls}>
        <div className={styles.seg}>
          <button className={`${styles.segBtn} ${mode === "current" ? styles.segOn : ""}`} onClick={() => setMode("current")}>Current icons</button>
          <button className={`${styles.segBtn} ${mode === "solar" ? styles.segOn : ""}`} onClick={() => setMode("solar")}>Proposed Solar</button>
        </div>
      </div>
      <div className={styles.dash}>
        <aside className={styles.dashSide}>
          <div className={styles.dashBrand}><span className={styles.dashBrandDot}>S</span> Sales Progressor</div>
          {[["House", "Properties", true], ["UsersThree", "Clients", false], ["ListChecks", "Tasks", false], ["LinkSimple", "Chains", false], ["CalendarBlank", "Calendar", false], ["Bell", "Reminders", false], ["Gear", "Settings", false]].map(([n, l, on]) => (
            <div key={l as string} className={`${styles.navItem} ${on ? styles.navOn : ""}`}><span className={styles.navIc}>{g(n as string, 19, on ? "var(--coral)" : undefined)}</span> {l as string}</div>
          ))}
        </aside>
        <main className={styles.dashMain}>
          <div className={styles.dashTopbar}>
            <span className={styles.dashH}>Your properties</span>
            <div className={styles.dashActions}>
              <span className={styles.dashBtn}>{g("MagnifyingGlass", 15)} Search</span>
              <span className={`${styles.dashBtn} ${styles.dashBtnPrimary}`}>{g("Plus", 15, "#fff")} New sale</span>
            </div>
          </div>
          <div className={styles.propGrid}>
            {[["10 High Street", "CheckCircle", "Exchanged", "#16a34a"], ["42 Oakmere Close", "Warning", "At risk", "#d97706"], ["7 Elm Gardens", "Clock", "Enquiries", undefined]].map(([addr, st, stt, col]) => (
              <div key={addr as string} className={styles.propCard}>
                <div className={styles.propTop}><span className={styles.propIc}>{g("House", 22)}</span><div><div className={styles.propAddr}>{addr as string}</div><div className={styles.propMeta}>Freehold · Mortgage</div></div></div>
                <div className={styles.propRow}><span style={{ color: "#6b7280", display: "inline-flex" }}>{g("EnvelopeSimple", 15, "#6b7280")}</span> Buyer · <span style={{ color: "#6b7280", display: "inline-flex" }}>{g("WhatsappLogo", 15, "#6b7280")}</span> Seller</div>
                <span className={styles.statusPill} style={{ color: (col as string) || "#6b7280" }}>{g(st as string, 14, (col as string) || "#6b7280")} {stt as string}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <div className={styles.taskList} style={{ flex: "1 1 320px" }}>
              {[["ListChecks", "Chase solicitor for draft contract"], ["Bell", "Mortgage offer expires in 5 days"], ["FileText", "Upload property information form"], ["CalendarCheck", "Confirm completion date"]].map(([n, t]) => (
                <div key={t as string} className={styles.taskRow}><span className={styles.taskIc}>{g(n as string, 18, "#6b7280")}</span><span className={styles.taskTxt}>{t as string}</span><span className={styles.taskIc}>{g("PencilSimple", 16, "#9ca3af")}</span></div>
              ))}
            </div>
            <div className={styles.menuCard}>
              {[["PencilSimple", "Edit sale"], ["UsersThree", "Manage parties"], ["Receipt", "Fees & invoice"], ["Trash", "Remove sale"]].map(([n, t]) => (
                <div key={t as string} className={styles.menuItem}><span className={styles.menuIc}>{g(n as string, 17, "#4b5563")}</span> {t as string}</div>
              ))}
            </div>
          </div>
          <div className={styles.emptyBox}><span style={{ color: "#cbd5e1" }}>{g("LinkSimple", 34, "#cbd5e1")}</span><span className={styles.emptyTxt}>No chain linked yet.</span><span className={`${styles.dashBtn} ${styles.dashBtnPrimary}`}>{g("Plus", 15, "#fff")} Link a chain</span></div>
        </main>
      </div>
    </section>
  );
}

/* ── D. Decisions ──────────────────────────────────────────────────────────── */
function Decisions() {
  const queue = CURRENT_ICONS.filter((i) => { const m = SOLAR_MAP[key(i)]; return m.status === "decision" || m.status === "keep" || i.leakCount > 0; })
    .sort((a, b) => b.count - a.count);
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>D · Decision &amp; risk queue</h2>
        <p className={styles.sectionSub}>Icons that need your call: no clean Solar match, best left as-is, or rendered by a component that also appears in an excluded area (a swap there would leak). {queue.length} items.</p>
      </div>
      <div className={styles.decGrid}>
        {queue.map((i) => {
          const m = SOLAR_MAP[key(i)];
          const concern = i.leakCount > 0 ? `Shared with an EXCLUDED area (${i.occ.filter((o) => o.leaks).map((o) => o.file.split("/").pop()).join(", ")}). Swapping the component would change the portal/Command Centre too.` : m.note;
          const rec = i.leakCount > 0 ? "Pass the icon in from the dashboard caller, or leave this component unchanged." : m.status === "keep" ? "Recommend keeping the existing icon." : "Review the proposed Solar below; pick it, choose another Solar icon, or keep existing.";
          return (
            <div key={key(i)} className={styles.decCard}>
              <div className={styles.decTop}>
                <Pair i={i} size={30} />
                <div className={styles.decName}>{i.name}<span className={styles.invSolar}>{i.count} uses · {m.solar || "no Solar"}</span></div>
                <StatusChip s={i.leakCount > 0 ? "decision" : m.status} />
              </div>
              <p className={styles.decConcern}>{concern}</p>
              <p className={styles.decRec}><b>Recommendation:</b> {rec}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ── E. Coverage ───────────────────────────────────────────────────────────── */
function Coverage() {
  const totalU = SCAN_STATS.uniqueIcons, totalO = SCAN_STATS.totalOccurrences;
  const rows: [string, number, number, string][] = [
    ["Exact match", STATUS_UNIQUE.exact ?? 0, STATUS_OCC.exact ?? 0, styles.stExact],
    ["Suitable alternative", STATUS_UNIQUE.alternative ?? 0, STATUS_OCC.alternative ?? 0, styles.stAlt],
    ["Needs decision", STATUS_UNIQUE.decision ?? 0, STATUS_OCC.decision ?? 0, styles.stDec],
    ["Keep existing", STATUS_UNIQUE.keep ?? 0, STATUS_OCC.keep ?? 0, styles.stKeep],
  ];
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}><h2 className={styles.sectionTitle}>E · Coverage summary</h2><p className={styles.sectionSub}>Calculated from the real inventory — not hardcoded.</p></div>
      <div className={styles.covGrid}>
        {rows.map(([l, u, o, cls]) => (
          <div key={l} className={styles.covCard}>
            <div className={styles.covTop}><span className={`${styles.chipBadge} ${cls}`}>{l}</span><span className={styles.covPct}>{Math.round((o / totalO) * 100)}%</span></div>
            <div className={styles.covBar}><div className={styles.covFill} style={{ width: `${(o / totalO) * 100}%` }} /></div>
            <div className={styles.covNums}><b>{u}</b> unique · <b>{o}</b> occurrences</div>
          </div>
        ))}
      </div>
      <div className={styles.covMeta}>
        <div className={styles.covStat}><b>{totalU}</b> unique icons · <b>{totalO}</b> occurrences · <b>{SCAN_STATS.phosphor}</b> Phosphor / <b>{SCAN_STATS.lucide}</b> Lucide</div>
        <div className={styles.covStat}><b>{SCAN_STATS.iconsSharedWithExcluded}</b> icon(s) in components shared with excluded areas · <b>{SCAN_STATS.occInSharedLeaking}</b> such occurrence(s)</div>
        <div className={styles.covStat}>By area: {Object.entries(SCAN_STATS.occByArea).map(([a, n]) => `${a} ${n}`).join(" · ")}</div>
        <div className={styles.covStat}><b>{((STATUS_OCC.exact ?? 0) / totalO * 100).toFixed(0)}%</b> of occurrences map to an exact Solar icon; <b>{(((STATUS_OCC.exact ?? 0) + (STATUS_OCC.alternative ?? 0)) / totalO * 100).toFixed(0)}%</b> to exact + suitable.</div>
      </div>
    </section>
  );
}

"use client";

// Property information ("property passport") — the single home for external
// facts about the physical property on the Overview tab. A calm hero (EPC +
// address + last sold) over Overview / Energy / History / Planning tabs, so it
// stays compact while everything is one tap away. Data from /api/property-intel
// → getPropertyEnrichment; every tab degrades independently and never blocks
// the page. Keeps all prior EPC + sold-price functionality.

import { useEffect, useState } from "react";
import { Info, ArrowSquareOut } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { LinkArrow } from "@/components/ui/LinkArrow";

type PricePaid = { date: string; amount: number; propertyType: string; newBuild: boolean; estateType: string; paon?: string; saon?: string; street?: string };
type Epc = { rating: string; score: number | null; potentialRating: string; potentialScore: number | null; propertyType: string; floorArea: number | null; builtForm: string; inspectionDate: string; validUntil: string | null; uprn: string | null; tenure: string; localAuthority: string; address: string };
type Designation = { found: boolean; label?: string; reference?: string; grade?: string };
type SourceRef = { label: string; url?: string };
type Links = { rightmove: string; zoopla: string; landReg: string };

type IntelData = {
  postcode: string | null;
  address: string;
  identity: { uprn: string | null; lat: number | null; lng: number | null; localAuthority: string | null };
  epc: { status: "ok" | "none" | "error" | "unconfigured"; data: Epc | null };
  sold: { status: "ok" | "none" | "error"; entries: PricePaid[] };
  planning: { status: "ok" | "error" | "no-coords"; conservationArea: Designation; article4: Designation; listedBuilding: Designation; coverageNote: string };
  councilTax: { status: "link"; link: SourceRef };
  connectivity: { status: "parked" };
  flood: { status: "link"; link: SourceRef };
  planningApplications: { status: "link"; link: SourceRef | null };
  worthKnowing: string[];
  sources: SourceRef[];
  links: Links | null;
};

function tidy(s: string): string {
  return (s ?? "").replace(/[-_]+/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}
function fmtMonthYear(d: string): string { return d ? new Date(d).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : ""; }
function yearOf(d: string): string { return d ? String(new Date(d).getFullYear()) : ""; }
function poundsFmt(p: number): string { return "£" + p.toLocaleString("en-GB", { maximumFractionDigits: 0 }); }
function yearsAgo(d: string): string {
  if (!d) return "";
  const yrs = Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 86400000));
  return yrs <= 0 ? "this year" : `${yrs} year${yrs === 1 ? "" : "s"} ago`;
}

const EPC_HEX: Record<string, string> = { A: "#16a34a", B: "#22c55e", C: "#84cc16", D: "#eab308", E: "#fb923c", F: "#ea580c", G: "#dc2626" };
const EPC_BANDS = ["A", "B", "C", "D", "E", "F", "G"];
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--agent-text-muted)" };

const PP_STYLES = `
  .pp-tabs { display:flex; gap:2px; padding:6px 10px; background:var(--agent-surface-glass); border-top:0.5px solid var(--agent-border-default); border-bottom:0.5px solid var(--agent-border-default); }
  .pp-tab { flex:1; font-family:inherit; font-size:12px; font-weight:600; color:var(--agent-text-secondary); background:none; border:none; border-radius:8px; padding:7px 6px; cursor:pointer; transition:background-color .14s ease, color .14s ease; }
  .pp-tab:hover { color:var(--agent-text-primary); }
  .pp-tab.on { background:var(--agent-surface-elevated); color:var(--agent-coral-deep); box-shadow:0 1px 3px rgba(30,45,74,0.10); }
`;

function EpcChip({ rating, size = 26 }: { rating: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: Math.round(size * 0.26), background: EPC_HEX[rating] ?? "rgba(148,163,184,0.5)", color: "#08120e", fontSize: Math.round(size * 0.5), fontWeight: 800, flexShrink: 0 }}>
      {rating || "?"}
    </span>
  );
}

type TabKey = "ov" | "en" | "hi" | "pl";

export function PropertyIntelCard({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<TabKey>("ov");

  useEffect(() => {
    fetch(`/api/property-intel?transactionId=${transactionId}`)
      .then((r) => { if (!r.ok) throw new Error("not ok"); return r.json(); })
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [transactionId]);

  const sales = (data?.sold.entries ?? []).filter((p) => p.date).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const priced = sales.filter((s) => s.amount > 0);
  const last = sales[0] ?? null;
  const lastPriced = priced[0] ?? null;
  const firstPriced = priced[priced.length - 1] ?? null;
  const epc = data?.epc.data ?? null;

  const pricePerM2 = lastPriced && epc?.floorArea && epc.floorArea > 0 ? Math.round(lastPriced.amount / epc.floorArea) : null;
  const growthPct = lastPriced && firstPriced && firstPriced !== lastPriced && firstPriced.amount > 0 ? Math.round(((lastPriced.amount - firstPriced.amount) / firstPriced.amount) * 100) : null;

  const line1 = (data?.address ?? "").split(",")[0]?.trim() || (data?.address ?? "");
  const propType = epc?.propertyType ? tidy(epc.propertyType) : (last?.propertyType ? tidy(last.propertyType) : null);
  const floorArea = epc?.floorArea ? `${Math.round(epc.floorArea)} m²` : null;
  const localAuthority = data?.identity.localAuthority ?? null;
  const worth = data?.worthKnowing ?? [];

  const TABS: { key: TabKey; label: string }[] = [
    { key: "ov", label: "Overview" },
    { key: "en", label: "Energy" },
    { key: "hi", label: "History" },
    { key: "pl", label: "Planning" },
  ];

  return (
    // Design Lab: `overview-property-intel`. Default v05 (Heavy frost).
    <GlassCard glassId="overview-property-intel" label="Overview · Property information" defaultVariant="v05" className="overflow-hidden rounded-[12px]">
      <style>{PP_STYLES}</style>

      {loading && (
        <div className="px-5 py-5">
          <p className="text-sm text-center" style={{ color: "var(--agent-text-muted)" }}>Fetching property information…</p>
        </div>
      )}
      {!loading && error && (
        <div className="px-5 py-5">
          <p className="text-sm text-center" style={{ color: "var(--agent-text-muted)" }}>Could not load property information.</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="agent-reveal-in">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px" }}>
            {epc && <EpcChip rating={epc.rating} size={46} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {line1 || "Property information"}
              </p>
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[propType, data.postcode].filter(Boolean).join(" · ") || "What we know about this property"}
              </p>
            </div>
            {last && (
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ ...LBL, display: "block" }}>Last sold</span>
                <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                  {last.amount > 0 ? poundsFmt(last.amount) : "Withheld"}
                </span>
                <span style={{ fontSize: 12, color: "var(--agent-text-muted)", marginLeft: 5 }}>{yearOf(last.date)}</span>
              </div>
            )}
          </div>

          {/* ── Tabs ─────────────────────────────────────────────────────── */}
          <div className="pp-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`pp-tab${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Panels ───────────────────────────────────────────────────── */}
          <div style={{ padding: "16px 18px", minHeight: 96 }}>
            {tab === "ov" && (
              <div className="agent-reveal-in">
                {worth.length > 0 && (
                  <div style={{ marginBottom: 14, padding: "11px 13px", borderRadius: 10, background: "rgba(var(--agent-coral-rgb), 0.06)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.20)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                      <Info size={14} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
                      <span style={{ ...LBL, color: "var(--agent-coral-deep)" }}>Worth knowing</span>
                    </div>
                    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                      {worth.map((w, i) => <li key={i} style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{w}</li>)}
                    </ul>
                  </div>
                )}
                <Facts rows={[["Type", propType], ["Floor area", floorArea], ["Local authority", localAuthority]]} />
                <LinkRow label="Council tax" link={data.councilTax.link} note="band" />
              </div>
            )}

            {tab === "en" && (
              <div className="agent-reveal-in">
                {epc ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={LBL}>EPC {epc.rating}{epc.score !== null ? ` · ${epc.score}` : ""}</span>
                      {epc.inspectionDate && (
                        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Certified {fmtMonthYear(epc.inspectionDate)}{epc.validUntil ? ` · valid to ${yearOf(epc.validUntil)}` : ""}</span>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 3 }}>
                      {EPC_BANDS.map((band, i) => {
                        const isNow = epc.rating === band;
                        const isPotential = !!epc.potentialRating && epc.potentialRating === band && epc.potentialRating !== epc.rating;
                        const width = 40 + i * 10;
                        return (
                          <div key={band} style={{ display: "flex", alignItems: "center", height: 20, position: "relative" }}>
                            <div style={{ width: `${width}%`, height: "100%", borderRadius: 3, display: "flex", alignItems: "center", padding: "0 8px", fontSize: 10, fontWeight: 800, color: "#08120e", background: EPC_HEX[band] ?? "rgba(148,163,184,0.4)", opacity: isNow || isPotential ? 1 : 0.5 }}>
                              {band}{isNow && epc.score !== null ? ` · ${epc.score}` : ""}
                            </div>
                            {(isNow || isPotential) && (
                              <span style={{ position: "absolute", right: 6, fontSize: 10, fontWeight: 800, color: "#08120e", background: "rgba(255,255,255,0.85)", padding: "1px 7px", borderRadius: 999 }}>
                                {isNow ? "Now" : `Potential${epc.potentialScore !== null ? ` ${epc.potentialScore}` : ""}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {data.postcode && (
                      <div style={{ marginTop: 10, textAlign: "right" }}>
                        <a href={`https://find-energy-certificate.service.gov.uk/find-a-certificate/search-by-postcode?postcode=${encodeURIComponent(data.postcode)}`} target="_blank" rel="noopener noreferrer" className="agent-link" style={{ fontSize: 11.5 }}>
                          Full certificate <LinkArrow />
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--agent-text-muted)", margin: 0 }}>
                    {data.epc.status === "error" ? "Couldn't reach the EPC register. Try again shortly." : data.epc.status === "none" ? "No certificate on record for this address." : "EPC data is currently unavailable."}
                  </p>
                )}
              </div>
            )}

            {tab === "hi" && (
              <div className="agent-reveal-in">
                {sales.length > 0 ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                      <span style={LBL}>Sold history</span>
                      {pricePerM2 && (
                        <span style={{ fontSize: 11, color: "var(--agent-text-muted)", fontVariantNumeric: "tabular-nums" }}>
                          {poundsFmt(pricePerM2)}/m²{growthPct !== null && firstPriced ? ` · ${growthPct >= 0 ? "+" : ""}${growthPct}% since ${yearOf(firstPriced.date)}` : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "grid", gap: 9 }}>
                      {sales.slice(0, 6).map((entry, i) => {
                        const newer = sales[sales.indexOf(entry) - 1];
                        const delta = entry.amount > 0 && newer?.amount > 0 ? Math.round(((newer.amount - entry.amount) / entry.amount) * 100) : null;
                        return (
                          <div key={i} className="agent-hover-row rounded-md px-1 -mx-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                            <div style={{ minWidth: 0 }}>
                              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>{entry.amount > 0 ? poundsFmt(entry.amount) : "Price withheld"}</span>
                              <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 8 }}>{fmtMonthYear(entry.date)}{i === 0 && entry.date ? ` · ${yearsAgo(entry.date)}` : ""}</span>
                            </div>
                            {delta !== null && newer && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{delta >= 0 ? "+" : ""}{delta}% → {yearOf(newer.date)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--agent-text-muted)", margin: 0 }}>
                    {data.sold.status === "error" ? "Couldn't reach Land Registry right now." : "No sales found for this address."}
                  </p>
                )}
              </div>
            )}

            {tab === "pl" && (
              <div className="agent-reveal-in">
                {data.planning.status === "ok" ? (
                  <>
                    <div style={{ display: "grid", gap: 8 }}>
                      <DesignationRow label="Conservation area" d={data.planning.conservationArea} />
                      <DesignationRow label="Article 4 direction" d={data.planning.article4} />
                      <DesignationRow label="Listed building" d={data.planning.listedBuilding} />
                    </div>
                    <p style={{ fontSize: 10.5, color: "var(--agent-text-muted)", lineHeight: 1.45, margin: "10px 0 0" }}>{data.planning.coverageNote}</p>
                  </>
                ) : (
                  <p className="text-xs italic" style={{ color: "var(--agent-text-muted)", margin: 0 }}>
                    {data.planning.status === "no-coords" ? "Couldn't locate this property precisely enough to check designations." : "Couldn't check planning designations right now."}
                  </p>
                )}
                <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {data.planningApplications.link && <SecondaryLink link={data.planningApplications.link} />}
                  <SecondaryLink link={data.flood.link} />
                </div>
              </div>
            )}
          </div>

          {/* ── Footer: sources + portal links (subtle) ──────────────────── */}
          <div style={{ borderTop: "0.5px solid var(--agent-border-default)", padding: "10px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>
              {data.sources.length ? `Sources: ${data.sources.map((s) => s.label).join(" · ")}` : "TSP surfaces this automatically. Always verify before relying on it."}
            </span>
            {data.links && (
              <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                <a href={data.links.rightmove} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--agent-text-secondary)", border: "0.5px solid var(--agent-border-default)" }}>Rightmove</a>
                <a href={data.links.zoopla} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--agent-text-secondary)", border: "0.5px solid var(--agent-border-default)" }}>Zoopla</a>
                <a href={data.links.landReg} target="_blank" rel="noopener noreferrer" className="text-[11px] px-2 py-0.5 rounded-md" style={{ color: "var(--agent-text-secondary)", border: "0.5px solid var(--agent-border-default)" }}>Title</a>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function Facts({ rows }: { rows: [string, string | null][] }) {
  const present = rows.filter(([, v]) => v);
  if (present.length === 0) return <p className="text-xs italic" style={{ color: "var(--agent-text-muted)", margin: 0 }}>Not available for this property.</p>;
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {present.map(([label, value]) => (
        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>{label}</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--agent-text-primary)", textAlign: "right" }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

function LinkRow({ label, link, note }: { label: string; link: SourceRef; note?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 8 }}>
      <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>{label}</span>
      {link.url ? (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="agent-link" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {note ? `Check ${note}` : link.label} <ArrowSquareOut size={12} weight="bold" />
        </a>
      ) : <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>—</span>}
    </div>
  );
}

function SecondaryLink({ link }: { link: SourceRef }) {
  return (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className="agent-link" style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      {link.label} <ArrowSquareOut size={12} weight="bold" />
    </a>
  );
}

function DesignationRow({ label, d }: { label: string; d: Designation }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>{label}</span>
      {d.found ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-coral-deep)", textAlign: "right", minWidth: 0 }}>Yes{d.grade ? ` · Grade ${d.grade}` : d.label ? ` · ${d.label}` : ""}</span>
      ) : (
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)", textAlign: "right" }}>None found in available data</span>
      )}
    </div>
  );
}

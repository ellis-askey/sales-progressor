"use client";

// Property information ("property passport") — the single home for external
// facts about the physical property on the Overview tab. Evolves the old EPC +
// sold-prices card: keeps everything it did, adds property basics, local
// authority, planning designations, Worth-knowing, and secondary official
// link-outs for the things we can't yet bring in natively (council tax, flood,
// nearby planning). Data comes from /api/property-intel → getPropertyEnrichment;
// every section degrades independently and never blocks the page.

import { useEffect, useState } from "react";
import { CaretDown, House, Lightning, ClockCounterClockwise, ShieldCheck, MapPin, Info, ArrowSquareOut } from "@phosphor-icons/react";
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

const LBL: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--agent-text-muted)" };

function EpcChip({ rating }: { rating: string }) {
  const hex = EPC_HEX[rating] ?? "rgba(148,163,184,0.5)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, background: hex, color: "#08120e", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
      {rating || "?"}
    </span>
  );
}

export function PropertyIntelCard({ transactionId }: { transactionId: string }) {
  const [data, setData] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

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

  const propType = epc?.propertyType ? tidy(epc.propertyType) : (last?.propertyType ? tidy(last.propertyType) : null);
  const floorArea = epc?.floorArea ? `${Math.round(epc.floorArea)} m²` : null;
  const localAuthority = data?.identity.localAuthority ?? null;
  const worth = data?.worthKnowing ?? [];

  return (
    // Design Lab: `overview-property-intel`. Default v05 (Heavy frost).
    <GlassCard glassId="overview-property-intel" label="Overview · Property information" defaultVariant="v05" className="overflow-hidden rounded-[12px]">
      <div className="agent-card-hdr">
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>Property information</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[data?.postcode, propType].filter(Boolean).join(" · ") || "What we know about this property"}
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading && <p className="text-sm text-center py-3" style={{ color: "var(--agent-text-muted)" }}>Fetching property information…</p>}
        {!loading && error && <p className="text-sm text-center py-3" style={{ color: "var(--agent-text-muted)" }}>Could not load property information.</p>}

        {!loading && !error && data && (
          <div className="agent-reveal-in">
            {/* ── Glance strip (always visible) ─────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              {epc && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <EpcChip rating={epc.rating} />
                  <span style={{ ...LBL, fontSize: 10 }}>EPC</span>
                </span>
              )}
              {last && (
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...LBL, fontSize: 10, display: "block" }}>Last sold</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                    {last.amount > 0 ? poundsFmt(last.amount) : "Price withheld"}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--agent-text-muted)", marginLeft: 6 }}>{yearOf(last.date)}</span>
                </span>
              )}
              {floorArea && (
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...LBL, fontSize: 10, display: "block" }}>Floor area</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>{floorArea}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="agent-link"
                style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0 }}
                aria-expanded={open}
              >
                {open ? "Hide details" : "View property details"}
                <CaretDown size={13} weight="bold" style={{ transition: "transform 200ms ease", transform: open ? "rotate(180deg)" : "none" }} />
              </button>
            </div>

            {/* ── Worth knowing (only when genuinely noteworthy) ────────────── */}
            {worth.length > 0 && (
              <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 10, background: "rgba(var(--agent-coral-rgb), 0.06)", border: "0.5px solid rgba(var(--agent-coral-rgb), 0.20)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: worth.length ? 6 : 0 }}>
                  <Info size={14} weight="fill" style={{ color: "var(--agent-coral-deep)" }} />
                  <span style={{ ...LBL, color: "var(--agent-coral-deep)" }}>Worth knowing</span>
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
                  {worth.map((w, i) => (
                    <li key={i} style={{ fontSize: 12.5, color: "var(--agent-text-secondary)", lineHeight: 1.45 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Expanded: the full passport ──────────────────────────────── */}
            <div className={`agent-acc${open ? " open" : ""}`} style={{ marginTop: open ? 4 : 0 }}>
              <div className="agent-acc-in">
                <div style={{ paddingTop: 14 }}>

                  {/* Property */}
                  <Section icon={<House size={15} weight="regular" />} title="Property">
                    <Facts rows={[
                      ["Type", propType],
                      ["Floor area", floorArea],
                      ["Local authority", localAuthority],
                    ]} />
                    <LinkRow label="Council tax" link={data.councilTax.link} note="band" />
                  </Section>

                  {/* Energy */}
                  <Section icon={<Lightning size={15} weight="regular" />} title="Energy" meta={epc?.inspectionDate ? `Certified ${fmtMonthYear(epc.inspectionDate)}${epc.validUntil ? ` · valid to ${yearOf(epc.validUntil)}` : ""}` : undefined}>
                    {epc ? (
                      <>
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
                          <div style={{ marginTop: 9, textAlign: "right" }}>
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
                  </Section>

                  {/* Sold history */}
                  {sales.length > 0 && (
                    <Section icon={<ClockCounterClockwise size={15} weight="regular" />} title="Sold history"
                      meta={pricePerM2 ? `${poundsFmt(pricePerM2)}/m²${growthPct !== null && firstPriced ? ` · ${growthPct >= 0 ? "+" : ""}${growthPct}% since ${yearOf(firstPriced.date)}` : ""}` : undefined}>
                      <div style={{ display: "grid", gap: 9 }}>
                        {sales.slice(0, 5).map((entry, i) => {
                          const newer = sales[sales.indexOf(entry) - 1];
                          const delta = entry.amount > 0 && newer?.amount > 0 ? Math.round(((newer.amount - entry.amount) / entry.amount) * 100) : null;
                          return (
                            <div key={i} className="agent-hover-row rounded-md px-1 -mx-1" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--agent-text-primary)", fontVariantNumeric: "tabular-nums" }}>
                                  {entry.amount > 0 ? poundsFmt(entry.amount) : "Price withheld"}
                                </span>
                                <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginLeft: 8 }}>{fmtMonthYear(entry.date)}{i === 0 && entry.date ? ` · ${yearsAgo(entry.date)}` : ""}</span>
                              </div>
                              {delta !== null && newer && (
                                <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{delta >= 0 ? "+" : ""}{delta}% → {yearOf(newer.date)}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  )}

                  {/* Planning & designations */}
                  <Section icon={<ShieldCheck size={15} weight="regular" />} title="Planning &amp; designations">
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
                    {data.planningApplications.link && (
                      <div style={{ marginTop: 10 }}>
                        <SecondaryLink link={data.planningApplications.link} />
                      </div>
                    )}
                  </Section>

                  {/* Environment */}
                  <Section icon={<MapPin size={15} weight="regular" />} title="Environment">
                    <SecondaryLink link={data.flood.link} sub="We link to the official check rather than show a risk band." />
                  </Section>

                  {/* Sources + portal links */}
                  <div style={{ borderTop: "0.5px solid var(--agent-border-default)", marginTop: 14, paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10.5, color: "var(--agent-text-muted)" }}>
                      {data.sources.length ? `Sources: ${data.sources.map((s) => s.label).join(" · ")}` : "TSP surfaces this automatically — always verify before relying on it."}
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
              </div>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function Section({ icon, title, meta, children }: { icon: React.ReactNode; title: React.ReactNode; meta?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 9 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <span style={{ color: "var(--agent-text-muted)", display: "inline-flex" }}>{icon}</span>
          <span style={LBL}>{title}</span>
        </span>
        {meta && <span style={{ fontSize: 11, color: "var(--agent-text-muted)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function Facts({ rows }: { rows: [string, string | null][] }) {
  const present = rows.filter(([, v]) => v);
  if (present.length === 0) return <p className="text-xs italic" style={{ color: "var(--agent-text-muted)", margin: 0 }}>Not available for this property.</p>;
  return (
    <div style={{ display: "grid", gap: 7 }}>
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 7 }}>
      <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>{label}</span>
      {link.url ? (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="agent-link" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
          {note ? `Check ${note}` : link.label} <ArrowSquareOut size={12} weight="bold" />
        </a>
      ) : <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>—</span>}
    </div>
  );
}

function SecondaryLink({ link, sub }: { link: SourceRef; sub?: string }) {
  return (
    <div>
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="agent-link" style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
        {link.label} <ArrowSquareOut size={12} weight="bold" />
      </a>
      {sub && <p style={{ fontSize: 10.5, color: "var(--agent-text-muted)", margin: "3px 0 0", lineHeight: 1.4 }}>{sub}</p>}
    </div>
  );
}

function DesignationRow({ label, d }: { label: string; d: Designation }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ fontSize: 12.5, color: "var(--agent-text-muted)" }}>{label}</span>
      {d.found ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-coral-deep)", textAlign: "right", minWidth: 0 }}>
          Yes{d.grade ? ` · Grade ${d.grade}` : d.label ? ` · ${d.label}` : ""}
        </span>
      ) : (
        <span style={{ fontSize: 11.5, color: "var(--agent-text-muted)", textAlign: "right" }}>None found in available data</span>
      )}
    </div>
  );
}

"use client";

// All Files → Map view (Phases 1–4). Orchestrates:
//   • data — turns the book into map files (status + postcode + date), groups
//     into postcode-district "patches" (lib/services/map-data.ts).
//   • geocoding — postcode → centroid via postcodes.io, client-side + cached
//     (lib/geo/geocode.ts). Patch bubbles sit at the mean of their members'
//     centroids; each sale pins at its postcode centroid (jittered so duplicates
//     don't stack).
//   • market share — fetches Land Registry registered-sale counts per outcode
//     from /api/area-sales, so a patch can show "you did N of M" (Phase 3).
//   • the map — the MapLibre canvas, loaded client-only via next/dynamic.
//   • Street View — a pin opens the property in Google Street View when a key
//     is configured (Phase 4); otherwise that control is simply absent.

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { fileFeePence, type PipelineRow } from "../PipelineBoard";
import { gbpCompact } from "../money";
import { toMapFile, groupByOutcode } from "@/lib/services/map-data";
import { geocodePostcodes, type LatLng } from "@/lib/geo/geocode";
import type { MapPatch, MapSale } from "./PropertyMap";

const PropertyMap = dynamic(() => import("./PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
  loading: () => <div className="map-loading">Loading map…</div>,
});

type Shade = "sales" | "value" | "share" | "gaps";
type StatusFilter = "both" | "agreed" | "completed";

const MONTH_MS = 30.44 * 24 * 60 * 60 * 1000;

// Deterministic ±~90m jitter so sales sharing a postcode don't stack exactly.
function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = (Math.abs(h) % 1000) / 1000;
  const b = (Math.abs(h >> 10) % 1000) / 1000;
  return [(a - 0.5) * 0.0016, (b - 0.5) * 0.0016];
}

export function MapView({
  rows,
  basePath,
  streetViewKey = null,
}: {
  rows: PipelineRow[];
  basePath: string;
  streetViewKey?: string | null;
}) {
  const { theme } = usePortalTheme();
  const mapTheme = theme === "dark" ? "dark" : "light";

  const [shade, setShade] = useState<Shade>("sales");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("both");
  const [months, setMonths] = useState<number | null>(12); // null = all time
  const [mode, setMode] = useState<"heat" | "pins">("heat");
  const [selected, setSelected] = useState<string | null>(null);
  const [geo, setGeo] = useState<Record<string, LatLng>>({});
  const [market, setMarket] = useState<Record<string, number | null>>({});
  const [selectedSale, setSelectedSale] = useState<{ id: string; address: string; lat: number; lng: number } | null>(null);

  // Raw file rows → map files (all statuses; withdrawn is filtered later).
  const mapFiles = useMemo(
    () =>
      rows.map((r) =>
        toMapFile({
          id: r.id,
          propertyAddress: r.propertyAddress,
          status: r.status,
          feePence: fileFeePence(r),
          completionDate: r.completionDate ?? null,
          expectedExchangeDate: r.expectedExchangeDate,
          createdAt: r.createdAt,
        }),
      ),
    [rows],
  );

  // Geocode every postcode we see, once (cached in localStorage thereafter).
  useEffect(() => {
    const pcs = Array.from(new Set(mapFiles.map((f) => f.postcode).filter((p): p is string => !!p)));
    if (!pcs.length) return;
    let cancelled = false;
    geocodePostcodes(pcs).then((g) => { if (!cancelled) setGeo(g); });
    return () => { cancelled = true; };
  }, [mapFiles]);

  // Status + time filter.
  const filtered = useMemo(() => {
    const cutoff = months != null ? Date.now() - months * MONTH_MS : null;
    return mapFiles.filter((f) => {
      if (f.status === "withdrawn") return false;
      if (statusFilter === "agreed" && f.status !== "agreed") return false;
      if (statusFilter === "completed" && f.status !== "completed") return false;
      if (cutoff != null && f.dateMs != null && f.dateMs < cutoff) return false;
      return true;
    });
  }, [mapFiles, statusFilter, months]);

  const patches = useMemo(() => groupByOutcode(filtered), [filtered]);
  const outcodeKey = patches.map((p) => p.outcode).join(",");

  // Your completed sales per district over the period — the share numerator.
  // Kept independent of the Agreed/Completed toggle: market share is inherently
  // "your completed vs the market's completed", so it shouldn't drop to 0 just
  // because you're looking at the Agreed lens.
  const completedByOutcode = useMemo(() => {
    const cutoff = months != null ? Date.now() - months * MONTH_MS : null;
    const m: Record<string, number> = {};
    for (const f of mapFiles) {
      if (f.status !== "completed" || !f.outcode) continue;
      if (cutoff != null && f.dateMs != null && f.dateMs < cutoff) continue;
      m[f.outcode] = (m[f.outcode] ?? 0) + 1;
    }
    return m;
  }, [mapFiles, months]);

  // Land Registry market size for the visible outcodes (top 20). Fills the
  // share bars; failures degrade to "no market data" (null).
  useEffect(() => {
    const top = patches.slice(0, 20).map((p) => p.outcode);
    if (!top.length) { setMarket({}); return; }
    let cancelled = false;
    fetch(`/api/area-sales?outcodes=${encodeURIComponent(top.join(","))}&months=${months ?? 12}`)
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setMarket(j.sales ?? {}); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcodeKey, months]);

  // Patches enriched with a centroid (mean of members' geocodes) + share.
  const placedPatches = useMemo(() => {
    const out: (MapPatch & { agreedCount: number; completedCount: number })[] = [];
    for (const p of patches) {
      const pts = p.files.map((f) => (f.postcode ? geo[f.postcode] : undefined)).filter((v): v is LatLng => !!v);
      if (!pts.length) continue;
      const lat = pts.reduce((s, v) => s + v.lat, 0) / pts.length;
      const lng = pts.reduce((s, v) => s + v.lng, 0) / pts.length;
      const marketSold = market[p.outcode] ?? null;
      const yourCompleted = completedByOutcode[p.outcode] ?? 0;
      const sharePct = marketSold && marketSold > 0 ? Math.min(100, (yourCompleted / marketSold) * 100) : null;
      out.push({
        outcode: p.outcode, label: p.label, lat, lng, total: p.total, intensity: 0,
        agreed: p.agreed, completed: p.completed, feePence: p.feePence, sharePct,
        agreedCount: p.agreed, completedCount: p.completed,
      });
    }
    // Intensity on the chosen metric, normalised across placed patches.
    //  • sales  — how many you've done here
    //  • value  — fees riding on the patch
    //  • share  — your % of the district's registered market
    //  • gaps   — targeting: busy market × low share (where the instructions
    //    you're missing actually are). Needs market data; 0 until it loads.
    const metric = (p: MapPatch): number => {
      if (shade === "value") return p.feePence;
      if (shade === "share") return p.sharePct ?? 0;
      if (shade === "gaps") {
        const ms = market[p.outcode];
        return ms && ms > 0 ? ms * (1 - (p.sharePct ?? 0) / 100) : 0;
      }
      return p.total;
    };
    const max = Math.max(1, ...out.map(metric));
    for (const p of out) p.intensity = metric(p) / max;
    return out;
  }, [patches, geo, market, shade, completedByOutcode]);

  // Individual sale pins (Phase 2), jittered off their postcode centroid.
  const sales = useMemo<MapSale[]>(() => {
    const out: MapSale[] = [];
    for (const f of filtered) {
      if (!f.postcode) continue;
      const c = geo[f.postcode];
      if (!c) continue;
      const [dLat, dLng] = jitter(f.id);
      out.push({ id: f.id, address: f.address, lat: c.lat + dLat, lng: c.lng + dLng, status: f.status });
    }
    return out;
  }, [filtered, geo]);

  const saleById = useRef(new Map<string, MapSale>());
  saleById.current = new Map(sales.map((s) => [s.id, s]));

  // Leaderboard is the placed patches with their market share, sorted by total.
  const board = useMemo(() => {
    const byOutcode = new Map(placedPatches.map((p) => [p.outcode, p]));
    return patches
      .map((p) => ({ patch: p, placed: byOutcode.get(p.outcode) }))
      .sort((a, b) => b.patch.total - a.patch.total);
  }, [patches, placedPatches]);

  const totalSales = patches.reduce((s, p) => s + p.total, 0);
  const geocodedCount = new Set(sales.map((s) => s.id)).size;

  function onSelectSale(id: string) {
    const s = saleById.current.get(id);
    if (s) setSelectedSale({ id: s.id, address: s.address, lat: s.lat, lng: s.lng });
  }

  return (
    <div className="mapview">
      <div className="map-toolbar">
        <Seg label="View" value={mode} onChange={setMode} opts={[["heat", "Heat"], ["pins", "Pins"]]} />
        {mode === "heat" ? (
          <Seg label="Shade by" value={shade} onChange={setShade} opts={[["sales", "Sales"], ["value", "Value"], ["share", "Share"], ["gaps", "Gaps"]]} />
        ) : (
          <div className="map-seg">
            <span className="map-seg-l">Pins</span>
            <span className="map-legend2"><span className="d agreed" />Agreed<span className="d completed" />Completed</span>
          </div>
        )}
        <Seg label="Status" value={statusFilter} onChange={setStatusFilter} opts={[["both", "Both"], ["agreed", "Agreed"], ["completed", "Completed"]]} />
        <Seg label="Period" value={months} onChange={setMonths} opts={[[12, "12m"], [24, "24m"], [null, "All"]]} />
        <span className="map-count">{totalSales} sales · {patches.length} patches</span>
      </div>

      <div className="map-split">
        <div className="map-canvas">
          {placedPatches.length > 0 ? (
            <PropertyMap
              theme={mapTheme}
              mode={mode}
              patches={placedPatches}
              sales={sales}
              selectedOutcode={selected}
              onSelectOutcode={(o) => setSelected(o)}
              onSelectSale={onSelectSale}
            />
          ) : (
            <div className="map-loading">
              {mapFiles.some((f) => f.postcode) ? "Placing your sales on the map…" : "No postcodes to plot yet."}
            </div>
          )}
          {geocodedCount < filtered.length && placedPatches.length > 0 && (
            <div className="map-note">Plotting {geocodedCount} of {filtered.length} — the rest are geocoding.</div>
          )}
        </div>

        <div className="map-panel">
          <h3 className="map-panel-t">Your patches</h3>
          <p className="map-panel-s">Ranked by sales. Bar = your share of that district&rsquo;s registered market.</p>
          <div className="map-board">
            {board.map(({ patch: p, placed }, i) => (
              <button
                key={p.outcode}
                type="button"
                className={`map-lead${selected === p.outcode ? " on" : ""}`}
                onClick={() => setSelected(selected === p.outcode ? null : p.outcode)}
              >
                <span className="map-rk">{i + 1}</span>
                <span className="map-pc">
                  {p.label}
                  <small>{p.agreed} agreed · {p.completed} completed · {gbpCompact(p.feePence)} fees</small>
                </span>
                <span className="map-share">
                  {placed?.sharePct != null ? (
                    <>
                      <span className="map-sb"><i style={{ width: `${placed.sharePct}%` }} /></span>
                      <span className="map-pct">{placed.sharePct.toFixed(placed.sharePct < 10 ? 1 : 0)}%</span>
                    </>
                  ) : (
                    <span className="map-pct map-pct-muted">—</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <p className="map-attr">Market data: HM Land Registry (registered sales). Geocoding: postcodes.io.</p>
        </div>
      </div>

      {selectedSale && (
        <div className="map-modal-scrim" onClick={() => setSelectedSale(null)}>
          <div className="map-modal" onClick={(e) => e.stopPropagation()}>
            <div className="map-modal-head">
              <span className="map-modal-addr">{selectedSale.address}</span>
              <button type="button" className="map-modal-x" onClick={() => setSelectedSale(null)} aria-label="Close">✕</button>
            </div>
            {streetViewKey ? (
              <iframe
                className="map-sv"
                title="Street View"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://www.google.com/maps/embed/v1/streetview?key=${streetViewKey}&location=${selectedSale.lat},${selectedSale.lng}&fov=80`}
              />
            ) : (
              <div className="map-sv-off">Street View turns on once a Google Maps key is configured.</div>
            )}
            <Link href={`${basePath}/${selectedSale.id}`} className="map-modal-cta">Open file</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// Small segmented control used across the toolbar.
function Seg<T extends string | number | null>({ label, value, onChange, opts }: {
  label: string; value: T; onChange: (v: T) => void; opts: [T, string][];
}) {
  return (
    <div className="map-seg">
      <span className="map-seg-l">{label}</span>
      <div className="map-seg-g">
        {opts.map(([v, lbl]) => (
          <button key={String(v)} type="button" className={`map-seg-b${value === v ? " on" : ""}`} onClick={() => onChange(v)}>{lbl}</button>
        ))}
      </div>
    </div>
  );
}

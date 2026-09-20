"use client";

// Chain → Map view canvas. A MapLibre map (client-only; WebGL, loaded via
// next/dynamic({ssr:false}) from ChainDrawer) that plots every chain property as
// a numbered pin in real chain order and draws the household moves between them,
// branches included. Overlays: a summary strip, a legend, a floating property
// card on pin-select, and a move card on line-click. Reuses the free My Files
// stack (MapLibre + Carto keyless tiles, postcodes.io geocoding, localStorage
// cache). Distances here are straight-line (haversine); Phase 2 swaps in real
// driving routes + times from OpenRouteService.

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
import { House, ShareNetwork, MapPin, Clock } from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { geocodePostcodes, type LatLng } from "@/lib/geo/geocode";
import { extractPostcode } from "@/lib/geo/postcode";
import {
  CHAIN_STATUS_COLOR, CHAIN_STATUS_LABEL,
  type ChainMapNode, type ChainMapMove, type ChainMapDetail, type ChainMapStatus,
} from "@/components/chain/chain-map-shared";

const STYLE = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

const LEGEND: { status: ChainMapStatus; label: string }[] = [
  { status: "yours", label: CHAIN_STATUS_LABEL.yours },
  { status: "claimed", label: CHAIN_STATUS_LABEL.claimed },
  { status: "invited", label: CHAIN_STATUS_LABEL.invited },
  { status: "unclaimed", label: CHAIN_STATUS_LABEL.unclaimed },
];

function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = (Math.abs(h) % 1000) / 1000;
  const b = (Math.abs(h >> 10) % 1000) / 1000;
  return [(a - 0.5) * 0.0013, (b - 0.5) * 0.0013];
}

function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180, la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const miEl = (mi: number) => `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`;

// The household move a selected property represents: the household living here is
// buying the sale directly above (its onward), so prefer the outgoing move
// (fromId === selected). If there's none (top of the chain), fall back to the
// incoming move (someone buying this property). Prefer the non-fork spine leg so
// a sale with several onward purchases resolves to its main move, never an
// invented one. Returns null when the chain establishes no move for this sale.
function deriveMove(sel: string | null, moves: ChainMapMove[]): { fromId: string; toId: string } | null {
  if (!sel) return null;
  const out = moves.find((m) => m.fromId === sel && !m.fork) ?? moves.find((m) => m.fromId === sel);
  if (out) return { fromId: sel, toId: out.toId };
  const inc = moves.find((m) => m.toId === sel && !m.fork) ?? moves.find((m) => m.toId === sel);
  if (inc) return { fromId: inc.fromId, toId: sel };
  return null;
}

export function ChainGeoMap({
  nodes,
  moves,
  details,
  selectedId,
  onSelectNode,
  theme,
}: {
  nodes: ChainMapNode[];
  moves: ChainMapMove[];
  details: Record<string, ChainMapDetail>;
  selectedId: string | null;
  onSelectNode: (id: string | null) => void;
  theme: "light" | "dark";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const loadedRef = useRef(false);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;
  const movesRef = useRef(moves);
  movesRef.current = moves;

  const [coords, setCoords] = useState<Record<string, LatLng>>({});
  const coordsRef = useRef(coords);
  coordsRef.current = coords;
  const [, setTick] = useState(0); // bump on map move so projected overlays follow
  // Tiny "18.4 mi · 31 min" label that follows the cursor while hovering a route.
  const [hoverTip, setHoverTip] = useState<{ x: number; y: number; label: string } | null>(null);
  // The move currently lit up on the map (derived from the selected property).
  // Kept in a ref so moveFC — rebuilt inside map callbacks — can read it without
  // re-installing layers.
  const activeMoveRef = useRef<{ fromId: string; toId: string } | null>(null);

  // Driving routes (Phase 2): distance/time + road polyline per postcode pair,
  // from /api/chain/routes (ORS-backed, cached). Missing ones fall back to a
  // straight line + haversine distance.
  type RouteResult = { distanceMeters: number; durationSeconds: number; geometry: number[][]; viaRoads?: string[] };
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const nodePc = useMemo(() => {
    const m: Record<string, string> = {};
    for (const n of nodes) { const pc = extractPostcode(n.address); if (pc) m[n.id] = pc; }
    return m;
  }, [nodes]);
  const nodePcRef = useRef(nodePc);
  nodePcRef.current = nodePc;
  const rk = (a: string, b: string) => `${a}__${b}`;
  const routeFor = (fromId: string, toId: string): RouteResult | null => {
    const f = nodePc[fromId], t = nodePc[toId];
    return f && t ? routes[rk(f, t)] ?? null : null;
  };
  const routeForRef = (fromId: string, toId: string): RouteResult | null => {
    const f = nodePcRef.current[fromId], t = nodePcRef.current[toId];
    return f && t ? routesRef.current[rk(f, t)] ?? null : null;
  };
  const M_PER_MI = 1609.34;
  const fmtDur = (s: number) => { const min = Math.round(s / 60); return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${min % 60}m`; };

  // Ask the server for driving routes once we know each move's postcodes.
  useEffect(() => {
    const legs = moves
      .map((m) => ({ fromPostcode: nodePc[m.fromId], toPostcode: nodePc[m.toId] }))
      .filter((l) => l.fromPostcode && l.toPostcode && l.fromPostcode !== l.toPostcode);
    if (legs.length === 0) return;
    let cancelled = false;
    fetch("/api/chain/routes", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legs }),
    })
      .then((r) => (r.ok ? r.json() : { routes: {} }))
      .then((j) => { if (!cancelled) setRoutes(j.routes ?? {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [moves, nodePc]);

  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // ── geocode every node's postcode → per-node coordinate (jittered) ──
  useEffect(() => {
    let cancelled = false;
    const byNode: { id: string; pc: string }[] = [];
    for (const n of nodes) {
      const pc = extractPostcode(n.address);
      if (pc) byNode.push({ id: n.id, pc });
    }
    if (byNode.length === 0) { setCoords({}); return; }
    geocodePostcodes(byNode.map((b) => b.pc)).then((geo) => {
      if (cancelled) return;
      const out: Record<string, LatLng> = {};
      for (const b of byNode) {
        const c = geo[b.pc];
        if (!c) continue;
        const [dLat, dLng] = jitter(b.id);
        out[b.id] = { lat: c.lat + dLat, lng: c.lng + dLng };
      }
      setCoords(out);
    });
    return () => { cancelled = true; };
  }, [nodes]);

  function moveFC(): GeoJSON.FeatureCollection {
    const active = activeMoveRef.current;
    return {
      type: "FeatureCollection",
      features: movesRef.current.flatMap((m) => {
        const a = coordsRef.current[m.fromId], b = coordsRef.current[m.toId];
        if (!a || !b) return [];
        const r = routeForRef(m.fromId, m.toId);
        const line = r && r.geometry.length > 1 ? r.geometry : [[a.lng, a.lat], [b.lng, b.lat]];
        // No selection → every route at its normal weight. A selection lights up
        // the one household move and fades the rest (kept visible, not hidden).
        const state = !active ? "normal"
          : active.fromId === m.fromId && active.toId === m.toId ? "active"
            : "faded";
        return [{
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: line },
          properties: { broken: !!m.broken, fromId: m.fromId, toId: m.toId, state },
        }];
      }),
    };
  }

  function installLine(map: maplibregl.Map) {
    if (!map.getSource("chain-moves")) {
      map.addSource("chain-moves", { type: "geojson", data: moveFC() });
    }
    // Width / opacity are data-driven on the feature "state" so selecting a
    // property makes its move prominent and fades the others, with no layer churn.
    // line-sort-key lifts the active line above the faded ones.
    const width = ["match", ["get", "state"], "active", 4.5, "faded", 2, 2.5] as unknown as maplibregl.ExpressionSpecification;
    const opacity = ["match", ["get", "state"], "active", 0.95, "faded", 0.16, 0.55] as unknown as maplibregl.ExpressionSpecification;
    const sortKey = ["match", ["get", "state"], "active", 2, 1] as unknown as maplibregl.ExpressionSpecification;
    if (!map.getLayer("chain-move-line")) {
      map.addLayer({
        id: "chain-move-line", type: "line", source: "chain-moves",
        filter: ["!", ["to-boolean", ["get", "broken"]]],
        layout: { "line-cap": "round", "line-join": "round", "line-sort-key": sortKey },
        paint: { "line-color": "#FF6B4A", "line-width": width, "line-opacity": opacity },
      });
    }
    if (!map.getLayer("chain-move-broken")) {
      map.addLayer({
        id: "chain-move-broken", type: "line", source: "chain-moves",
        filter: ["to-boolean", ["get", "broken"]],
        layout: { "line-cap": "round", "line-join": "round", "line-sort-key": sortKey },
        paint: {
          "line-color": "#94A3B8",
          "line-width": ["match", ["get", "state"], "active", 3.5, "faded", 1.6, 2] as unknown as maplibregl.ExpressionSpecification,
          "line-opacity": ["match", ["get", "state"], "active", 0.9, "faded", 0.2, 0.6] as unknown as maplibregl.ExpressionSpecification,
          "line-dasharray": [1.6, 1.4],
        },
      });
    }
  }

  // ── init the map once ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container, style: STYLE[theme], center: [-1.5, 52.4], zoom: 6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => { loadedRef.current = true; installLine(map); syncMarkers(); map.resize(); });
    map.on("styledata", () => { if (map.isStyleLoaded()) installLine(map); });

    const bump = () => setTick((t) => t + 1);
    map.on("move", bump); map.on("zoom", bump); map.on("resize", bump);

    // Click a move line → select the household making that move (its origin), so
    // the same journey popup opens and the route lights up. Click empty map → clear.
    const onLineClick = (e: maplibregl.MapLayerMouseEvent) => {
      const fromId = e.features?.[0]?.properties?.fromId as string | undefined;
      if (fromId) onSelectRef.current(fromId);
    };
    map.on("click", "chain-move-line", onLineClick);
    map.on("click", "chain-move-broken", onLineClick);
    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ["chain-move-line", "chain-move-broken"] });
      if (hit.length === 0) onSelectRef.current(null);
    });
    // Hover a route → a small label tracks the cursor with the real drive figures
    // (or straight-line when there's no route). Same data the click popup shows.
    const onLineMove = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const fromId = f?.properties?.fromId as string | undefined;
      const toId = f?.properties?.toId as string | undefined;
      if (!fromId || !toId) return;
      const r = routeForRef(fromId, toId);
      let label = "";
      if (r) label = `${miEl(r.distanceMeters / M_PER_MI)} · ${fmtDur(r.durationSeconds)}`;
      else {
        const a = coordsRef.current[fromId], b = coordsRef.current[toId];
        if (a && b) label = `${miEl(haversineMiles(a, b))} · straight-line`;
      }
      if (label) setHoverTip({ x: e.point.x, y: e.point.y, label });
    };
    for (const id of ["chain-move-line", "chain-move-broken"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mousemove", id, onLineMove);
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; setHoverTip(null); });
    }

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    const nudges = [80, 260, 480].map((ms) => window.setTimeout(() => map.resize(), ms));
    return () => {
      nudges.forEach(clearTimeout);
      ro.disconnect(); map.remove();
      mapRef.current = null; loadedRef.current = false; markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setStyle(STYLE[theme]);
  }, [theme]);

  // Pan to a freshly-selected pin so its card is comfortably in view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const c = coords[selectedId];
    if (c) map.easeTo({ center: [c.lng, c.lat], duration: reduceMotion ? 0 : 450 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function syncMarkers() {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const seen = new Set<string>();
    for (const n of nodes) {
      const c = coords[n.id];
      if (!c) continue;
      seen.add(n.id);
      let m = markersRef.current.get(n.id);
      if (!m) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "chn-pin";
        el.addEventListener("click", (e) => { e.stopPropagation(); onSelectRef.current(n.id); });
        m = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([c.lng, c.lat]).addTo(map);
        markersRef.current.set(n.id, m);
      } else {
        m.setLngLat([c.lng, c.lat]);
      }
      const el = m.getElement();
      el.style.setProperty("--pin", CHAIN_STATUS_COLOR[n.status]);
      el.textContent = n.label;
      el.classList.toggle("onward", !!n.onward);
      el.classList.toggle("on", n.id === selectedId);
      // The other end of the lit-up move — keep it clearly visible so the journey
      // reads as a pair, not a single pin.
      el.classList.toggle("dest", activeMoveRef.current?.toId === n.id && n.id !== selectedId);
    }
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) { m.remove(); markersRef.current.delete(id); }
    }
    (map.getSource("chain-moves") as maplibregl.GeoJSONSource | undefined)?.setData(moveFC());
    if (!fittedRef.current) {
      const pts = nodes.map((n) => coords[n.id]).filter(Boolean) as LatLng[];
      if (pts.length > 0) {
        const b = new maplibregl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]);
        for (const p of pts) b.extend([p.lng, p.lat]);
        map.fitBounds(b, { padding: { top: 70, bottom: 70, left: 70, right: 70 }, maxZoom: 13, duration: reduceMotion ? 0 : 500 });
        fittedRef.current = true;
      }
    }
  }
  useEffect(() => { syncMarkers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [coords, nodes, selectedId]);

  // Routes arrived → redraw the lines along the actual roads.
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) (map.getSource("chain-moves") as maplibregl.GeoJSONSource | undefined)?.setData(moveFC());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes]);

  // ── overlay geometry (projected each render via the tick) ──
  const map = mapRef.current;
  const project = (c: LatLng) => map!.project([c.lng, c.lat]);

  const geoMoves = moves
    .map((m) => {
      const a = coords[m.fromId], b = coords[m.toId];
      if (!a || !b) return null;
      const r = routeFor(m.fromId, m.toId);
      return { m, a, b, r, miles: r ? r.distanceMeters / M_PER_MI : haversineMiles(a, b) };
    })
    .filter((x): x is { m: ChainMapMove; a: LatLng; b: LatLng; r: RouteResult | null; miles: number } => !!x);
  const totalMiles = geoMoves.reduce((s, x) => s + x.miles, 0);
  const totalDriveSeconds = geoMoves.reduce((s, x) => s + (x.r?.durationSeconds ?? 0), 0);
  const longest = geoMoves.reduce<(typeof geoMoves)[number] | null>((mx, x) => (!mx || x.miles > mx.miles ? x : mx), null);
  const allDriving = geoMoves.length > 0 && geoMoves.every((x) => x.r);
  const anyDriving = geoMoves.some((x) => x.r);

  const selCoord = selectedId ? coords[selectedId] : null;
  const selDetail = selectedId ? details[selectedId] : null;
  const selPt = map && selCoord ? project(selCoord) : null;

  // The household move this selected property represents — the popup content and
  // the lit-up route both come from here. activeMoveRef feeds moveFC (map paint).
  const active = deriveMove(selectedId, moves);
  activeMoveRef.current = active;
  const fromD = active ? details[active.fromId] : null;
  const toD = active ? details[active.toId] : null;
  const jRoute = active ? routeFor(active.fromId, active.toId) : null;
  const jFrom = active ? coords[active.fromId] : null;
  const jTo = active ? coords[active.toId] : null;
  const jMi = jFrom && jTo ? haversineMiles(jFrom, jTo) : null;
  // "X of N in chain" — only for a numbered spine property (branch labels are "↑").
  const posLabel = selDetail && /^\d+$/.test(selDetail.label) ? `${selDetail.label} of ${nodes.length} in chain` : null;

  return (
    <div className="chn-map-wrap">
      <div ref={containerRef} className="chn-map-canvas" />

      {/* Cursor-following route label */}
      {hoverTip && <div className="chn-tip" style={{ left: hoverTip.x, top: hoverTip.y }}>{hoverTip.label}</div>}

      {/* Summary bar — metric cards + a contextual focus panel (the longest move
          by default; the selected property's place in the chain once one is
          picked). Position lives here now, so the map popup stays lean. */}
      <div className="chn-summary">
        <div className="chn-metric">
          <span className="chn-metric-ic"><House size={20} weight="regular" /></span>
          <span><b>{nodes.length}</b><span>{nodes.length === 1 ? "property" : "properties"}</span></span>
        </div>
        <div className="chn-metric">
          <span className="chn-metric-ic"><ShareNetwork size={20} weight="regular" /></span>
          <span><b>{moves.length}</b><span>{moves.length === 1 ? "move" : "moves"}</span></span>
        </div>
        {geoMoves.length > 0 && (
          <div className="chn-metric">
            <span className="chn-metric-ic"><MapPin size={20} weight="regular" /></span>
            <span><b>{allDriving ? "" : "~"}{Math.round(totalMiles)}</b><span>miles total</span></span>
          </div>
        )}
        {anyDriving && totalDriveSeconds > 0 && (
          <div className="chn-metric">
            <span className="chn-metric-ic"><Clock size={20} weight="regular" /></span>
            <span><b>{allDriving ? "" : "~"}{fmtDur(totalDriveSeconds)}</b><span>total drive time</span></span>
          </div>
        )}
        <div className="chn-focus">
          {selectedId && selDetail ? (
            <>
              <span className="chn-focus-txt">
                <span className="chn-focus-label">{posLabel ?? "Onward purchase"}</span>
                <span className="chn-focus-sub">{selDetail.line1}</span>
              </span>
              <button type="button" className="chn-focus-x" aria-label="Clear selection" onClick={() => onSelectNode(null)}>×</button>
            </>
          ) : longest ? (
            <button type="button" className="chn-focus-long" onClick={() => onSelectNode(longest.m.fromId)}>
              <span className="chn-focus-label">Longest move</span>
              <span className="chn-focus-val">{allDriving ? "" : "~"}{miEl(longest.miles)}{longest.r ? ` · ${fmtDur(longest.r.durationSeconds)}` : ""}</span>
              <span className="chn-focus-sub">{details[longest.m.fromId]?.line1} → {details[longest.m.toId]?.line1}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      <div className="chn-legend">
        {LEGEND.map((l) => (
          <span key={l.status} className="chn-leg-item">
            <span className="chn-leg-dot" style={{ background: CHAIN_STATUS_COLOR[l.status] }} />{l.label}
          </span>
        ))}
      </div>

      {/* Selection popup. When the selected property represents a household move
          (it has an onward, or an incoming move at the top), the card becomes a
          compact journey label: where they're moving + real drive distance/time +
          position. Otherwise the simple property card is retained. */}
      {selPt && selDetail && (
        active && fromD && toD ? (
          <div
            className="chn-card chn-journey"
            style={{ left: selPt.x, top: selPt.y, transform: `translate(-50%, ${selPt.y < 180 ? "22px" : "calc(-100% - 20px)"})` }}
          >
            <button type="button" className="chn-journey-x" aria-label="Close" onClick={() => onSelectNode(null)}>×</button>
            <div className="chn-card-in">
              <PropertyThumb photoUrl={selDetail.photoUrl} size={44} />
              <div className="chn-card-txt">
                <span className="chn-journey-route">
                  <span className="chn-journey-from">{fromD.line1}</span>
                  <span className="chn-journey-arrow" aria-hidden>→</span>
                  <button type="button" className="chn-journey-to" onClick={() => onSelectNode(active.toId)}>{toD.line1}</button>
                </span>
                {jRoute
                  ? <span className="chn-journey-dist">🚗 {miEl(jRoute.distanceMeters / M_PER_MI)} · {fmtDur(jRoute.durationSeconds)}</span>
                  : jMi != null && <span className="chn-journey-dist">{miEl(jMi)} · straight-line</span>}
                {jRoute?.viaRoads && jRoute.viaRoads.length > 0 && (
                  <span className="chn-journey-via">Via {jRoute.viaRoads.join(", ")}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="chn-card"
            style={{ left: selPt.x, top: selPt.y, transform: `translate(-50%, ${selPt.y < 180 ? "22px" : "calc(-100% - 20px)"})` }}
          >
            <div className="chn-card-in">
              <PropertyThumb photoUrl={selDetail.photoUrl} size={46} />
              <div className="chn-card-txt">
                <span className="chn-card-l1">{selDetail.line1}</span>
                {selDetail.line2 && <span className="chn-card-l2">{selDetail.line2}</span>}
                <span className="chn-card-meta">
                  <span style={{ color: CHAIN_STATUS_COLOR[selDetail.status], fontWeight: 650 }}>{CHAIN_STATUS_LABEL[selDetail.status]}</span>
                  {selDetail.agency && <span className="chn-card-ag"> · {selDetail.agency}</span>}
                </span>
                {selDetail.progressPercent != null && (
                  <span className="chn-card-bar"><i style={{ width: `${Math.min(100, Math.max(0, selDetail.progressPercent))}%` }} /></span>
                )}
              </div>
            </div>
            {selDetail.href && <Link href={selDetail.href} className="chn-card-cta">View chain details →</Link>}
          </div>
        )
      )}
    </div>
  );
}

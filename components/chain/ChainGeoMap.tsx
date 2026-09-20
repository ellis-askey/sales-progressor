"use client";

// Chain → Map view canvas. A MapLibre map (client-only; WebGL, loaded via
// next/dynamic({ssr:false}) from ChainDrawer) that plots every chain property as
// a numbered pin in real chain order and draws the household moves between them,
// branches included. Overlays: a summary strip, a legend, a floating property
// card on pin-select, and a move card on line-click. Reuses the free My Files
// stack (MapLibre + Carto keyless tiles, postcodes.io geocoding, localStorage
// cache). Distances here are straight-line (haversine); Phase 2 swaps in real
// driving routes + times from OpenRouteService.

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import Link from "next/link";
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
  const [selMove, setSelMove] = useState<{ fromId: string; toId: string } | null>(null);

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
    return {
      type: "FeatureCollection",
      features: movesRef.current.flatMap((m) => {
        const a = coordsRef.current[m.fromId], b = coordsRef.current[m.toId];
        if (!a || !b) return [];
        return [{
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
          properties: { broken: !!m.broken, fromId: m.fromId, toId: m.toId },
        }];
      }),
    };
  }

  function installLine(map: maplibregl.Map) {
    if (!map.getSource("chain-moves")) {
      map.addSource("chain-moves", { type: "geojson", data: moveFC() });
    }
    if (!map.getLayer("chain-move-line")) {
      map.addLayer({
        id: "chain-move-line", type: "line", source: "chain-moves",
        filter: ["!", ["to-boolean", ["get", "broken"]]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#FF6B4A", "line-width": 2.5, "line-opacity": 0.55 },
      });
    }
    if (!map.getLayer("chain-move-broken")) {
      map.addLayer({
        id: "chain-move-broken", type: "line", source: "chain-moves",
        filter: ["to-boolean", ["get", "broken"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#94A3B8", "line-width": 2, "line-opacity": 0.6, "line-dasharray": [1.6, 1.4] },
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

    // Click a move line → move card. Click empty map → clear selection.
    const onLineClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0];
      const fromId = f?.properties?.fromId as string | undefined;
      const toId = f?.properties?.toId as string | undefined;
      if (fromId && toId) { setSelMove({ fromId, toId }); onSelectRef.current(null); }
    };
    map.on("click", "chain-move-line", onLineClick);
    map.on("click", "chain-move-broken", onLineClick);
    map.on("click", (e) => {
      const hit = map.queryRenderedFeatures(e.point, { layers: ["chain-move-line", "chain-move-broken"] });
      if (hit.length === 0) { setSelMove(null); onSelectRef.current(null); }
    });
    for (const id of ["chain-move-line", "chain-move-broken"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
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
        el.addEventListener("click", (e) => { e.stopPropagation(); setSelMove(null); onSelectRef.current(n.id); });
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

  // ── overlay geometry (projected each render via the tick) ──
  const map = mapRef.current;
  const project = (c: LatLng) => map!.project([c.lng, c.lat]);

  const geoMoves = moves
    .map((m) => ({ m, a: coords[m.fromId], b: coords[m.toId] }))
    .filter((x): x is { m: ChainMapMove; a: LatLng; b: LatLng } => !!x.a && !!x.b);
  const totalMiles = geoMoves.reduce((s, x) => s + haversineMiles(x.a, x.b), 0);
  const longest = geoMoves.reduce<{ mi: number; x: typeof geoMoves[number] | null }>(
    (mx, x) => { const mi = haversineMiles(x.a, x.b); return mi > mx.mi ? { mi, x } : mx; },
    { mi: 0, x: null },
  );

  const selCoord = selectedId ? coords[selectedId] : null;
  const selDetail = selectedId ? details[selectedId] : null;
  const selPt = map && selCoord ? project(selCoord) : null;

  const moveA = selMove ? coords[selMove.fromId] : null;
  const moveB = selMove ? coords[selMove.toId] : null;
  const movePt = map && moveA && moveB ? project({ lat: (moveA.lat + moveB.lat) / 2, lng: (moveA.lng + moveB.lng) / 2 }) : null;
  const moveMi = moveA && moveB ? haversineMiles(moveA, moveB) : null;

  return (
    <div className="chn-map-wrap">
      <div ref={containerRef} className="chn-map-canvas" />

      {/* Summary strip */}
      <div className="chn-summary">
        <span className="chn-sum-item"><b>{nodes.length}</b> {nodes.length === 1 ? "property" : "properties"}</span>
        <span className="chn-sum-item"><b>{moves.length}</b> {moves.length === 1 ? "move" : "moves"}</span>
        {geoMoves.length > 0 && <span className="chn-sum-item"><b>~{Math.round(totalMiles)} mi</b> total</span>}
        {longest.x && (
          <span className="chn-sum-item chn-sum-long">
            Longest <b>~{miEl(longest.mi)}</b>
          </span>
        )}
        <span className="chn-sum-note">approx straight-line</span>
      </div>

      {/* Legend */}
      <div className="chn-legend">
        {LEGEND.map((l) => (
          <span key={l.status} className="chn-leg-item">
            <span className="chn-leg-dot" style={{ background: CHAIN_STATUS_COLOR[l.status] }} />{l.label}
          </span>
        ))}
      </div>

      {/* Property card */}
      {selPt && selDetail && (
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
      )}

      {/* Move card */}
      {movePt && selMove && (
        <div className="chn-move" style={{ left: movePt.x, top: movePt.y, transform: "translate(-50%, calc(-100% - 14px))" }}>
          <p className="chn-move-h">Move {details[selMove.fromId]?.label} → {details[selMove.toId]?.label}</p>
          <p className="chn-move-addr">{details[selMove.fromId]?.line1} → {details[selMove.toId]?.line1}</p>
          {moveMi != null && <p className="chn-move-dist">{miEl(moveMi)} · approx straight-line</p>}
          <div className="chn-move-acts">
            <button type="button" onClick={() => { setSelMove(null); onSelectNode(selMove.fromId); }}>{details[selMove.fromId]?.line1}</button>
            <button type="button" onClick={() => { setSelMove(null); onSelectNode(selMove.toId); }}>{details[selMove.toId]?.line1}</button>
          </div>
        </div>
      )}
    </div>
  );
}

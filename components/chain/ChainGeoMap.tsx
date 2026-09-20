"use client";

// Chain → Map view canvas. A MapLibre map (client-only; touches WebGL) that
// plots every chain property as a numbered pin in real chain order and draws the
// actual household moves between consecutive properties. Reuses the same free
// stack as the My Files map: MapLibre + Carto keyless GL basemap, postcodes.io
// geocoding (client-side, localStorage-cached). No API key here. Driving
// distances are layered on later (Phase 2); this renders position + moves.

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geocodePostcodes, type LatLng } from "@/lib/geo/geocode";
import { extractPostcode } from "@/lib/geo/postcode";

export type ChainMapStatus = "yours" | "completed" | "claimed" | "invited" | "unclaimed";

export type ChainMapNode = {
  id: string; // chain link id
  displayPos: number; // 1..N, bottom of chain = 1 (matches the cards)
  address: string;
  status: ChainMapStatus;
};

// A real household move: the seller of `fromId` is buying `toId` (the property
// directly above them in the chain). `broken` = the move leaves the chain
// (withdrawal / break), drawn dashed rather than solid.
export type ChainMapMove = { fromId: string; toId: string; broken?: boolean };

const STYLE = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
};

// Restrained TSP palette — your sale coral, claimed green, invited amber,
// unclaimed grey, completed a deeper green. Four legend colours + a done shade.
const STATUS_COLOR: Record<ChainMapStatus, string> = {
  yours: "#FF6B4A",
  completed: "#1F8A4A",
  claimed: "#2F9E63",
  invited: "#E0A32E",
  unclaimed: "#94A3B8",
};

// Deterministic ±~70m jitter so two properties sharing a postcode don't stack.
function jitter(id: string): [number, number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const a = (Math.abs(h) % 1000) / 1000;
  const b = (Math.abs(h >> 10) % 1000) / 1000;
  return [(a - 0.5) * 0.0013, (b - 0.5) * 0.0013];
}

export function ChainGeoMap({
  nodes,
  moves,
  selectedId,
  onSelectNode,
  theme,
}: {
  nodes: ChainMapNode[];
  moves: ChainMapMove[];
  selectedId: string | null;
  onSelectNode: (id: string) => void;
  theme: "light" | "dark";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const loadedRef = useRef(false);
  const fittedRef = useRef(false);
  // Latest handlers/data for the stable marker click closures.
  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;
  const movesRef = useRef(moves);
  movesRef.current = moves;

  const [coords, setCoords] = useState<Record<string, LatLng>>({});

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
        const a = coords[m.fromId], b = coords[m.toId];
        if (!a || !b) return [];
        return [{
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
          properties: { broken: !!m.broken },
        }];
      }),
    };
  }

  // ── the move lines source + layers (re-installed after a theme setStyle) ──
  function installLine(map: maplibregl.Map) {
    if (!map.getSource("chain-moves")) {
      map.addSource("chain-moves", { type: "geojson", data: moveFC() });
    }
    // line-dasharray isn't data-driven in MapLibre, so moves + breaks are two
    // layers split by the `broken` flag: solid coral for a real move, dashed
    // grey where the household leaves the chain.
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
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE[theme],
      center: [-1.5, 52.4],
      zoom: 6,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => { loadedRef.current = true; installLine(map); syncMarkers(); });
    map.on("styledata", () => { if (map.isStyleLoaded()) installLine(map); });
    return () => { map.remove(); mapRef.current = null; loadedRef.current = false; markersRef.current.clear(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── theme swap ──
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.setStyle(STYLE[theme]);
  }, [theme]);

  // ── (re)build markers + line + fit whenever coords / nodes change ──
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
      el.style.setProperty("--pin", STATUS_COLOR[n.status]);
      el.textContent = String(n.displayPos);
      el.classList.toggle("on", n.id === selectedId);
    }
    // Drop markers for nodes that vanished.
    for (const [id, m] of markersRef.current) {
      if (!seen.has(id)) { m.remove(); markersRef.current.delete(id); }
    }

    (map.getSource("chain-moves") as maplibregl.GeoJSONSource | undefined)?.setData(moveFC());

    if (!fittedRef.current) {
      const pts = nodes.map((n) => coords[n.id]).filter(Boolean) as LatLng[];
      if (pts.length > 0) {
        const b = new maplibregl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]);
        for (const p of pts) b.extend([p.lng, p.lat]);
        map.fitBounds(b, { padding: 80, maxZoom: 13, duration: reduceMotion ? 0 : 500 });
        fittedRef.current = true;
      }
    }
  }

  useEffect(() => { syncMarkers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [coords, nodes, selectedId]);

  return <div ref={containerRef} className="chn-map-canvas" />;
}

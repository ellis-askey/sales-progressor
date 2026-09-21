"use client";

// Location-visual backdrop for the file hero's empty state (no property photo).
// A clean, non-interactive MapLibre map centred on the property's postcode, so
// the hero always feels complete and shares the same layout as the photo state.
//
// Reuses the app's existing, free/keyless map stack (same as the chain map):
//   - MapLibre GL + Carto Positron / Dark-Matter vector tiles (no API key)
//   - postcodes.io geocoding via lib/geo/geocode (client-side, localStorage-cached)
// It's lazy-loaded (the parent pulls it in via next/dynamic only when a file has
// no photo), so maplibre never touches the initial bundle or the server render.
// No coords (missing/foreign postcode, geocode miss) → renders nothing and the
// hero keeps its plain fallback.

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geocodePostcodes, type LatLng } from "@/lib/geo/geocode";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

const STYLE = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
} as const;

export default function PropertyLocationMap({ postcode }: { postcode: string | null }) {
  const { isNight } = usePortalTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [ready, setReady] = useState(false);

  // Geocode the postcode → centroid (cached in localStorage, so a returning
  // user pays nothing). One value expected back.
  useEffect(() => {
    if (!postcode) return;
    let live = true;
    geocodePostcodes([postcode])
      .then((geo) => {
        if (!live) return;
        const c = Object.values(geo).find(Boolean) ?? null;
        if (c) setCoords(c);
      })
      .catch(() => { /* leave coords null → hero fallback */ });
    return () => { live = false; };
  }, [postcode]);

  // Build the map once we have coordinates. Re-created on theme flip so the
  // tiles match light/dark. Non-interactive: it's a backdrop, not a tool.
  useEffect(() => {
    if (!coords || !containerRef.current) return;
    setReady(false);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE[isNight ? "dark" : "light"],
      center: [coords.lng, coords.lat],
      zoom: 14.5,
      interactive: false,
      // Badge hidden per founder request; attribution belongs on a credits page
      // instead (OSM/Carto terms). See PropertyHero handoff note.
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => { map.resize(); setReady(true); });
    return () => { map.remove(); mapRef.current = null; };
  }, [coords, isNight]);

  if (!postcode) return null;

  return (
    <div style={{ position: "absolute", inset: 0 }} aria-hidden>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 600ms ease" }}
      />
      {/* "You are here" pin at the centre — the map is centred on the property,
          so screen-centre is the property. Soft pulse; static under reduced motion. */}
      {ready && (
        <div className="hero-loc-pin" aria-hidden>
          <span className="hero-loc-ring" />
          <span className="hero-loc-dot" />
        </div>
      )}
      <style jsx>{`
        .hero-loc-pin {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
          height: 18px;
          pointer-events: none;
        }
        .hero-loc-dot {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #2563eb;
          border: 2.5px solid #fff;
          box-shadow: 0 1px 4px rgba(15, 23, 42, 0.35);
        }
        .hero-loc-ring {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(37, 99, 235, 0.35);
          animation: hero-loc-pulse 2.4s ease-out infinite;
        }
        @keyframes hero-loc-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(3.6); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-loc-ring { animation: none; opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

"use client";

// Compact non-interactive street map for a "Sold for…?" card: MapLibre + Carto
// Positron tiles with a pulsing coral dot on the property's postcode centroid.
// Same keyless stack as components/transaction/PropertyLocationMap.tsx, trimmed
// for the game card (fixed light style, coords passed in, no geocoding).
// Loaded via next/dynamic ssr:false from SoldForGame.

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function CardMap({ lat, lng }: { lat: number; lng: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    setReady(false);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Each card opens slightly wide and eases down onto the street — every
    // round starts with the feel of travelling to the next property.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE,
      center: [lng, lat],
      zoom: reduceMotion ? 15.2 : 13.9,
      interactive: false,
      attributionControl: false,
    });
    map.on("load", () => {
      map.resize();
      setReady(true);
      if (!reduceMotion) {
        map.easeTo({ zoom: 15.2, duration: 1100, easing: (t) => 1 - Math.pow(1 - t, 3) });
      }
    });
    return () => {
      map.remove();
    };
  }, [lat, lng]);

  return (
    <div style={{ position: "absolute", inset: 0 }} aria-hidden>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, opacity: ready ? 1 : 0, transition: "opacity 500ms ease" }}
      />
      {ready && (
        <div className="sf-map-pin">
          <span className="sf-map-ring" />
          <span className="sf-map-dot" />
        </div>
      )}
      <style jsx>{`
        .sf-map-pin {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 18px;
          height: 18px;
          pointer-events: none;
        }
        .sf-map-dot {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 13px;
          height: 13px;
          border-radius: 999px;
          background: #ff6b4a;
          border: 2.5px solid #fff;
          box-shadow: 0 1px 4px rgba(43, 36, 32, 0.35);
        }
        .sf-map-ring {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(255, 107, 74, 0.35);
          animation: sf-map-pulse 2.4s ease-out infinite;
        }
        @keyframes sf-map-pulse {
          0% {
            transform: scale(1);
            opacity: 0.6;
          }
          100% {
            transform: scale(3.4);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sf-map-ring {
            animation: none;
            opacity: 0.35;
          }
        }
      `}</style>
    </div>
  );
}

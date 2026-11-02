"use client";
// LiquidGlass — the real Apple-style refraction engine, in-house (no dependency).
//
// Technique (the rdev/liquid-glass-react approach, not feTurbulence):
//  1. A per-element displacement map drawn on a <canvas>: R encodes X-shift,
//     G encodes Y-shift. The interior is flattened to neutral (128,128 = zero
//     shift) so the CENTRE stays crisp; only a band at the rounded-rect rim
//     carries the gradient — that band is the lens lip that magnifies/bends.
//  2. That bitmap feeds an SVG <feImage> → <feDisplacementMap> applied to the
//     element's BACKDROP (backdrop-filter: url(#id)), so it refracts whatever
//     is painted behind it.
//  3. Chromatic aberration: the displacement runs three times (R/G/B at
//     slightly different scales) and recombines with screen blends → the faint
//     prismatic fringe on the edges that reads as "real glass".
//
// Fallback: the .lgx-surface class carries a plain frosted blur. Browsers that
// don't support url() in backdrop-filter (Safari, Firefox) discard the inline
// url() value and keep the frosted blur — still glass, just no bend.
//
// Dev-only concept component; lives beside the /dev/liquid-glass page.

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rr);
    return;
  }
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Build the displacement bitmap for a given box. Interior neutral → crisp;
// rim band carries the R/G gradient → the refracting lens lip.
function makeDisplacementMap(
  w: number,
  h: number,
  radius: number,
  bevel: number,
): string {
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return "";

  // Black base, then add R horizontally and G vertically so the box reads
  // (0,0)→(255,255); its centre lands on (128,128) = zero displacement.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = "lighter";
  const gx = ctx.createLinearGradient(0, 0, W, 0);
  gx.addColorStop(0, "rgb(0,0,0)");
  gx.addColorStop(1, "rgb(255,0,0)");
  ctx.fillStyle = gx;
  ctx.fillRect(0, 0, W, H);

  const gy = ctx.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0, "rgb(0,0,0)");
  gy.addColorStop(1, "rgb(0,255,0)");
  ctx.fillStyle = gy;
  ctx.fillRect(0, 0, W, H);

  // Flatten the interior back to neutral (128,128) leaving only a rim band of
  // thickness ~bevel. Blur the fill so the lip falls off smoothly (not a hard
  // ring). This is the crisp-centre / bent-edge signature of the effect.
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = `blur(${Math.max(1, bevel * 0.5)}px)`;
  ctx.fillStyle = "rgb(128,128,0)";
  roundRectPath(ctx, bevel, bevel, W - 2 * bevel, H - 2 * bevel, Math.max(0, radius - bevel));
  ctx.fill();
  ctx.filter = "none";

  return c.toDataURL();
}

type Props = HTMLAttributes<HTMLDivElement> & {
  /** corner radius in px (also used to shape the map) */
  radius?: number;
  /** residual frost blur layered on top of the refraction */
  blur?: number;
  /** displacement strength — how hard the rim bends the backdrop */
  displace?: number;
  /** thickness of the refracting rim band in px */
  thickness?: number;
  /** chromatic-aberration spread in px (0 = off) */
  aberration?: number;
  /** glass body tint */
  tint?: string;
  children?: ReactNode;
};

export function LiquidGlass({
  radius = 26,
  blur = 1.5,
  displace = 58,
  thickness = 18,
  aberration = 4,
  tint = "rgba(255,255,255,0.12)",
  className = "",
  style,
  children,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const rawId = useId();
  const fid = `lg${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [map, setMap] = useState("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (size.w > 1 && size.h > 1) {
      const bevel = Math.max(2, Math.min(thickness, size.w / 2 - 1, size.h / 2 - 1));
      setMap(makeDisplacementMap(size.w, size.h, radius, bevel));
    }
  }, [size, radius, thickness]);

  const ready = !!map && size.w > 1 && size.h > 1;
  const bf = ready
    ? `url(#${fid}) blur(${blur}px) saturate(185%) brightness(1.06)`
    : undefined;

  const mergedStyle: CSSProperties = {
    borderRadius: radius,
    background: `linear-gradient(135deg, ${tint}, rgba(255,255,255,0.03))`,
    ...style,
  };
  if (bf) {
    mergedStyle.backdropFilter = bf;
    (mergedStyle as CSSProperties & { WebkitBackdropFilter?: string }).WebkitBackdropFilter = bf;
  }

  return (
    <div ref={ref} className={`lgx-surface ${className}`} style={mergedStyle} {...rest}>
      {ready && (
        <svg
          className="lgx-filter-svg"
          width={size.w}
          height={size.h}
          aria-hidden
          focusable="false"
        >
          <defs>
            <filter
              id={fid}
              filterUnits="userSpaceOnUse"
              x="0"
              y="0"
              width={size.w}
              height={size.h}
              colorInterpolationFilters="sRGB"
            >
              <feImage
                href={map}
                x="0"
                y="0"
                width={size.w}
                height={size.h}
                preserveAspectRatio="none"
                result="map"
              />
              {aberration > 0 ? (
                <>
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={displace + aberration}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="dR"
                  />
                  <feColorMatrix
                    in="dR"
                    type="matrix"
                    values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
                    result="cR"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={displace}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="dG"
                  />
                  <feColorMatrix
                    in="dG"
                    type="matrix"
                    values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
                    result="cG"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="map"
                    scale={displace - aberration}
                    xChannelSelector="R"
                    yChannelSelector="G"
                    result="dB"
                  />
                  <feColorMatrix
                    in="dB"
                    type="matrix"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
                    result="cB"
                  />
                  <feBlend in="cR" in2="cG" mode="screen" result="rg" />
                  <feBlend in="rg" in2="cB" mode="screen" />
                </>
              ) : (
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="map"
                  scale={displace}
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              )}
            </filter>
          </defs>
        </svg>
      )}
      {children}
    </div>
  );
}

export default LiquidGlass;

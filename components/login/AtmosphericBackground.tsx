"use client"

import { useEffect, useRef } from "react"

type NodeData = {
  id: number; cx: number; cy: number; r: number
  color: "white" | "coral"; opacity: number; depth: 0 | 1 | 2
  breathDuration: number; breathDelay: number
}
type EdgeData = { from: number; to: number; shimmer?: true }

// Shimmer lines with pre-calculated lengths (px in 1440×900 space)
const SHIMMER_META: Record<string, { length: number; duration: number; phase: number }> = {
  "0-1":   { length:  74, duration:  9, phase: 0.00 },
  "8-10":  { length: 100, duration: 11, phase: 0.60 },
  "18-20": { length:  72, duration:  8, phase: 0.30 },
  "24-26": { length:  64, duration: 10, phase: 0.80 },
  "30-5":  { length: 184, duration:  7, phase: 0.15 },
  "35-37": { length: 170, duration: 12, phase: 0.50 },
  "41-43": { length: 160, duration:  9, phase: 0.70 },
  "53-1":  { length: 340, duration: 13, phase: 0.25 },
}

const NODES: NodeData[] = [
  // top-left cluster
  { id: 0,  cx:  90, cy:  95, r: 3.0, color: "white", opacity: 0.60, depth: 1, breathDuration: 5.2, breathDelay: 0.0 },
  { id: 1,  cx: 140, cy: 150, r: 4.0, color: "white", opacity: 0.50, depth: 0, breathDuration: 4.5, breathDelay: 0.8 },
  { id: 2,  cx: 195, cy:  85, r: 2.5, color: "white", opacity: 0.40, depth: 2, breathDuration: 6.1, breathDelay: 1.5 },
  { id: 3,  cx: 235, cy: 175, r: 3.5, color: "white", opacity: 0.55, depth: 1, breathDuration: 5.8, breathDelay: 2.2 },
  { id: 4,  cx: 175, cy: 220, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 7.0, breathDelay: 0.5 },
  { id: 5,  cx: 110, cy: 260, r: 3.0, color: "white", opacity: 0.45, depth: 1, breathDuration: 4.8, breathDelay: 1.8 },
  { id: 6,  cx: 265, cy: 130, r: 2.0, color: "coral", opacity: 0.50, depth: 2, breathDuration: 6.5, breathDelay: 3.0 },
  { id: 7,  cx:  60, cy: 180, r: 2.5, color: "white", opacity: 0.30, depth: 2, breathDuration: 5.5, breathDelay: 2.5 },
  // top-right cluster
  { id: 8,  cx: 1280, cy:  80, r: 3.0, color: "white", opacity: 0.50, depth: 1, breathDuration: 4.9, breathDelay: 1.2 },
  { id: 9,  cx: 1340, cy: 130, r: 2.0, color: "white", opacity: 0.40, depth: 2, breathDuration: 6.3, breathDelay: 0.3 },
  { id: 10, cx: 1310, cy: 175, r: 3.5, color: "coral", opacity: 0.55, depth: 0, breathDuration: 5.1, breathDelay: 2.0 },
  { id: 11, cx: 1360, cy: 220, r: 2.5, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.8, breathDelay: 1.0 },
  { id: 12, cx: 1250, cy: 180, r: 2.0, color: "white", opacity: 0.40, depth: 2, breathDuration: 7.0, breathDelay: 3.5 },
  { id: 13, cx: 1380, cy:  70, r: 3.0, color: "white", opacity: 0.45, depth: 1, breathDuration: 4.5, breathDelay: 0.7 },
  { id: 14, cx: 1200, cy: 120, r: 4.0, color: "white", opacity: 0.60, depth: 0, breathDuration: 5.5, breathDelay: 1.8 },
  { id: 15, cx: 1290, cy: 240, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.0, breathDelay: 2.8 },
  // bottom-left cluster
  { id: 16, cx:  80, cy: 720, r: 3.0, color: "white", opacity: 0.50, depth: 1, breathDuration: 5.3, breathDelay: 0.9 },
  { id: 17, cx: 140, cy: 780, r: 2.5, color: "white", opacity: 0.40, depth: 2, breathDuration: 6.7, breathDelay: 2.1 },
  { id: 18, cx: 195, cy: 740, r: 3.0, color: "coral", opacity: 0.55, depth: 1, breathDuration: 4.6, breathDelay: 1.4 },
  { id: 19, cx: 100, cy: 840, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 7.0, breathDelay: 3.2 },
  { id: 20, cx: 210, cy: 810, r: 4.0, color: "white", opacity: 0.60, depth: 0, breathDuration: 5.0, breathDelay: 0.4 },
  { id: 21, cx: 160, cy: 860, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.2, breathDelay: 2.7 },
  { id: 22, cx:  60, cy: 790, r: 2.5, color: "white", opacity: 0.40, depth: 1, breathDuration: 5.8, breathDelay: 1.6 },
  // bottom-right cluster
  { id: 23, cx: 1260, cy: 720, r: 3.0, color: "white", opacity: 0.50, depth: 1, breathDuration: 5.1, breathDelay: 1.1 },
  { id: 24, cx: 1320, cy: 780, r: 2.5, color: "coral", opacity: 0.45, depth: 1, breathDuration: 4.7, breathDelay: 2.3 },
  { id: 25, cx: 1360, cy: 740, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.9, breathDelay: 0.6 },
  { id: 26, cx: 1280, cy: 830, r: 4.0, color: "white", opacity: 0.60, depth: 0, breathDuration: 5.4, breathDelay: 1.9 },
  { id: 27, cx: 1380, cy: 800, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.3, breathDelay: 3.1 },
  { id: 28, cx: 1200, cy: 770, r: 3.0, color: "white", opacity: 0.45, depth: 1, breathDuration: 5.7, breathDelay: 0.8 },
  { id: 29, cx: 1340, cy: 870, r: 2.5, color: "white", opacity: 0.40, depth: 2, breathDuration: 7.0, breathDelay: 2.5 },
  // left edge
  { id: 30, cx:  40, cy: 430, r: 3.0, color: "white", opacity: 0.45, depth: 1, breathDuration: 5.0, breathDelay: 1.3 },
  { id: 31, cx: 300, cy: 390, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.5, breathDelay: 2.9 },
  { id: 32, cx: 330, cy: 500, r: 2.5, color: "white", opacity: 0.40, depth: 1, breathDuration: 4.8, breathDelay: 0.6 },
  { id: 33, cx: 270, cy: 570, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.8, breathDelay: 1.7 },
  { id: 34, cx:  65, cy: 540, r: 3.5, color: "coral", opacity: 0.50, depth: 0, breathDuration: 5.2, breathDelay: 3.3 },
  // right edge
  { id: 35, cx: 1160, cy: 390, r: 2.5, color: "white", opacity: 0.40, depth: 1, breathDuration: 5.6, breathDelay: 1.0 },
  { id: 36, cx: 1130, cy: 470, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.4, breathDelay: 2.4 },
  { id: 37, cx: 1170, cy: 560, r: 3.0, color: "white", opacity: 0.45, depth: 1, breathDuration: 4.9, breathDelay: 0.5 },
  { id: 38, cx: 1400, cy: 440, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 7.0, breathDelay: 1.9 },
  { id: 39, cx: 1100, cy: 620, r: 3.5, color: "white", opacity: 0.50, depth: 0, breathDuration: 5.3, breathDelay: 3.0 },
  // top center sparse
  { id: 40, cx: 560, cy:  40, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.1, breathDelay: 0.7 },
  { id: 41, cx: 640, cy:  70, r: 2.5, color: "white", opacity: 0.40, depth: 1, breathDuration: 5.5, breathDelay: 2.2 },
  { id: 42, cx: 720, cy:  35, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.9, breathDelay: 1.5 },
  { id: 43, cx: 800, cy:  65, r: 2.0, color: "coral", opacity: 0.45, depth: 1, breathDuration: 4.7, breathDelay: 3.4 },
  { id: 44, cx: 880, cy:  45, r: 2.5, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.3, breathDelay: 0.9 },
  // bottom center sparse
  { id: 45, cx: 540, cy: 880, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.0, breathDelay: 1.8 },
  { id: 46, cx: 660, cy: 870, r: 2.5, color: "white", opacity: 0.40, depth: 1, breathDuration: 5.4, breathDelay: 0.3 },
  { id: 47, cx: 760, cy: 885, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.7, breathDelay: 2.6 },
  { id: 48, cx: 860, cy: 875, r: 2.0, color: "white", opacity: 0.35, depth: 1, breathDuration: 5.1, breathDelay: 1.1 },
  // accent / fill
  { id: 49, cx:  350, cy: 300, r: 1.5, color: "white", opacity: 0.30, depth: 2, breathDuration: 7.0, breathDelay: 0.8 },
  { id: 50, cx:  420, cy: 640, r: 2.0, color: "coral", opacity: 0.40, depth: 1, breathDuration: 5.8, breathDelay: 2.0 },
  { id: 51, cx: 1020, cy: 300, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.4, breathDelay: 1.4 },
  { id: 52, cx: 1050, cy: 650, r: 1.5, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.8, breathDelay: 3.1 },
  { id: 53, cx:  480, cy: 160, r: 2.0, color: "white", opacity: 0.40, depth: 1, breathDuration: 5.2, breathDelay: 0.4 },
  { id: 54, cx:  980, cy: 150, r: 2.5, color: "white", opacity: 0.35, depth: 1, breathDuration: 5.7, breathDelay: 1.6 },
  { id: 55, cx:  490, cy: 780, r: 2.0, color: "white", opacity: 0.30, depth: 2, breathDuration: 6.5, breathDelay: 2.3 },
  { id: 56, cx:  960, cy: 790, r: 2.0, color: "white", opacity: 0.35, depth: 2, breathDuration: 6.1, breathDelay: 0.7 },
]

const EDGES: EdgeData[] = [
  // top-left cluster
  { from:  0, to:  1, shimmer: true },
  { from:  1, to:  3 },
  { from:  3, to:  5 },
  { from:  0, to:  7 },
  { from:  2, to:  3 },
  { from:  6, to:  3 },
  // top-right cluster
  { from:  8, to: 10, shimmer: true },
  { from: 10, to: 14 },
  { from: 14, to: 12 },
  { from:  8, to: 13 },
  { from:  9, to: 11 },
  { from: 10, to: 15 },
  // bottom-left cluster
  { from: 16, to: 18 },
  { from: 18, to: 20, shimmer: true },
  { from: 20, to: 21 },
  { from: 16, to: 22 },
  { from: 17, to: 19 },
  { from: 18, to: 17 },
  // bottom-right cluster
  { from: 23, to: 24 },
  { from: 24, to: 26, shimmer: true },
  { from: 26, to: 28 },
  { from: 23, to: 28 },
  { from: 25, to: 27 },
  { from: 24, to: 29 },
  // left edge
  { from: 30, to:  5, shimmer: true },
  { from: 30, to: 34 },
  { from: 32, to: 31 },
  { from: 32, to: 33 },
  { from: 34, to: 22 },
  { from: 31, to: 53 },
  // right edge
  { from: 35, to: 37, shimmer: true },
  { from: 37, to: 39 },
  { from: 38, to: 36 },
  { from: 35, to: 12 },
  { from: 39, to: 56 },
  // top center
  { from: 40, to: 41 },
  { from: 41, to: 43, shimmer: true },
  { from: 42, to: 44 },
  { from: 40, to: 42 },
  // bottom center
  { from: 45, to: 46 },
  { from: 46, to: 47 },
  { from: 47, to: 48 },
  // cross connections
  { from: 53, to:  1, shimmer: true },
  { from: 54, to: 14 },
  { from:  4, to: 31 },
  { from: 33, to: 50 },
  { from: 51, to: 35 },
  { from: 52, to: 39 },
  { from: 55, to: 20 },
  { from: 56, to: 28 },
  { from:  0, to: 53 },
  { from:  8, to: 54 },
  { from: 44, to: 54 },
  { from: 48, to: 56 },
  { from: 45, to: 55 },
]

const nodeMap = new Map(NODES.map(n => [n.id, n]))

function edgeColor(edge: EdgeData): string {
  const a = nodeMap.get(edge.from)!
  const b = nodeMap.get(edge.to)!
  return a.color === "coral" || b.color === "coral" ? "#FF8A65" : "#C8D8F0"
}

export function AtmosphericBackground() {
  const depthRefs = [
    useRef<SVGGElement>(null),
    useRef<SVGGElement>(null),
    useRef<SVGGElement>(null),
  ] as const

  const shimmerElemsRef = useRef<Map<string, SVGLineElement>>(new Map())

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    // Parallax state
    let targetX = 0.5, targetY = 0.5
    let curX = 0.5, curY = 0.5
    const SHIFTS = [15, 8, 3] // px per depth layer

    // Shimmer state
    const shimmerState = new Map(
      Object.entries(SHIMMER_META).map(([key, meta]) => [
        key,
        { phase: meta.phase, duration: meta.duration, length: meta.length },
      ])
    )

    const handleMouse = (e: MouseEvent) => {
      targetX = e.clientX / window.innerWidth
      targetY = e.clientY / window.innerHeight
    }
    window.addEventListener("mousemove", handleMouse)

    let last = performance.now()
    let raf: number

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05) // cap at 50ms
      last = now

      // Parallax
      curX += (targetX - curX) * 0.07
      curY += (targetY - curY) * 0.07
      depthRefs.forEach((ref, depth) => {
        if (!ref.current) return
        const s = SHIFTS[depth]
        const dx = (curX - 0.5) * 2 * s
        const dy = (curY - 0.5) * 2 * s
        ref.current.style.transform = `translate(${dx}px, ${dy}px)`
      })

      // Shimmer
      shimmerState.forEach((s, key) => {
        s.phase = (s.phase + dt / s.duration) % 1.0
        const el = shimmerElemsRef.current.get(key)
        if (!el) return

        if (s.phase < 0.18) {
          const t = s.phase / 0.18
          const opacity = Math.sin(t * Math.PI) * 0.75
          const dashOffset = (1 - t) * (s.length + 50) - 50
          el.style.strokeOpacity = String(opacity)
          el.style.strokeDashoffset = String(dashOffset)
        } else {
          el.style.strokeOpacity = "0"
        }
      })

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener("mousemove", handleMouse)
      cancelAnimationFrame(raf)
    }
  }, [])

  const shimmerEdges = EDGES.filter(e => e.shimmer)
  const staticEdges = EDGES.filter(e => !e.shimmer)

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(ellipse 120% 100% at 50% 45%, #0d1f3c 0%, #070d1a 65%, #040810 100%)",
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Static lines */}
        <g>
          {staticEdges.map((edge, i) => {
            const a = nodeMap.get(edge.from)!
            const b = nodeMap.get(edge.to)!
            return (
              <line
                key={i}
                x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                stroke={edgeColor(edge)}
                strokeWidth={0.6}
                strokeOpacity={0.18}
              />
            )
          })}
        </g>

        {/* Shimmer lines — base layer */}
        <g>
          {shimmerEdges.map((edge) => {
            const a = nodeMap.get(edge.from)!
            const b = nodeMap.get(edge.to)!
            const key = `${edge.from}-${edge.to}`
            const meta = SHIMMER_META[key]
            return (
              <g key={key}>
                {/* static base */}
                <line
                  x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                  stroke={edgeColor(edge)}
                  strokeWidth={0.6}
                  strokeOpacity={0.18}
                />
                {/* travelling shimmer */}
                <line
                  ref={el => {
                    if (el) shimmerElemsRef.current.set(key, el)
                    else shimmerElemsRef.current.delete(key)
                  }}
                  x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy}
                  stroke={edgeColor(edge)}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  style={{
                    strokeDasharray: `40 ${meta.length + 100}`,
                    strokeDashoffset: meta.length + 50,
                    strokeOpacity: 0,
                  }}
                />
              </g>
            )
          })}
        </g>

        {/* Node layers by depth — parallax applied per group */}
        {([2, 1, 0] as const).map(depth => (
          <g key={depth} ref={depthRefs[depth]}>
            {NODES.filter(n => n.depth === depth).map(node => {
              const fill = node.color === "coral" ? "#FF8A65" : "#E8F0FF"
              return (
                <circle
                  key={node.id}
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r}
                  fill={fill}
                  opacity={node.opacity}
                  className="atm-node"
                  style={{
                    animationDuration: `${node.breathDuration}s`,
                    animationDelay: `-${node.breathDelay}s`,
                    transformOrigin: `${node.cx}px ${node.cy}px`,
                  }}
                />
              )
            })}
          </g>
        ))}
      </svg>

      <style>{`
        .atm-node {
          animation: atm-breathe var(--dur, 5s) ease-in-out infinite;
        }
        @keyframes atm-breathe {
          0%, 100% { transform: scale(1); opacity: inherit; }
          50%       { transform: scale(1.10); }
        }
        @media (prefers-reduced-motion: reduce) {
          .atm-node { animation: none; }
        }
      `}</style>
    </div>
  )
}

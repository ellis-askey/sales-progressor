export function SunriseBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "linear-gradient(135deg, #FFE8D1 0%, #FFD4A3 30%, #FFB88A 60%, #FF9676 100%)",
        overflow: "hidden",
      }}
    >
      {/* Bloom 1 — white-warm, upper-left, figure-eight 38s */}
      <div className="sr-bloom sr-bloom-1" />
      {/* Bloom 2 — pale yellow, top-right, diagonal 45s */}
      <div className="sr-bloom sr-bloom-2" />
      {/* Bloom 3 — coral glow, lower-centre, circular 35s */}
      <div className="sr-bloom sr-bloom-3" />
      {/* Bloom 4 — pale pink, bottom-right, arc 50s */}
      <div className="sr-bloom sr-bloom-4" />

      <style>{`
        .sr-bloom {
          position: absolute;
          border-radius: 50%;
          will-change: transform;
          pointer-events: none;
        }

        /* White-warm bloom — upper left, figure-eight */
        .sr-bloom-1 {
          width: 800px;
          height: 650px;
          top: -120px;
          left: -120px;
          background: radial-gradient(ellipse, rgba(255,255,235,0.70) 0%, transparent 65%);
          animation: sr-figure-eight 28s -4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        /* Pale yellow bloom — top right, diagonal */
        .sr-bloom-2 {
          width: 680px;
          height: 680px;
          top: -160px;
          right: -100px;
          background: radial-gradient(ellipse, rgba(255,220,100,0.40) 0%, transparent 65%);
          animation: sr-diagonal 34s -12s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        /* Deep coral glow — lower centre, circular */
        .sr-bloom-3 {
          width: 600px;
          height: 600px;
          bottom: -100px;
          left: 18%;
          background: radial-gradient(ellipse, rgba(220,80,40,0.30) 0%, transparent 62%);
          animation: sr-circular 26s -8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        /* Pale pink — bottom right, arc */
        .sr-bloom-4 {
          width: 620px;
          height: 540px;
          bottom: -120px;
          right: -80px;
          background: radial-gradient(ellipse, rgba(255,180,130,0.45) 0%, transparent 62%);
          animation: sr-arc 38s -22s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        /* Figure-eight — large sweep so motion is clearly visible */
        @keyframes sr-figure-eight {
          0%   { transform: translate(   0px,    0px); }
          12%  { transform: translate( 200px,  120px); }
          25%  { transform: translate( 340px,    0px); }
          37%  { transform: translate( 200px, -120px); }
          50%  { transform: translate(   0px,    0px); }
          62%  { transform: translate(-200px,  120px); }
          75%  { transform: translate(-340px,    0px); }
          87%  { transform: translate(-200px, -120px); }
          100% { transform: translate(   0px,    0px); }
        }

        /* Diagonal — sweeps down-left across most of the viewport */
        @keyframes sr-diagonal {
          0%   { transform: translate(   0px,    0px); }
          40%  { transform: translate(-300px,  220px); }
          70%  { transform: translate(-160px,  380px); }
          100% { transform: translate(   0px,    0px); }
        }

        /* Circular — wide anticlockwise orbit */
        @keyframes sr-circular {
          0%   { transform: translate(   0px,    0px); }
          25%  { transform: translate(-220px, -160px); }
          50%  { transform: translate(  -40px, -310px); }
          75%  { transform: translate( 220px, -160px); }
          100% { transform: translate(   0px,    0px); }
        }

        /* Arc — lifts and sweeps left then back */
        @keyframes sr-arc {
          0%   { transform: translate(   0px,    0px); }
          35%  { transform: translate(-260px, -200px); }
          68%  { transform: translate( 180px, -160px); }
          100% { transform: translate(   0px,    0px); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sr-bloom { animation: none !important; }
        }
      `}</style>
    </div>
  )
}

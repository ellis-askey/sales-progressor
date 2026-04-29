"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  address: string;
  onDismiss: () => void;
};

function startConfetti(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#f97316"];

  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 200,
    vx: (Math.random() - 0.5) * 4,
    vy: 2.5 + Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    w: 7 + Math.random() * 7,
    h: 3 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.18,
  }));

  let raf = 0;
  const start = Date.now();

  const frame = () => {
    const elapsed = Date.now() - start;
    if (elapsed > 3000) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = elapsed > 2400 ? 1 - (elapsed - 2400) / 600 : 1;
    for (const p of pieces) {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };

  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

export function ExchangeCelebration({ address, onDismiss }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    return startConfetti(canvasRef.current);
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <style>{`
        @keyframes exchange-in {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Confetti canvas — pointer-events:none so it doesn't block the modal */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Backdrop — tap to dismiss */}
      <div className="absolute inset-0 bg-black/65" onClick={onDismiss} />

      {/* Modal card */}
      <div
        className="relative z-10 bg-white rounded-3xl max-w-sm w-full px-8 py-10 shadow-2xl text-center"
        style={{ animation: "exchange-in 200ms ease-out both" }}
      >
        {/* Star icon */}
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2 leading-tight">Exchange confirmed</h2>
        <p className="text-base font-semibold text-slate-600 mb-3 leading-snug">{address}</p>
        <p className="text-sm text-slate-500 leading-relaxed mb-8">
          Contracts are now legally exchanged. Your fee is crystallised — congratulations.
        </p>

        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          Continue
        </button>
      </div>
    </div>,
    document.body
  );
}

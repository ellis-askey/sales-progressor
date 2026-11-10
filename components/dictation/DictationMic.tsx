"use client";

// The dictation control: a bare mic that becomes a live voice-memo waveform with
// a stop button while recording. Presentational — pass it the controls from a
// useDictation hook. Hidden entirely on browsers without SpeechRecognition.
// Prototyped at /dev/voice-dictation.

import { useEffect, useRef } from "react";
import type { DictationControls } from "./useDictation";

function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </svg>
  );
}

// Live voice-memo waveform: thin bars mirrored around the centre, streaming with
// loudness (RMS off the time-domain signal). Quiet sits as dots on the line.
function Waveform({ analyser, color, width, height }: { analyser: AnalyserNode | null; color: string; width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const smoothRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const BARS = 52;
    if (samplesRef.current.length !== BARS) samplesRef.current = new Array(BARS).fill(0);
    const time = analyser ? new Uint8Array(analyser.fftSize) : null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);
      let level = 0;
      if (analyser && time) {
        analyser.getByteTimeDomainData(time);
        let sum = 0;
        for (let i = 0; i < time.length; i++) { const x = (time[i] - 128) / 128; sum += x * x; }
        level = Math.sqrt(sum / time.length);
      }
      smoothRef.current += (level - smoothRef.current) * 0.55;
      const s = Math.min(1, smoothRef.current * 2.6);
      const samples = samplesRef.current;
      samples.push(s);
      if (samples.length > BARS) samples.shift();
      const gap = 2;
      const barW = Math.max(2, (w - gap * (BARS - 1)) / BARS);
      const cy = h / 2;
      const minH = barW;
      for (let i = 0; i < BARS; i++) {
        const v = samples[i] ?? 0;
        const bh = Math.max(minH, v * h * 0.96);
        const x = i * (barW + gap);
        const y = cy - bh / 2;
        ctx.globalAlpha = 0.28 + 0.72 * Math.min(1, v * 1.3);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, bh, barW / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [analyser, color]);

  return <canvas ref={canvasRef} style={{ width, height, display: "block" }} />;
}

// One-time stylesheet for the control (keyframe + classes).
const DM_CSS = `
.dm-mic{border:0;background:transparent;cursor:pointer;padding:5px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;transition:background .15s ease;}
.dm-mic:hover{background:color-mix(in srgb, currentColor 12%, transparent);}
.dm-rec{display:inline-flex;align-items:center;gap:9px;}
.dm-stop{position:relative;width:24px;height:24px;border-radius:50%;border:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.dm-stop-sq{width:8px;height:8px;border-radius:2.5px;background:#fff;}
.dm-stop::before{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid currentColor;opacity:.4;animation:dm-ring 1.5s ease-out infinite;}
@keyframes dm-ring{0%{transform:scale(.72);opacity:.55}100%{transform:scale(1.45);opacity:0}}
.dm-wave{display:inline-flex;align-items:center;}
`;

function useDictationCss() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("dictation-mic-css")) return;
    const el = document.createElement("style");
    el.id = "dictation-mic-css";
    el.textContent = DM_CSS;
    document.head.appendChild(el);
  }, []);
}

export function DictationMic({
  controls,
  color = "var(--agent-coral-deep, #F04E2C)",
  waveColor = "#F04E2C",
  size = 18,
  waveWidth = 132,
  waveHeight = 28,
}: {
  controls: DictationControls;
  color?: string;
  waveColor?: string;
  size?: number;
  waveWidth?: number;
  waveHeight?: number;
}) {
  useDictationCss();
  const { status, analyser, toggle } = controls;

  // No SpeechRecognition (e.g. Firefox): hide the control entirely rather than
  // show a dead button.
  if (status === "unsupported") return null;

  if (status === "listening") {
    return (
      <span className="dm-rec">
        <button type="button" className="dm-stop" style={{ background: waveColor, color: waveColor }} aria-label="Stop voice typing" title="Stop"
          onMouseDown={(e) => e.preventDefault()} onClick={toggle}>
          <span className="dm-stop-sq" />
        </button>
        <span className="dm-wave" style={{ color: waveColor }}>
          <Waveform analyser={analyser} color={waveColor} width={waveWidth} height={waveHeight} />
        </span>
      </span>
    );
  }

  return (
    <button type="button" className="dm-mic" style={{ color }} aria-label="Voice type" title="Voice type"
      onMouseDown={(e) => e.preventDefault()} onClick={toggle}>
      <MicIcon size={size} />
    </button>
  );
}

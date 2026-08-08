"use client";
// Iridescence, WebGL holographic ripple backdrop. Ported from Elevra PWA
// (src/components/decor/Iridescence.tsx) on 2026-08-08 for the Sales
// Progressor Elevra-backgrounds pass. Unchanged except for "use client".
//
// Adapted from the react-bits shader. The default has no opacity control,
// so we add a `uOpacity` uniform on `gl_FragColor.a` letting callers dial
// the intensity down for subtle background use. Set opacity 0.15-0.2 for
// a barely-there iridescent wash; 1 for the full holographic surface.
//
// Runs at DPR-capped resolution via ogl. Pauses when off-screen
// (IntersectionObserver). Mouse listener is attached to `window`, not
// the container, so it still fires when the container has
// `pointer-events: none` (needed for fixed-inset app backdrops).
import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import "./Iridescence.css";

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [1, 1, 1];
  return [
    parseInt(result[1]!, 16) / 255,
    parseInt(result[2]!, 16) / 255,
    parseInt(result[3]!, 16) / 255,
  ];
};

const vertex = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uResolution;
uniform vec2 uMouse;
uniform float uAmplitude;
uniform float uSpeed;
uniform float uOpacity;
varying vec2 vUv;

void main() {
  float mr = min(uResolution.x, uResolution.y);
  vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

  uv += (uMouse - vec2(0.5)) * uAmplitude;

  float d = -uTime * 0.5 * uSpeed;
  float a = 0.0;
  for (float i = 0.0; i < 8.0; ++i) {
    a += cos(i - d - a * uv.x);
    d += sin(uv.y * i + a);
  }
  d += uTime * 0.5 * uSpeed;
  vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
  col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5);
  gl_FragColor = vec4(col * uColor, uOpacity);
}
`;

interface IridescenceProps {
  color?: string;
  speed?: number;
  amplitude?: number;
  mouseReact?: boolean;
  opacity?: number;
}

export function Iridescence({
  color = "#ffffff",
  speed = 1,
  amplitude = 0.1,
  mouseReact = true,
  opacity = 1,
}: IridescenceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mouse = useRef<[number, number]>([0.5, 0.5]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      return;
    }

    const gl = renderer.gl;
    if (!gl) return;
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new Float32Array(hexToRgb(color)) },
        uResolution: { value: new Float32Array([1, 1, 1]) },
        uMouse: { value: new Float32Array([0.5, 0.5]) },
        uAmplitude: { value: amplitude },
        uSpeed: { value: speed },
        uOpacity: { value: opacity },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      const res = program.uniforms.uResolution.value as Float32Array;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      res[2] = gl.drawingBufferWidth / gl.drawingBufferHeight;
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / Math.max(1, rect.width);
      const y = 1.0 - (e.clientY - rect.top) / Math.max(1, rect.height);
      mouse.current = [x, y];
      const mu = program.uniforms.uMouse.value as Float32Array;
      mu[0] = x;
      mu[1] = y;
    };
    if (mouseReact) {
      window.addEventListener("mousemove", onMouseMove, { passive: true });
    }

    let raf = 0;
    let isVisible = true;
    const t0 = performance.now();

    const loop = (t: number) => {
      program.uniforms.uTime.value = (t - t0) * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };
    const tryStart = () => {
      if (isVisible && raf === 0) raf = requestAnimationFrame(loop);
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry?.isIntersecting ?? false;
        if (isVisible) tryStart();
        else tryStop();
      },
      { threshold: 0 },
    );
    io.observe(container);

    const onVisibility = () => {
      if (document.hidden) tryStop();
      else tryStart();
    };
    document.addEventListener("visibilitychange", onVisibility);

    tryStart();

    return () => {
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (mouseReact) {
        window.removeEventListener("mousemove", onMouseMove);
      }
      try {
        container.removeChild(canvas);
      } catch {
        /* ignore */
      }
    };
  }, [color, speed, amplitude, mouseReact, opacity]);

  return <div ref={containerRef} className="iridescence-container" aria-hidden />;
}

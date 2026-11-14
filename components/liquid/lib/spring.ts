"use client";
// Spring physics for TSP Liquid Glass motion.
//
// Adapted from Glassy UI's `registry/glassyui/lib/liquid-motion.ts`
// (https://github.com/alexburlis/glassyui), MIT License, Copyright (c) 2026
// Glassy UI contributors. The spring model (response/bounce parameterisation +
// semi-implicit Euler integration) is reused under the MIT terms; the frame-loop
// and reduced-motion helpers are our own. Keep this attribution if you copy it.
//
// MIT permission notice (from the Glassy UI LICENSE):
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files, to deal in the Software
//   without restriction... The above copyright notice and this permission notice
//   shall be included in all copies or substantial portions of the Software.

export type Spring = {
  value: number;
  velocity: number;
  target: number;
  stiffness: number;
  damping: number;
  precision: number;
};

// response = period of the undamped oscillation (s); bounce 0 = critically damped.
export function createSpring(response: number, bounce: number, value: number, precision = 0.001): Spring {
  return {
    value,
    velocity: 0,
    target: value,
    stiffness: ((2 * Math.PI) / response) ** 2,
    damping: (4 * Math.PI * (1 - bounce)) / response,
    precision,
  };
}

// Change how a spring moves without stopping it (carries its velocity over).
export function retuneSpring(spring: Spring, response: number, bounce: number) {
  spring.stiffness = ((2 * Math.PI) / response) ** 2;
  spring.damping = (4 * Math.PI * (1 - bounce)) / response;
}

// Semi-implicit Euler in steps of at most 1/120 s. Returns whether still moving.
export function stepSpring(spring: Spring, dt: number, snap: boolean): boolean {
  if (snap || (spring.value === spring.target && spring.velocity === 0)) {
    spring.value = spring.target;
    spring.velocity = 0;
    return false;
  }
  const steps = Math.max(1, Math.ceil(dt * 120));
  const h = dt / steps;
  for (let i = 0; i < steps; i += 1) {
    spring.velocity += (-spring.stiffness * (spring.value - spring.target) - spring.damping * spring.velocity) * h;
    spring.value += spring.velocity * h;
  }
  if (Math.abs(spring.value - spring.target) < spring.precision && Math.abs(spring.velocity) < spring.precision) {
    spring.value = spring.target;
    spring.velocity = 0;
    return false;
  }
  return true;
}

export function motionReduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A minimal rAF loop. `step(dt)` returns true to keep running. Our own code.
export function createFrameLoop(step: (dt: number) => boolean) {
  let raf = 0;
  let last = 0;
  let running = false;
  const tick = (t: number) => {
    const dt = last ? Math.min((t - last) / 1000, 1 / 30) : 1 / 60;
    last = t;
    const cont = step(dt);
    if (cont) raf = requestAnimationFrame(tick);
    else { running = false; last = 0; }
  };
  return {
    start() { if (!running) { running = true; last = 0; raf = requestAnimationFrame(tick); } },
    stop() { running = false; cancelAnimationFrame(raf); last = 0; },
  };
}

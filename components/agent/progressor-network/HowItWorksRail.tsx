"use client";

import { Compass, Handshake, FolderOpen } from "@phosphor-icons/react";

// The "how it works" rail shown beside the Discover grid: three numbered steps.

const STEPS = [
  { n: 1, Icon: Compass, title: "Discover", body: "Browse verified, independent sales progression businesses." },
  { n: 2, Icon: Handshake, title: "Connect", body: "Request a connection with the businesses that fit your needs." },
  { n: 3, Icon: FolderOpen, title: "Assign sales", body: "Hand chosen sales to your progressor and keep everything in TSP." },
];

export function HowItWorksRail() {
  return (
    <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, position: "sticky", top: 12 }}>
      <p style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>How it works</p>
      <ol className="pn-steps">
        {STEPS.map(({ n, Icon, title, body }) => (
          <li key={n} className="pn-step">
            <span className="pn-step-num">{n}</span>
            <div style={{ minWidth: 0 }}>
              <p className="pn-step-title">
                <Icon size={13} weight="bold" /> {title}
              </p>
              <p className="pn-step-body">{body}</p>
            </div>
          </li>
        ))}
      </ol>
      <style>{`
        .pn-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:16px}
        .pn-step{display:flex;gap:12px;align-items:flex-start}
        .pn-step-num{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0;border-radius:999px;background:rgba(var(--agent-coral-rgb),0.12);color:var(--agent-coral-deep);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
        .pn-step-title{margin:0;display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--agent-text-primary)}
        .pn-step-body{margin:4px 0 0;font-size:12px;color:var(--agent-text-secondary);line-height:1.45}
      `}</style>
    </div>
  );
}

"use client";

import { SealCheck, Stack, Lightning } from "@phosphor-icons/react";
import { IconChip } from "@/components/ui/IconChip";

// The three-benefit band under the page hero: three SEPARATE glass cards, each
// led by a canonical circular IconChip — matching the StatCards summary bars
// used elsewhere in the agent app, not a single divided panel.

const ITEMS = [
  { Icon: SealCheck, title: "Verified performance", body: "Work with proven, high-performing progression businesses." },
  { Icon: Stack, title: "Independent businesses", body: "A curated network of specialist, independent firms." },
  { Icon: Lightning, title: "Seamlessly connected", body: "Request a connection and start progressing sales in a few clicks." },
];

export function NetworkValueStrip() {
  return (
    <div className="pn-strip">
      {ITEMS.map(({ Icon, title, body }) => (
        <div key={title} className="agent-glass pn-strip-card">
          <IconChip tone="coral" size={40}>
            <Icon size={20} weight="bold" />
          </IconChip>
          <div style={{ minWidth: 0 }}>
            <p className="pn-strip-title">{title}</p>
            <p className="pn-strip-body">{body}</p>
          </div>
        </div>
      ))}
      <style>{`
        .pn-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
        .pn-strip-card{display:flex;gap:12px;align-items:flex-start;padding:16px 20px;border-radius:var(--agent-radius-xl)}
        .pn-strip-title{margin:0;font-size:14px;font-weight:700;color:var(--agent-text-primary);line-height:1.25}
        .pn-strip-body{margin:4px 0 0;font-size:12px;color:var(--agent-text-secondary);line-height:1.45}
        @media (max-width:860px){.pn-strip{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}

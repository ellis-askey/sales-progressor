"use client";

// /dev/crm-connect — preview of the REAL "Connect your CRM" settings panel
// (components/account/crm/ConnectCrmPanel) with the real catalogue + logos, so
// the logo wall can be eyeballed without logging into the agent app. Demo demand
// counts are passed in for show. NB: Request won't save here (there's no agency
// session on a /dev route) — it optimistically ticks then reverts; the live page
// at Account → Connect your CRM does the real save.

import "@/app/agent/styles/agent-system.css";
import { ConnectCrmPanel } from "@/components/account/crm/ConnectCrmPanel";
import { CRM_CATALOGUE } from "@/lib/crm/catalogue";

const DEMO_COUNTS: Record<string, number> = {
  reapit: 142, alto: 128, jupix: 96, street: 88, expertagent: 64, rex: 39, apex27: 24, loop: 11, gnb: 3,
};

export default function CrmConnectPreviewPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f3f1ed", padding: "40px 24px 100px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 750, letterSpacing: "-0.025em", color: "#15171c" }}>Connect your CRM</h1>
        <p style={{ margin: "6px 0 28px", fontSize: 15, lineHeight: 1.5, color: "#6c6760", maxWidth: 620 }}>
          Preview of the live settings panel with the real logos. Only CRMs with a logo are shown. Request won&rsquo;t save on this preview route; the live page at Account &rarr; Connect your CRM does.
        </p>
        <ConnectCrmPanel catalogue={CRM_CATALOGUE} counts={DEMO_COUNTS} requested={[]} />
      </div>
    </div>
  );
}

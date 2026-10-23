"use client";

// /dev/chain-checkin-update — review page for critique #286.
//
// The chains check-in "Last update" line, redesigned: small + grey + subtle,
// with the confirmer's photo + name, and a proper sentence per confirmation.
// PROPOSED strings + layout — nothing is wired into the real page until signed
// off here. Dev-only (404 in production); review on localhost:3001.

import { notFound } from "next/navigation";
import { ContactAvatar } from "@/components/ui/Avatar";
import { CHECK_IN_STEPS, checkInConfirmationLine } from "@/lib/chain/check-in-steps";

// Stand-in values so the layout reads like a real row.
const WHO = "Ellis Askey";
const AGENCY = "Moves By Wright";
const WHEN = "24th Oct";

// The proposed new line, exactly as it would render on a check-in row.
function LastUpdateLine({ stepKey, withPhoto }: { stepKey: string; withPhoto: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <ContactAvatar
        contact={{ name: WHO, roleType: "agent" }}
        size={22}
        image={withPhoto ? "https://i.pravatar.cc/80?img=12" : null}
      />
      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
        {checkInConfirmationLine(stepKey, WHO, AGENCY)}
        <span style={{ color: "var(--agent-text-faint, #b8b0a4)" }}> · {WHEN}</span>
      </p>
    </div>
  );
}

export default function DevChainCheckinUpdatePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 20px 80px" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--agent-text-primary)", margin: 0 }}>
        Chains check-in · &ldquo;Last update&rdquo; line
      </h1>
      <p style={{ fontSize: 13, color: "var(--agent-text-secondary)", margin: "6px 0 0", lineHeight: 1.5 }}>
        Critique #286. New look (small, grey, subtle) with the confirmer&rsquo;s photo + name, and a
        full sentence per confirmation. These are the PROPOSED strings for every step — confirm or
        reword, then I&rsquo;ll wire it into the real check-in row.
      </p>

      {/* Before / after, so the change is obvious */}
      <div style={{ marginTop: 28, display: "grid", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--agent-text-muted)", marginBottom: 6 }}>Now</div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-secondary)" }}>
            <span style={{ fontWeight: 700, color: "var(--agent-success, #15803d)", background: "var(--agent-success-bg, rgba(21,128,61,0.1))", padding: "1px 7px", borderRadius: 99, marginRight: 6 }}>Last update {WHEN}</span>
            Confirmed: dcp issued
          </p>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--agent-coral-deep)", marginBottom: 6 }}>Proposed</div>
          <LastUpdateLine stepKey="dcp_issued" withPhoto />
          <div style={{ fontSize: 11, color: "var(--agent-text-faint, #b8b0a4)", marginTop: 6 }}>
            (photo shows when the confirmer has one; otherwise the tinted initials below)
          </div>
          <div style={{ marginTop: 8 }}><LastUpdateLine stepKey="dcp_issued" withPhoto={false} /></div>
        </div>
      </div>

      {/* Every step's proposed sentence */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", margin: "34px 0 4px" }}>All step confirmations</h2>
      <p style={{ fontSize: 12, color: "var(--agent-text-muted)", margin: "0 0 14px" }}>Format: &ldquo;{WHO} received confirmation from {AGENCY} that &hellip;&rdquo;</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "16px 18px", borderRadius: 12, background: "var(--agent-surface-elevated, #fff)", border: "0.5px solid var(--agent-border-subtle)" }}>
        {CHECK_IN_STEPS.map((s) => (
          <div key={s.key}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--agent-text-faint, #b8b0a4)", marginBottom: 3 }}>{s.label}</div>
            <LastUpdateLine stepKey={s.key} withPhoto={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

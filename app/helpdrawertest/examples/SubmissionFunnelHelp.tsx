"use client";

import { SubmissionFunnel } from "@/components/analytics/SubmissionFunnel";
import type { SubmissionFunnelData } from "@/lib/services/analytics";

const MOCK_DATA: SubmissionFunnelData = {
  stages: [
    { key: "submitted", label: "Submitted", count: 24 },
    { key: "exchanged", label: "Exchanged", count: 18 },
    { key: "completed", label: "Completed", count: 11 },
  ],
  conversions: [
    { from: "submitted", to: "exchanged", percent: 75 },
    { from: "exchanged", to: "completed", percent: 61 },
  ],
};

export function SubmissionFunnelHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ padding: "16px 20px" }}>
      <SubmissionFunnel data={MOCK_DATA} />
    </div>
  );
}

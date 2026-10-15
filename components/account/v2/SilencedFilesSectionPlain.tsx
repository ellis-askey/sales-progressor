"use client";

// components/account/v2/SilencedFilesSectionPlain.tsx
//
// Read-only "Paused files" roster on the Account/Notifications tab (settings
// consolidation, D3). Pausing and resuming a sale's automated client emails now
// happens ONLY on the sale itself (its Client-settings drawer), so there is a
// single source of truth. This section is a visibility list of what's currently
// paused, with a link to each file — it no longer silences or resumes here.

import Link from "next/link";
import { Bell, BellSlash, ArrowRight } from "@phosphor-icons/react";
import { AccountCard } from "@/components/account/chrome/AccountCard";

type FileRow = {
  id: string;
  propertyAddress: string;
  pausedAt: Date | null;
  pausedByName: string | null;
};

function relTime(d: Date | null): string {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
}

export function SilencedFilesSectionPlain({ initialSilenced }: { initialSilenced: FileRow[] }) {
  const silenced = initialSilenced;
  return (
    <AccountCard
      icon={<Bell size={18} weight="bold" />}
      title="Paused files"
      subtitle="Sales where automated client emails are paused. Pause or resume a sale from the sale itself."
      bodyStyle={{ marginTop: 12 }}
    >
      {silenced.length === 0 ? (
        <div style={{ textAlign: "center", padding: "26px 0 20px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", background: "rgba(255,107,74,0.10)", color: "var(--agent-coral-deep, #E2452A)", marginBottom: 12 }}>
            <BellSlash size={20} weight="bold" />
          </span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#111827" }}>No files are paused</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af" }}>Automated emails are running normally on all active files.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {silenced.map((f) => (
            <div
              key={f.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "10px 14px",
                background: "rgba(254, 243, 199, 0.30)",
                border: "0.5px solid rgba(217, 119, 6, 0.18)",
                borderRadius: 8,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.propertyAddress}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6b7280" }}>
                  Paused {relTime(f.pausedAt)}
                  {f.pausedByName ? ` by ${f.pausedByName}` : ""}
                </p>
              </div>
              <Link
                href={`/agent/transactions/${f.id}`}
                style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: "var(--agent-coral-deep, #E2452A)", background: "#fff", border: "0.5px solid rgba(0,0,0,0.14)", borderRadius: 6, textDecoration: "none" }}
              >
                Open file <ArrowRight size={12} weight="bold" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </AccountCard>
  );
}

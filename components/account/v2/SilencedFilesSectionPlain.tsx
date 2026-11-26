"use client";

// components/account/v2/SilencedFilesSectionPlain.tsx
//
// Read-only "Paused files" roster on the Account/Notifications tab (settings
// consolidation, D3). Pausing and resuming a sale's automated client emails now
// happens ONLY on the sale itself (its Client-settings drawer), so there is a
// single source of truth. This section is a visibility list of what's currently
// paused, with a link to each file — it no longer silences or resumes here.

import Link from "next/link";
import { Bell, BellSlash } from "@/components/icons/ph";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Badge } from "@/components/ui/Badge";
import { buttonClasses } from "@/components/arc/button/button";
import { LinkArrow } from "@/components/ui/LinkArrow";

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
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: "50%", background: "rgba(var(--agent-coral-rgb),0.10)", color: "var(--agent-coral-deep, #E2452A)", marginBottom: 12 }}>
            <BellSlash size={20} weight="bold" />
          </span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>No files are paused</p>
          <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--agent-text-tertiary)" }}>Automated emails are running normally on all active files.</p>
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
                padding: "11px 14px",
                background: "var(--agent-surface-subtle, rgba(45,24,16,0.03))",
                border: "1px solid var(--agent-border-subtle)",
                borderRadius: 10,
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.propertyAddress}
                  </p>
                  <Badge tone="amber">Paused</Badge>
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>
                  {relTime(f.pausedAt)}
                  {f.pausedByName ? `, by ${f.pausedByName}` : ""}
                </p>
              </div>
              <Link href={`/agent/transactions/${f.id}`} className={buttonClasses({ variant: "secondary", size: "sm" })} style={{ flexShrink: 0 }}>
                Open file <LinkArrow />
              </Link>
            </div>
          ))}
        </div>
      )}
    </AccountCard>
  );
}

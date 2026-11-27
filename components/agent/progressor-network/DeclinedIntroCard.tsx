"use client";

import { Button } from "@/components/ui/Button";
import type { ProgressorNetworkBusiness } from "@/lib/services/progressor-network";
import { readableOn } from "./shared";

// The "not taken up" state on the Introductions tab: a calm record that a
// request was declined, paired with the decline email. No blame and no dead end
// — View profile stays open, Dismiss clears the row, and the business shows
// normally on Discover so the agency can approach it again later. Same density
// as the other network cards so the grid stays even.

export function DeclinedIntroCard({
  business,
  onView,
  onDismiss,
}: {
  business: ProgressorNetworkBusiness;
  onView: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const b = business;
  const tileText = readableOn(b.brandColor);

  return (
    <div className="agent-glass pn-card" data-bloom style={{ borderRadius: "var(--agent-radius-xl)", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {b.logoPath ? (
          <div aria-hidden style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: "#fff", border: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", opacity: 0.85 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.logoPath} alt="" style={{ maxWidth: "82%", maxHeight: "82%", objectFit: "contain" }} />
          </div>
        ) : (
          <div aria-hidden style={{ width: 46, height: 46, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: b.brandColor, color: tileText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", opacity: 0.85 }}>
            {b.monogram}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", lineHeight: 1.25 }}>{b.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)" }}>Not taken up</p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
        They aren&apos;t accepting new connections right now. Nothing was shared, and you can approach them again from Discover whenever you like.
      </p>

      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <Button variant="secondary" size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onView(b.id)}>
          View profile
        </Button>
        <Button variant="ghost" size="sm" style={{ flex: 1, justifyContent: "center" }} onClick={() => onDismiss(b.id)}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}

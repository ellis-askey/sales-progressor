"use client";

import { useEffect, useState } from "react";
import { Check, PaperPlaneTilt, BookmarkSimple, Info } from "@phosphor-icons/react";
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { StatNumber } from "@/components/ui/StatNumber";
import type { ProgressorNetworkBusiness } from "@/lib/services/progressor-network";
import { tagIcon, readableOn, formatAvgExchange } from "./shared";

// "View profile" drawer: a fuller read of a business plus the connect CTA. The
// business can go null the instant the drawer starts closing, so we retain the
// last-shown business for the slide-out animation (no blank flash).
//
// Stat numerals use the StatNumber primitive; a business with no verified
// performance data shows a "new to the network" note instead. Status reads from
// outlined pills; the info callout uses a coral left-accent, not a faded wash.

export function ProgressorProfileDrawer({
  business,
  open,
  onClose,
  onConnect,
  onToggleSave,
}: {
  business: ProgressorNetworkBusiness | null;
  open: boolean;
  onClose: () => void;
  onConnect: (id: string) => void;
  onToggleSave: (id: string) => void;
}) {
  const [shown, setShown] = useState<ProgressorNetworkBusiness | null>(business);
  useEffect(() => {
    if (business) setShown(business);
  }, [business]);

  const b = business ?? shown;
  if (!b) return null;

  const tileText = readableOn(b.brandColor);
  const hasStats =
    b.stats.exchangeRatePct != null || (b.stats.exchangedFiles12mo ?? 0) > 0 || b.stats.teamSize > 0;

  const stats: { value: string; label: string }[] = [
    { value: b.stats.exchangeRatePct == null ? "–" : `${b.stats.exchangeRatePct}%`, label: "Exchange rate" },
    { value: b.stats.exchangedFiles12mo == null ? "–" : `${b.stats.exchangedFiles12mo}`, label: "Exchanged files (12 months)" },
    { value: formatAvgExchange(b.stats.avgTimeToExchangeWeeks), label: "Avg. time to exchange" },
    { value: `${b.stats.teamSize}`, label: "Team members" },
  ];

  return (
    <Drawer open={open} onClose={onClose} ariaLabel={`${b.name} profile`} size="md">
      <DrawerHeader>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {b.logoPath ? (
            <div
              aria-hidden
              style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: "#fff", border: "1px solid var(--agent-border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logoPath} alt="" style={{ maxWidth: "82%", maxHeight: "82%", objectFit: "contain" }} />
            </div>
          ) : (
            <div
              aria-hidden
              style={{ width: 48, height: 48, flexShrink: 0, borderRadius: "var(--agent-radius-md)", background: b.brandColor, color: tileText, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700 }}
            >
              {b.monogram}
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--agent-text-primary)" }}>{b.name}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{b.kind}</p>
          </div>
        </div>
      </DrawerHeader>

      <DrawerBody>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {b.availability === "accepting" && (
            <Pill tone="success" glass size="md"><Check size={12} weight="bold" /> Accepting new instructions</Pill>
          )}
          {b.connectionStatus === "connected" && (
            <Pill tone="brand" outline size="md">{b.viaNetwork ? "Connected via network" : "Connected"}</Pill>
          )}
          {b.connectionStatus === "requested" && <Pill tone="info" outline size="md">Request sent</Pill>}
        </div>

        <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>{b.blurb}</p>

        {hasStats ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
            {stats.map((s) => (
              <div key={s.label} className="agent-glass" style={{ borderRadius: "var(--agent-radius-md)", padding: "12px 16px" }}>
                <StatNumber size="sm">{s.value}</StatNumber>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--agent-text-muted)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="agent-glass" style={{ borderRadius: "var(--agent-radius-md)", padding: "14px 16px", marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-muted)", lineHeight: 1.5 }}>
              New to the network. Verified performance stats (exchange rate, time to exchange, completed sales) appear here as {b.name} completes sales on the platform.
            </p>
          </div>
        )}

        <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 600, color: "var(--agent-text-primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Specialisms &amp; coverage</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {b.tags.map((t) => {
            const Icon = tagIcon(t);
            return (
              <Pill key={t} tone="default" size="sm"><Icon size={11} weight="bold" /> {t}</Pill>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "12px 16px", borderRadius: "var(--agent-radius-md)", background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-subtle)", borderLeft: "2px solid var(--agent-coral-deep)" }}>
          <Info size={16} weight="bold" style={{ color: "var(--agent-coral-deep)", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.5 }}>
            Connecting adds {b.name} to your agency&apos;s progressors. You decide which sales to hand to them, one by one.
          </p>
        </div>
      </DrawerBody>

      <DrawerFooter>
        <Button variant="secondary" size="md" onClick={() => onToggleSave(b.id)}>
          <BookmarkSimple size={15} weight={b.saved ? "fill" : "regular"} /> {b.saved ? "Saved" : "Save"}
        </Button>
        {b.connectionStatus === "none" ? (
          <Button variant="primary" size="md" onClick={() => onConnect(b.id)}>
            <PaperPlaneTilt size={15} weight="bold" /> Request to connect
          </Button>
        ) : b.connectionStatus === "requested" ? (
          <Button variant="secondary" size="md" disabled>Request sent</Button>
        ) : (
          <Button variant="secondary" size="md" disabled><Check size={15} weight="bold" /> Connected</Button>
        )}
      </DrawerFooter>
    </Drawer>
  );
}

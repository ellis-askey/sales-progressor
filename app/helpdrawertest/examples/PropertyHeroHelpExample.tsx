"use client";

import { PropertyHero } from "@/components/transaction/PropertyHero";

const TEN_DAYS_FROM_NOW = new Date(Date.now() + 10 * 86400000);

export function PropertyHeroHelpExample(_props: Record<string, string>) {
  return (
    <div style={{ width: "100%", overflow: "hidden", borderRadius: 16 }}>
      <PropertyHero
        address="22 Birchwood Lane, Guildford, Surrey"
        agencyName="Hartwell Estates"
        status="active"
        tenure="leasehold"
        purchaseType="mortgage"
        purchasePrice={32500000}
        exchangeDate={TEN_DAYS_FROM_NOW}
        percent={62}
        onTrack="on_track"
        serviceType="self_managed"
        backHref="/agent/dashboard"
      />
    </div>
  );
}

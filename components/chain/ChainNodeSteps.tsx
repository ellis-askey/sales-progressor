"use client";

// The onward/related tracker steps rendered INSIDE a chain-drawer node (gqu39v).
// Same tracker + "reported" data as the file overview's chain focus panel — just
// reachable from the drawer, so an agent chasing a neighbour can tick steps on
// the call without leaving for the file. Lazily fetches the near + far views the
// first time the node flips to "Their steps"; reuses OnwardPurchaseCard exactly
// as the overview does (embedded, near/far side toggle).

import { useState, useEffect } from "react";
import { OnwardPurchaseCard } from "@/components/transaction/OnwardPurchaseCard";
import type { OnwardTrackerView } from "@/lib/services/onward";
import {
  getOnwardTrackerViewAction,
  getOnwardSellerViewAction,
  getRelatedSaleViewAction,
  getRelatedBuyerViewAction,
} from "@/app/actions/onward";

export function ChainNodeSteps({
  transactionId,
  direction,
  address,
}: {
  // OUR file — the trackers are keyed to it (the onward/related is its neighbour).
  transactionId: string;
  direction: "onward" | "related";
  address: string | null;
}) {
  const isOnward = direction === "onward";
  const [nearView, setNearView] = useState<OnwardTrackerView | null>(null);
  const [farView, setFarView] = useState<OnwardTrackerView | null>(null);
  const [far, setFar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const [n, f] = await Promise.all([
          isOnward ? getOnwardTrackerViewAction(transactionId) : getRelatedSaleViewAction(transactionId),
          isOnward ? getOnwardSellerViewAction(transactionId) : getRelatedBuyerViewAction(transactionId),
        ]);
        if (!alive) return;
        setNearView(n);
        setFarView(f);
      } catch {
        if (alive) setError("Couldn't load their steps. Try again.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [transactionId, isOnward]);

  const nearLabel = isOnward ? "Buyer's steps" : "Seller's steps";
  const farLabel = isOnward ? "Seller's steps" : "Buyer's steps";
  const farDirection: "onward_seller" | "related_buyer" = isOnward ? "onward_seller" : "related_buyer";

  if (loading) {
    return <p style={{ margin: 0, padding: "8px 2px", fontSize: 12, color: "var(--agent-text-muted)" }}>Loading their steps…</p>;
  }
  if (error || !nearView || !farView) {
    return <p style={{ margin: 0, padding: "8px 2px", fontSize: 12, color: "var(--agent-danger)" }}>{error ?? "Couldn't load their steps."}</p>;
  }

  return (
    <div style={{ paddingTop: 2 }}>
      <div role="tablist" aria-label="Which side" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button
          type="button" role="tab" aria-selected={!far}
          className={`agent-segment-pill agent-segment-pill-sm${!far ? " on" : ""}`}
          onClick={() => setFar(false)}
        >{nearLabel}</button>
        <button
          type="button" role="tab" aria-selected={far}
          className={`agent-segment-pill agent-segment-pill-sm${far ? " on" : ""}`}
          onClick={() => setFar(true)}
        >{farLabel}</button>
      </div>
      <OnwardPurchaseCard
        key={far ? "far" : "near"}
        embedded
        defaultStepsOpen
        transactionId={transactionId}
        initialView={far ? farView : nearView}
        onwardAddress={address}
        direction={far ? farDirection : direction}
        seedTenure={far ? nearView.tenure : null}
        seedShareOfFreehold={far ? nearView.isShareOfFreehold : false}
      />
    </div>
  );
}

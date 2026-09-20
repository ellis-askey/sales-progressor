"use client";

// The compact ordered chain list shown in the left panel of the Map command
// centre. One row per property in real chain order: numbered + status-coloured
// (matching the map pins), photo, address, agency, status, progress. Selecting a
// row highlights its map pin; a selected pin scrolls its row into view.

import { useEffect, useRef } from "react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { CHAIN_STATUS_COLOR, CHAIN_STATUS_LABEL, type ChainMapStatus } from "@/components/chain/ChainGeoMap";

export type ChainMapPanelItem = {
  id: string;
  displayPos: number;
  line1: string;
  line2: string;
  agency: string | null;
  photoUrl: string | null;
  status: ChainMapStatus;
  progressPercent: number | null;
};

export function ChainMapPanel({
  items,
  selectedId,
  onSelect,
}: {
  items: ChainMapPanelItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (selectedId) selRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (items.length === 0) {
    return <p className="cmp-empty">No properties to place on the map yet.</p>;
  }

  return (
    <div className="cmp-list">
      {items.map((it) => {
        const on = it.id === selectedId;
        return (
          <button
            key={it.id}
            ref={on ? selRef : undefined}
            type="button"
            className={`cmp-row${on ? " on" : ""}`}
            onClick={() => onSelect(it.id)}
          >
            <span className="cmp-num" style={{ background: CHAIN_STATUS_COLOR[it.status] }}>{it.displayPos}</span>
            <PropertyThumb photoUrl={it.photoUrl} size={44} />
            <span className="cmp-txt">
              <span className="cmp-l1">{it.line1}</span>
              {it.line2 && <span className="cmp-l2">{it.line2}</span>}
              <span className="cmp-meta">
                <span className="cmp-status" style={{ color: CHAIN_STATUS_COLOR[it.status] }}>{CHAIN_STATUS_LABEL[it.status]}</span>
                {it.agency && <span className="cmp-agency">· {it.agency}</span>}
              </span>
              {it.progressPercent != null && (
                <span className="cmp-bar"><i style={{ width: `${Math.min(100, Math.max(0, it.progressPercent))}%` }} /></span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

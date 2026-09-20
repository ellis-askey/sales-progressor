"use client";

// The compact ordered chain list shown in the left panel of the Map command
// centre. One row per property in real chain order — numbered + status-coloured
// (matching the map pins), photo, address, agency, status, progress — plus the
// key Timeline actions transferred in: Send/Resend invite, Open file, and Add
// sale above/below. Onward purchases (branches) are indented under the property
// they fork from. Selecting a row highlights its map pin; a selected pin scrolls
// its row into view.

import { useEffect, useRef } from "react";
import Link from "next/link";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { CHAIN_STATUS_COLOR, CHAIN_STATUS_LABEL, type ChainMapStatus } from "@/components/chain/chain-map-shared";

export type ChainMapPanelItem = {
  id: string;
  label: string; // number for a spine property, "↑" for an onward purchase
  onward?: boolean;
  line1: string;
  line2: string;
  agency: string | null;
  photoUrl: string | null;
  status: ChainMapStatus;
  progressPercent: number | null;
  href: string | null; // open the file (your own sales)
  invite: "send" | "resend" | null; // invite the stub agent
};

export function ChainMapPanel({
  items,
  selectedId,
  onSelect,
  onInvite,
  onAddAbove,
  onAddBelow,
  busyInviteId,
}: {
  items: ChainMapPanelItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInvite?: (linkId: string) => void;
  onAddAbove?: () => void;
  onAddBelow?: () => void;
  busyInviteId?: string | null;
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
      {onAddAbove && <button type="button" className="chain-addbtn chain-addbtn-above" onClick={onAddAbove}>+ Add sale above</button>}

      {items.map((it) => {
        const on = it.id === selectedId;
        const acts = !!it.href || (!!it.invite && !!onInvite);
        return (
          <div key={it.id} className={`cmp-rowwrap${it.onward ? " cmp-rowwrap--onward" : ""}`}>
            <button
              ref={on ? selRef : undefined}
              type="button"
              className={`cmp-row${on ? " on" : ""}`}
              onClick={() => onSelect(it.id)}
            >
              <span className="cmp-num" style={{ background: CHAIN_STATUS_COLOR[it.status] }}>{it.label}</span>
              <PropertyThumb photoUrl={it.photoUrl} size={40} />
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

            {acts && (
              <div className="cmp-acts">
                {it.href && <Link href={it.href} className="cmp-act cmp-act--primary">Open file →</Link>}
                {it.invite && onInvite && (
                  <button
                    type="button"
                    className="cmp-act"
                    disabled={busyInviteId === it.id}
                    onClick={() => onInvite(it.id)}
                  >
                    {busyInviteId === it.id ? "Sending…" : it.invite === "resend" ? "Resend invite" : "Send invite"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {onAddBelow && <button type="button" className="chain-addbtn chain-addbtn-below" onClick={onAddBelow}>+ Add sale below</button>}
    </div>
  );
}

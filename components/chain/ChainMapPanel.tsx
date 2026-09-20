"use client";

// The compact ordered chain list shown in the left panel of the Map command
// centre. One row per property in real chain order — numbered + status-coloured
// (matching the map pins), photo, address, agency, status, progress — plus the
// Timeline actions: Send/Resend invite, Open file, a ⋯ menu (edit / add onward /
// move / chase / photo / share link / remove), and Add sale above/below. Onward
// purchases are indented under the property they fork from. Selecting a row
// highlights its map pin; a selected pin scrolls its row into view.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  // ⋯ menu capabilities
  canEdit: boolean;
  hasShareLink: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canAddOnward: boolean;
  canUploadPhoto: boolean;
  chaseDir: "onward" | "related" | null;
};

export type ChainMapActions = {
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
  onCopyShare?: (id: string) => void;
  onRevokeShare?: (id: string) => void;
  onMoveUp?: (id: string) => void;
  onMoveDown?: (id: string) => void;
  onAddOnward?: (id: string) => void;
  onChase?: (id: string) => void;
  onUploadPhoto?: (id: string, file: File) => void;
};

function RowMenu({ item, actions }: { item: ChainMapPanelItem; actions: ChainMapActions }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("scroll", onScroll, true); };
  }, [open]);

  const rows: { label: string; onClick: () => void; danger?: boolean }[] = [];
  if (item.canEdit && actions.onEdit) rows.push({ label: "Edit details", onClick: () => actions.onEdit!(item.id) });
  if (item.canAddOnward && actions.onAddOnward) rows.push({ label: "Add onward purchase", onClick: () => actions.onAddOnward!(item.id) });
  if (item.canMoveUp && actions.onMoveUp) rows.push({ label: "Move up", onClick: () => actions.onMoveUp!(item.id) });
  if (item.canMoveDown && actions.onMoveDown) rows.push({ label: "Move down", onClick: () => actions.onMoveDown!(item.id) });
  if (item.chaseDir && actions.onChase) rows.push({ label: "Chase agent", onClick: () => actions.onChase!(item.id) });
  if (item.canUploadPhoto && actions.onUploadPhoto) rows.push({ label: item.photoUrl ? "Change photo" : "Add photo", onClick: () => fileRef.current?.click() });
  if (item.canEdit && actions.onCopyShare) rows.push({ label: "Copy share link", onClick: () => actions.onCopyShare!(item.id) });
  if (item.canEdit && item.hasShareLink && actions.onRevokeShare) rows.push({ label: "Revoke share link", onClick: () => actions.onRevokeShare!(item.id) });
  if (item.canEdit && actions.onRemove) rows.push({ label: "Remove", danger: true, onClick: () => actions.onRemove!(item.id) });

  if (rows.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="cmp-menu-btn"
        aria-label="More actions"
        onClick={(e) => {
          e.stopPropagation();
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
          setOpen((o) => !o);
        }}
      >
        ⋯
      </button>
      {actions.onUploadPhoto && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.onUploadPhoto!(item.id, f); e.target.value = ""; }}
        />
      )}
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popRef} className="cmp-menu" style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }} onClick={(e) => e.stopPropagation()}>
          {rows.map((r) => (
            <button
              key={r.label}
              type="button"
              className={`cmp-menu-item${r.danger ? " danger" : ""}`}
              onClick={() => { setOpen(false); r.onClick(); }}
            >
              {r.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function ChainMapPanel({
  items,
  selectedId,
  onSelect,
  onInvite,
  onAddAbove,
  onAddBelow,
  busyInviteId,
  actions = {},
}: {
  items: ChainMapPanelItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInvite?: (linkId: string) => void;
  onAddAbove?: () => void;
  onAddBelow?: () => void;
  busyInviteId?: string | null;
  actions?: ChainMapActions;
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
            <div className="cmp-rowline">
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
              <RowMenu item={it} actions={actions} />
            </div>

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

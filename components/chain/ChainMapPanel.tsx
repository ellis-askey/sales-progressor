"use client";

// The compact ordered chain list shown in the left panel of the Map command
// centre. One row per property in real chain order — numbered + status-coloured
// (matching the map pins), photo, address, agency, status, progress — plus the
// Timeline actions: the status-driven primary CTA (Add email / Send invite /
// Resend / Update email & resend), Open file, and a ⋮ menu (edit / add onward /
// move / chase / photo / share link / remove). Everything for one property lives
// inside its card. Onward purchases are indented under the property they fork
// from. Selecting a row highlights its map pin; a selected pin scrolls its row
// into view.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { CHAIN_STATUS_COLOR, type ChainMapStatus } from "@/components/chain/chain-map-shared";

// The primary call-to-action for a row, mirroring the Timeline's status-driven
// buttons. `kind` tells the panel which handler to call: "invite" → onInvite
// (send/resend), "edit" → actions.onEdit (opens the edit drawer to add/fix the
// agent email).
export type ChainMapCta = { label: string; kind: "invite" | "edit"; tone: "primary" | "normal" | "warn" };

export type ChainMapPanelItem = {
  id: string;
  label: string; // number for a spine property, "↑" for an onward purchase
  onward?: boolean;
  line1: string;
  line2: string;
  agency: string | null;
  photoUrl: string | null;
  status: ChainMapStatus; // drives the numbered pin colour (5-state, matches the map)
  statusLabel: string; // exact Timeline label (Unclaimed / Invited / Bounced / Declined / Claimed / Your file)
  statusDanger: boolean; // bounced / declined — render the label in danger
  progressPercent: number | null;
  href: string | null; // open the file (your own sales)
  cta: ChainMapCta | null;
  // ⋮ menu capabilities
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
  onEditEmail?: (id: string) => void; // Add email / Update email & resend — opens Edit focused on the email field
  onInsert?: (id: string, placement: "above" | "below") => void; // insert a sale beside this one
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
  const { theme } = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Close on Escape / scroll / resize, so the fixed-positioned menu never drifts
  // from its button (mirrors the Timeline's CardMenu).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
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
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) {
            const r = btnRef.current?.getBoundingClientRect();
            if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
          }
          setOpen((o) => !o);
        }}
      >
        ⋮
      </button>
      {actions.onUploadPhoto && (
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) actions.onUploadPhoto!(item.id, f); e.target.value = ""; }}
        />
      )}
      {open && pos && typeof document !== "undefined" && createPortal(
        // data-theme re-establishes the agent token scope: the portal renders under
        // <body>, outside the AgentShell where --agent-* live, so without this the
        // menu would resolve every token to nothing and render unstyled.
        <div data-theme={theme}>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 1600 }} />
          <div role="menu" className="cmp-menu" style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 1601 }}>
            {rows.map((r) => (
              <button
                key={r.label}
                type="button"
                role="menuitem"
                className={`cmp-menu-item${r.danger ? " danger" : ""}`}
                onClick={(e) => { e.stopPropagation(); setOpen(false); r.onClick(); }}
              >
                {r.label}
              </button>
            ))}
          </div>
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
  const selRef = useRef<HTMLDivElement>(null);
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
        const busy = busyInviteId === it.id;
        const runCta = () => {
          if (!it.cta) return;
          if (it.cta.kind === "invite") onInvite?.(it.id);
          else (actions.onEditEmail ?? actions.onEdit)?.(it.id);
        };
        const acts = !!it.href || !!it.cta;
        return (
          <div
            key={it.id}
            ref={on ? selRef : undefined}
            className={`cmp-rowwrap${it.onward ? " cmp-rowwrap--onward" : ""}${on ? " on" : ""}`}
          >
            <div className="cmp-rowline">
              <button type="button" className="cmp-row" onClick={() => onSelect(it.id)}>
                <span className="cmp-num" style={{ background: CHAIN_STATUS_COLOR[it.status] }}>{it.label}</span>
                <PropertyThumb photoUrl={it.photoUrl} size={40} />
                <span className="cmp-txt">
                  <span className="cmp-l1">{it.line1}</span>
                  {it.line2 && <span className="cmp-l2">{it.line2}</span>}
                  <span className="cmp-meta">
                    <span className="cmp-status" style={{ color: it.statusDanger ? "var(--agent-danger)" : CHAIN_STATUS_COLOR[it.status] }}>{it.statusLabel}</span>
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
                {it.cta && (
                  <button
                    type="button"
                    className={`cmp-act cmp-act--${it.cta.tone}`}
                    disabled={it.cta.kind === "invite" && busy}
                    onClick={runCta}
                  >
                    {it.cta.kind === "invite" && busy ? "Sending…" : it.cta.label}
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

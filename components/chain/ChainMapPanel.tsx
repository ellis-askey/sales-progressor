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

import { Fragment, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { CHAIN_STATUS_COLOR, type ChainMapStatus } from "@/components/chain/chain-map-shared";
import type { ChainCardBadge } from "@/components/chain/LinkCard";

// The primary call-to-action for a row, mirroring the Timeline's status-driven
// buttons. `kind` tells the panel which handler to call: "invite" → onInvite
// (send/resend), "edit" → actions.onEdit (opens the edit drawer to add/fix the
// agent email).
export type ChainMapCta = { label: string; kind: "invite" | "edit"; tone: "primary" | "normal" | "warn" };

export type ChainMapPanelItem = {
  id: string;
  label: string; // number for a spine property, "↑" for an onward purchase
  depth: number; // 0 = spine (the trunk); each fork level indents one more, with a rail
  forkParent: boolean; // has branch onwards above it → the rail curves down into this card
  branchTop: boolean; // top of its own ladder (no sale above it) → caps the rail
  canColumnAdd: boolean; // this is the top of its own ladder → offer "+ add sale above"
  line1: string;
  line2: string;
  agency: string | null;
  photoUrl: string | null;
  status: ChainMapStatus; // drives the numbered pin colour (5-state, matches the map)
  statusLabel: string; // exact Timeline label (Unclaimed / Invited / Bounced / Declined / Claimed / Your file)
  statusDanger: boolean; // bounced / declined — render the label in danger
  // Signals ported from the Timeline card (parity for the drawer swap):
  claimedByName: string | null; // shown inline as "Claimed by {name}" for another agency's file
  priceLabel: string | null; // £ figure on your own file
  metaLine: string | null; // relative-time context ("Invite sent · 2h ago", "Chased · 3d ago")
  badges: ChainCardBadge[]; // withdrawal / cascade badges
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
  // Expandable detail (intel / notes / contact / onward), prebuilt by ChainView
  // via the shared ChainCardExpand. null when there's nothing to show.
  expand: ReactNode | null;
  // A hover "+" may appear in the gap above this card to insert a sale between
  // it and the one above (same-ladder pairs only).
  canInsertAbove: boolean;
};

export type ChainMapActions = {
  onEdit?: (id: string) => void;
  onEditEmail?: (id: string) => void; // Add email / Update email & resend — opens Edit focused on the email field
  onColumnAdd?: (id: string) => void; // grow this column upward (add above its ladder top)
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

// A hover-revealed "+" in the gap between two cards — the lineless equivalent of
// the Timeline's connector insert. Inserts a sale between this card and the one
// above it.
function InsertStrip({ onClick, label = "Insert a sale here" }: { onClick: () => void; label?: string }) {
  return (
    <div className="cmp-insert">
      <button type="button" className="cmp-insert-btn" onClick={onClick} aria-label={label} title={label}>+</button>
    </div>
  );
}

// Indents a row by its depth in the chain tree and draws the rail guides that
// show branching. depth 0 (the spine) renders no guide. Each deeper level adds
// one guide column with a continuous vertical line, so a fork's onward purchases
// read as a grouped branch hanging off the sale below them.
function TreeRow({
  depth,
  spacing = "card",
  railThrough = false,
  railCap,
  children,
}: {
  depth: number;
  spacing?: "card" | "tight" | "none";
  // Draw the branch rail straight through this row (at the branch depth, +8px into
  // the body). Used on the thin add/insert rows that sit between a fork sale and
  // its branches, so the rail stays one continuous line down to the fork card.
  railThrough?: boolean;
  // Cap the rail at the top of a branch: "top" starts the branch's own rail at the
  // elbow of its topmost card (a right angle, not a line running past it); "none"
  // hides the rail entirely (the add row above that top card).
  railCap?: "top" | "none";
  children: ReactNode;
}) {
  return (
    <div className="cmp-tree">
      {Array.from({ length: depth }).map((_, i) => {
        const last = i === depth - 1;
        // The guide nearest the card gets an elbow tick (card rows only) so each
        // branch visibly hooks onto the rail. railCap trims the last (own) guide.
        let cls = "cmp-guide";
        if (last && spacing === "card") cls += " cmp-guide--elbow";
        if (last && railCap === "top") cls += " cmp-guide--captop";
        if (last && railCap === "none") cls += " cmp-guide--capnone";
        return <span key={i} className={cls} aria-hidden />;
      })}
      <div className={`cmp-tree-body cmp-tree-body--${spacing}${railThrough ? " cmp-tree-body--rail" : ""}`}>{children}</div>
    </div>
  );
}

// One property card: the selectable row, its chevron (expand) + ⋮ menu, the
// action bar, and the expandable detail body. Owns its own expand state.
function PanelRow({
  item,
  selected,
  busyInviteId,
  onSelect,
  onInvite,
  actions,
  innerRef,
}: {
  item: ChainMapPanelItem;
  selected: boolean;
  busyInviteId?: string | null;
  onSelect: (id: string) => void;
  onInvite?: (id: string) => void;
  actions: ChainMapActions;
  innerRef?: Ref<HTMLDivElement>;
}) {
  const [expanded, setExpanded] = useState(false);
  const busy = busyInviteId === item.id;
  const runCta = () => {
    if (!item.cta) return;
    if (item.cta.kind === "invite") onInvite?.(item.id);
    else (actions.onEditEmail ?? actions.onEdit)?.(item.id);
  };
  const acts = !!item.href || !!item.cta;
  return (
    <div ref={innerRef} className={`cmp-rowwrap${item.depth > 0 ? " cmp-rowwrap--branch" : ""}${selected ? " on" : ""}`}>
      <div className="cmp-rowline">
        <button type="button" className="cmp-row" onClick={() => onSelect(item.id)}>
          <span className="cmp-num" style={{ background: CHAIN_STATUS_COLOR[item.status] }}>{item.label}</span>
          <PropertyThumb photoUrl={item.photoUrl} size={40} />
          <span className="cmp-txt">
            <span className="cmp-l1">{item.line1}</span>
            {item.line2 && <span className="cmp-l2">{item.line2}</span>}
            <span className="cmp-meta">
              <span className="cmp-status" style={{ color: item.statusDanger ? "var(--agent-danger)" : CHAIN_STATUS_COLOR[item.status] }}>{item.statusLabel}</span>
              {item.claimedByName
                ? <span className="cmp-claimer">by {item.claimedByName}</span>
                : item.agency && <span className="cmp-agency">· {item.agency}</span>}
            </span>
            {item.metaLine && <span className="cmp-submeta">{item.metaLine}</span>}
            {item.badges.length > 0 && (
              <span className="cmp-badges">
                {item.badges.map((b, i) => (
                  <span key={i} className={`cmp-badge cmp-badge--${b.tone}`}>{b.label}</span>
                ))}
              </span>
            )}
          </span>
        </button>
        <div className="cmp-rowtools">
          {item.expand && (
            <button
              type="button"
              className="cmp-chevron"
              aria-expanded={expanded}
              aria-label={expanded ? "Hide details" : "Show details"}
              onClick={() => setExpanded((v) => !v)}
            >
              <span aria-hidden style={{ display: "inline-block", transition: "transform 0.22s ease", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
            </button>
          )}
          <RowMenu item={item} actions={actions} />
        </div>
      </div>

      {item.progressPercent != null && (
        <div className="cmp-progress">
          <span className="cmp-pct">{Math.round(item.progressPercent)}%</span>
          <span className="cmp-bar"><i style={{ width: `${Math.min(100, Math.max(0, item.progressPercent))}%` }} /></span>
          {item.priceLabel && <span className="cmp-price">{item.priceLabel}</span>}
        </div>
      )}

      {acts && (
        <div className="cmp-acts">
          {item.href && <Link href={item.href} className="cmp-act cmp-act--primary">Open file →</Link>}
          {item.cta && (
            <button
              type="button"
              className={`cmp-act cmp-act--${item.cta.tone}`}
              disabled={item.cta.kind === "invite" && busy}
              onClick={runCta}
            >
              {item.cta.kind === "invite" && busy ? "Sending…" : item.cta.label}
            </button>
          )}
        </div>
      )}

      {item.expand && (
        <div className={`cmp-expand${expanded ? " open" : ""}`}>
          <div><div className="cmp-expand-inner">{item.expand}</div></div>
        </div>
      )}
    </div>
  );
}

export function ChainMapPanel({
  items,
  selectedId,
  onSelect,
  onInvite,
  onAddBelow,
  busyInviteId,
  actions = {},
}: {
  items: ChainMapPanelItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onInvite?: (linkId: string) => void;
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
      {items.map((it) => (
        <Fragment key={it.id}>
          {/* Grow a column upward. The spine (depth 0) keeps its clear "+ Add sale
              above" button; branch columns use the discoverable "+" circle instead,
              so the tree stays clean — the same circle as insert-between. */}
          {it.canColumnAdd && actions.onColumnAdd && (
            it.depth === 0 ? (
              <TreeRow depth={0} spacing="tight" railThrough={it.forkParent}>
                <button type="button" className="chain-addbtn chain-addbtn-above cmp-coladd" onClick={() => actions.onColumnAdd!(it.id)}>+ Add sale above</button>
              </TreeRow>
            ) : (
              <TreeRow depth={it.depth} spacing="none" railThrough={it.forkParent} railCap="none">
                <InsertStrip onClick={() => actions.onColumnAdd!(it.id)} label="Add a sale above" />
              </TreeRow>
            )
          )}
          {/* Insert between two sales in the same branch (a real adjacent pair). On a
              fork sale this thin row also carries the rail down to the card. */}
          {it.canInsertAbove && actions.onInsert && (
            <TreeRow depth={it.depth} spacing="none" railThrough={it.forkParent}>
              <InsertStrip onClick={() => actions.onInsert!(it.id, "above")} />
            </TreeRow>
          )}
          <TreeRow depth={it.depth} railCap={it.branchTop && it.depth > 0 ? "top" : undefined}>
            <PanelRow
              item={it}
              selected={it.id === selectedId}
              innerRef={it.id === selectedId ? selRef : undefined}
              busyInviteId={busyInviteId}
              onSelect={onSelect}
              onInvite={onInvite}
              actions={actions}
            />
          </TreeRow>
        </Fragment>
      ))}

      {onAddBelow && <button type="button" className="chain-addbtn chain-addbtn-below" onClick={onAddBelow}>+ Add sale below</button>}
    </div>
  );
}

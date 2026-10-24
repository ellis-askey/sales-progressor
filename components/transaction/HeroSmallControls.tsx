"use client";

// Small-screen hero action controls (critique). On desktop the file hero keeps
// its separate pinned pills (Settings top-right, Remove/Add photo over the
// photo). On smaller screens those stacked awkwardly, so this component groups
// them:
//   • Tablet  → an icon-only cluster top-right (Settings + photo action).
//   • Mobile  → a single overflow (kebab) button that opens a small menu with
//               the real controls (full labels), on the canonical Popover.
// The Settings control is the same instance passed down from the hero (its
// drawer lives inside it), so nothing is duplicated.

import { type ReactNode } from "react";
import { DotsThreeVertical, Trash, Camera, Note } from "@phosphor-icons/react/dist/ssr";
import { StickyAddButton, spawnStickyNote } from "@/components/sticky/StickyAddButton";
import { Popover } from "@/components/ui/Popover";

export function HeroSmallControls({
  settingsSlot,
  transactionId,
  hasPhoto,
  showMap,
  busy,
  onRemove,
  onAdd,
  mobile,
}: {
  settingsSlot?: ReactNode;
  transactionId?: string;
  hasPhoto: boolean;
  showMap: boolean;
  busy: boolean;
  onRemove: () => void;
  onAdd: () => void;
  mobile: boolean;
}) {
  // Adding a photo on mobile is handled by the mobile photo strip's own pill, so
  // the kebab only offers Remove there; the tablet cluster offers Add too.
  const photoIsAdd = showMap && !hasPhoto;
  const showPhoto = !!transactionId && (hasPhoto || (photoIsAdd && !mobile));

  if (!settingsSlot && !showPhoto) return null;

  const photoButton = (onDone?: () => void) => showPhoto ? (
    <button
      type="button"
      className="hero-ctl-photo"
      disabled={busy}
      onClick={() => { (photoIsAdd ? onAdd : onRemove)(); onDone?.(); }}
    >
      {photoIsAdd ? <Camera size={14} weight="regular" /> : <Trash size={14} weight="regular" />}
      <span className="hero-ctl-photo-label">{photoIsAdd ? (busy ? "Uploading…" : "Add photo") : "Remove photo"}</span>
    </button>
  ) : null;

  if (mobile) {
    return (
      <div className="hero-ctl-sm">
        <Popover
          preset="menu"
          placement="bottom-end"
          trigger={
            <button
              type="button"
              className="hero-ctl-kebab"
              aria-haspopup="menu"
              aria-label="File actions"
            >
              <DotsThreeVertical size={18} weight="bold" />
            </button>
          }
        >
          {(close) => (
            // Keep the .hero-ctl-menu class so its descendant item rules
            // (full-width transparent rows + lift hover) still apply, but
            // neutralise its surface/position — the Popover owns those now.
            <div className="hero-ctl-menu" style={{ position: "static", background: "none", border: "none", boxShadow: "none", padding: 0, minWidth: 0 }}>
              {settingsSlot}
              {transactionId && (
                <button
                  type="button"
                  className="hero-ctl-photo"
                  onClick={() => { spawnStickyNote(transactionId); close(); }}
                >
                  <Note size={14} weight="regular" />
                  <span className="hero-ctl-photo-label">Add a sticky note</span>
                </button>
              )}
              {photoButton(close)}
            </div>
          )}
        </Popover>
      </div>
    );
  }

  // Tablet: icon-only cluster. Sticky trigger sits left of Settings, as on desktop.
  return (
    <div className="hero-ctl-sm hero-ctl-icononly">
      {transactionId && <StickyAddButton transactionId={transactionId} />}
      {settingsSlot}
      {photoButton()}
    </div>
  );
}

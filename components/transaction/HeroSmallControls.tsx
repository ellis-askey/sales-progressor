"use client";

// Small-screen hero action controls (critique). On desktop the file hero keeps
// its separate pinned pills (Settings top-right, Remove/Add photo over the
// photo). On smaller screens those stacked awkwardly, so this component groups
// them:
//   • Tablet  → an icon-only cluster top-right (Settings + photo action).
//   • Mobile  → a single overflow (kebab) button that opens a small menu with
//               the real controls (full labels).
// The Settings control is the same instance passed down from the hero (its
// drawer lives inside it), so nothing is duplicated.

import { useState, useRef, useEffect, type ReactNode } from "react";
import { DotsThreeVertical, Trash, Camera } from "@phosphor-icons/react/dist/ssr";

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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Adding a photo on mobile is handled by the mobile photo strip's own pill, so
  // the kebab only offers Remove there; the tablet cluster offers Add too.
  const photoIsAdd = showMap && !hasPhoto;
  const showPhoto = !!transactionId && (hasPhoto || (photoIsAdd && !mobile));

  if (!settingsSlot && !showPhoto) return null;

  const photoButton = showPhoto ? (
    <button
      type="button"
      className="hero-ctl-photo"
      disabled={busy}
      onClick={() => { (photoIsAdd ? onAdd : onRemove)(); setOpen(false); }}
    >
      {photoIsAdd ? <Camera size={14} weight="regular" /> : <Trash size={14} weight="regular" />}
      <span className="hero-ctl-photo-label">{photoIsAdd ? (busy ? "Uploading…" : "Add photo") : "Remove photo"}</span>
    </button>
  ) : null;

  if (mobile) {
    return (
      <div className="hero-ctl-sm" ref={ref}>
        <button
          type="button"
          className="hero-ctl-kebab"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="File actions"
          onClick={() => setOpen((v) => !v)}
        >
          <DotsThreeVertical size={18} weight="bold" />
        </button>
        {open && (
          <div className="hero-ctl-menu" role="menu">
            {settingsSlot}
            {photoButton}
          </div>
        )}
      </div>
    );
  }

  // Tablet: icon-only cluster.
  return (
    <div className="hero-ctl-sm hero-ctl-icononly">
      {settingsSlot}
      {photoButton}
    </div>
  );
}

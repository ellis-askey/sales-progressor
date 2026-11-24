"use client";

import { forwardRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CaretDown, CaretUp } from "@phosphor-icons/react";

// Canonical drawer header card. Two zones split by a hairline: a PROPERTY zone
// (photo + street bold on line 1, town/postcode beneath) and a RECIPIENT zone
// (a non-caps "To" label, avatar, name + role). When the recipient is pickable,
// the recipient zone is the dropdown trigger (chevron) — the picker menu itself
// stays with the caller, anchored to this card via the forwarded ref.
//
// Theme-aware via the --agent-* tokens. First used by ChaseDrawer. See
// docs/reference/COMPONENT_LIBRARY_CATALOG.md.
export const RecipientHeaderCard = forwardRef<
  HTMLDivElement,
  {
    photoUrl?: string | null;
    addressLine1: string;
    // Town / postcode (the remainder after the first comma). Omitted → single line.
    addressLine2?: string;
    // Omit (null) to render the property zone only — e.g. before a recipient is chosen.
    // `role` is the muted line under the name; `meta` is any extra lines beneath
    // it (e.g. an email + "last chased" for a cold-agent chase).
    recipient?: { name: string; role?: string; avatar: ReactNode; meta?: ReactNode } | null;
    // The recipient-zone label. Lowercase-friendly by design ("To", "Sending to").
    label?: string;
    // When true the recipient zone is a button that toggles the picker (chevron shown).
    interactive?: boolean;
    open?: boolean;
    onToggle?: () => void;
  }
>(function RecipientHeaderCard(
  { photoUrl, addressLine1, addressLine2, recipient, label = "To", interactive = false, open = false, onToggle },
  ref,
) {
  const [hover, setHover] = useState(false);

  const zoneStyle: CSSProperties = {
    width: "100%",
    textAlign: "left",
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "11px 14px 13px",
    border: "none",
    borderTop: "0.5px solid var(--agent-border-default)",
    background: hover && interactive ? "rgba(var(--agent-coral-rgb), 0.05)" : "transparent",
    cursor: interactive ? "pointer" : "default",
    transition: "background 140ms",
    font: "inherit",
  };

  const zoneInner = recipient && (
    <>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="agent-section-label agent-section-label-plain" style={{ display: "block", marginBottom: 6 }}>
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          {recipient.avatar}
          <span style={{ minWidth: 0, flex: 1 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {recipient.name}
            </span>
            {recipient.role && (
              <span style={{ display: "block", fontSize: 11.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {recipient.role}
              </span>
            )}
            {recipient.meta}
          </span>
        </div>
      </div>
      {interactive && (
        <span style={{ color: "var(--agent-text-muted)", display: "flex", flexShrink: 0 }}>
          {open ? <CaretUp size={15} /> : <CaretDown size={15} />}
        </span>
      )}
    </>
  );

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        background: "var(--agent-surface-elevated)",
        border: "0.5px solid var(--agent-border-default)",
        borderRadius: 16,
        boxShadow: "0 1px 2px rgba(var(--agent-shadow-rgb), 0.05), 0 10px 26px -14px rgba(var(--agent-shadow-rgb), 0.22)",
        overflow: "hidden",
      }}
    >
      {/* Property zone */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 14 }}>
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: 12,
            flexShrink: 0,
            overflow: "hidden",
            background: "transparent",
            border: photoUrl ? "0.5px solid rgba(var(--agent-coral-rgb), 0.18)" : "none",
          }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <span className="property-photo-fallback" aria-hidden style={{ display: "block", width: "100%", height: "100%" }} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "-0.012em" }}>
            {addressLine1}
          </p>
          {addressLine2 && (
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {addressLine2}
            </p>
          )}
        </div>
      </div>

      {/* Recipient zone (only once a recipient is chosen) */}
      {recipient && (
        interactive ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={zoneStyle}
          >
            {zoneInner}
          </button>
        ) : (
          <div style={zoneStyle}>{zoneInner}</div>
        )
      )}
    </div>
  );
});

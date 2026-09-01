"use client";
// Shared avatar/initials components for Contact and User records.
// Centralised gradient definitions — do not duplicate across files.

import { getInitials } from "@/lib/contacts/displayName";
import type { CSSProperties } from "react";

// ─── Gradient tokens ─────────────────────────────────────────────────────────

const SIDE_STYLES = {
  vendor: {
    bg: "linear-gradient(135deg, #E6F1FB 0%, #B5D4F4 100%)",
    color: "#0C447C",
  },
  purchaser: {
    bg: "linear-gradient(135deg, #E1F5EE 0%, #9FE1CB 100%)",
    color: "#085041",
  },
  internal: {
    bg: "linear-gradient(135deg, var(--agent-avatar-user-start, #FAEEDA) 0%, var(--agent-avatar-user-end, #FAC775) 100%)",
    color: "var(--agent-avatar-user-text, #633806)",
  },
  // Customer-agency agents — brand coral, to sit apart from the internal
  // progressor amber on the activity timeline.
  agent: {
    bg: "linear-gradient(135deg, #FFE3DB 0%, #FF9E86 100%)",
    color: "#7A2E15",
  },
  fallback: {
    bg: "linear-gradient(135deg, #F1EFE8 0%, #D3D1C7 100%)",
    color: "#444441",
  },
} as const;

type Side = keyof typeof SIDE_STYLES;

// ─── Default agent art ───────────────────────────────────────────────────────
// Branded fallback used for staff/agent avatars with no uploaded photo (client
// contacts keep their initials). Inlined so the three coral tones can be
// re-themed via CSS custom properties — they default to the source artwork's
// hexes, so a later per-agency primary-colour change can retint the avatar
// without touching this file. Source: Images/tsp-avatar.svg.
function DefaultAgentAvatarArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: "block" }} aria-hidden>
      <rect width="512" height="512" fill="var(--tsp-avatar-base, #FC9C50)" />
      <path
        d="M0 374 C72 392 116 394 166 379 C233 359 278 303 326 248 C376 191 425 164 512 149 L512 512 L0 512 Z"
        fill="var(--tsp-avatar-mid, #FF5E1F)"
      />
      <path
        d="M101 512 C156 468 209 414 280 367 C330 334 375 305 422 318 C460 328 489 358 512 391 L512 512 Z"
        fill="var(--tsp-avatar-deep, #FF2D0F)"
      />
      <circle cx="252" cy="181" r="55" fill="#FFFFFF" />
      <path
        d="M252 258 C197 258 159 296 159 352 C159 373 171 386 190 386 H314 C333 386 345 373 345 352 C345 296 307 258 252 258 Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

// Maps ContactRole to avatar side
function contactRoleToSide(roleType: string): Side {
  if (roleType === "vendor") return "vendor";
  if (roleType === "purchaser") return "purchaser";
  if (roleType === "broker") return "purchaser"; // buyers have brokers
  return "fallback"; // solicitor, other — can't determine side
}

// ─── Base avatar ─────────────────────────────────────────────────────────────

type AvatarBaseProps = {
  initials: string;
  side: Side;
  size?: number;
  className?: string;
  // When set, the photo fills the circle and the initials become the fallback
  // (shown only if the image fails to load).
  image?: string | null;
  // Focal point (percent) for cropping the photo — keeps a face centred when a
  // portrait fills a circle. Defaults to dead centre (50/50).
  focusX?: number;
  focusY?: number;
  // When no image is set, render the branded default agent art instead of
  // initials. Used for staff/agent avatars, not client contacts.
  defaultArt?: boolean;
};

function AvatarBase({ initials, side, size = 32, className, image, focusX = 50, focusY = 50, defaultArt = false }: AvatarBaseProps) {
  const { bg, color } = SIDE_STYLES[side];
  const fontSize = Math.round(size * 0.375);

  const style: CSSProperties = {
    width: size,
    height: size,
    background: bg,
    color,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize,
    fontWeight: 600,
    flexShrink: 0,
    userSelect: "none",
    overflow: "hidden",
  };

  return (
    <span style={style} className={className} aria-hidden>
      {image ? (
        <img
          src={image}
          alt=""
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focusX}% ${focusY}%`, display: "block" }}
        />
      ) : defaultArt ? (
        <DefaultAgentAvatarArt size={size} />
      ) : (
        initials
      )}
    </span>
  );
}

// ─── ContactAvatar ────────────────────────────────────────────────────────────

type ContactAvatarProps = {
  contact: { name: string; roleType?: string };
  size?: number;
  className?: string;
};

export function ContactAvatar({ contact, size = 32, className }: ContactAvatarProps) {
  const initials = getInitials(contact);
  const side = contact.roleType ? contactRoleToSide(contact.roleType) : "fallback";
  return <AvatarBase initials={initials} side={side} size={size} className={className} />;
}

// ─── UserAvatar ───────────────────────────────────────────────────────────────

type UserAvatarProps = {
  user: { name: string; image?: string | null; imageFocusX?: number | null; imageFocusY?: number | null };
  size?: number;
  className?: string;
};

export function UserAvatar({ user, size = 32, className }: UserAvatarProps) {
  const initials = getInitials({ name: user.name });
  return (
    <AvatarBase
      initials={initials}
      side="internal"
      size={size}
      className={className}
      image={user.image ?? null}
      focusX={user.imageFocusX ?? 50}
      focusY={user.imageFocusY ?? 50}
      defaultArt
    />
  );
}

// ─── ActorAvatar (activity timeline) ─────────────────────────────────────────
// One avatar for whoever a timeline row represents — an internal progressor, a
// customer-agency agent, or a client contact (seller/buyer/solicitor). Photo
// fills the circle; initials on a role-coloured gradient are the fallback.

export type ActorRole = "progressor" | "agent" | "seller" | "buyer" | "solicitor" | "system" | "other";

function actorRoleToSide(role: ActorRole): Side {
  switch (role) {
    case "seller": return "vendor";
    case "buyer": return "purchaser";
    case "progressor": return "internal";
    case "agent": return "agent";
    default: return "fallback"; // solicitor / system / other → grey
  }
}

export function ActorAvatar({
  name, role, image, size = 24, className,
}: { name: string; role: ActorRole; image?: string | null; size?: number; className?: string }) {
  // Staff/agent actors (customer-agency agent or internal progressor) fall back
  // to the branded default art; clients (seller/buyer/solicitor) keep initials.
  const isStaff = role === "agent" || role === "progressor";
  return (
    <AvatarBase
      initials={getInitials({ name: name || "?" })}
      side={actorRoleToSide(role)}
      size={size}
      className={className}
      image={image ?? null}
      defaultArt={isStaff}
    />
  );
}

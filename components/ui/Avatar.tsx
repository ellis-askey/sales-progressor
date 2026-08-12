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
  fallback: {
    bg: "linear-gradient(135deg, #F1EFE8 0%, #D3D1C7 100%)",
    color: "#444441",
  },
} as const;

type Side = keyof typeof SIDE_STYLES;

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
};

function AvatarBase({ initials, side, size = 32, className, image }: AvatarBaseProps) {
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
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
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
  user: { name: string; image?: string | null };
  size?: number;
  className?: string;
};

export function UserAvatar({ user, size = 32, className }: UserAvatarProps) {
  const initials = getInitials({ name: user.name });
  return <AvatarBase initials={initials} side="internal" size={size} className={className} image={user.image ?? null} />;
}

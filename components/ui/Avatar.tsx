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

// Per-side tones for the branded person art (2026-09-03). The SVG is a 3-layer
// scene + a white figure; retinting is just swapping the three --tsp-avatar-*
// vars, so a seller reads blue, a buyer green, everyone else grey. The white
// figure is untouched. Staff/agent (internal/agent) aren't listed here, so they
// keep the coral defaults baked into the art.
const ART_TONES: Partial<Record<Side, { base: string; mid: string; deep: string }>> = {
  vendor:    { base: "#5B9BD5", mid: "#2E6DB4", deep: "#0C447C" },
  purchaser: { base: "#4FB98F", mid: "#1E9273", deep: "#085041" },
  fallback:  { base: "#AEB7C4", mid: "#7F8A9B", deep: "#586477" },
};

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

// ID-card art for solicitors/professionals. Same 3-tone background as the
// person art, with an ID-card motif; all coral hexes route through the same
// --tsp-avatar-* vars, so it retints as a unit (grey for solicitors). White
// card stays white. Source: Images/tsp-id-card-avatar.svg.
function DefaultIdCardAvatarArt({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" style={{ display: "block" }} aria-hidden>
      <rect width="512" height="512" fill="var(--tsp-avatar-base, #FC9C50)" />
      <path d="M0 374 C72 392 116 394 166 379 C233 359 278 303 326 248 C376 191 425 164 512 149 L512 512 L0 512 Z" fill="var(--tsp-avatar-mid, #FF5E1F)" />
      <path d="M101 512 C156 468 209 414 280 367 C330 334 375 305 422 318 C460 328 489 358 512 391 L512 512 Z" fill="var(--tsp-avatar-deep, #FF2D0F)" />
      <path d="M256 120 C233 120 215 138 215 161 L215 179 H143 C122 179 106 196 106 217 V344 C106 365 122 382 143 382 H369 C390 382 406 365 406 344 V217 C406 196 390 179 369 179 H297 V161 C297 138 279 120 256 120 Z" fill="#FFFFFF" />
      <circle cx="256" cy="152" r="13" fill="var(--tsp-avatar-base, #FC9C50)" />
      <rect x="106" y="240" width="300" height="8" fill="var(--tsp-avatar-base, #FC9C50)" />
      <circle cx="173" cy="287" r="21" fill="var(--tsp-avatar-mid, #FF5E1F)" />
      <path d="M173 314 C151 314 133 329 133 345 C133 353 139 357 148 357 H198 C207 357 213 353 213 345 C213 329 195 314 173 314 Z" fill="var(--tsp-avatar-mid, #FF5E1F)" />
      <rect x="285" y="266" width="93" height="16" rx="8" fill="var(--tsp-avatar-base, #FC9C50)" />
      <rect x="285" y="303" width="93" height="16" rx="8" fill="var(--tsp-avatar-mid, #FF5E1F)" />
      <rect x="242" y="340" width="136" height="16" rx="8" fill="var(--tsp-avatar-deep, #FF2D0F)" />
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
  // When no image is set, render the branded default art instead of initials.
  defaultArt?: boolean;
  // Which art to use for the default: "person" (clients/staff) or "idcard"
  // (solicitors/professionals). Ignored unless defaultArt is set.
  artKind?: "person" | "idcard";
};

function AvatarBase({ initials, side, size = 32, className, image, focusX = 50, focusY = 50, defaultArt = false, artKind = "person" }: AvatarBaseProps) {
  const { bg, color } = SIDE_STYLES[side];
  const fontSize = Math.round(size * 0.375);
  // When showing the branded art for a contact side, retint its layers.
  const artTones = defaultArt ? ART_TONES[side] : undefined;

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
    ...(artTones
      ? ({
          "--tsp-avatar-base": artTones.base,
          "--tsp-avatar-mid": artTones.mid,
          "--tsp-avatar-deep": artTones.deep,
        } as CSSProperties)
      : {}),
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
        artKind === "idcard" ? <DefaultIdCardAvatarArt size={size} /> : <DefaultAgentAvatarArt size={size} />
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
  // Render the branded person art (tinted to the contact's side) instead of
  // initials. Default ON (2026-09-03) — a client with no photo shows the
  // side-coloured person everywhere. Pass art={false} to force initials.
  art?: boolean;
};

export function ContactAvatar({ contact, size = 32, className, art = true }: ContactAvatarProps) {
  const initials = getInitials(contact);
  const side = contact.roleType ? contactRoleToSide(contact.roleType) : "fallback";
  const artKind = contact.roleType === "solicitor" ? "idcard" : "person";
  return <AvatarBase initials={initials} side={side} size={size} className={className} defaultArt={art} artKind={artKind} />;
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
  // Everyone falls back to the branded person art (2026-09-03), tinted to their
  // side: staff coral, seller blue, buyer green, solicitor/other grey. A photo
  // still wins when present. Initials are retired here.
  return (
    <AvatarBase
      initials={getInitials({ name: name || "?" })}
      side={actorRoleToSide(role)}
      size={size}
      className={className}
      image={image ?? null}
      defaultArt
      artKind={role === "solicitor" ? "idcard" : "person"}
    />
  );
}

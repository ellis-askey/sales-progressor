"use client";

// components/account/chrome/AccountSidebarUser.tsx
//
// The signed-in user chip at the bottom of the Account sidebar (mirrors the
// agent shell's user block). Avatar + name + role; clicking opens a small menu
// above it with Sign out. Light Account register.

import { CaretUp, SignOut } from "@phosphor-icons/react";
import { signOut } from "next-auth/react";
import { UserAvatar } from "@/components/ui/Avatar";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";

const ROLE_LABEL: Record<string, string> = {
  director: "Director",
  negotiator: "Negotiator",
  admin: "Admin",
  sales_progressor: "Sales Progressor",
  superadmin: "Superadmin",
  viewer: "Viewer",
};

export function AccountSidebarUser({
  name,
  role,
  image,
  roleLabel,
}: {
  name: string;
  role: string;
  image: string | null;
  /** Override the role caption (e.g. "Business owner"). Defaults to ROLE_LABEL. */
  roleLabel?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <Popover
        preset="menu"
        placement="top-start"
        trigger={
          <button
            type="button"
            aria-haspopup="menu"
            className="account-user-chip"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "8px 8px",
              border: "none",
              background: "transparent",
              borderRadius: 10,
              cursor: "pointer",
              transition: "background 120ms",
            }}
          >
            {/* Matches the top-nav user chip: uploaded photo, else the branded
                default avatar art (not initials). */}
            <UserAvatar user={{ name, image }} size={34} />
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {roleLabel ?? ROLE_LABEL[role] ?? role}
              </span>
            </span>
            <CaretUp size={13} weight="bold" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
          </button>
        }
      >
        {(close) => (
          <PopoverMenuItem icon={<SignOut size={16} weight="bold" />} onClick={() => { close(); signOut({ callbackUrl: "/login" }); }}>
            Sign out
          </PopoverMenuItem>
        )}
      </Popover>

      <style>{`
        .account-user-chip:hover { background: var(--agent-hover-shade) !important; }
      `}</style>
    </div>
  );
}

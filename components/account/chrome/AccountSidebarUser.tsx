"use client";

// components/account/chrome/AccountSidebarUser.tsx
//
// The signed-in user chip at the bottom of the Account sidebar (mirrors the
// agent shell's user block). Avatar + name + role; clicking opens a small menu
// above it with Sign out. Light Account register.

import { useEffect, useRef, useState } from "react";
import { CaretUp, SignOut } from "@phosphor-icons/react";
import { signOut } from "next-auth/react";
import { UserAvatar } from "@/components/ui/Avatar";

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
}: {
  name: string;
  role: string;
  image: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.10)",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding: 6,
            animation: "account-user-menu-in 140ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="account-user-menu-item"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "9px 10px",
              border: "none",
              background: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 500,
              color: "#111827",
              textAlign: "left",
            }}
          >
            <SignOut size={16} weight="bold" style={{ color: "#6b7280" }} />
            Sign out
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="account-user-chip"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "8px 8px",
          border: "none",
          background: open ? "rgba(0,0,0,0.04)" : "transparent",
          borderRadius: 10,
          cursor: "pointer",
          transition: "background 120ms",
        }}
      >
        {/* Matches the top-nav user chip: uploaded photo, else the branded
            default avatar art (not initials). */}
        <UserAvatar user={{ name, image }} size={34} />
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ROLE_LABEL[role] ?? role}
          </span>
        </span>
        <CaretUp
          size={13}
          weight="bold"
          style={{ color: "#9ca3af", flexShrink: 0, transform: open ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 160ms" }}
        />
      </button>

      <style>{`
        .account-user-chip:hover { background: rgba(0,0,0,0.04) !important; }
        .account-user-menu-item:hover { background: rgba(0,0,0,0.05); }
        @keyframes account-user-menu-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

"use client";
// Portal menu drawer — slides up from the bottom, opened by the hamburger
// button in PortalShell's header. Contains three sections:
//   1. Your details        — client edits their own Contact record
//   2. Your solicitor      — read view + "Update details" / "Switch firm"
//   3. Notifications       — email / push toggles
//
// Commit B (this file's first pass) ships an EMPTY drawer that just
// opens + closes. Section content + edit endpoints land in commit C so
// the animation + a11y wiring is testable in isolation first.
//
// 2026-08-09.

import { useEffect } from "react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { P } from "./portal-ui";

type Props = {
  open: boolean;
  onClose: () => void;
  // Passed through from PortalShell so commit C can wire the edit
  // sections without another prop drill. Unused in this commit.
  contactName: string;
  contactRole: string;
};

export function PortalMenuDrawer({ open, onClose, contactName, contactRole }: Props) {
  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Body-scroll lock while open — otherwise the underlying page scrolls
  // when the drawer content itself doesn't need to.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 40,
          background: "rgba(15, 23, 42, 0.30)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 220ms ease",
        }}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Menu"
        aria-hidden={!open}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 41,
          maxHeight: "85vh",
          background: P.cardBg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: "0 -8px 32px rgba(15, 23, 42, 0.12)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Grabber */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
          <div
            aria-hidden
            style={{
              width: 40,
              height: 4,
              borderRadius: 999,
              background: "rgba(15, 23, 42, 0.12)",
            }}
          />
        </div>

        {/* Header */}
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px 14px",
          borderBottom: `0.5px solid ${P.border}`,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: P.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {contactRole === "vendor" ? "Your sale" : "Your purchase"}
            </p>
            <h2 style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700, color: P.textPrimary }}>
              Menu
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              borderRadius: 10,
              border: `0.5px solid ${P.border}`,
              background: "#fff",
              color: P.textSecondary,
              cursor: "pointer",
            }}
          >
            <X size={16} weight="bold" />
          </button>
        </header>

        {/* Body — stubbed. Commit C fills in the three sections. */}
        <div style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 20px 32px",
          // iOS safe-area inset so buttons don't sit under the home indicator
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 32px)",
        }}>
          <p style={{ margin: 0, fontSize: 14, color: P.textMuted, textAlign: "center", padding: "40px 0" }}>
            Your details, your solicitor, and notifications will live here.
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: P.textMuted, textAlign: "center" }}>
            Signed in as {contactName}.
          </p>
        </div>
      </aside>
    </>
  );
}

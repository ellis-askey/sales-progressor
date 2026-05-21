"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X } from "@phosphor-icons/react";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";

type Props = {
  address: string;
  originatorAgency?: string;
};

export function ClaimWelcomeModal({ address, originatorAgency }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (params.get("newUser") === "1") {
      setVisible(true);
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setVisible(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!mounted || !visible) return null;

  const chainDescription = originatorAgency
    ? `Your sale at ${address} is now part of ${originatorAgency}'s chain. Everyone in it can see how each sale is progressing — including yours.`
    : `Your sale at ${address} is now part of the chain. Everyone in it can see how each sale is progressing — including yours.`;

  return createPortal(
    <div
      data-theme={theme}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={() => setVisible(false)}
    >
      <div className="fixed inset-0 agent-backdrop-overlay" />
      <div
        className="agent-modal"
        style={{
          maxWidth: 460,
          width: "calc(100vw - 48px)",
          position: "relative",
          padding: 0,
          overflow: "hidden",
          animation: "agent-modal-in 240ms cubic-bezier(0.25,0,0,1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", height: 56, padding: "0 20px", borderBottom: "0.5px solid rgba(0,0,0,0.08)", gap: 12 }}>
          <p style={{ flex: 1, margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--agent-success)",
                animation: "agent-pulse-dot 2.4s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
            You&apos;re in.
          </p>
          <button onClick={() => setVisible(false)} aria-label="Close" className="agent-icon-btn agent-icon-btn-sm">
            <X size={14} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.65 }}>
            {chainDescription}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.65 }}>
            When you&apos;re ready, add your buyer&apos;s and seller&apos;s details and tick off steps as they happen.
          </p>
          <button
            onClick={() => setVisible(false)}
            className="agent-btn agent-btn-color-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, fontWeight: 700, marginTop: 4 }}
          >
            Open my file
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

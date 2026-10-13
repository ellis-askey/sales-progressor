"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { SheetBandHeader, SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { CheckCircle, UsersThree, House } from "@phosphor-icons/react";

export type ChainMember = {
  address: string;
  status: "you" | "joined" | "pending";
  progress: number | null;
};

type Props = {
  address: string;
  originatorAgency?: string;
  members?: ChainMember[];
  connectedCount?: number;
  // Critique #237: lets ClaimFirstRunFlow chain the chase set-up welcome after
  // this closes. "setup" = they went into the reconcile flow, "later" = any
  // other dismissal. Only fires when the modal actually showed (?newUser=1).
  onClosed?: (via: "setup" | "later") => void;
};

function shortAddress(a: string): string {
  return a.split(",")[0]?.trim() || a;
}

// Shown once when ?newUser=1 lands on a freshly-claimed file. Welcomes the agent
// to the chain and shows where every connected sale has reached. Copy is honest
// to what the chain actually shares: each joined sale's progress %, and that
// updating your file is visible to the others. The private "stuck on X" detail
// is NOT surfaced here. See docs/active/chain-invite-conversion.
export function ClaimWelcomeModal({ address, originatorAgency, members = [], connectedCount = 0, onClosed }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = usePortalTheme();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  // Edge fades on the member strip (2026-10-13): fade whichever side has more
  // content scrolled out of view, so cards never cut off bluntly. Same
  // mask-image pattern as the portal menu's tab row.
  const stripRef = useRef<HTMLDivElement>(null);
  const [stripFade, setStripFade] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });
  const measureStrip = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setStripFade({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);
  useEffect(() => {
    if (!visible) return;
    measureStrip();
    window.addEventListener("resize", measureStrip);
    return () => window.removeEventListener("resize", measureStrip);
  }, [visible, measureStrip]);
  const stripMask =
    stripFade.left && stripFade.right
      ? "linear-gradient(to right, transparent 0, #000 26px, #000 calc(100% - 26px), transparent 100%)"
      : stripFade.left
        ? "linear-gradient(to right, transparent 0, #000 26px, #000 100%)"
        : stripFade.right
          ? "linear-gradient(to right, #000 0, #000 calc(100% - 26px), transparent 100%)"
          : undefined;

  useEffect(() => {
    setMounted(true);
    if (params.get("newUser") === "1") {
      setVisible(true);
      router.replace(pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  const short = shortAddress(address);

  function closeModal(via: "setup" | "later") {
    setVisible(false);
    onClosed?.(via);
  }

  return (
    <Modal open={visible} onClose={() => closeModal("later")} ariaLabel="Welcome to the chain" size="xl" zLayer="escalated" closeTone="onDark">
      {/* Member strip scrollbar (2026-10-13): breathing room under the cards and
          a slim glassy bar — translucent neutral, near-invisible track — rather
          than the stock grey or a tinted primary. */}
      <style>{`
        .cwm-strip {
          display: flex; gap: 8px; overflow-x: auto;
          padding: 2px 2px 10px;
          scrollbar-width: thin;
          scrollbar-color: rgba(15,23,42,0.18) transparent;
        }
        .cwm-strip::-webkit-scrollbar { height: 6px; }
        .cwm-strip::-webkit-scrollbar-track { background: rgba(15,23,42,0.04); border-radius: 999px; }
        .cwm-strip::-webkit-scrollbar-thumb {
          background: rgba(15,23,42,0.16);
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.55);
          background-clip: padding-box;
        }
        .cwm-strip::-webkit-scrollbar-thumb:hover { background: rgba(15,23,42,0.28); background-clip: padding-box; }
      `}</style>
      <Modal.Header style={SHEET_BAND_STYLE}>
        {/* No kicker (2026-10-13) — title + the connection line as its subtext. */}
        <SheetBandHeader
          title="Welcome to the chain."
          subtitle={`${short} is now connected to ${originatorAgency ? `${originatorAgency}'s` : "the"} live chain.`}
        />
      </Modal.Header>
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "26px 30px 24px" }}>
        <p style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-success)" }}>
          <CheckCircle size={18} weight="fill" /> You&apos;re connected
        </p>

        {/* Chain strip */}
        {members.length > 0 && (
          <div style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-muted)" }}>
              <UsersThree size={15} /> {connectedCount} sale{connectedCount === 1 ? "" : "s"} connected
            </p>
            <div
              ref={stripRef}
              className="cwm-strip"
              onScroll={measureStrip}
              style={{ WebkitMaskImage: stripMask, maskImage: stripMask }}
            >
              {members.map((m, i) => {
                const isYou = m.status === "you";
                const statusText = isYou ? "You are here" : m.status === "pending" ? "Invite pending" : m.progress != null ? `${m.progress}% complete` : "Joined";
                const statusColor = isYou ? "var(--agent-primary)" : m.status === "pending" ? "var(--agent-text-muted)" : "var(--agent-success)";
                return (
                  <div key={i} style={{
                    flex: "1 0 132px", minWidth: 132, borderRadius: 10, padding: "10px 12px",
                    background: isYou ? "rgba(var(--agent-primary-rgb, 255,107,74), 0.06)" : "var(--agent-surface)",
                    border: isYou ? "1.5px solid var(--agent-primary, #FF6B4A)" : "0.5px solid var(--agent-border-subtle)",
                    // Depth (2026-10-13): the flat tiles read as dead space — a lit
                    // top edge + soft drop shadow sits them above the strip.
                    boxShadow: isYou
                      ? "inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(var(--agent-primary-rgb, 255,107,74), 0.18), 0 5px 14px -5px rgba(var(--agent-primary-rgb, 255,107,74), 0.38)"
                      : "inset 0 1px 0 rgba(255,255,255,0.55), 0 1px 2px rgba(15,23,42,0.06), 0 5px 14px -6px rgba(15,23,42,0.16)",
                  }}>
                    <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: statusColor }}>{statusText}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Two-up — privacy-first wording (2026-10-13): the old copy read like a
            live broadcast of everything on the file, which the chain never does.
            Only each sale's overall progress is shared. Bare coral icons, no
            faded backers. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
              <House size={18} weight="bold" color="var(--agent-primary, #FF6B4A)" /> Your side stays yours.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>Your clients, notes and file details stay private. The rest of the chain only sees how far your sale has progressed.</p>
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>
              <UsersThree size={18} weight="bold" color="var(--agent-primary, #FF6B4A)" /> See the whole chain.
            </p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>See how every connected sale is progressing, what&apos;s moving and what&apos;s still outstanding, without having to chase for updates.</p>
          </div>
        </div>

        {/* CTA — hands off to the milestone-setup modal (ReconcileLaterBanner
            listens for this event) so it opens directly instead of just closing. */}
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sp:open-reconcile"));
            closeModal("setup");
          }}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
            padding: "14px 20px", fontSize: 15, fontWeight: 700, marginTop: 2,
            color: "#fff", border: "none", borderRadius: 12, cursor: "pointer",
            // The solid gradient primary used across the recent claim/log-update work.
            background: "linear-gradient(180deg, #FF6F4E 0%, #F04E2C 100%)",
            boxShadow: "0 2px 0 #C63E20, 0 6px 16px rgba(240,78,44,0.30), inset 0 1px 0 rgba(255,255,255,0.3)",
            transition: "filter 140ms ease, transform 140ms ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(1.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.filter = "none")}
        >
          Set up {short}
        </button>
        <button
          onClick={() => closeModal("later")}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--agent-text-muted)", margin: "-8px auto 0", padding: 6, transition: "color 140ms ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--agent-text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--agent-text-muted)")}
        >
          I&apos;ll do this later
        </button>
      </div>
    </Modal>
  );
}


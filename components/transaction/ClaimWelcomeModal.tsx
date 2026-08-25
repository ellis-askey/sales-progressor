"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";
import { CheckCircle, Eye, UsersThree, Gift } from "@phosphor-icons/react";

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
};

function shortAddress(a: string): string {
  return a.split(",")[0]?.trim() || a;
}

// Shown once when ?newUser=1 lands on a freshly-claimed file. Welcomes the agent
// to the chain and shows where every connected sale has reached. Copy is honest
// to what the chain actually shares: each joined sale's progress %, and that
// updating your file is visible to the others. The private "stuck on X" detail
// is NOT surfaced here. See docs/active/chain-invite-conversion.
export function ClaimWelcomeModal({ address, originatorAgency, members = [], connectedCount = 0 }: Props) {
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

  if (!mounted) return null;

  const short = shortAddress(address);

  return (
    <Modal open={visible} onClose={() => setVisible(false)} ariaLabel="Welcome to the chain" size="xl" zLayer="escalated">
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", gap: 18, padding: "30px 30px 24px" }}>
        {/* Header */}
        <div>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 8, margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-success)" }}>
            <CheckCircle size={18} weight="fill" /> You&apos;re connected
          </p>
          <h2 style={{ margin: "8px 0 6px", fontSize: 25, fontWeight: 800, color: "var(--agent-text-primary)", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Welcome to the chain.
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>
            <strong style={{ color: "var(--agent-text-primary)" }}>{short}</strong> is now connected to {originatorAgency ? `${originatorAgency}'s` : "the"} live chain.
          </p>
        </div>

        {/* Chain strip */}
        {members.length > 0 && (
          <div style={{ background: "var(--agent-surface-elevated)", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 12, padding: "12px 14px" }}>
            <p style={{ display: "inline-flex", alignItems: "center", gap: 6, margin: "0 0 10px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-muted)" }}>
              <UsersThree size={15} /> {connectedCount} sale{connectedCount === 1 ? "" : "s"} connected
            </p>
            <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
              {members.map((m, i) => {
                const isYou = m.status === "you";
                const statusText = isYou ? "You are here" : m.status === "pending" ? "Invite pending" : m.progress != null ? `${m.progress}% complete` : "Joined";
                const statusColor = isYou ? "var(--agent-primary)" : m.status === "pending" ? "var(--agent-text-muted)" : "var(--agent-success)";
                return (
                  <div key={i} style={{
                    flex: "1 0 132px", minWidth: 132, borderRadius: 10, padding: "10px 12px",
                    background: isYou ? "rgba(var(--agent-primary-rgb), 0.06)" : "var(--agent-surface)",
                    border: isYou ? "1.5px solid var(--agent-primary)" : "0.5px solid var(--agent-border-subtle)",
                  }}>
                    <p style={{ margin: "0 0 3px", fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.address}</p>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: statusColor }}>{statusText}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Two-up */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>Your side is yours.</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>Add your buyer and seller and keep your milestones up to date. The other agents see how far along you are.</p>
          </div>
          <div style={{ flex: "1 1 240px" }}>
            <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)" }}>You&apos;ll see theirs too.</p>
            <p style={{ margin: 0, fontSize: 13, color: "var(--agent-text-secondary)", lineHeight: 1.55 }}>One shared view means everyone stays in the loop and the chain keeps moving.</p>
          </div>
        </div>

        {/* Feature cells */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, borderTop: "0.5px solid var(--agent-border-subtle)", paddingTop: 16 }}>
          <Feature Icon={Eye} title="Live chain" body="See how far every connected sale has reached." />
          <Feature Icon={UsersThree} title="Shared progress" body="Update your file once. Everyone sees it." />
          <Feature Icon={Gift} title="No cost" body="Your place in this chain is free." />
        </div>

        {/* CTA — hands off to the milestone-setup modal (ReconcileLaterBanner
            listens for this event) so it opens directly instead of just closing. */}
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("sp:open-reconcile"));
            setVisible(false);
          }}
          className="agent-btn agent-btn-color-primary"
          style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, fontWeight: 700, marginTop: 2 }}
        >
          Set up {short}
        </button>
        <button onClick={() => setVisible(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--agent-text-muted)", textDecoration: "underline", margin: "-8px auto 0", padding: 6 }}>
          I&apos;ll do this later
        </button>
      </div>
    </Modal>
  );
}

function Feature({ Icon, title, body }: { Icon: typeof Eye; title: string; body: string }) {
  return (
    <div style={{ flex: "1 1 150px" }}>
      <Icon size={18} weight="bold" color="var(--agent-primary)" />
      <p style={{ margin: "6px 0 2px", fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>{title}</p>
      <p style={{ margin: 0, fontSize: 12, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>{body}</p>
    </div>
  );
}

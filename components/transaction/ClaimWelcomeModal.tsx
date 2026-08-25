"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/agent/use-portal-theme";
import { Modal } from "@/components/ui/Modal";

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

  if (!mounted) return null;

  const chainDescription = originatorAgency
    ? `Your sale at ${address} is now part of ${originatorAgency}'s chain. Everyone in it can see how each sale is progressing, including yours.`
    : `Your sale at ${address} is now part of the chain. Everyone in it can see how each sale is progressing, including yours.`;

  return (
    <Modal
      open={visible}
      onClose={() => setVisible(false)}
      ariaLabel="You're in"
      size="md"
      zLayer="escalated"
    >
      <div data-theme={theme} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Modal.Header>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", display: "flex", alignItems: "center", gap: 10 }}>
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
        </Modal.Header>

        <Modal.Body>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.65 }}>
              {chainDescription}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.65 }}>
              When you&apos;re ready, add your buyer&apos;s and seller&apos;s details and tick off steps as they happen.
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)", lineHeight: 1.65 }}>
              Know the agent for the sale above or below yours? Add them to the chain from your file and we&apos;ll invite them in too, so the whole chain can see where things stand.
            </p>
          </div>
        </Modal.Body>

        {/* Single full-width CTA. Uses agent-btn-color-primary (escape-hatch
            class Button.tsx grandfathered for modal contexts). */}
        <Modal.Footer style={{ padding: "12px 24px 20px", justifyContent: "stretch" }}>
          <button
            onClick={() => setVisible(false)}
            className="agent-btn agent-btn-color-primary"
            style={{ width: "100%", justifyContent: "center", padding: "14px 20px", fontSize: 15, fontWeight: 700 }}
          >
            Open my file
          </button>
        </Modal.Footer>
      </div>
    </Modal>
  );
}

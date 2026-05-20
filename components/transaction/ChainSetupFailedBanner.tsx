"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function ChainSetupFailedBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!fired.current && params.get("chainSetupFailed") === "1") {
      fired.current = true;
      setVisible(true);
      router.replace(pathname, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        background: "var(--agent-surface-warning, #fffbeb)",
        border: "1px solid var(--agent-border-warning, #fcd34d)",
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 4,
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#92400e" }}>
          Chain setup failed
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 13, color: "#b45309" }}>
          Your file was saved, but the chain wasn&apos;t linked.{" "}
          <button
            onClick={() => {
              document.getElementById("chain-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
              setVisible(false);
            }}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontWeight: 600,
              fontSize: 13,
              color: "#92400e",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            Go to chain panel →
          </button>
        </p>
      </div>
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          color: "#b45309",
          padding: 0,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

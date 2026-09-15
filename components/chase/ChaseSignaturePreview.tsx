"use client";

// Shared signature preview for the chase drawers. Fetches the white-label
// signature the real send will append (same resolver, via /api/chase/signature-
// preview) and renders it exactly as the email signs off — photo, name, phone,
// agency logo — plus the "finish your signature" nudge for the BASIC fallback.
// Used by both ChaseDrawer and ChaseNeighbourDrawer so the sign-off preview is
// identical across every chase (Law 4/14: one component, not two copies).

import { useEffect, useState } from "react";

type Sig = { html: string; missing: string[]; mode?: string; name?: string | null };

// "a" / "a and b" / "a, b and c" — for the signature-completion nudge.
function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function ChaseSignaturePreview({ transactionId, visible }: { transactionId: string; visible: boolean }) {
  const [signature, setSignature] = useState<Sig | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch(`/api/chase/signature-preview?transactionId=${transactionId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (active && d) setSignature(d as Sig); })
        .catch(() => {});
    };
    load();
    // Refetch when the agent returns to this tab (e.g. after editing their
    // profile in another tab) so the sign-off updates without a manual refresh.
    const onReturn = () => { if (document.visibilityState !== "hidden") load(); };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      active = false;
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [transactionId]);

  if (!visible || !signature) return null;

  // Only the BASIC fallback has personal pieces still to complete (IMAGE / CUSTOM
  // have nothing to finish). The agency logo isn't a personal action, so drop it.
  const personal = signature.mode === "BASIC" ? signature.missing.filter((m) => m !== "agency logo") : [];

  return (
    <div>
      {/* Rendered on white regardless of drawer theme — it's a preview of the
          email, which is always light. */}
      <div
        style={{ background: "#ffffff", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 10, padding: "4px 16px 14px", overflowX: "auto" }}
        dangerouslySetInnerHTML={{ __html: signature.html }}
      />
      <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
        Your signature is added when you send. Open in my email uses your own email app&rsquo;s signature instead.
      </p>
      {personal.length > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
          Add your {formatList(personal)} to finish your signature.{" "}
          <a href="/agent/account/profile" target="_blank" rel="noreferrer" style={{ color: "var(--agent-coral-deep)", fontWeight: 600 }}>Update profile</a>
        </p>
      )}
    </div>
  );
}

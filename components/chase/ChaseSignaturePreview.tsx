"use client";

// Shared sign-off + signature preview for the chase drawers. Fetches the white-
// label signature the real send appends (same resolver, via /api/chase/signature-
// preview) and renders it exactly as the email signs off — now as ONE continuous
// block: the editable sign-off phrase (pencil), then the signature (photo, name,
// phone, agency logo). The AI no longer writes the sign-off; the app owns it, so
// what the agent sees here is what goes out. Used by ChaseDrawer and
// ChaseNeighbourDrawer (Law 4/14: one component, not two copies).

import { useEffect, useState } from "react";
import { PencilSimple } from "@phosphor-icons/react";
import type { SigStyle } from "./ChaseComposer";

type Sig = { html: string; missing: string[]; mode?: string; name?: string | null };

const SIGN_OFFS = ["Kind regards,", "Best regards,", "Best wishes,", "Many thanks,"];

// "a" / "a and b" / "a, b and c" — for the signature-completion nudge.
function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function ChaseSignaturePreview({
  transactionId,
  visible,
  sigStyle = "default",
  signOff,
  onSignOffChange,
}: {
  transactionId: string;
  visible: boolean;
  // Per-message style from the composer toolbar (basic / logo / default).
  sigStyle?: SigStyle;
  // The editable sign-off phrase + its setter. When omitted (e.g. a surface that
  // doesn't offer editing), the phrase isn't shown and the signature stands alone.
  signOff?: string;
  onSignOffChange?: (s: string) => void;
}) {
  const [signature, setSignature] = useState<Sig | null>(null);
  const [krOpen, setKrOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetch(`/api/chase/signature-preview?transactionId=${transactionId}&style=${sigStyle}`)
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
  }, [transactionId, sigStyle]);

  if (!visible || !signature) return null;

  // Only the BASIC fallback has personal pieces still to complete (IMAGE / CUSTOM
  // have nothing to finish). The agency logo isn't a personal action, so drop it.
  const personal = signature.mode === "BASIC" ? signature.missing.filter((m) => m !== "agency logo") : [];
  // The editable sign-off phrase is shown for BASIC-family signatures only — an
  // image/custom signature already carries its own valediction, so we never add
  // a second one. Mirrors the send path (/api/chase/send-email).
  const showSignOff = signature.mode === "BASIC" && !!onSignOffChange;
  const phrase = signOff && signOff.trim() ? signOff : "Kind regards,";

  return (
    <div>
      {/* Rendered on white regardless of drawer theme — it's a preview of the
          email, which is always light. Sign-off phrase + signature as one block. */}
      <div style={{ background: "#ffffff", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 10, padding: "14px 16px", overflowX: "auto" }}>
        {showSignOff && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14, color: "#111827", lineHeight: 1.5 }}>{phrase}</span>
            <button
              type="button"
              aria-label="Change sign-off"
              title="Change sign-off"
              onClick={() => setKrOpen((v) => !v)}
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", color: "#9aa0aa", cursor: "pointer" }}
            >
              <PencilSimple size={14} weight="bold" />
            </button>
            {krOpen && (
              <>
                <div onClick={() => setKrOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{ position: "absolute", top: 28, left: 0, zIndex: 41, minWidth: 160, background: "#fff", border: "0.5px solid var(--agent-border-subtle)", borderRadius: 9, boxShadow: "0 12px 26px -14px rgba(0,0,0,0.4)", padding: 5 }}>
                  {SIGN_OFFS.map((opt) => {
                    const sel = opt === phrase;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => { onSignOffChange?.(opt); setKrOpen(false); }}
                        style={{ display: "block", width: "100%", textAlign: "left", border: "none", background: "transparent", fontSize: 13, color: sel ? "var(--agent-coral-deep)" : "#211d18", fontWeight: sel ? 700 : 400, padding: "7px 10px", borderRadius: 6, cursor: "pointer" }}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
        <div dangerouslySetInnerHTML={{ __html: signature.html }} />
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45 }}>
        This sign-off and signature are added when you send. Open in my email uses your own email app&rsquo;s signature instead.
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

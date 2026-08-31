// Renders when a portal token resolves to a contact whose round is no
// longer the file's active round. Triggered by the belt-and-braces
// guard in lib/services/portal.ts:resolvePortalRoundContext —
// purchaser contact with buyerRoundId !== activeBuyerRoundId. Vendor
// contacts never trigger this.
//
// Friendly notice, not a 404 — a buyer who bookmarked the link should
// see an explanation, not a missing-page error.

import { extractFirstName } from "@/lib/contacts/displayName";

export function DeadRoundNotice({
  contactName,
  agencyName,
  address,
}: {
  contactName: string;
  agencyName: string;
  address: string;
}) {
  return (
    <div
      className="portal-fade-in"
      style={{
        maxWidth: 480,
        margin: "10vh auto",
        padding: "32px 24px",
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 4px 32px rgba(20, 27, 52, 0.06)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        color: "#1a1d29",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: "#FFE9E4",
          borderRadius: 28,
          margin: "0 auto 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        🔒
      </div>
      <h1 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 700 }}>
        This link is no longer active
      </h1>
      <p style={{ margin: "0 0 8px", fontSize: 15, lineHeight: 1.55, color: "#3d4358" }}>
        Hi {extractFirstName(contactName)}, the link for{" "}
        <strong style={{ color: "#1a1d29" }}>{address}</strong> isn't connected to this sale
        any more.
      </p>
      <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.55, color: "#6a708a" }}>
        If you're still involved with this sale, please contact {agencyName} for a fresh link.
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "#9aa0bd" }}>
        Sales Progressor
      </p>
    </div>
  );
}

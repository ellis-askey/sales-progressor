// /test/claim-welcome — disposable preview of the new claim-cycle welcome
// email. Renders the actual buildClaimWelcome() output with sample data so
// the rendered subject + HTML + text can be reviewed before the email is
// wired into the live /api/claim path. Append ?fallback=1 to see the
// "The other side of the chain" fallback when invitingAgencyName is null.
//
// Delete this folder once the template is approved and live.

import { buildClaimWelcome } from "@/lib/emails/retention";

type SearchParams = Promise<{ fallback?: string; noaddress?: string }>;

export default async function ClaimWelcomePreview({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { fallback, noaddress } = await searchParams;
  const useFallback = fallback === "1";
  const useNoAddress = noaddress === "1";

  const built = buildClaimWelcome({
    firstName: "Sarah",
    address: useNoAddress ? "" : "14 Birchwood Avenue, Knutsford, WA16 8JL",
    ctaUrl: "https://portal.thesalesprogressor.co.uk/agent/transactions/sample-tx-id",
    invitingAgencyName: useFallback ? undefined : "Hamilton & Stone",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f4f5f7",
      padding: "32px 16px",
      fontFamily: "-apple-system,BlinkMacSystemFont,sans-serif",
      color: "#1a1d29",
    }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>
          Claim-cycle welcome — preview
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#5b6478" }}>
          Sample data: Sarah ·{" "}
          {useNoAddress ? "no address (fallback copy)" : "14 Birchwood Avenue, Knutsford, WA16 8JL"} ·{" "}
          {useFallback ? "no inviting agency (fallback copy)" : "inviting agency = Hamilton & Stone"}
          . Toggle with <code>?fallback=1</code> for the inviter fallback, <code>?noaddress=1</code> for the address fallback.
        </p>

        <section style={{ marginBottom: 24 }}>
          <p style={{
            margin: "0 0 4px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase", color: "#8b91a3",
          }}>Subject</p>
          <p style={{
            margin: 0, padding: "10px 14px", background: "#fff",
            borderRadius: 8, border: "1px solid #e1e4ec", fontSize: 14,
          }}>{built.subject}</p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <p style={{
            margin: "0 0 4px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase", color: "#8b91a3",
          }}>From</p>
          <p style={{
            margin: 0, padding: "10px 14px", background: "#fff",
            borderRadius: 8, border: "1px solid #e1e4ec", fontSize: 14,
          }}>{built.fromDisplayName}</p>
        </section>

        <section style={{ marginBottom: 24 }}>
          <p style={{
            margin: "0 0 4px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase", color: "#8b91a3",
          }}>Rendered HTML</p>
          <div style={{
            background: "#fff", borderRadius: 8, border: "1px solid #e1e4ec",
            overflow: "hidden",
          }}>
            <iframe
              title="Rendered email"
              srcDoc={built.html}
              style={{ width: "100%", height: 580, border: "none", display: "block" }}
            />
          </div>
        </section>

        <section>
          <p style={{
            margin: "0 0 4px", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.06em", textTransform: "uppercase", color: "#8b91a3",
          }}>Plain-text fallback</p>
          <pre style={{
            margin: 0, padding: "16px", background: "#fff",
            borderRadius: 8, border: "1px solid #e1e4ec", fontSize: 13,
            whiteSpace: "pre-wrap", fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace",
            color: "#1a1d29",
          }}>{built.text}</pre>
        </section>
      </div>
    </div>
  );
}

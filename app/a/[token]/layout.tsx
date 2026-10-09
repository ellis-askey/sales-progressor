import { verifyAdvisorToken } from "@/lib/advisor-confirm/token";
import { getAdvisorPortalView } from "@/lib/advisor-confirm/portal-data";
import { P } from "@/components/portal/portal-ui";
// The .glass-vNN classes the shared portal cards resolve to (not global).
import "@/app/styles/glass.css";

export const dynamic = "force-dynamic";

// The secret token lives in this page's URL. no-referrer stops the browser
// putting that full URL in the Referer header when the advisor clicks any
// outbound link, so the token can't leak to a third party.
export const metadata = { referrer: "no-referrer", title: "Mortgage advisor portal" } as const;

export default async function AdvisorPortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const decoded = verifyAdvisorToken(token);
  // Validate the token AND that we can build a view for its side (Phase 1 =
  // buyer side only). Anything else shows the invalid-link notice rather than a
  // half-built page.
  const view = decoded ? await getAdvisorPortalView(decoded.transactionId, decoded.side) : null;
  if (!view) return <InvalidShell />;

  return (
    <div className="min-h-screen portal-scope" style={{ position: "relative" }}>
      {/* Same ambient wash the client portal uses (global CSS, no import). */}
      <div aria-hidden className="portal-ambient" />
      <div style={{ maxWidth: 512, margin: "0 auto" }}>
        <header style={{ padding: "20px 20px 4px" }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: P.primary }}>
            {view.agencyName}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: P.textMuted }}>
            Mortgage advisor update{view.advisorFirstName ? ` · Hi ${view.advisorFirstName}` : ""}
          </p>
        </header>
        <main style={{ padding: "20px 16px 48px" }}>{children}</main>
      </div>
    </div>
  );
}

function InvalidShell() {
  return (
    <div className="portal-scope" style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div aria-hidden className="portal-ambient" />
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: P.textPrimary, margin: "0 0 8px" }}>This link is not valid</p>
        <p style={{ fontSize: 14, color: P.textSecondary, margin: 0, lineHeight: 1.6 }}>
          The link may have expired or been mistyped. Please reply to the email you received and we&rsquo;ll send a fresh one.
        </p>
      </div>
    </div>
  );
}

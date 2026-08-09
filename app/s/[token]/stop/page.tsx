import { prisma } from "@/lib/prisma";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { StopEmailsPanel } from "./StopEmailsPanel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

// Landing for the email footer's "stop these emails for this matter" link.
// Deliberately a confirmation step (not a one-click GET) so an email client
// pre-fetching the link can't silently unsubscribe the firm.
export default async function StopEmailsPage({ params }: PageProps) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);

  let address: string | null = null;
  let alreadyStopped = false;
  if (decoded) {
    const tx = await prisma.propertyTransaction.findUnique({
      where: { id: decoded.transactionId },
      select: {
        propertyAddress: true,
        vendorSolicitorEmailsPaused: true,
        purchaserSolicitorEmailsPaused: true,
      },
    });
    if (tx) {
      address = tx.propertyAddress;
      alreadyStopped =
        decoded.side === "vendor" ? tx.vendorSolicitorEmailsPaused : tx.purchaserSolicitorEmailsPaused;
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#eef1f5", padding: "28px 16px", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", background: "#ffffff", border: "1px solid #dfe5ec", borderRadius: 10, padding: "32px 28px" }}>
        {!decoded || !address ? (
          <>
            <p style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 600, color: "#0f2740" }}>This link is not valid</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#6b7c93" }}>
              Please reply to the email you received and I&rsquo;ll sort it out.
            </p>
          </>
        ) : (
          <StopEmailsPanel token={token} address={address} alreadyStopped={alreadyStopped} />
        )}
      </div>
    </div>
  );
}

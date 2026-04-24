import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SurveyForm } from "@/components/feedback/SurveyForm";

export const metadata = { title: "Rate your experience | Sales Progressor" };

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const contact = await prisma.contact.findFirst({
    where: { portalToken: token },
    select: {
      name: true,
      roleType: true,
      transaction: { select: { propertyAddress: true } },
    },
  });

  if (!contact) notFound();

  const roleLabel = contact.roleType === "purchaser" ? "purchase" : "sale";

  return (
    <main style={{ background: "linear-gradient(160deg, #0d1117 0%, #0f1a2e 100%)", minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 24px" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 40 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #FF8A65, #FF6B4A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.5 0 2.91.37 4.15 1.01" />
            </svg>
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>Sales Progressor</span>
        </div>

        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 20, padding: "36px 32px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "#FF6B4A", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Completion survey
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: "1.6rem", fontWeight: 800, letterSpacing: "-0.03em", color: "rgba(255,255,255,0.92)", lineHeight: 1.15 }}>
            How was your experience?
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
            {contact.name.split(" ")[0]}, congratulations on completing your {roleLabel} at {contact.transaction.propertyAddress}. We'd love your feedback — it takes less than a minute.
          </p>

          <SurveyForm token={token} />
        </div>
      </div>
    </main>
  );
}

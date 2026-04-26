import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NewTransactionForm } from "@/components/transactions/NewTransactionForm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export default async function AgentNewTransactionPage() {
  const session = await requireSession();

  const [recommendedFirms, drafts] = await Promise.all([
    Promise.resolve().then(() =>
      db.agencyRecommendedSolicitor?.findMany({ where: { agencyId: session.user.agencyId }, select: { solicitorFirmId: true, defaultReferralFeePence: true } }) ?? Promise.resolve([])
    ).then((rows: { solicitorFirmId: string; defaultReferralFeePence: number | null }[]) =>
      rows.map((r) => ({ id: r.solicitorFirmId, defaultReferralFeePence: r.defaultReferralFeePence }))
    ).catch(() => []),
    prisma.propertyTransaction.findMany({
      where: { agencyId: session.user.agencyId, agentUserId: session.user.id, status: "draft" as never },
      select: {
        id: true, propertyAddress: true, tenure: true, purchaseType: true,
        purchasePrice: true, createdAt: true,
        contacts: { select: { name: true, phone: true, email: true, roleType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).then((rows) => rows.map((r) => ({
      id: r.id,
      propertyAddress: r.propertyAddress,
      tenure: r.tenure as string | null,
      purchaseType: r.purchaseType as string | null,
      purchasePrice: r.purchasePrice ?? null,
      createdAt: r.createdAt.toISOString(),
      vendorName: r.contacts.find((c: { roleType: string }) => c.roleType === "vendor")?.name ?? null,
      vendorPhone: r.contacts.find((c: { roleType: string }) => c.roleType === "vendor")?.phone ?? null,
      vendorEmail: r.contacts.find((c: { roleType: string }) => c.roleType === "vendor")?.email ?? null,
      purchaserName: r.contacts.find((c: { roleType: string }) => c.roleType === "purchaser")?.name ?? null,
      purchaserPhone: r.contacts.find((c: { roleType: string }) => c.roleType === "purchaser")?.phone ?? null,
      purchaserEmail: r.contacts.find((c: { roleType: string }) => c.roleType === "purchaser")?.email ?? null,
    }))).catch(() => []),
  ]);

  return (
    <>
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(255,138,101,0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,138,101,0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,220,100,0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative", padding: "24px 32px 28px" }}>
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>{session.user.firmName ?? "Agent Portal"}</p>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>New Transaction</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Fill in the details below to create a new property file.</p>
        </div>
      </div>

      <div className="px-8 py-7">
        <NewTransactionForm userRole={session.user.role} redirectBase="/agent/transactions" recommendedFirms={recommendedFirms} initialDrafts={drafts} />
      </div>
    </>
  );
}

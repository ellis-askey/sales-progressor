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
        notes: true,
        agentFeeAmount: true, agentFeePercent: true, agentFeeIsVatInclusive: true,
        vendorSolicitorFirmId: true, vendorSolicitorContactId: true,
        vendorSolicitorFirm: { select: { name: true } },
        vendorSolicitorContact: { select: { name: true, phone: true, email: true } },
        purchaserSolicitorFirmId: true, purchaserSolicitorContactId: true,
        purchaserSolicitorFirm: { select: { name: true } },
        purchaserSolicitorContact: { select: { name: true, phone: true, email: true } },
        referredFirmId: true, referralFee: true,
        progressedBy: true,
        contacts: { select: { name: true, phone: true, email: true, roleType: true } },
        documents: { where: { source: "mos" }, select: { storagePath: true, fileSize: true, mimeType: true, filename: true }, take: 1 },
        chainLink: {
          select: {
            position: true,
            chain: {
              select: {
                links: {
                  orderBy: { position: "asc" },
                  select: { position: true, transactionId: true, stubPropertyAddress: true, stubAgencyName: true, stubAgentName: true, stubAgentEmail: true, stubAgentPhone: true, stubNotes: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }).then((rows) => rows.map((r) => {
      const originatorPos = r.chainLink?.position ?? -1;
      const chainStubs = r.chainLink?.chain?.links
        .filter((l) => l.transactionId === null)
        .map((l) => ({
          id: Math.random().toString(36).slice(2),
          direction: (l.position < originatorPos ? "above" : "below") as "above" | "below",
          stubPropertyAddress: l.stubPropertyAddress ?? "",
          stubAgencyName: l.stubAgencyName ?? "",
          stubAgentName: l.stubAgentName ?? "",
          stubAgentEmail: l.stubAgentEmail ?? "",
          stubAgentPhone: l.stubAgentPhone ?? "",
          stubNotes: l.stubNotes ?? "",
        })) ?? [];
      const mosDocs = r.documents ?? [];
      const mosDoc = mosDocs[0] ?? null;
      const vendorContacts = r.contacts.filter((c: { roleType: string }) => c.roleType === "vendor");
      const purchaserContacts = r.contacts.filter((c: { roleType: string }) => c.roleType === "purchaser");
      const vendorSol = r.vendorSolicitorFirmId && r.vendorSolicitorFirm
        ? { firmId: r.vendorSolicitorFirmId, firmName: r.vendorSolicitorFirm.name, contactId: r.vendorSolicitorContactId ?? null, contactName: r.vendorSolicitorContact?.name ?? null, phone: r.vendorSolicitorContact?.phone ?? null, email: r.vendorSolicitorContact?.email ?? null }
        : null;
      const purchaserSol = r.purchaserSolicitorFirmId && r.purchaserSolicitorFirm
        ? { firmId: r.purchaserSolicitorFirmId, firmName: r.purchaserSolicitorFirm.name, contactId: r.purchaserSolicitorContactId ?? null, contactName: r.purchaserSolicitorContact?.name ?? null, phone: r.purchaserSolicitorContact?.phone ?? null, email: r.purchaserSolicitorContact?.email ?? null }
        : null;
      return {
        id: r.id,
        propertyAddress: r.propertyAddress,
        tenure: r.tenure as string | null,
        purchaseType: r.purchaseType as string | null,
        purchasePrice: r.purchasePrice ?? null,
        createdAt: r.createdAt.toISOString(),
        notes: r.notes ?? null,
        agentFeeAmount: r.agentFeeAmount ?? null,
        agentFeePercent: r.agentFeePercent != null ? Number(r.agentFeePercent) : null,
        agentFeeIsVatInclusive: r.agentFeeIsVatInclusive ?? null,
        vendors: vendorContacts.map((c: { name: string; phone: string | null; email: string | null }) => ({ name: c.name, phone: c.phone, email: c.email })),
        purchasers: purchaserContacts.map((c: { name: string; phone: string | null; email: string | null }) => ({ name: c.name, phone: c.phone, email: c.email })),
        vendorSolicitor: vendorSol,
        purchaserSolicitor: purchaserSol,
        referredFirmId: r.referredFirmId ?? null,
        referralFee: r.referralFee ?? null,
        mosStoragePath: mosDoc?.storagePath ?? null,
        mosFileSize: mosDoc?.fileSize ?? null,
        mosMimeType: mosDoc?.mimeType ?? null,
        mosFilename: mosDoc?.filename ?? null,
        progressedBy: (r.progressedBy as string | null) ?? "agent",
        chainStubs,
      };
    })).catch(() => []),
  ]);

  return (
    <>
      <div style={{
        background: "rgba(255,255,255,0.52)",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        borderBottom: "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 24px rgba(var(--agent-coral-base-rgb),0.07), 0 1px 0 rgba(255,255,255,0.80) inset",
        position: "relative",
        overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{ position: "absolute", top: -60, right: -40, width: 260, height: 260, borderRadius: "50%", background: "radial-gradient(circle, rgba(var(--agent-coral-base-rgb),0.13) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: -40, left: 60, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(var(--agent-bloom-gold-rgb),0.10) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div className="relative px-4 pt-6 pb-7 md:px-8">
          <p className="agent-eyebrow" style={{ marginBottom: 12 }}>{session.user.firmName ?? "Agent Portal"}</p>
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>New Transaction</h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>Fill in the details below to create a new property file.</p>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 md:py-7">
        <NewTransactionForm userRole={session.user.role} redirectBase="/agent/transactions" recommendedFirms={recommendedFirms} initialDrafts={drafts} />
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveAgentVisibility, getDraftTransactions, getAgentTransactions } from "@/lib/services/agent";
import { discardDraftAction } from "@/app/actions/transactions";
import { QuickAddForm } from "@/components/transactions/QuickAddForm";

function relativeDate(d: Date | string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function AgentQuickAddPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await requireSession();
  if (session.user.role !== "negotiator" && session.user.role !== "director") {
    redirect("/dashboard");
  }

  const { draft: draftId } = await searchParams;
  const vis = await resolveAgentVisibility(session.user.id, session.user.agencyId);

  const [drafts, allTransactions] = await Promise.all([
    getDraftTransactions(vis),
    getAgentTransactions(vis),
  ]);

  const recentFiles = allTransactions.slice(0, 5);

  // If ?draft=id, find it and build initialValues
  const activeDraft = draftId ? drafts.find((d) => d.id === draftId) : null;
  const initialValues = activeDraft
    ? {
        address: activeDraft.propertyAddress,
        tenure: activeDraft.tenure,
        purchaseType: activeDraft.purchaseType,
        purchasePrice: activeDraft.purchasePrice,
        vendorName: activeDraft.contacts.find((c) => c.roleType === "vendor")?.name,
        vendorPhone: activeDraft.contacts.find((c) => c.roleType === "vendor")?.phone,
        purchaserName: activeDraft.contacts.find((c) => c.roleType === "purchaser")?.name,
        purchaserPhone: activeDraft.contacts.find((c) => c.roleType === "purchaser")?.phone,
      }
    : undefined;

  return (
    <>
      {/* Header */}
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
          <h1 style={{ margin: 0, fontSize: "var(--agent-text-h1)", fontWeight: "var(--agent-weight-semibold)", color: "var(--agent-text-primary)", letterSpacing: "var(--agent-tracking-tight)", lineHeight: "var(--agent-line-tight)" }}>
            {activeDraft ? "Continue draft" : "Quick add"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "var(--agent-text-body-sm)", color: "var(--agent-text-tertiary)" }}>
            {activeDraft ? activeDraft.propertyAddress : "Log a new sale or purchase in seconds."}
          </p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="px-6 py-6">
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 24, alignItems: "start" }}>

          {/* Left: form */}
          <QuickAddForm initialValues={initialValues} draftId={activeDraft?.id} />

          {/* Right: panels */}
          <div className="space-y-4">

            {/* Draft saves */}
            {drafts.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/20">
                  <p className="glass-section-label text-slate-900/40">Draft saves</p>
                  <p className="text-xs text-slate-900/35 mt-0.5">Pick up where you left off.</p>
                </div>
                <div className="divide-y divide-white/15">
                  {drafts.map((draft) => {
                    const vendor = draft.contacts.find((c) => c.roleType === "vendor");
                    const purchaser = draft.contacts.find((c) => c.roleType === "purchaser");
                    const names = [vendor?.name, purchaser?.name].filter(Boolean).join(" & ");
                    const meta = [
                      draft.tenure ? (draft.tenure === "freehold" ? "Freehold" : "Leasehold") : null,
                      draft.purchaseType === "mortgage" ? "Mortgage" : draft.purchaseType === "cash" ? "Cash" : draft.purchaseType === "cash_from_proceeds" ? "Proceeds" : null,
                    ].filter(Boolean).join(" · ");
                    const isActive = draft.id === activeDraft?.id;
                    return (
                      <div key={draft.id} className={`px-5 py-3.5 flex items-start justify-between gap-4 ${isActive ? "bg-blue-50/30" : ""}`}>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900/80 truncate">{draft.propertyAddress}</p>
                          {names && <p className="text-xs text-slate-900/50 mt-0.5 truncate">{names}</p>}
                          <p className="text-xs text-slate-900/35 mt-0.5">
                            {meta ? `${meta} · ` : ""}{relativeDate(draft.updatedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
                          {!isActive && (
                            <Link
                              href={`/agent/quick-add?draft=${draft.id}`}
                              className="text-xs font-semibold text-blue-500 hover:text-blue-600 transition-colors"
                            >
                              Continue →
                            </Link>
                          )}
                          {isActive && (
                            <span className="text-xs font-semibold text-blue-500">Editing</span>
                          )}
                          <form action={discardDraftAction.bind(null, draft.id)}>
                            <button type="submit" className="text-xs text-slate-900/35 hover:text-red-500 transition-colors">
                              Discard
                            </button>
                          </form>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recently added */}
            {recentFiles.length > 0 && (
              <div className="glass-card overflow-hidden">
                <div className="px-5 py-4 border-b border-white/20">
                  <p className="glass-section-label text-slate-900/40">Recently added</p>
                </div>
                <div className="divide-y divide-white/15">
                  {recentFiles.map((tx) => (
                    <div key={tx.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900/80 truncate">{tx.propertyAddress}</p>
                        <p className="text-xs text-slate-900/35 mt-0.5">{relativeDate(tx.createdAt)}</p>
                      </div>
                      <Link
                        href={`/agent/transactions/${tx.id}`}
                        className="text-sm font-medium text-blue-500 hover:text-blue-600 flex-shrink-0 transition-colors"
                      >
                        →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full form CTA */}
            <div className="glass-card px-5 py-4">
              <p className="glass-section-label text-slate-900/40 mb-2">Need more fields?</p>
              <p className="text-sm text-slate-900/50 mb-3">
                The full form supports memo of sale upload, solicitor details, agent fee, notes and more.
              </p>
              <Link
                href="/agent/transactions/new"
                className="text-sm font-semibold text-blue-500 hover:text-blue-600 transition-colors"
              >
                Open full form →
              </Link>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

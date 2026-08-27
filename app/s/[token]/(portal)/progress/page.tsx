import { prisma } from "@/lib/prisma";
import { forRound, milestoneScopeWhere } from "@/lib/services/milestone-scope";
import { resolveDisplayStages, type ResolvedStage } from "@/lib/milestones/display-stages";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";
import { PortalCard, CardKicker } from "../../portal-cards";
import { S } from "../../ui";

export const dynamic = "force-dynamic";

function fmtLong(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function fmtShort(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function SolicitorProgressPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = verifySolicitorToken(token);
  if (!decoded) return null;

  const tx = await prisma.propertyTransaction.findUnique({
    where: { id: decoded.transactionId },
    select: { id: true, activeBuyerRoundId: true, expectedExchangeDate: true, overridePredictedDate: true, completionDate: true },
  });
  if (!tx) return null;

  const scope = forRound(tx.activeBuyerRoundId, tx.id);
  const allRows = await prisma.milestoneCompletion.findMany({
    where: { transactionId: tx.id, ...milestoneScopeWhere(scope) },
    select: { state: true, completedAt: true, milestoneDefinition: { select: { code: true } } },
  });
  const stages = resolveDisplayStages(
    allRows.map((r) => ({ code: r.milestoneDefinition.code, isComplete: r.state === "complete", isNotRequired: r.state === "not_required", completion: { completedAt: r.completedAt } })),
    { expectedExchangeDate: tx.expectedExchangeDate ?? null, overridePredictedDate: tx.overridePredictedDate ?? null, targetCompletionDate: tx.completionDate ?? null },
  );

  return (
    <div className="portal-reveal-stack" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PortalCard>
        <CardKicker>Full timeline</CardKicker>
        <div>
          {stages.map((s, i) => (
            <TimelineRow key={s.key} stage={s} last={i === stages.length - 1} />
          ))}
        </div>
      </PortalCard>
    </div>
  );
}

function TimelineRow({ stage, last }: { stage: ResolvedStage; last: boolean }) {
  const st = stage.status;
  const dot = st === "complete" ? S.successRing : st === "in_progress" ? S.accent : "rgba(15,39,64,0.18)";
  const detail =
    st === "complete"
      ? stage.completedAt ? `Completed ${fmtLong(stage.completedAt)}` : "Complete"
      : st === "in_progress"
        ? "In progress"
        : st === "up_next"
          ? "Up next"
          : st === "skipped"
            ? "Skipped"
            : stage.key === "exchange" && stage.forecastDate
              ? `Target ~ ${fmtShort(stage.forecastDate)}`
              : stage.key === "completion"
                ? "To be confirmed"
                : "Not started";
  return (
    <div style={{ display: "flex", gap: 14, minHeight: 56 }}>
      <div style={{ position: "relative", width: 24, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        {!last && <div style={{ position: "absolute", top: 22, bottom: -8, width: 2, background: st === "complete" ? S.successRing : "rgba(15,39,64,0.10)" }} />}
        <div style={{ width: 16, height: 16, borderRadius: 8, marginTop: 4, background: st === "complete" || st === "in_progress" ? dot : "#fff", border: `2px solid ${dot}`, zIndex: 1 }} />
      </div>
      <div style={{ paddingBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: st === "in_progress" ? 700 : 600, color: st === "skipped" ? S.faint : S.ink, textDecoration: st === "skipped" ? "line-through" : "none" }}>{stage.name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: st === "in_progress" ? S.accent : st === "complete" ? S.muted : S.faint, fontWeight: st === "in_progress" ? 600 : 400 }}>{detail}</p>
      </div>
    </div>
  );
}

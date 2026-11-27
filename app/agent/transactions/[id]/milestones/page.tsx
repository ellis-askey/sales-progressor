// File-detail — Steps + Activity tab (route segment). Renders only when open.
// Steps and the activity log are one surface now: Steps at ~60%, the activity
// feed as a ~40% column beside it from 1100px up, stacking BELOW Steps below
// that — so a laptop at 100% zoom gets the split while phones and smaller /
// portrait tablets (incl. iPad landscape at 1024) stay stacked. The Sale-health
// sidebar is suppressed on this tab by FileTabsChrome, so the pair runs full
// width.
// Nothing inside either panel changed — this is pure relocation (founder,
// 2026-11-17). The standalone /activity route redirects here.
import { loadFilePageContext } from "@/lib/services/file-page-context";
import { StepsPanel } from "@/components/transaction/StepsPanel";
import { ActivityPanel } from "@/components/transaction/ActivityPanel";
import { buildPartyNameContext } from "@/lib/milestones/step-name";
import { TabEnter } from "@/components/transaction/TabEnter";
import { progressionBusinessesEnabled } from "@/lib/progression/flags";

export const unstable_dynamicStaleTime = 300;

// Exchange/completion is confirmed on this tab. That confirm reconciles the
// outstanding late-stage steps and completes BOTH sides of the pair inside one
// DB transaction, budgeted up to ~40s (timeout 30s + up to 10s to acquire a
// pooled connection — app/actions/milestones.ts). Vercel's default function
// limit (~15s) killed the request mid-write, which the progressor saw as a
// freeze. Give the route headroom to match that budget — same fix the new-sale
// route uses (app/agent/transactions/new/page.tsx).
export const maxDuration = 60;

export default async function StepsTabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, transaction, isInternalStaff, isProgressor, isAdminRole } = await loadFilePageContext(id);
  // Real party names for the Steps-tab labels (firm + seller/buyer names, titles
  // stripped, active buyer round only). Falls back to generic wording per slot.
  const partyNames = buildPartyNameContext(
    transaction.contacts,
    transaction.vendorSolicitorFirm?.name ?? null,
    transaction.purchaserSolicitorFirm?.name ?? null,
    transaction.activeBuyerRound?.id ?? null,
  );
  // Progression-business members can mark a note private to their team. They can
  // only ever reach their own business's files, so membership + flag is enough;
  // createCommunicationRecord re-checks the business scope as the boundary.
  const canMarkPrivate = progressionBusinessesEnabled() && !!session.user.progressionBusinessId;

  return (
    <TabEnter stage>
      <div className="flex flex-col min-[1100px]:flex-row gap-4 min-[1100px]:gap-5 min-[1100px]:items-start">
        <div className="min-w-0 min-[1100px]:flex-[3]">
          <StepsPanel
            transactionId={transaction.id}
            agencyId={session.user.agencyId}
            userId={session.user.id}
            purchaseType={transaction.purchaseType ?? null}
            buyerNames={transaction.contacts.filter((c) => c.roleType === "purchaser").map((c) => c.name)}
            partyNames={partyNames}
          />
        </div>
        <div className="min-w-0 min-[1100px]:flex-[2]">
          {/* Cap the activity log on the split view: it no longer runs the whole
              page down. It sticks beside the steps and scrolls inside its own
              viewport-height box. Only at ≥1100px (where the split exists); below
              that it stacks under Steps and flows naturally. */}
          <div className="min-[1100px]:sticky min-[1100px]:top-4 min-[1100px]:max-h-[calc(100vh-7rem)] min-[1100px]:overflow-y-auto min-[1100px]:pr-1">
            <ActivityPanel
              transactionId={transaction.id}
              agencyId={session.user.agencyId}
              isInternalStaff={isInternalStaff}
              isProgressor={isProgressor}
              isAdminRole={isAdminRole}
              canMarkPrivate={canMarkPrivate}
              currentUserId={session.user.id}
              currentUserName={session.user.name ?? ""}
              currentUserRole={session.user.role ?? ""}
              contacts={transaction.contacts}
              vendorSolicitor={transaction.vendorSolicitorContact ?? null}
              purchaserSolicitor={transaction.purchaserSolicitorContact ?? null}
            />
          </div>
        </div>
      </div>
    </TabEnter>
  );
}

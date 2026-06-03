// Async server-component wrapper that defers the
// getAutomatedEmailsForTransaction fetch off the page's first paint.
// Mounted under a <Suspense> on the file detail page so the rest of
// the Reminders tab can render in parallel rather than waiting on a
// query that has historically dominated the page's load time
// (~2.6s in measurements as of 2026-06-03).
//
// Trade-off (deliberate): the inner AutomatedEmailsCard previously
// received `optimisticallySnoozedCodes` from RemindersSection's local
// state so the Upcoming list would hide just-snoozed items instantly.
// Pulling the card out of RemindersSection's render tree loses that
// direct prop wire. The page-level revalidatePath in the snooze actions
// still refreshes the card within a few hundred ms, so the visible blip
// on a snooze is a brief reappearance of the row, not a permanent
// stale state. Reinstate the sync (via React `use()` on a passed
// Promise) if the blip starts to annoy real users.

import { Suspense } from "react";
import { AutomatedEmailsCard } from "@/components/reminders/AutomatedEmailsCard";
import { getAutomatedEmailsForTransaction } from "@/lib/services/automated-emails-preview";

type Props = {
  transactionId: string;
  fileOnHold: boolean;
};

async function Inner({ transactionId, fileOnHold }: Props) {
  const data = await getAutomatedEmailsForTransaction(transactionId).catch(
    () =>
      ({
        pending: [],
        sentToday: [],
        upcoming: [],
        pauseState: {
          globalDisabled: false,
          agencyDisabled: false,
          fileDisabled: false,
          activePauseReason: null,
          agencyName: null,
        },
      }) as Awaited<ReturnType<typeof getAutomatedEmailsForTransaction>>,
  );

  return (
    <AutomatedEmailsCard
      data={data}
      transactionId={transactionId}
      fileOnHold={fileOnHold}
    />
  );
}

export function AutomatedEmailsCardAsync(props: Props) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  );
}

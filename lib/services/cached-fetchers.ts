// React.cache() wrappers for the file-detail page's fetchers.
//
// The page used to await every fetcher up-front in one big Promise.all
// because if it didn't, multiple downstream components would re-fetch
// the same data. Now that the page streams panels independently via
// Suspense, several panels need overlapping data — e.g. `milestones`
// goes to the sidebar progress ring, the Steps tab, the Overview
// next-milestone widget, and the Reminders tab's completedCodes set.
// Without cache() each of those would fire its own DB call.
//
// React.cache() dedupes calls within a single render pass: same input
// args = same Promise = one underlying query. Safe to call from any
// async server component without coordinating up front.

import { cache } from "react";
import { getTransaction, getTransactionByScope } from "@/lib/services/transactions";
import { getMilestonesForTransaction } from "@/lib/services/milestones";
import { getReminderLogsForTransaction, getGraceDaysByMilestoneCode } from "@/lib/services/reminders";
import { getActivityTimeline, getAutomatedEmailCountsByContact, getLastContactedByContact } from "@/lib/services/comms";
import { getLastUpdate } from "@/lib/services/summary";
import { listManualTasksForTransaction, listInternalSelfAssignedTasksForTransaction } from "@/lib/services/manual-tasks";
import { getClientChaseStatesForTransaction } from "@/lib/services/client-chase-state";

export const getTransactionCached            = cache(getTransaction);
export const getTransactionByScopeCached     = cache(getTransactionByScope);
export const getMilestonesCached             = cache(getMilestonesForTransaction);
export const getReminderLogsCached           = cache(getReminderLogsForTransaction);
export const getActivityTimelineCached       = cache(getActivityTimeline);
export const getLastUpdateCached             = cache(getLastUpdate);
export const listManualTasksCached           = cache(listManualTasksForTransaction);
export const listInternalSelfAssignedCached  = cache(listInternalSelfAssignedTasksForTransaction);
export const getGraceDaysCached              = cache(getGraceDaysByMilestoneCode);
export const getClientChaseStatesCached      = cache(getClientChaseStatesForTransaction);
export const getAutomatedEmailCountsCached   = cache(getAutomatedEmailCountsByContact);
export const getLastContactedByContactCached = cache(getLastContactedByContact);

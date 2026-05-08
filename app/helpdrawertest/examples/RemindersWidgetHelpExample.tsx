"use client";

import { RemindersWidget } from "@/components/transaction/RemindersWidget";

const THREE_DAYS_AGO = new Date(Date.now() - 3 * 86400000);
const TODAY = new Date();

const MOCK_REMINDERS = [
  {
    id: "help-reminder-1",
    ruleName: "Chase: Vendor solicitor — contract pack",
    nextDueDate: THREE_DAYS_AGO,
    pendingChaseCount: 2,
  },
  {
    id: "help-reminder-2",
    ruleName: "Chase: Purchaser solicitor — mortgage offer",
    nextDueDate: TODAY,
    pendingChaseCount: 1,
  },
];

export function RemindersWidgetHelpExample(_props: Record<string, string>) {
  return <RemindersWidget reminders={MOCK_REMINDERS} totalActive={5} />;
}

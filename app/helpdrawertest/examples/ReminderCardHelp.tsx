"use client";

import { ReminderCard, type CardLog, type Contact } from "@/components/reminders/ReminderCard";

const THREE_DAYS_AGO = new Date(Date.now() - 3 * 86400000);
const TWO_DAYS_AGO = new Date(Date.now() - 2 * 86400000);

const MOCK_LOG: CardLog = {
  id: "help-reminder-demo",
  nextDueDate: THREE_DAYS_AGO,
  snoozedUntil: null,
  reminderRule: {
    name: "Chase: Vendor solicitor — contract pack",
    description: null,
    targetMilestoneCode: "VM3",
    repeatEveryDays: 5,
    escalateAfterChases: 3,
    graceDays: 3,
    anchorMilestone: { name: "Memorandum of sale confirmed" },
  },
  chaseTasks: [
    {
      id: "help-task-demo",
      status: "pending",
      priority: "normal",
      chaseCount: 2,
      manualChaseCount: 1,
      dueDate: THREE_DAYS_AGO,
      communications: [{ createdAt: TWO_DAYS_AGO, method: "email" }],
    },
  ],
};

const MOCK_CONTACTS: Contact[] = [
  { id: "c1", name: "Hawthorne & Co Solicitors", roleType: "solicitor", email: "conveyancing@hawthorne.co.uk" },
];

export function ReminderCardHelpExample(_props: Record<string, string>) {
  return (
    <ReminderCard
      log={MOCK_LOG}
      transactionId="help-tx-demo"
      contacts={MOCK_CONTACTS}
      propertyAddress="12 Birchwood Lane, Guildford"
      showAddressLink={false}
      isLoading={null}
      onComplete={() => {}}
      onSnooze={() => {}}
      onEscalate={() => {}}
      onManualChase={() => {}}
      onChased={() => {}}
      lastComm={{ createdAt: TWO_DAYS_AGO, method: "email" }}
      totalActiveOnFile={1}
    />
  );
}

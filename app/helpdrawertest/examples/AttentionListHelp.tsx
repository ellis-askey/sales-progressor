"use client";

import { AttentionListView, type AttentionItem } from "@/components/hub/AttentionListView";

const ITEMS: AttentionItem[] = [
  {
    id: "1",
    urgency: "escalated",
    reminderName: "Vendor solicitor — contract pack",
    transaction: { id: "tx1", propertyAddress: "8 Maple Close, Guildford" },
  },
  {
    id: "2",
    urgency: "overdue",
    reminderName: "Search results outstanding",
    transaction: { id: "tx2", propertyAddress: "12 Birchwood Lane, Guildford" },
  },
  {
    id: "3",
    urgency: "due_today",
    reminderName: "Mortgage offer update",
    transaction: { id: "tx3", propertyAddress: "3 Elmwood Rise, Dorking" },
  },
];

export function AttentionListHelpExample(_props: Record<string, string>) {
  return <AttentionListView items={ITEMS} />;
}

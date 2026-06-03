"use client";

// Tiny client-side bridge: lets an async server panel report its tab
// badge count into the PropertyFileTabs badge state without the page
// server component having to fetch the data up front.
//
// Each panel renders <TabBadgeReporter tabKey="reminders" count={N} />
// at the top of its tree. As the panel streams in, this component
// mounts, reads the badge updater from context, and calls it once.
// PropertyFileTabs re-renders with the new badge.

import { useEffect } from "react";
import { useTabBadge } from "@/components/transaction/PropertyFileTabs";

type Props = {
  tabKey: string;
  count: number;
};

export function TabBadgeReporter({ tabKey, count }: Props) {
  const updateBadge = useTabBadge();
  useEffect(() => {
    if (updateBadge) updateBadge(tabKey, count);
  }, [tabKey, count, updateBadge]);
  return null;
}

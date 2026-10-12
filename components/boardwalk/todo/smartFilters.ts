// Built-in smart filters — real queries over the existing filter engine, not
// decorative links. Used by the sidebar ("My tasks"), the Filters & labels
// workspace, and /boardwalk/todo/smart/[key].

import type { FilterQuery } from "@/lib/todo/types";

export interface SmartFilter {
  key: string;
  name: string;
  hint: string;
  query: FilterQuery;
}

export const SMART_FILTERS: SmartFilter[] = [
  {
    key: "my-tasks",
    name: "My tasks",
    hint: "Everything assigned to you",
    query: { combinator: "and", conditions: [{ field: "assignee", value: "me" }] },
  },
  {
    key: "due-today",
    name: "Due today",
    hint: "Due on today's date",
    query: { combinator: "and", conditions: [{ field: "due", value: "today" }] },
  },
  {
    key: "overdue",
    name: "Overdue",
    hint: "Past their due date",
    query: { combinator: "and", conditions: [{ field: "due", value: "overdue" }] },
  },
  {
    key: "high-priority",
    name: "High priority",
    hint: "Priority 1 tasks",
    query: { combinator: "and", conditions: [{ field: "priority", value: "1" }] },
  },
  {
    key: "next-7-days",
    name: "Next 7 days",
    hint: "Due within a week",
    query: { combinator: "and", conditions: [{ field: "due", value: "next_7_days" }] },
  },
  {
    key: "no-date",
    name: "No due date",
    hint: "Unscheduled tasks",
    query: { combinator: "and", conditions: [{ field: "due", value: "no_date" }] },
  },
  {
    key: "recently-added",
    name: "Recently added",
    hint: "Created this week",
    query: { combinator: "and", conditions: [{ field: "created", value: "this_week" }] },
  },
];

export function getSmartFilter(key: string): SmartFilter | undefined {
  return SMART_FILTERS.find((f) => f.key === key);
}

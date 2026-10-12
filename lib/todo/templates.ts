// Built-in estate-agency project templates for Boardwalk To Do. Instantiated
// into REAL projects (sections + tasks) the user can edit freely — these are
// starting points, not hardcoded workflows. Users can also save any project
// of their own as a template (TodoProject.isTemplate).

import type { RecurrenceRule } from "./types";

export interface TemplateTask {
  title: string;
  description?: string;
  priority?: number;
  section?: string;
  subtasks?: string[];
  recurrence?: RecurrenceRule;
}

export interface TodoProjectTemplate {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  sections: string[];
  tasks: TemplateTask[];
}

export const TODO_TEMPLATES: TodoProjectTemplate[] = [
  {
    id: "new-instruction",
    name: "New property instruction",
    description: "Everything between winning the instruction and being ready to market.",
    color: "#404648",
    icon: "Home",
    sections: ["Paperwork", "Property preparation", "Marketing prep"],
    tasks: [
      { title: "Send terms of business", section: "Paperwork", priority: 1 },
      { title: "Signed terms returned", section: "Paperwork", priority: 2 },
      { title: "Complete AML checks on all owners", section: "Paperwork", priority: 1 },
      { title: "Confirm title and ownership position", section: "Paperwork" },
      { title: "Order EPC if not current", section: "Property preparation", priority: 2 },
      { title: "Book photography", section: "Property preparation", priority: 2, subtasks: ["Confirm property is photo-ready", "Agree date with owner", "Book photographer"] },
      { title: "Book floorplan", section: "Property preparation" },
      { title: "Gather lease details (if leasehold)", section: "Paperwork", description: "Term remaining, ground rent, service charge, managing agent." },
      { title: "Agree asking price with owner", section: "Marketing prep", priority: 1 },
      { title: "Confirm viewing arrangements and key holding", section: "Marketing prep" },
    ],
  },
  {
    id: "property-launch",
    name: "Property launch",
    description: "From assets in hand to live everywhere, approved by the owner.",
    color: "#4d5a4d",
    icon: "Rocket",
    sections: ["Assets", "Copy & approval", "Go live"],
    tasks: [
      { title: "Photography received and selected", section: "Assets", priority: 2 },
      { title: "Floorplan checked and labelled", section: "Assets" },
      { title: "EPC on file", section: "Assets" },
      { title: "Write listing copy", section: "Copy & approval", priority: 2 },
      { title: "Owner approval on copy and photos", section: "Copy & approval", priority: 1 },
      { title: "Build portal listings", section: "Go live", subtasks: ["Rightmove", "Zoopla", "OnTheMarket", "Own website"] },
      { title: "Prepare social posts", section: "Go live" },
      { title: "Email matching applicants", section: "Go live", priority: 2 },
      { title: "Order board", section: "Go live" },
    ],
  },
  {
    id: "valuation-follow-up",
    name: "Valuation follow-up",
    description: "The week after a market appraisal. Stay warm without being pushy.",
    color: "#8f5a56",
    icon: "TrendingUp",
    sections: ["Within 24 hours", "This week", "Keep warm"],
    tasks: [
      { title: "Send valuation letter / email", section: "Within 24 hours", priority: 1 },
      { title: "Send comparable evidence pack", section: "Within 24 hours" },
      { title: "Follow-up call", section: "This week", priority: 2 },
      { title: "Answer outstanding questions", section: "This week" },
      { title: "Second follow-up if no decision", section: "Keep warm" },
      { title: "Add to monthly market-update list", section: "Keep warm" },
    ],
  },
  {
    id: "marketing-campaign",
    name: "Marketing campaign",
    description: "A repeatable plan for a campaign: socials, email, print and portals.",
    color: "#996c1f",
    icon: "Megaphone",
    sections: ["Plan", "Produce", "Publish", "Review"],
    tasks: [
      { title: "Agree campaign goal and audience", section: "Plan", priority: 2 },
      { title: "Set budget", section: "Plan" },
      { title: "Draft social content", section: "Produce", subtasks: ["Instagram", "Facebook", "LinkedIn"] },
      { title: "Draft email campaign", section: "Produce" },
      { title: "Brief print / brochure work", section: "Produce" },
      { title: "Schedule posts", section: "Publish" },
      { title: "Send email campaign", section: "Publish", priority: 2 },
      { title: "Collect results and learnings", section: "Review" },
    ],
  },
  {
    id: "team-admin",
    name: "Team administration",
    description: "The recurring office drumbeat. Set it up once, let it repeat.",
    color: "#2b3032",
    icon: "ClipboardList",
    sections: ["Daily", "Weekly", "Monthly"],
    tasks: [
      { title: "Morning pipeline check", section: "Daily", recurrence: { freq: "weekdays", interval: 1, label: "every weekday" } },
      { title: "Chase outstanding paperwork", section: "Daily", recurrence: { freq: "weekdays", interval: 1, label: "every weekday" } },
      { title: "Team meeting agenda", section: "Weekly", recurrence: { freq: "weekly", interval: 1, weekdays: [1], label: "every monday" } },
      { title: "Window card and display refresh", section: "Weekly", recurrence: { freq: "weekly", interval: 1, weekdays: [5], label: "every friday" } },
      { title: "Invoice run", section: "Monthly", recurrence: { freq: "monthly_first_workday", interval: 1, label: "first working day of each month" } },
      { title: "Portal performance review", section: "Monthly", recurrence: { freq: "monthly", interval: 1, monthDay: 15, label: "every month on the 15th" } },
    ],
  },
  {
    id: "recruitment-onboarding",
    name: "Recruitment & onboarding",
    description: "From offer letter to a fully set-up team member.",
    color: "#55604f",
    icon: "UserPlus",
    sections: ["Before day one", "First day", "First month"],
    tasks: [
      { title: "Send offer letter and contract", section: "Before day one", priority: 1 },
      { title: "Collect right-to-work documents", section: "Before day one", priority: 1 },
      { title: "Order equipment", section: "Before day one", subtasks: ["Laptop", "Phone", "Business cards"] },
      { title: "Create accounts", section: "Before day one", subtasks: ["Email", "CRM", "Portals", "Boardwalk Forms + To Do"] },
      { title: "Desk and welcome pack ready", section: "First day" },
      { title: "Office tour and introductions", section: "First day" },
      { title: "Systems training", section: "First month", subtasks: ["CRM", "Phones", "Compliance basics"] },
      { title: "30-day review", section: "First month", priority: 2 },
    ],
  },
];

export function getTodoTemplate(id: string): TodoProjectTemplate | undefined {
  return TODO_TEMPLATES.find((t) => t.id === id);
}

// Universal role icons for ContactRole values. Single source of truth for:
//   - which icon represents each role (vendor / purchaser / solicitor /
//     broker / other)
//   - which colour pairs with each role (vendor=orange, purchaser=blue;
//     others=neutral)
//   - the canonical capitalised label
//
// Consumers across the app:
//   - ContactsSection (role badges)
//   - TransactionRowView (Vendor: / Buyer: line)
//   - ReminderCard / RemindersSection / AgentRemindersList (Seller/Buyer
//     column headers + empty states)
//   - MilestonePanel (vendor/purchaser side tabs)
//   - CommsActivityFeed (milestone badges)
//   - AutomatedEmailsListView + AutomatedEmailsCard (recipient role line)
//   - AutomationSettingsForm (Vendor side / Purchaser side section headers)
//   - ReconcileMilestonePicker (section headers)
//   - MemoStatusBar (section tabs)
//
// Future swap of an icon (e.g. UserCircle → User) is a single edit here.

import {
  UserCircle, User, Briefcase, ChartLineUp,
  type Icon,
} from "@phosphor-icons/react";

export type Role = "vendor" | "purchaser" | "solicitor" | "broker" | "other";

const ICON_FOR_ROLE: Record<Role, Icon> = {
  vendor:    UserCircle, // avatar — distinguished from purchaser by colour
  purchaser: UserCircle, // avatar — distinguished from vendor by colour
  solicitor: Briefcase,  // legal professional
  broker:    ChartLineUp, // financial / advisory
  other:     User,        // generic person (plain silhouette, no circle)
};

// Solid colour for the icon glyph itself. Pairs with the role's bg tint
// where rendered as a pill (vendor=#fff3e0 bg, purchaser=#e0f2fe bg).
const COLOUR_FOR_ROLE: Record<Role, string> = {
  vendor:    "#ea580c", // orange — established convention across the app
  purchaser: "#0369a1", // blue   — established convention across the app
  solicitor: "var(--agent-text-secondary)",
  broker:    "var(--agent-text-secondary)",
  other:     "var(--agent-text-muted)",
};

// Pill background tint when the icon + label appear inside a coloured pill.
export const ROLE_PILL_BG: Record<Role, string> = {
  vendor:    "#fff3e0",
  purchaser: "#e0f2fe",
  solicitor: "rgba(15,23,42,0.06)",
  broker:    "rgba(15,23,42,0.06)",
  other:     "rgba(15,23,42,0.06)",
};

const LABEL_FOR_ROLE: Record<Role, string> = {
  vendor:    "Vendor",
  purchaser: "Purchaser",
  solicitor: "Solicitor",
  broker:    "Broker",
  other:     "Other",
};

const SHORT_LABEL_FOR_ROLE: Record<Role, string> = {
  vendor:    "Seller",
  purchaser: "Buyer",
  solicitor: "Solicitor",
  broker:    "Broker",
  other:     "Other",
};

// Normalise free-text role strings (some places pass lowercase "vendor",
// some pass "Vendor", some pass DB enum). Returns null if unrecognised.
export function asRole(input: string | null | undefined): Role | null {
  if (!input) return null;
  const k = input.toLowerCase();
  if (k === "vendor" || k === "purchaser" || k === "solicitor" || k === "broker" || k === "other") {
    return k as Role;
  }
  return null;
}

export function roleColour(role: Role): string {
  return COLOUR_FOR_ROLE[role];
}

export function roleLabel(role: Role): string {
  return LABEL_FOR_ROLE[role];
}

// Some surfaces use "Seller" / "Buyer" instead of "Vendor" / "Purchaser"
// (Reminders column headers, for example). Use this where that's the case.
export function roleShortLabel(role: Role): string {
  return SHORT_LABEL_FOR_ROLE[role];
}

type Props = {
  role: Role;
  size?: number;
  weight?: "regular" | "bold" | "fill";
  // When supplied, overrides the role's default colour. Use sparingly —
  // the colour convention is part of the role's identity.
  colorOverride?: string;
};

export function RoleIcon({ role, size = 14, weight = "regular", colorOverride }: Props) {
  const Cmp = ICON_FOR_ROLE[role];
  const color = colorOverride ?? COLOUR_FOR_ROLE[role];
  return (
    <span style={{ color, display: "inline-flex", flexShrink: 0, lineHeight: 0 }}>
      <Cmp size={size} weight={weight} />
    </span>
  );
}

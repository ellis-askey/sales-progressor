// Client-safe work-queue alert types + display config. Split out of
// lib/services/work-queue so CLIENT components (e.g. components/reminders/
// FileAlertsStrip) can import ALERT_CONFIG + the item/alert types WITHOUT pulling
// the whole work-queue server module into the browser bundle. work-queue statically
// imports access-scope -> agent-session and prisma query builders, whose graph
// reaches node-only modules (net/tls/dns/fs via the email + glossary chains). A
// value import of ALERT_CONFIG from work-queue dragged all of that into the client
// and broke the Turbopack build. This module imports only a Prisma TYPE (erased).
import type { TransactionStatus } from "@prisma/client";

export type AlertType =
  | "missing_vendor_solicitor"
  | "missing_purchaser_solicitor"
  | "overdue_exchange"
  | "stale";

export type WorkQueueItem = {
  id: string;
  propertyAddress: string;
  status: TransactionStatus;
  expectedExchangeDate: Date | null;
  alerts: AlertType[];
  vendors: string[];
  purchasers: string[];
  lastActivityAt: Date | null;
  agentUser: { id: string; name: string } | null;
  createdAt: Date;
};

export const ALERT_CONFIG: Record<AlertType, { label: string; color: string; bg: string; border: string }> = {
  overdue_exchange:          { label: "Exchange date overdue",       color: "var(--agent-danger)",  bg: "var(--agent-danger-bg)",  border: "var(--agent-danger-border)"  },
  missing_vendor_solicitor:  { label: "Seller's solicitor unreachable",    color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" },
  missing_purchaser_solicitor: { label: "Buyer's solicitor unreachable", color: "var(--agent-warning)", bg: "var(--agent-warning-bg)", border: "var(--agent-warning-border)" },
  stale:                     { label: "No progress for 14+ days",     color: "var(--agent-info)",    bg: "var(--agent-info-bg)",    border: "var(--agent-info-border)"    },
};

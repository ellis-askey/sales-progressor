// Delivery-status → canonical Pill tone + label mapping for the Automated-
// emails surface. One source of truth so the feed rows, the detail drawer, and
// the needs-attention panel all label delivery states identically. Colour is
// never the only signal — every state carries a distinct word (a11y).

import type { PillProps } from "@/components/ui/Pill";
import type { EmailDeliveryStatus } from "@/lib/services/automated-emails-list";

type Tone = NonNullable<PillProps["tone"]>;

const META: Record<EmailDeliveryStatus, { label: string; tone: Tone }> = {
  delivered: { label: "Delivered", tone: "success" },
  sent:      { label: "Sent",      tone: "info" },
  pending:   { label: "Pending",   tone: "muted" },
  deferred:  { label: "Deferred",  tone: "warning" },
  bounced:   { label: "Bounced",   tone: "danger" },
  blocked:   { label: "Blocked",   tone: "danger" },
  errored:   { label: "Errored",   tone: "danger" },
  failed:    { label: "Failed",    tone: "danger" },
};

export function deliveryStatusMeta(status: EmailDeliveryStatus): { label: string; tone: Tone } {
  return META[status];
}

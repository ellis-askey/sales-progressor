// Plain-English names for the raw EventType slugs, so Command Centre pages can
// show "Confirmed a milestone" instead of `milestone_confirmed` in monospace.
// Founder-facing; keep these human and verb-first.

export const EVENT_LABELS: Record<string, string> = {
  user_logged_in: "Logged in",
  user_logged_out: "Logged out",
  user_invited: "Invited a teammate",
  user_accepted_invite: "Accepted an invite",
  password_reset_requested: "Asked to reset a password",
  password_reset_completed: "Reset their password",
  agency_created: "Agency joined",
  agency_mode_changed: "Agency plan changed",
  agency_archived: "Agency archived",
  transaction_created: "Started a sale",
  transaction_archived: "Archived a sale",
  transaction_status_changed: "Changed a sale's status",
  milestone_confirmed: "Confirmed a milestone",
  milestone_marked_not_required: "Skipped a milestone",
  milestone_reversed: "Undid a milestone",
  exchange_gate_unlocked: "Reached ready-to-exchange",
  contracts_exchanged: "Exchanged",
  sale_completed: "Completed a sale",
  chase_sent: "Sent a chase",
  chase_message_generated: "Drafted a chase",
  email_parse_attempted: "Parsed an email",
  file_uploaded: "Uploaded a file",
  file_deleted: "Removed a file",
  feedback_submitted: "Sent feedback",
  admin_logged_in: "Admin logged in",
  admin_action_performed: "Admin action",
};

// Falls back to a de-underscored version of the slug for any unmapped type.
export function eventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

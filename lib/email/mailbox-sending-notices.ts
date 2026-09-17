// Copy for the mailbox-sending lifecycle notices (plain text, no template
// chrome). Pure builders so the send paths (lib/integrations/imap/connections,
// lib/integrations/smtp/send) and the Command Centre email catalogue render
// the SAME words — the catalogue's no-drift rule.

/**
 * The one-off confirmation fired to the mailbox ITSELF the moment sending is
 * switched on — it sends through the newly enabled route, so its arrival is
 * the proof the route works.
 */
export function buildMailboxSendingTest(): { subject: string; text: string } {
  return {
    subject: "Sending is set up",
    text:
      "Emails you send from Sales Progressor on your files will now come from this address. " +
      "A copy of each one is filed in this mailbox's Sent folder, and replies land straight back here. " +
      "This is a one-off confirmation that sending works. There's nothing you need to do.",
  };
}

/**
 * Sent to the connection owner's sign-in inbox (from our own address) when
 * their app-password stops working and sending auto-disables. Their mail keeps
 * flowing via the SendGrid fallback in the meantime.
 */
export function buildMailboxSendingStopped(mailboxEmail: string): { subject: string; text: string } {
  return {
    subject: `Sending from your inbox has stopped working: ${mailboxEmail}`,
    text:
      `We tried to send an email from your connected inbox ${mailboxEmail}, but its mail server no longer accepts the app-password. ` +
      "This usually means the password was removed or expired.\n\n" +
      "Your emails still go out. Until this is fixed, we'll send them from our own address with replies going to you, so nothing on your files is held up.\n\n" +
      "To send from your own address again, create a new app-password with your email provider, then reconnect the inbox from Account, under Connections.",
  };
}

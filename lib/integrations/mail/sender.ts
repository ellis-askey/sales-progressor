// Sender classification for inbound mail matching. Pure string logic, no imports
// — so it stays unit-testable without dragging in the server/auth graph.

// A machine / automated sender — alerts, notifications, no-reply mailers. Real
// conveyancing correspondence comes from a HUMAN mailbox; a machine that merely
// name-drops a property (a portal "your listings this week" digest, a CI or CRM
// alert, a social notification) is NOT correspondence. The matcher therefore
// never lets these in on the weakest signal — a bare address mention. The strong
// signals still apply: a message the agent deliberately files into a property
// folder, or one that continues a thread already on a file, is still placed.
//
// This is a PRINCIPLE, not a blocklist: the no-reply/notification local-part test
// generalises to senders we've never seen, so there's no list to keep complete.
// The small domain set is only belt-and-braces for high-volume machines that
// don't use a no-reply-style address.
const NOISE_SENDER_DOMAINS = new Set<string>([
  "vercel.com", "sentry.io", "getsentry.com", "md.getsentry.com",
  "github.com", "monday.com", "linkedin.com", "facebookmail.com",
]);

export function isMachineSender(from: string): boolean {
  const f = (from ?? "").toLowerCase().trim();
  if (!f.includes("@")) return false;
  const [local, domain] = f.split("@");
  // no-reply / notification / alert / mailer style local part
  if (/(^|[._+-])(no-?reply|do-?not-?reply|donotreply|notifications?|alerts?|mailer|mailer-daemon|bounce|postmaster|automated)([._+-]|$)/.test(local)) {
    return true;
  }
  if (!domain) return false;
  if (NOISE_SENDER_DOMAINS.has(domain)) return true;
  // alerts./notifications./mailer./no-reply. subdomains (e.g. alerts.zoopla.co.uk)
  if (/(^|\.)(alerts?|notifications?|mailer|no-?reply)\./.test(domain)) return true;
  return false;
}

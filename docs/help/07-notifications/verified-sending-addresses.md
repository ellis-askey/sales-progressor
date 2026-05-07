# Verified Sending Addresses

When you send a chase email or a portal link email from Sales Progressor, the email needs to come from somewhere. By default it comes from a generic Sales Progressor address. Setting up a verified sending address makes outgoing emails appear as coming from your own work email.

## Why it matters

An email from `jane.smith@highstreet-homes.co.uk` is more trusted by solicitors and clients than one from a generic platform address. It also keeps your professional brand consistent — the recipient sees it as coming from you, not from a third-party system.

## How to verify an address

1. Go to **Settings → Sending addresses**.
2. Click **Add address**.
3. Enter your work email address (e.g. `jane@youragency.co.uk`).
4. A verification email is sent to that address.
5. Click the confirmation link in that email.
6. The address is now verified and will be used for all outgoing emails.

## DNS records (for domain-level setup)

To ensure emails sent on your behalf are delivered reliably and pass spam checks, your IT team or domain host may need to add DNS records. The Settings page shows the exact CNAME records that need to be added.

If you're not sure who manages your domain's DNS, ask your IT contact. The platform can also email the DNS record details to your IT team directly — use the "Send instructions" option in the Sending addresses section.

## Multiple addresses

If your branch uses multiple email addresses (e.g. different negotiators each have their own), each person can verify their own sending address. Each user's outgoing emails come from their own verified address.

## What happens if no verified address is set

Emails are still sent, but they come from a generic Sales Progressor address. The client or solicitor will see this as the sender. All functionality works the same — the only difference is the displayed "From" address.

## Related articles

- [System emails](system-emails.md)
- [Chase emails](../04-reminders-and-chasing/chase-emails.md)
- [Sending a portal link](../05-portal/sending-a-portal-link.md)

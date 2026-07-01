// One-shot: send a sample of the white-labelled outsource intro email
// to a real address, for Ellis's manual eyeball review on staging.
//
// Bypasses the queue + working-hours scheduler — just builds the template
// and pushes it through SendGrid directly so it lands now. The from-name
// is the locked production format ("{firstName} {lastName}, {agencyName}");
// the envelope address is updates@thesalesprogressor.co.uk because we
// don't have a verified Akeman Residential domain in this account (which
// is exactly the production fallback path).
//
// Run:
//   SENDGRID_API_KEY="$(grep '^SENDGRID_API_KEY' .env.preview | cut -d'=' -f2- | tr -d '"')" \
//     npx ts-node --compiler-options '{"module":"CommonJS","esModuleInterop":true}' \
//       scripts/send-test-outsource-intro.ts

import sgMail from "@sendgrid/mail";
import { buildOutsourceIntroEmail } from "../lib/emails/outsource-intro-template";

async function main() {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error("SENDGRID_API_KEY is not set on this shell");
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);

  const built = buildOutsourceIntroEmail({
    clientFirstName: "Ellis",
    address: "42 Briarwood Avenue, Hampton, TW12 1AB",
    agentFirstName: "Taylor",
    agentLastName: "Kay",
    agencyName: "Akeman Residential",
  });

  const fromHeader = `${built.fromName} <updates@thesalesprogressor.co.uk>`;
  const to = "ellisaskey@googlemail.com";

  console.log("Sending preview...");
  console.log("  to:        ", to);
  console.log("  from:      ", fromHeader);
  console.log("  subject:   ", built.subject);

  await sgMail.send({
    to,
    from: fromHeader,
    replyTo: "taylor@akemanresidential.co.uk",
    subject: built.subject,
    text: built.text,
    html: built.html,
  });

  console.log("Sent.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

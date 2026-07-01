// Send a single live test of the claim-cycle welcome email to a fixed
// recipient so Ellis can see the rendering in a real inbox. Calls
// buildClaimWelcome directly and uses @sendgrid/mail directly to avoid
// pulling lib/email.ts (which imports Prisma).
//
// Run:
//   npx ts-node \
//     --compiler-options '{"module":"CommonJS","esModuleInterop":true,"baseUrl":".","paths":{"@/*":["./*"]}}' \
//     --require tsconfig-paths/register \
//     scripts/send-test-claim-welcome.ts

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import sgMail from "@sendgrid/mail";
import { buildClaimWelcome } from "@/lib/emails/retention";

const RECIPIENT = "ellisaskey@googlemail.com";
const FROM = "Sales Progressor <updates@thesalesprogressor.co.uk>";

async function main() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    console.error("SENDGRID_API_KEY is not set in env.");
    process.exit(1);
  }
  sgMail.setApiKey(apiKey);

  // Sample data mirrors a plausible real claim signup. To test the
  // address-empty fallback, swap `address` to "".
  const built = buildClaimWelcome({
    firstName: "Ellis",
    address: "14 Birchwood Avenue, Knutsford, WA16 8JL",
    ctaUrl: "https://portal.thesalesprogressor.co.uk/agent/transactions/sample-test-tx-id",
  });

  console.log("Subject:", built.subject);
  console.log("From:   ", FROM);
  console.log("To:     ", RECIPIENT);
  console.log("Sending...");

  await sgMail.send({
    to: RECIPIENT,
    from: FROM,
    subject: built.subject,
    text: built.text,
    html: built.html,
  });

  console.log("✓ Sent.");
}

main().catch((err) => {
  console.error("Send failed:", err);
  if (err.response?.body) console.error(JSON.stringify(err.response.body, null, 2));
  process.exit(1);
});

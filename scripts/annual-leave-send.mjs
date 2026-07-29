// scripts/annual-leave-send.mjs
// Annual-leave notice to every buyer/seller on an ACTIVE OUTSOURCED file.
//
// Modes:
//   (default)  preview — writes docs/annual-leave-emails-final.md, sends nothing
//   --test     sends representative samples to ellisaskey@googlemail.com
//   --send     sends the full batch to real recipients (guarded)
//
// Run:
//   npx dotenv -e .env.production -- node scripts/annual-leave-send.mjs
//   npx dotenv -e .env.production -- node scripts/annual-leave-send.mjs --test
//   npx dotenv -e .env.production -- node scripts/annual-leave-send.mjs --send
//
// Deletion criteria: one-shot; delete once the 2026 annual-leave send is done.
// Tracked in docs/SCRIPTS_REGISTRY.md.

import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import sgMail from "@sendgrid/mail";

const MODE = process.argv.includes("--send")
  ? "send"
  : process.argv.includes("--test")
    ? "test"
    : "preview";

const TEST_TO = "ellisaskey@googlemail.com";
const SENDER_EMAIL = "updates@thesalesprogressor.co.uk";
const SUBJECT = "Annual Leave – 30 July to 10 August";
// Production portal base. NOT process.env.NEXTAUTH_URL — that's localhost in
// .env.production; the real value lives in Vercel. Confirmed against code
// (14 refs) + CLAUDE.md. /progress is the milestone-confirmation page the
// app's own milestone emails link to.
const PORTAL_BASE = "https://portal.thesalesprogressor.co.uk";
const portalUrlFor = (token) => (token ? `${PORTAL_BASE}/portal/${token}/progress` : null);

// From display name per agency: "Ellis @ <agency>", except EXP which is
// plain "Ellis Askey" (its reply-to is the Sales Progressor address and the
// body signs off as Danny Bailey EXP). Confirmed by Ellis 2026-07-28.
const DISPLAY_NAME_BY_AGENCY = {
  "Akeman Residential": "Ellis @ Akeman Residential",
  "Meldone Estates": "Ellis @ Meldone Estates",
  "Via Properties": "Ellis @ Via Properties",
  "Oplah Ltd": "Ellis @ Oplah",
  "EXP - DB": "Ellis Askey",
};
function fromFor(agency) {
  const name = DISPLAY_NAME_BY_AGENCY[agency];
  if (!name) throw new Error(`No display name configured for agency "${agency}" — refusing to send.`);
  return `${name} <${SENDER_EMAIL}>`;
}

// Reply-To is per-agency (Ellis's white-label mailbox at each agency).
// All five confirmed by Ellis 2026-07-28. A missing entry throws rather
// than silently sending with the wrong reply-to.
const REPLY_TO_BY_AGENCY = {
  "Akeman Residential": "ellis@akeman-residential.co.uk",
  "Meldone Estates": "ellis@meldoneestates.co.uk",
  "Oplah Ltd": "salesprogression@oplah.co.uk",
  "Via Properties": "ellis@viavia.co.uk",
  "EXP - DB": "ellis@thesalesprogressor.co.uk",
};
function replyToFor(agency) {
  const rt = REPLY_TO_BY_AGENCY[agency];
  if (!rt) throw new Error(`No reply-to configured for agency "${agency}" — refusing to send.`);
  return rt;
}

// Body sign-off block per agency, so a Via file isn't signed "Akeman
// Residential". Standard agencies: role line "Sales Progression" + brand.
// EXP is bespoke: signs off "Ellis Askey" / "Danny Bailey EXP". Confirmed
// by Ellis 2026-07-28. Missing entry throws rather than sending wrong brand.
const SIGNOFF_BY_AGENCY = {
  "Akeman Residential": "Kind regards,\nEllis Askey\nSales Progression\nAkeman Residential",
  "Meldone Estates": "Kind regards,\nEllis Askey\nSales Progression\nMeldone Estates",
  "Via Properties": "Kind regards,\nEllis Askey\nSales Progression\nVia Properties",
  "Oplah Ltd": "Kind regards,\nEllis Askey\nSales Progression\nOplah",
  "EXP - DB": "Kind regards,\nEllis Askey\nDanny Bailey EXP",
};
function signOffFor(agency) {
  const s = SIGNOFF_BY_AGENCY[agency];
  if (!s) throw new Error(`No sign-off configured for agency "${agency}" — refusing to send.`);
  return s;
}

// Belt-and-suspenders on top of the completion-milestone exclusion in the
// SQL below (both files are milestone-completed anyway). Confirmed completed
// by Ellis 2026-07-28.
const EXCLUDE_ADDRESS_PREFIXES = ["18 Station Road", "22 Williamson Way"];

// ── Greeting logic (approved 2026-07-28) ───────────────────────────────────
const TITLE_RE = /^(mr|mrs|ms|miss|mx|dr|prof|sir|dame|lord|lady|rev|mr\s*(&|and)\s*mrs|mr\s*(&|and)\s*mr|mrs\s*(&|and)\s*mrs)\.?\s+/i;
const COMPANY_RE = /\b(ltd|limited|llp|plc|solicitors|properties|estates?|group|homes|lettings)\b/i;

function greetingFor(rawName) {
  const name = (rawName || "").trim();
  if (!name) return "there";
  if (COMPANY_RE.test(name)) return "there"; // e.g. "Bamsy Estates Ltd"
  const hadTitle = TITLE_RE.test(name);
  const stripped = name.replace(TITLE_RE, "").trim();
  const tokens = stripped.split(/\s+/).filter(Boolean);
  // Title + surname only (no first name on record): keep the title — "Mr Cook".
  if (hadTitle && tokens.length <= 1) return name.replace(/\.$/, "");
  return tokens[0] || name;
}

// ── Body ───────────────────────────────────────────────────────────────────
function bodyText(greeting, saleOrPurchase, signOff, portalUrl) {
  const cta = portalUrl
    ? `\n\nYou can view and confirm your milestones at any time here:\n${portalUrl}`
    : "";
  return `Hi ${greeting},

I hope you are well.

Just a quick note to let you know that I'll be on annual leave from Thursday 30 July, returning to my desk on Monday 10 August.

If there's anything you'd like me to deal with before I go, please let me know today so I have time to look into it before I finish for my holiday.

Whilst I'm away, if anything arises in relation to your transaction, please liaise directly with your solicitor. They'll be able to deal with any legal matters and continue progressing your ${saleOrPurchase} during my absence.

If your enquiry is non-urgent and specifically requires my attention, please send me an email and I'll respond as soon as possible after I return.

If you're using the portal, please continue to confirm milestones as they happen. This keeps everyone involved in the transaction updated automatically and helps maintain momentum while I'm away.

Thank you for your understanding, and I look forward to catching up with you when I'm back.

${signOff}${cta}`;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function bodyHtml(greeting, saleOrPurchase, signOff, portalUrl) {
  // Render the letter (through the sign-off) as paragraphs; the CTA button is
  // appended separately so it renders as a real button, not a text line.
  const paras = bodyText(greeting, saleOrPurchase, signOff, null).split("\n\n");
  const letter = paras
    .map((p, i) =>
      i === paras.length - 1
        ? `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`
        : `<p style="margin:0 0 16px">${esc(p)}</p>`
    )
    .join("\n");
  const button = portalUrl
    ? `\n<p style="margin:8px 0 0"><a href="${esc(portalUrl)}" style="display:inline-block;background:#FF6B4A;color:#fff;padding:10px 22px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Confirm your milestones →</a></p>`
    : "";
  return letter + button;
}

// ── Pull recipients ────────────────────────────────────────────────────────
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const rows = (await c.query(`
  SELECT pt."propertyAddress" AS address, ct.name AS raw_name,
         ct."roleType"::text AS role, ct.email AS email, a.name AS agency,
         ct."portalToken" AS portal_token
    FROM "Contact" ct
    JOIN "PropertyTransaction" pt ON pt.id = ct."propertyTransactionId"
    JOIN "Agency" a ON a.id = pt."agencyId"
   WHERE pt.status = 'active' AND pt."serviceType" = 'outsourced' AND a."isInternal" = false
     AND ct."roleType" IN ('vendor','purchaser')
     AND ct.email IS NOT NULL AND ct."unsubscribedAt" IS NULL
     -- Exclude files that have already COMPLETED (completion milestone done).
     -- Their status is stale ('active') but the sale/purchase is finished, so
     -- "continue progressing your sale" would be wrong. Exchanged-but-not-yet-
     -- completed files (e.g. completing during the leave) are kept.
     AND NOT EXISTS (
       SELECT 1 FROM "MilestoneCompletion" mc
       JOIN "MilestoneDefinition" md ON md.id = mc."milestoneDefinitionId"
       WHERE mc."transactionId" = pt.id
         AND md.code IN ('VM20','PM27') AND mc.state = 'complete'
     )
   ORDER BY pt."propertyAddress", ct."roleType"
`)).rows;
await c.end();

// Exclude completed files.
const afterFiles = rows.filter(
  (r) => !EXCLUDE_ADDRESS_PREFIXES.some((p) => r.address.toLowerCase().startsWith(p.toLowerCase()))
);

// Drop anything that isn't a real email address. Caught a contact with a
// phone number in the email field (Emma O'Connell, 20 Williamson Way) —
// would fail at SendGrid. Reported so the DB can be fixed separately.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invalidEmail = afterFiles.filter((r) => !EMAIL_RE.test(r.email.trim()));
const kept = afterFiles.filter((r) => EMAIL_RE.test(r.email.trim()));
if (invalidEmail.length) {
  console.log(`Skipping ${invalidEmail.length} contact(s) with an invalid email:`);
  for (const r of invalidEmail) console.log(`  ${r.address} | ${r.role} | "${r.raw_name}" | "${r.email}"`);
}

// Group by email so shared inboxes (e.g. a couple) get ONE email.
const byEmail = new Map();
for (const r of kept) {
  const key = r.email.trim().toLowerCase();
  const g = byEmail.get(key) ?? { email: r.email.trim(), contacts: [] };
  g.contacts.push(r);
  byEmail.set(key, g);
}

const emails = [];
for (const g of byEmail.values()) {
  const greetings = [...new Set(g.contacts.map((x) => greetingFor(x.raw_name)))];
  const greeting = greetings.length <= 2 ? greetings.join(" and ") : greetings.slice(0, -1).join(", ") + " and " + greetings.slice(-1);
  const roles = new Set(g.contacts.map((x) => x.role));
  const saleOrPurchase = roles.size > 1 ? "sale or purchase" : roles.has("vendor") ? "sale" : "purchase";
  const agency = g.contacts[0].agency;
  const signOff = signOffFor(agency);
  // Primary contact's portal link (first with a token). Shared inboxes see
  // the same transaction either way. Null when no contact has a token.
  const token = g.contacts.map((x) => x.portal_token).find(Boolean) ?? null;
  const portalUrl = portalUrlFor(token);
  emails.push({
    to: g.email,
    greeting,
    saleOrPurchase,
    agency,
    from: fromFor(agency),
    replyTo: replyToFor(agency),
    portalUrl,
    address: g.contacts[0].address.split(",")[0].trim(),
    text: bodyText(greeting, saleOrPurchase, signOff, portalUrl),
    html: bodyHtml(greeting, saleOrPurchase, signOff, portalUrl),
  });
}
emails.sort((a, b) => a.address.localeCompare(b.address));

// ── Preview doc ────────────────────────────────────────────────────────────
if (MODE === "preview") {
  const out = [`# Annual-leave emails — FINAL (${new Date().toISOString().slice(0, 10)})`, ""];
  out.push(`Subject: **${SUBJECT}** · From: per agency (${SENDER_EMAIL}) · Reply-To: per agency (below)`, "");
  out.push(`**${emails.length} emails.** Shared inboxes collapsed to one. 18 Station Road + 22 Williamson Way excluded (completed).`, "", "---", "");
  for (const e of emails) {
    out.push(`### ${e.address} — ${e.to} (${e.saleOrPurchase})`, "", `_From: ${e.from} · Reply-To: ${e.replyTo}_`, "", "```", e.text, "```", "");
  }
  const p = path.join(process.cwd(), "docs", "annual-leave-emails-final.md");
  fs.writeFileSync(p, out.join("\n"), "utf8");
  const withLink = emails.filter((e) => e.portalUrl).length;
  console.log(`PREVIEW: ${emails.length} emails (${withLink} with a portal CTA, ${emails.length - withLink} without a token). Wrote ${p}. Nothing sent.`);
  process.exit(0);
}

// ── Send ───────────────────────────────────────────────────────────────────
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendOne(e) {
  await sgMail.send({ to: e.to, from: e.from, replyTo: e.replyTo, subject: SUBJECT, text: e.text, html: e.html });
}

if (MODE === "test") {
  // Representative samples: a vendor ("sale"), a purchaser ("purchase"),
  // a title-kept name, the company fallback, and the collapsed couple.
  const pick = (fn) => emails.find(fn);
  // One per agency (covers every From display name + sign-off) plus the
  // greeting edge cases (title kept, company fallback, couple).
  const samples = [
    pick((e) => e.agency === "Akeman Residential" && /^(Mr|Mrs|Ms|Miss) /.test(e.greeting)) || pick((e) => e.agency === "Akeman Residential"),
    pick((e) => e.agency === "Meldone Estates"),
    pick((e) => e.agency === "Via Properties"),
    pick((e) => e.agency === "Oplah Ltd" && e.greeting.includes(" and ")),
    pick((e) => e.agency === "Oplah Ltd" && e.greeting === "there"),
    pick((e) => e.agency === "EXP - DB"),
  ].filter(Boolean);
  const seen = new Set();
  let n = 0;
  for (const s of samples) {
    if (seen.has(s.to + s.greeting)) continue;
    seen.add(s.to + s.greeting);
    const subj = `[TEST ${++n}] ${SUBJECT} (Hi ${s.greeting}, ${s.saleOrPurchase}, ${s.agency})`;
    await sgMail.send({ to: TEST_TO, from: s.from, replyTo: s.replyTo, subject: subj, text: s.text, html: s.html });
    console.log(`Sent test ${n} to ${TEST_TO}: from="${s.from}" reply-to=${s.replyTo} — Hi ${s.greeting} (${s.saleOrPurchase})`);
  }
  console.log(`\nDone. ${n} test emails sent to ${TEST_TO}. Real recipients untouched.`);
  process.exit(0);
}

if (MODE === "send") {
  console.log(`SENDING ${emails.length} real emails from ${SENDER_EMAIL} (per-agency display names)...`);
  let ok = 0, fail = 0;
  for (const e of emails) {
    try {
      await sendOne(e);
      ok++;
      console.log(`  ✓ ${e.to} — Hi ${e.greeting} (${e.saleOrPurchase}) reply-to=${e.replyTo}`);
    } catch (err) {
      fail++;
      console.error(`  ✗ ${e.to}: ${err?.response?.body ? JSON.stringify(err.response.body) : err.message}`);
    }
    await new Promise((r) => setTimeout(r, 250)); // gentle pacing
  }
  console.log(`\nDone. Sent ${ok}, failed ${fail}, of ${emails.length}.`);
  process.exit(fail > 0 ? 1 : 0);
}

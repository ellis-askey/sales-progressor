// scripts/annual-leave-name-check.mjs
// One-shot: builds the recipient list for the annual-leave notice (every
// vendor/purchaser contact on an active outsourced file that has an email and
// is not unsubscribed) and prints a NAME-APPROVAL table — raw stored name →
// proposed "Hi ___" greeting → a flag on anything that looks wrong (title +
// surname only, company name, joint parties, missing name, comma format).
//
// READ-ONLY. Sends nothing. Produces docs/annual-leave-name-check-2026.md.
//
// Run: npx dotenv -e .env.production -- node scripts/annual-leave-name-check.mjs
//
// Deletion criteria: delete once the annual-leave send is completed and the
// name-approval step is signed off (one-shot, tracked in SCRIPTS_REGISTRY).

import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const rows = (await c.query(`
  SELECT pt."propertyAddress" AS address,
         ct.name AS raw_name,
         ct."roleType"::text AS role,
         ct.email AS email,
         ct."unsubscribedAt" AS unsubscribed_at,
         a.name AS agency
    FROM "Contact" ct
    JOIN "PropertyTransaction" pt ON pt.id = ct."propertyTransactionId"
    JOIN "Agency" a ON a.id = pt."agencyId"
   WHERE pt.status = 'active'
     AND pt."serviceType" = 'outsourced'
     AND a."isInternal" = false
     AND ct."roleType" IN ('vendor','purchaser')
   ORDER BY pt."propertyAddress", ct."roleType", ct.name
`)).rows;

await c.end();

// ── Greeting analysis ──────────────────────────────────────────────────────
const TITLE_RE = /^(mr|mrs|ms|miss|mx|dr|prof|sir|dame|lord|lady|rev|mr\s*(&|and)\s*mrs|mr\s*(&|and)\s*mr|mrs\s*(&|and)\s*mrs)\.?\s+/i;

function analyse(rawName) {
  const name = (rawName || "").trim();
  if (!name) return { greeting: "there", flag: "NO NAME — would greet 'Hi there'" };

  const hadTitle = TITLE_RE.test(name);
  const stripped = name.replace(TITLE_RE, "").trim();
  const tokens = stripped.split(/\s+/).filter(Boolean);
  const greeting = tokens[0] || name;

  const flags = [];
  if (hadTitle && tokens.length <= 1)
    flags.push(`TITLE + SURNAME — "Hi ${greeting}" is a surname, not a first name`);
  if (/\b(ltd|limited|llp|plc|solicitors|properties|estates?|group|homes|lettings)\b/i.test(name))
    flags.push("looks like a COMPANY/FIRM name");
  if (name.includes(","))
    flags.push("comma in name — check ordering (Surname, First?)");
  if (/\s+(&|and)\s+/i.test(stripped))
    flags.push("JOINT parties — greeting uses first person only");
  if (greeting.length <= 2)
    flags.push("very short greeting — check");
  if (greeting === greeting.toLowerCase() && greeting !== "there")
    flags.push("all-lowercase — check capitalisation");

  return { greeting, flag: flags.join("; ") };
}

const shortAddr = (a) => a.split(",")[0].trim();

// ── Build rows ─────────────────────────────────────────────────────────────
const sendable = [];
const skipped = [];
for (const r of rows) {
  const { greeting, flag } = analyse(r.raw_name);
  const side = r.role === "vendor" ? "Seller" : "Buyer";
  const rec = {
    address: shortAddr(r.address),
    side,
    rawName: r.raw_name || "(blank)",
    greeting,
    email: r.email || "",
    flag,
    unsubscribed: !!r.unsubscribed_at,
  };
  if (!r.email) skipped.push({ ...rec, reason: "no email on file" });
  else if (r.unsubscribed_at) skipped.push({ ...rec, reason: "UNSUBSCRIBED" });
  else sendable.push(rec);
}

// ── Emit markdown ──────────────────────────────────────────────────────────
const out = [];
out.push(`# Annual-leave notice — name approval (${new Date().toISOString().slice(0, 10)})`);
out.push("");
out.push(`Scope: every vendor/purchaser contact on an **active outsourced** file with an email on record and not unsubscribed.`);
out.push("");
out.push(`**${sendable.length} emails would send.** ${skipped.length} contacts skipped (no email or unsubscribed) — listed at the bottom.`);
out.push("");
out.push(`Review the **Hi ___** column. ⚠ marks anything that looks wrong. Approve, or send corrections.`);
out.push("");
out.push(`| # | Property | Side | Stored name | Hi ___ | Email | Flag |`);
out.push(`|---|---|---|---|---|---|---|`);
sendable.forEach((r, i) => {
  const f = r.flag ? `⚠ ${r.flag}` : "";
  out.push(`| ${i + 1} | ${r.address} | ${r.side} | ${r.rawName} | **${r.greeting}** | ${r.email} | ${f} |`);
});
out.push("");
out.push(`## Skipped (not emailed) — ${skipped.length}`);
out.push("");
out.push(`| Property | Side | Stored name | Email | Reason |`);
out.push(`|---|---|---|---|---|`);
skipped.forEach((r) => {
  out.push(`| ${r.address} | ${r.side} | ${r.rawName} | ${r.email || "-"} | ${r.reason} |`);
});
out.push("");

const flaggedCount = sendable.filter((r) => r.flag).length;
out.push(`## Summary`);
out.push("");
out.push(`- Sendable emails: **${sendable.length}**`);
out.push(`- Flagged for review: **${flaggedCount}**`);
out.push(`- Skipped (no email): **${skipped.filter((r) => r.reason === "no email on file").length}**`);
out.push(`- Skipped (unsubscribed): **${skipped.filter((r) => r.reason === "UNSUBSCRIBED").length}**`);

const outPath = path.join(process.cwd(), "docs", "annual-leave-name-check-2026.md");
fs.writeFileSync(outPath, out.join("\n"), "utf8");

// ── Mark duplicate emails (someone party to two files) ─────────────────────
const emailCounts = new Map();
for (const r of sendable) {
  const k = r.email.toLowerCase();
  emailCounts.set(k, (emailCounts.get(k) ?? 0) + 1);
}
for (const r of sendable) r.dup = emailCounts.get(r.email.toLowerCase()) > 1;

// ── Recommended greeting for flagged rows ──────────────────────────────────
function recommend(r) {
  if (r.flag.startsWith("TITLE + SURNAME")) {
    // Keep the title: "Hi Mr Cook" is correct where we only hold title+surname.
    return `Hi ${r.rawName.replace(/\.$/, "")}`;
  }
  if (r.flag.startsWith("NO NAME")) return "Hi there";
  if (r.flag.includes("COMPANY")) return "Hi there  (or a named contact if known)";
  return null;
}

// ── HTML artifact ──────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const flaggedRows = sendable.filter((r) => r.flag);
const dupGroups = [...new Set(sendable.filter((r) => r.dup).map((r) => r.email.toLowerCase()))]
  .map((e) => sendable.filter((r) => r.email.toLowerCase() === e));

const tableRows = sendable.map((r, i) => {
  const cls = r.flag ? "flag" : r.dup ? "dup" : "";
  const note = r.flag ? `⚠ ${esc(r.flag)}` : r.dup ? "↔ also emailed on another file" : "";
  return `<tr class="${cls}"><td class="num">${i + 1}</td><td>${esc(r.address)}</td><td>${esc(r.side)}</td><td class="stored">${esc(r.rawName)}</td><td class="greet">${esc(r.greeting)}</td><td class="email">${esc(r.email)}</td><td class="note">${note}</td></tr>`;
}).join("\n");

const decisionCards = [
  ...flaggedRows.map((r) => {
    const rec = recommend(r);
    return `<div class="card flag-card"><div class="card-h"><span class="chip chip-flag">Name</span><span class="card-loc">${esc(r.address)} · ${esc(r.side)}</span></div>
      <div class="card-body"><div><span class="lbl">Stored</span><span class="val">${esc(r.rawName)}</span></div>
      <div><span class="lbl">Would say</span><span class="val bad">Hi ${esc(r.greeting)}</span></div>
      ${rec ? `<div><span class="lbl">Suggest</span><span class="val good">${esc(rec)}</span></div>` : ""}</div>
      <p class="card-why">${esc(r.flag)}</p></div>`;
  }),
  ...dupGroups.map((g) => {
    const p = g[0];
    const names = g.map((x) => `${esc(x.greeting)} (${esc(x.address)} · ${esc(x.side)})`).join(", ");
    const sameProp = g.every((x) => x.address === g[0].address);
    const why = sameProp
      ? "Two people share this inbox on the same file — sending both means two greetings to one mailbox."
      : "Same person is party to two files — they'd receive two copies of the same notice.";
    return `<div class="card dup-card"><div class="card-h"><span class="chip chip-dup">Duplicate inbox</span><span class="card-loc">${esc(p.email)}</span></div>
      <div class="card-body"><div><span class="lbl">Goes to</span><span class="val">${names}</span></div></div>
      <p class="card-why">${why}</p></div>`;
  }),
].join("\n");

const html = `<title>Annual-leave notice — name approval</title>
<style>
  :root{
    --ground:#FAF8F5; --surface:#FFFFFF; --surface-2:#F3F0EB; --line:#E4DED5;
    --ink:#1C1815; --muted:#6E665D; --faint:#9A9186;
    --accent:#D8542F; --flag:#B7791F; --flag-bg:#FBF3E2; --dup:#2F6FB0; --dup-bg:#EAF1F8; --good:#2E7D57;
    --shadow:0 1px 2px rgba(28,24,21,.05),0 8px 24px rgba(28,24,21,.06);
  }
  @media (prefers-color-scheme:dark){
    :root{ --ground:#15120F; --surface:#1E1A16; --surface-2:#262019; --line:#332C24;
      --ink:#F1ECE4; --muted:#A79D90; --faint:#786E62;
      --accent:#FF7A54; --flag:#E0A94A; --flag-bg:#2A2214; --dup:#7FB0DE; --dup-bg:#15212C; --good:#63C295;
      --shadow:0 1px 2px rgba(0,0,0,.3),0 8px 28px rgba(0,0,0,.35); }
  }
  :root[data-theme="light"]{ --ground:#FAF8F5; --surface:#FFFFFF; --surface-2:#F3F0EB; --line:#E4DED5; --ink:#1C1815; --muted:#6E665D; --faint:#9A9186; --accent:#D8542F; --flag:#B7791F; --flag-bg:#FBF3E2; --dup:#2F6FB0; --dup-bg:#EAF1F8; --good:#2E7D57; }
  :root[data-theme="dark"]{ --ground:#15120F; --surface:#1E1A16; --surface-2:#262019; --line:#332C24; --ink:#F1ECE4; --muted:#A79D90; --faint:#786E62; --accent:#FF7A54; --flag:#E0A94A; --flag-bg:#2A2214; --dup:#7FB0DE; --dup-bg:#15212C; --good:#63C295; }

  *{box-sizing:border-box}
  body{margin:0;background:var(--ground);color:var(--ink);
    font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5;-webkit-font-smoothing:antialiased;}
  .wrap{max-width:1080px;margin:0 auto;padding:48px 28px 96px;}
  .eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:600;}
  h1{font-family:Georgia,"Times New Roman",serif;font-weight:600;font-size:34px;line-height:1.1;margin:.3em 0 .15em;letter-spacing:-.01em;text-wrap:balance;}
  .lede{color:var(--muted);font-size:15px;max-width:60ch;margin:0;}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:32px 0;}
  @media(max-width:640px){.stats{grid-template-columns:repeat(2,1fr)}}
  .stat{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px;box-shadow:var(--shadow);}
  .stat .n{font-size:30px;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
  .stat.flag .n{color:var(--flag)} .stat.dup .n{color:var(--dup)}
  .stat .k{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:2px;}
  h2{font-family:Georgia,serif;font-weight:600;font-size:21px;margin:40px 0 4px;}
  .sub{color:var(--muted);font-size:14px;margin:0 0 18px;}
  .cards{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;}
  @media(max-width:720px){.cards{grid-template-columns:1fr}}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px;box-shadow:var(--shadow);}
  .flag-card{border-left:3px solid var(--flag)} .dup-card{border-left:3px solid var(--dup)}
  .card-h{display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;}
  .chip{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:3px 8px;border-radius:999px;}
  .chip-flag{background:var(--flag-bg);color:var(--flag)} .chip-dup{background:var(--dup-bg);color:var(--dup)}
  .card-loc{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;}
  .card-body{display:flex;flex-direction:column;gap:6px;}
  .card-body>div{display:flex;gap:10px;align-items:baseline;}
  .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);width:66px;flex-shrink:0;}
  .val{font-size:15px;font-weight:500;} .val.bad{color:var(--flag)} .val.good{color:var(--good)}
  .card-why{font-size:13px;color:var(--muted);margin:12px 0 0;padding-top:12px;border-top:1px solid var(--line);}
  .tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);margin-top:18px;}
  table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:760px;}
  thead th{position:sticky;top:0;background:var(--surface-2);color:var(--muted);text-align:left;
    font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;padding:11px 14px;border-bottom:1px solid var(--line);}
  tbody td{padding:10px 14px;border-bottom:1px solid var(--line);background:var(--surface);}
  tbody tr:last-child td{border-bottom:none}
  .num{color:var(--faint);font-variant-numeric:tabular-nums;width:34px;}
  .stored{color:var(--muted)} .greet{font-weight:600;} .email{color:var(--muted);font-size:12.5px;}
  .note{font-size:12px;color:var(--muted);}
  tr.flag td{background:var(--flag-bg)} tr.flag .greet{color:var(--flag)} tr.flag .note{color:var(--flag);font-weight:500;}
  tr.dup td{background:var(--dup-bg)} tr.dup .note{color:var(--dup);}
  .skip h2{margin-top:48px}
  footer{margin-top:40px;color:var(--faint);font-size:12.5px;}
</style>
<div class="wrap">
  <span class="eyebrow">Sales Progression · Akeman Residential</span>
  <h1>Annual-leave notice — name check</h1>
  <p class="lede">Every buyer and seller on an active outsourced file, with the greeting each would receive. Review the <strong>Hi&nbsp;___</strong> column, then approve or correct. Nothing sends until you do.</p>

  <div class="stats">
    <div class="stat"><div class="n">${sendable.length}</div><div class="k">Emails to send</div></div>
    <div class="stat flag"><div class="n">${flaggedRows.length}</div><div class="k">Names flagged</div></div>
    <div class="stat dup"><div class="n">${dupGroups.length}</div><div class="k">Duplicate inboxes</div></div>
    <div class="stat"><div class="n">${skipped.length}</div><div class="k">Skipped</div></div>
  </div>

  <h2>Decisions needed</h2>
  <p class="sub">These ${flaggedRows.length + dupGroups.length} are the only ones that need a call. The other ${sendable.length - flaggedRows.length - dupGroups.reduce((a, g) => a + g.length, 0)} are ordinary first names.</p>
  <div class="cards">${decisionCards}</div>

  <h2>All recipients</h2>
  <p class="sub">${sendable.length} emails. Amber rows are flagged names; blue rows go to an inbox that appears more than once.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>Property</th><th>Side</th><th>Stored name</th><th>Hi ___</th><th>Email</th><th>Note</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>

  <div class="skip"><h2>Skipped — not emailed</h2>
  <p class="sub">${skipped.length} contacts: no email on record, or unsubscribed.</p>
  <div class="tablewrap"><table>
    <thead><tr><th>Property</th><th>Side</th><th>Stored name</th><th>Email</th><th>Reason</th></tr></thead>
    <tbody>${skipped.map((r) => `<tr><td>${esc(r.address)}</td><td>${esc(r.side)}</td><td>${esc(r.rawName)}</td><td class="email">${esc(r.email || "—")}</td><td class="note">${esc(r.reason)}</td></tr>`).join("\n")}</tbody>
  </table></div></div>

  <footer>Generated ${new Date().toISOString().slice(0, 10)} from live data · read-only · no emails sent</footer>
</div>`;

const htmlPath = path.join(process.cwd(), "docs", "annual-leave-name-check-2026.html");
fs.writeFileSync(htmlPath, html, "utf8");
console.log(`Wrote ${htmlPath}`);

// ── Console summary ────────────────────────────────────────────────────────
console.log(`Sendable: ${sendable.length} | Flagged: ${flaggedCount} | Skipped: ${skipped.length}`);
console.log(`Wrote ${outPath}`);
console.log("\n--- FLAGGED ROWS ---");
for (const r of sendable.filter((x) => x.flag)) {
  console.log(`  ${r.address} [${r.side}] stored="${r.rawName}" -> "Hi ${r.greeting}"  ⚠ ${r.flag}`);
}

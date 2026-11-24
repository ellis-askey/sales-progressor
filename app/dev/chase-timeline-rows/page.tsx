"use client";

// /dev/chase-timeline-rows — PREVIEW of the proposed Chase Timeline row, built in
// OUR design system (agent tokens, real Pill + Avatars, the joining rail, ring
// icons, light/dark via the agent shell). The supplied HTML mock was a guide for
// COPY + layout only; the look is ours. Each of the 45 states is shown once, plus
// a continuous sample timeline. A toggle swaps seeded example text for {variable}
// tokens. Not wired to data; blocks in production.

import { useState, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { ContactAvatar, UserAvatar } from "@/components/ui/Avatar";
import { useDarkMode } from "@/lib/agent/use-theme";

type Mode = "example" | "vars";

const VARS: Record<string, { ex: string; label: string }> = {
  buyer: { ex: "Bob Smith", label: "buyer full name" },
  seller: { ex: "Jane Doe", label: "seller full name" },
  sol: { ex: "Aastha Paul", label: "solicitor contact name" },
  senderFull: { ex: "Ellis Askey", label: "sender full name" },
  subject: { ex: "Your purchase of 19 Bodge Piece, quick update?", label: "email subject" },
  grace: { ex: "2", label: "grace period (working days)" },
  teamChases: { ex: "2", label: "number of team chases" },
  outstanding: { ex: "Title deeds, FENSA certificate", label: "outstanding items" },
  noteText: { ex: "Still waiting for the FENSA certificate.", label: "note text" },
  completion: { ex: "5 Dec", label: "completion date" },
  exchangeTarget: { ex: "6 Nov", label: "target exchange date" },
  movedDate: { ex: "18 Nov", label: "new chase date" },
  confirmRole: { ex: "Buyer", label: "buyer or seller" },
  confirmWhat: { ex: "receipt of the welcome pack", label: "what was confirmed" },
  milestoneName: { ex: "Draft contract pack", label: "milestone name" },
  authRole: { ex: "Seller", label: "buyer or seller" },
  authName: { ex: "Jane Doe", label: "client full name" },
  dt: { ex: "", label: "date & time" },
  due: { ex: "", label: "date" },
};

type Tok = { v: string; ex?: string };
type Part = string | Tok;

function Render({ parts, mode }: { parts: Part[]; mode: Mode }) {
  return (
    <>
      {parts.map((p, i) => {
        if (typeof p === "string") return <span key={i}>{p}</span>;
        const vr = VARS[p.v];
        if (mode === "vars") return <span key={i} className="ctl-var">{`{${vr.label}}`}</span>;
        return <span key={i}>{p.ex ?? vr.ex}</span>;
      })}
    </>
  );
}

const ICONS: Record<string, ReactNode> = {
  auto: <path d="m3 10 18-7-7 18-3-8-8-3zm8 3L21 3" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  team: <path d="M5 5v5a4 4 0 0 0 4 4h10m-5-5 5 5-5 5" />,
  danger: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5m0 3h.01" /></>,
  success: <path d="m6 12 4 4 8-8" />,
  milestone: <path d="m6 12 4 4 8-8" />,
  movement: <path d="M4 8h15m-4-4 4 4-4 4m5 4H5m4-4-4 4 4 4" />,
  calendar: <><rect x="4" y="6" width="16" height="14" rx="3" /><path d="M8 4v4m8-4v4M4 10h16" /></>,
  hold: <path d="M9 7v10m6-10v10" />,
};

// The person attributed to an event — avatar (photo or colour-coded SVG fallback)
// + full name + role/title beneath. `system` = Autopilot (no person).
type Actor =
  | { av: "system" }
  | { av: "agent" | "vendor" | "purchaser" | "solicitor"; nameKey: string; role: string };

function ActorBlock({ a, mode }: { a: Actor; mode: Mode }) {
  if (a.av === "system") {
    return (
      <div className="ctl-actor">
        <span className="ctl-sysav" aria-hidden><svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" /></svg></span>
        <div className="ctl-who"><span className="ctl-who-name">Autopilot</span></div>
      </div>
    );
  }
  const nm = VARS[a.nameKey].ex;
  return (
    <div className="ctl-actor">
      {a.av === "agent"
        ? <UserAvatar user={{ name: nm }} size={30} />
        : <ContactAvatar contact={{ name: nm, roleType: a.av }} size={30} art />}
      <div className="ctl-who">
        <span className="ctl-who-name"><Render parts={[{ v: a.nameKey }]} mode={mode} /></span>
        <span className="ctl-who-role">{a.role}</span>
      </div>
    </div>
  );
}

type State = {
  fixture: string;
  cat: keyof typeof ICONS;
  upcoming?: boolean;
  pill?: "Automatic" | "For your team" | "On hold";
  headline: Part[];
  subject?: Part[];
  body?: Part[];
  note?: { label: string; text: Part[] };
  actor?: Actor;
  status?: "sent" | "delivered" | "opened";
  view?: boolean;
  date?: Part[];
};

const pillTone = (label: string) => (label === "Automatic" ? "info" : label === "For your team" ? "warning" : "muted");

function Row({ s, mode, last }: { s: State; mode: Mode; last?: boolean }) {
  return (
    <div className={`ctl-row ${s.cat}${s.upcoming ? " up" : ""}`}>
      <div className="ctl-lead">
        <span className={`ctl-ic${s.upcoming ? " dashed" : ""}`}><svg viewBox="0 0 24 24" aria-hidden="true">{ICONS[s.cat]}</svg></span>
        {!last && <span className="ctl-rail" />}
      </div>
      <div className="ctl-body">
        <div className="ctl-head">
          <h3><Render parts={s.headline} mode={mode} /></h3>
          {s.pill && <Pill glass dot size="sm" tone={pillTone(s.pill)}>{s.pill}</Pill>}
        </div>
        {s.subject && <p className="ctl-sub"><Render parts={s.subject} mode={mode} /></p>}
        {s.body && <p className="ctl-p"><Render parts={s.body} mode={mode} /></p>}
        {s.note && <p className="ctl-note"><strong>{s.note.label}</strong><Render parts={s.note.text} mode={mode} /></p>}
        {s.actor && <ActorBlock a={s.actor} mode={mode} />}
      </div>
      {(s.date || s.status || s.view) && (
        <div className="ctl-right">
          {s.date && <span className="ctl-date"><Render parts={s.date} mode={mode} /></span>}
          {s.status && <span className={`ctl-status ${s.status}`}>{s.status[0].toUpperCase() + s.status.slice(1)}</span>}
          {s.view && <span className="ctl-view">View email <span aria-hidden="true">{"→"}</span></span>}
        </div>
      )}
    </div>
  );
}

const SYS: Actor = { av: "system" };
const AGENT: Actor = { av: "agent", nameKey: "senderFull", role: "Sales progressor" };

const SAMPLE: State[] = [
  { fixture: "", cat: "team", upcoming: true, pill: "For your team", headline: ["Follow up with ", { v: "buyer" }], body: ["Buyer · In your work queue"] },
  { fixture: "", cat: "team", headline: ["Chase handed to your team"], body: [{ v: "buyer" }, " · Automatic chase limit reached after 2 emails."], actor: SYS, date: [{ v: "dt", ex: "7 Nov 2026, 09:00" }] },
  { fixture: "", cat: "email", headline: ["Chase emailed to ", { v: "buyer" }], subject: [{ v: "subject" }], actor: AGENT, status: "delivered", view: true, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
  { fixture: "", cat: "email", headline: ["Chase emailed to ", { v: "buyer" }], subject: [{ v: "subject" }], actor: SYS, status: "sent", view: true, date: [{ v: "dt", ex: "5 Nov 2026, 06:00" }] },
];

const GROUPS: { id: string; title: string; items: State[] }[] = [
  {
    id: "group-0", title: "Next action", items: [
      { fixture: "Client · automatic", cat: "auto", upcoming: true, pill: "Automatic", headline: ["Follow up with ", { v: "buyer" }], body: ["Buyer"], date: ["Due ", { v: "due", ex: "12 Nov" }] },
      { fixture: "Client · team reminder", cat: "team", upcoming: true, pill: "For your team", headline: ["Follow up with ", { v: "buyer" }], body: ["Buyer"], date: ["Reminder on ", { v: "due", ex: "12 Nov" }] },
      { fixture: "Solicitor · automatic", cat: "auto", upcoming: true, pill: "Automatic", headline: ["Follow up with the buyer’s solicitor"], date: ["Due ", { v: "due", ex: "12 Nov" }] },
      { fixture: "Handed to team", cat: "team", upcoming: true, pill: "For your team", headline: ["Follow up with ", { v: "buyer" }], body: ["Buyer · In your work queue"] },
      { fixture: "On hold", cat: "hold", upcoming: true, pill: "On hold", headline: ["Follow up with ", { v: "buyer" }], body: ["Waiting for replies to enquiries."] },
    ],
  },
  {
    id: "group-1", title: "Scheduled & opened", items: [
      { fixture: "Client · with grace period", cat: "calendar", headline: ["Chase scheduled for ", { v: "buyer" }], body: ["If there’s no reply, follow-up is due in ", { v: "grace" }, " working days."], date: [{ v: "dt", ex: "31 Oct 2026, 20:37" }] },
      { fixture: "Client · no grace period", cat: "calendar", headline: ["Chase scheduled for ", { v: "buyer" }], body: ["Waiting for confirmation of the milestone."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Solicitor chase", cat: "calendar", headline: ["Chase scheduled for the buyer’s solicitor"], body: ["Waiting for confirmation of the milestone."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Initial enquiries follow-up", cat: "calendar", headline: ["Follow-up started for initial enquiries"], body: ["Waiting for the buyer’s solicitor to raise enquiries."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Enquiry replies tracking", cat: "calendar", headline: ["Tracking started for enquiry replies"], body: ["Waiting for replies to the initial enquiries."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Enquiry replies tracking · with note", cat: "calendar", headline: ["Tracking started for enquiry replies"], note: { label: "Outstanding", text: [{ v: "outstanding" }] }, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Exchange day started", cat: "calendar", headline: ["Exchange targeted for ", { v: "exchangeTarget" }], body: ["Completion agreed for ", { v: "completion" }, "."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
    ],
  },
  {
    id: "group-2", title: "Enquiry movements", items: [
      { fixture: "Replies sent", cat: "movement", headline: ["Replies to initial enquiries sent"], body: ["Sent by the seller’s solicitor."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Replies received", cat: "movement", headline: ["Enquiry replies received"], body: ["With the buyer’s solicitor for review."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Further enquiries raised", cat: "movement", headline: ["Further enquiries raised"], body: ["Waiting for the seller’s solicitor to reply."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Partial replies", cat: "movement", headline: ["Some enquiry replies received"], body: ["Further replies are still outstanding."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Responsibility corrected", cat: "movement", headline: ["Enquiry responsibility corrected"], body: ["Now with the seller’s solicitor."], date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Enquiries update", cat: "movement", headline: ["Note added to enquiries"], note: { label: "Note", text: [{ v: "noteText" }] }, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
    ],
  },
  {
    id: "group-3", title: "Automatic emails", items: [
      { fixture: "Client · saved email", cat: "email", headline: ["Chase emailed to ", { v: "buyer" }], subject: [{ v: "subject" }], actor: SYS, status: "sent", view: true, date: [{ v: "dt", ex: "5 Nov 2026, 06:00" }] },
      { fixture: "Solicitor · no saved copy", cat: "email", headline: ["Chase emailed to the buyer’s solicitor"], actor: SYS, status: "sent", date: [{ v: "dt", ex: "5 Nov 2026, 06:00" }] },
      { fixture: "Initial enquiries chase", cat: "email", headline: ["Initial enquiries chased"], body: ["To ", { v: "sol" }, ", buyer’s solicitor."], actor: SYS, status: "opened", view: true, date: [{ v: "dt", ex: "5 Nov 2026, 06:00" }] },
      { fixture: "Enquiry replies chase", cat: "email", headline: ["Enquiry replies chased"], body: ["To the seller’s solicitor."], actor: SYS, status: "opened", view: true, date: [{ v: "dt", ex: "5 Nov 2026, 06:00" }] },
      { fixture: "Exchange · morning check-in", cat: "email", headline: ["Morning exchange check-in sent"], body: ["To both solicitors."], actor: SYS, status: "sent", date: [{ v: "dt", ex: "1 Dec 2026, 08:00" }] },
      { fixture: "Exchange · client update", cat: "email", headline: ["Exchange day update sent"], body: ["To the buyer and seller."], actor: SYS, status: "sent", date: [{ v: "dt", ex: "1 Dec 2026, 08:30" }] },
      { fixture: "Exchange · authority request", cat: "email", headline: ["Authority to exchange requested"], body: ["To the buyer and seller."], actor: SYS, status: "sent", date: [{ v: "dt", ex: "1 Dec 2026, 08:35" }] },
      { fixture: "Exchange · midday follow-up", cat: "email", headline: ["Midday exchange follow-up sent"], body: ["To both solicitors."], actor: SYS, status: "sent", date: [{ v: "dt", ex: "1 Dec 2026, 12:00" }] },
      { fixture: "Exchange · afternoon follow-up", cat: "email", headline: ["Afternoon exchange follow-up sent"], body: ["To both solicitors."], actor: SYS, status: "sent", date: [{ v: "dt", ex: "1 Dec 2026, 14:00" }] },
    ],
  },
  {
    id: "group-4", title: "Manual emails", items: [
      { fixture: "Sent", cat: "email", headline: ["Chase emailed to ", { v: "buyer" }], subject: [{ v: "subject" }], actor: AGENT, status: "sent", view: true, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Delivered", cat: "email", headline: ["Chase emailed to ", { v: "buyer" }], subject: [{ v: "subject" }], actor: AGENT, status: "delivered", view: true, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Opened", cat: "email", headline: ["Chase emailed to ", { v: "buyer" }], subject: [{ v: "subject" }], actor: AGENT, status: "opened", view: true, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
      { fixture: "Bounced", cat: "danger", headline: ["Chase email to ", { v: "buyer" }, " bounced"], body: ["The email couldn’t be delivered."], actor: AGENT, view: true, date: [{ v: "dt", ex: "6 Nov 2026, 14:12" }] },
    ],
  },
  {
    id: "group-5", title: "Handover & escalation", items: [
      { fixture: "Handover · client", cat: "team", headline: ["Chase handed to your team"], body: [{ v: "buyer" }, " · Automatic chase limit reached after 2 emails."], actor: SYS, date: [{ v: "dt", ex: "7 Nov 2026, 09:00" }] },
      { fixture: "Handover · solicitor", cat: "team", headline: ["Chase handed to your team"], body: ["Buyer’s solicitor · Automatic chase limit reached after 2 emails."], actor: SYS, date: [{ v: "dt", ex: "7 Nov 2026, 09:00" }] },
      { fixture: "Escalated · by a person", cat: "danger", headline: ["Escalated to the file owner"], body: ["No reply after ", { v: "teamChases" }, " team chases."], actor: AGENT, date: [{ v: "dt", ex: "8 Nov 2026, 09:12" }] },
      { fixture: "Escalated · automatic", cat: "danger", headline: ["Escalated to the file owner"], body: ["Initial enquiries were still outstanding after repeated follow-ups."], actor: SYS, date: [{ v: "dt", ex: "8 Nov 2026, 09:12" }] },
    ],
  },
  {
    id: "group-6", title: "Resolved & confirmed", items: [
      { fixture: "Confirmed · by the client", cat: "success", headline: [{ v: "confirmRole" }, " confirmed ", { v: "confirmWhat" }], body: ["Chase closed."], actor: { av: "purchaser", nameKey: "buyer", role: "Buyer" }, date: [{ v: "dt", ex: "8 Nov 2026, 10:04" }] },
      { fixture: "Confirmed · no attribution", cat: "success", headline: ["Milestone confirmed"], body: ["Chase closed."], date: [{ v: "dt", ex: "8 Nov 2026, 10:04" }] },
      { fixture: "Confirmed · solicitor milestone", cat: "success", headline: [{ v: "milestoneName" }, " confirmed"], body: ["Chase closed."], actor: { av: "solicitor", nameKey: "sol", role: "Buyer’s solicitor" }, date: [{ v: "dt", ex: "8 Nov 2026, 10:04" }] },
      { fixture: "Initial enquiries raised", cat: "success", headline: ["Initial enquiries raised"], body: ["Now waiting for replies."], date: [{ v: "dt", ex: "8 Nov 2026, 10:04" }] },
      { fixture: "Enquiries satisfied", cat: "success", headline: ["Enquiries satisfied"], body: ["Enquiry follow-ups closed."], date: [{ v: "dt", ex: "8 Nov 2026, 10:04" }] },
      { fixture: "Authority given", cat: "success", headline: [{ v: "authRole" }, " gave authority to exchange"], actor: { av: "vendor", nameKey: "authName", role: "Seller" }, date: [{ v: "dt", ex: "1 Dec 2026, 13:40" }] },
      { fixture: "Exchanged", cat: "milestone", headline: ["Contracts exchanged"], body: ["Completion due ", { v: "completion" }, "."], date: [{ v: "dt", ex: "1 Dec 2026, 16:30" }] },
    ],
  },
  {
    id: "group-7", title: "Moved & stopped", items: [
      { fixture: "Next chase moved", cat: "calendar", headline: ["Next chase moved to ", { v: "movedDate" }], date: [{ v: "dt", ex: "8 Nov 2026, 10:30" }] },
      { fixture: "Chase stopped", cat: "hold", headline: ["Chase stopped"], body: ["The milestone was completed separately."], date: [{ v: "dt", ex: "7 Nov 2026, 16:00" }] },
      { fixture: "Exchange day ended", cat: "hold", headline: ["Exchange attempt ended"], body: ["Contracts weren’t exchanged during this attempt."], date: [{ v: "dt", ex: "1 Dec 2026, 15:00" }] },
    ],
  },
];

export default function DevChaseTimelineRows() {
  if (process.env.NODE_ENV === "production") notFound();
  const { isDark, setDark } = useDarkMode("system");
  const [mode, setMode] = useState<Mode>("example");

  return (
    <div className="ctl-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="ctl-top">
        <div>
          <p className="ctl-eyebrow">/dev · proposed timeline · our design + new copy</p>
          <h1>Chase timeline — every row</h1>
        </div>
        <div className="ctl-toggles">
          <div className="ctl-seg" role="group" aria-label="Content">
            <button type="button" className={mode === "example" ? "on" : ""} onClick={() => setMode("example")}>Example</button>
            <button type="button" className={mode === "vars" ? "on" : ""} onClick={() => setMode("vars")}>Variables</button>
          </div>
          <div className="ctl-seg" role="group" aria-label="Theme">
            <button type="button" className={!isDark ? "on" : ""} onClick={() => setDark(false)}>Light</button>
            <button type="button" className={isDark ? "on" : ""} onClick={() => setDark(true)}>Dark</button>
          </div>
        </div>
      </div>
      <p className="ctl-lead">
        The proposed row, in our design system (real Pill, avatars, the joining rail, our tokens). Flip to <b>Variables</b> to
        see which text is dynamic (<span className="ctl-var">{"{like this}"}</span>, swapped per sale) versus fixed.
      </p>

      <div className="ctl-card ctl-sample">
        <div className="ctl-fix">Example timeline · 19 Bodge Piece</div>
        <div className="ctl-stack">
          {SAMPLE.map((s, i) => <Row key={i} s={s} mode={mode} last={i === SAMPLE.length - 1} />)}
        </div>
      </div>

      <div className="ctl-cathead"><h2>All 45 states</h2><p>The label on each card names the example — it sits outside the proposed row.</p></div>

      <nav className="ctl-nav" aria-label="State groups">
        {GROUPS.map((g) => <a href={`#${g.id}`} key={g.id}>{g.title} <small>{g.items.length}</small></a>)}
      </nav>

      {GROUPS.map((g) => (
        <section id={g.id} className="ctl-group" key={g.id}>
          <h2>{g.title} <small>{g.items.length}</small></h2>
          <div className="ctl-grid">
            {g.items.map((s, i) => (
              <article className="ctl-card" key={i}>
                <div className="ctl-fix">{s.fixture}</div>
                <div className="ctl-stack"><Row s={s} mode={mode} last /></div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

const CSS = `
.ctl-root{position:relative;z-index:1;max-width:900px;margin:0 auto;padding:36px 22px 120px;color:var(--agent-text-primary)}
.ctl-root h1,.ctl-root h2,.ctl-root h3,.ctl-root p{margin:0}
.ctl-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.ctl-eyebrow{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--agent-coral-deep);margin:0 0 8px}
.ctl-root h1{font-size:28px;font-weight:800;letter-spacing:-.02em}
.ctl-lead{font-size:13.5px;line-height:1.6;color:var(--agent-text-secondary);margin:12px 0 0;max-width:720px}
.ctl-toggles{display:flex;gap:8px;flex-wrap:wrap}
.ctl-seg{display:inline-flex;padding:3px;border-radius:10px;gap:2px;background:color-mix(in srgb,var(--agent-text-primary) 7%,transparent);border:0.5px solid var(--agent-border-default)}
.ctl-seg button{font:inherit;font-size:12px;font-weight:650;padding:5px 13px;border:none;border-radius:8px;background:transparent;color:var(--agent-text-secondary);cursor:pointer;transition:background .14s,color .14s}
.ctl-seg button.on{background:var(--agent-coral-deep);color:var(--agent-text-on-coral,#fff)}
.ctl-var{color:var(--agent-coral-deep);background:color-mix(in srgb,var(--agent-coral-deep) 12%,transparent);border-radius:5px;padding:0 4px;font-weight:650;white-space:nowrap}

.ctl-cathead{margin:40px 0 14px}
.ctl-cathead p{font-size:13px;color:var(--agent-text-muted);margin-top:4px}
.ctl-root h2{font-size:18px;font-weight:750;letter-spacing:-.02em}
.ctl-nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px}
.ctl-nav a{font-size:12.5px;color:var(--agent-text-secondary);text-decoration:none;background:var(--agent-surface-elevated);border:0.5px solid var(--agent-border-subtle);border-radius:999px;padding:5px 11px}
.ctl-nav a:hover{border-color:var(--agent-coral-deep);color:var(--agent-text-primary)}
.ctl-root small{font-size:11px;color:var(--agent-text-muted);background:color-mix(in srgb,var(--agent-text-primary) 8%,transparent);border-radius:99px;padding:1px 6px;margin-left:4px}
.ctl-group{margin-top:30px;scroll-margin-top:16px}
.ctl-group>h2{margin-bottom:12px}
.ctl-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}

.ctl-card{container-type:inline-size;background:var(--agent-surface-elevated);border:0.5px solid var(--agent-border-subtle);border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.05),0 10px 30px rgba(0,0,0,.05)}
:root[data-theme="dark"] .ctl-card{border-color:rgba(255,255,255,.08);box-shadow:0 1px 2px rgba(0,0,0,.4),0 14px 36px rgba(0,0,0,.5)}
.ctl-fix{padding:9px 16px;background:color-mix(in srgb,var(--agent-text-primary) 3%,transparent);border-bottom:0.5px solid var(--agent-border-subtle);font-size:12px;font-weight:600;color:var(--agent-text-muted)}
.ctl-sample{margin-top:26px}
.ctl-stack{padding:4px 2px}

.ctl-row{display:grid;grid-template-columns:30px minmax(0,1fr);column-gap:13px;padding:13px 16px;--kind:var(--agent-text-muted)}
.ctl-row.auto,.ctl-row.email{--kind:var(--agent-info)}
.ctl-row.team{--kind:var(--agent-warning)}
.ctl-row.danger{--kind:var(--agent-danger)}
.ctl-row.success,.ctl-row.milestone{--kind:var(--agent-success)}
.ctl-row.movement{--kind:#0E8C86}
.ctl-row.up{background:color-mix(in srgb,var(--kind) 8%,transparent);border-radius:12px;margin:3px 0}
.ctl-row.milestone{background:color-mix(in srgb,var(--agent-success) 9%,transparent);border-radius:12px;margin:3px 0}

.ctl-lead{display:flex;flex-direction:column;align-items:center}
/* -4px lifts the 28px circle so its centre lands on the headline's first line. */
.ctl-ic{width:28px;height:28px;flex:none;margin-top:-4px;border-radius:50%;display:grid;place-items:center;background:var(--agent-surface-elevated);border:1.5px solid var(--kind);color:var(--kind)}
.ctl-ic.dashed{border-style:dashed}
.ctl-ic svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ctl-rail{width:2px;flex:1;min-height:14px;margin-top:3px;background:var(--agent-border-subtle)}

.ctl-body{min-width:0}
.ctl-head{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}
.ctl-body h3{font-size:14px;font-weight:600;letter-spacing:-.012em;line-height:1.35;color:var(--agent-text-primary)}
.ctl-p{font-size:12.5px;color:var(--agent-text-secondary);margin-top:3px;line-height:1.42}
.ctl-sub{font-size:12.5px;color:var(--agent-text-muted);margin-top:3px;line-height:1.42;font-style:italic;overflow-wrap:anywhere}
.ctl-note{margin-top:6px;border-left:2px solid var(--agent-border-strong);background:color-mix(in srgb,var(--agent-text-primary) 4%,transparent);border-radius:0 6px 6px 0;padding:5px 9px;font-size:12.5px;color:var(--agent-text-secondary)}
.ctl-note strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--agent-text-muted);margin-bottom:1px;font-weight:700}

/* Actor identity — avatar + full name + role/title beneath */
.ctl-actor{display:flex;align-items:center;gap:9px;margin-top:9px}
.ctl-who{display:flex;flex-direction:column;min-width:0;line-height:1.25}
.ctl-who-name{font-size:12.5px;font-weight:600;color:var(--agent-text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ctl-who-role{font-size:11px;color:var(--agent-text-muted)}
.ctl-sysav{width:30px;height:30px;flex:none;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--agent-text-primary) 7%,transparent);color:var(--agent-text-muted)}
.ctl-sysav svg{width:14px;height:14px;fill:currentColor;stroke:none}

.ctl-right{grid-column:2;display:flex;flex-wrap:wrap;gap:3px 12px;margin-top:6px;font-size:11.5px;color:var(--agent-text-muted);font-variant-numeric:tabular-nums}
.ctl-status{display:inline-flex;align-items:center;gap:5px;font-weight:650}
.ctl-status:before{content:"";width:5px;height:5px;border-radius:999px;background:currentColor}
.ctl-status.sent{color:var(--agent-text-muted)}
.ctl-status.delivered{color:var(--agent-info)}
.ctl-status.opened{color:var(--agent-success)}
.ctl-view{color:var(--agent-coral-deep);font-weight:700;white-space:nowrap}
.ctl-row.up .ctl-date{font-weight:650;color:var(--agent-text-secondary)}
@container (min-width:520px){
  .ctl-row:has(.ctl-right){grid-template-columns:30px minmax(0,1fr) 150px}
  .ctl-right{grid-column:3;grid-row:1;flex-direction:column;align-items:flex-end;gap:7px;margin-top:1px;text-align:right;white-space:nowrap}
}
`;

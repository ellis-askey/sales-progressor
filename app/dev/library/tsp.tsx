"use client";
// TSP library · domain patterns. Built from our proven /dev/updates-glass row +
// progress-line, /dev/hub-slice journey, and the hub treatments — the real TSP
// content objects. Content-layer → token/solid surfaces (no lens), status stated
// (dots, not pills), grounded strings. Registry in TSP_REG.

import { useState, type ReactNode } from "react";
import {
  CheckCircle, CalendarBlank, Check, ChatCircle, House, CaretRight, PaperPlaneTilt,
  Warning, ArrowUpRight, Path,
} from "@phosphor-icons/react";
import { cn } from "./lib";
import { Button } from "./controls";
import { DropdownMenu } from "./overlays";
import type { RegEntry } from "./registry";

function Avatar({ role, name }: { role: "staff" | "sol" | "buyer" | "seller"; name: string }) { return <span className="tlx-av" data-role={role} aria-hidden>{name}</span>; }

/* ── PropertyRow — the Updates file row: address hero + status dot + progress line ─ */
export function PropertyRow({ addr = "14 Bushey Avenue", loc = "Broxbourne, EN10 6QE", status = "Active", pct = 62, next = "Chase the buyer's solicitor for replies", tone = "ok" as "ok" | "warn" | "danger" }) {
  return (
    <button className="tlx-row">
      <span className="tlx-row-ic"><House weight="regular" /></span>
      <span className="tlx-row-main">
        <span className="tlx-row-top"><strong>{addr}</strong><span className="tlx-row-loc">{loc}</span></span>
        <span className="tlx-row-prog"><span className="tlx-row-prog-fill" data-tone={tone} style={{ width: `${pct}%` }} /></span>
        <span className="tlx-row-next">Next: {next}</span>
      </span>
      <span className="tlx-row-tail"><span className="tlx-status" data-tone={tone}><span className="tlx-status-dot" />{status} · {pct}%</span><CaretRight weight="bold" /></span>
    </button>
  );
}

/* ── PropertySummary — richer header ─────────────────────────────────────────── */
export function PropertySummary() {
  return (
    <div className="tlx-summary">
      <div className="tlx-summary-head">
        <div><div className="tlx-status" data-tone="warn"><span className="tlx-status-dot" />Exchange overdue · 5 days</div><h3>3 Maple Court<span>Hertford · SG14 1QF</span></h3></div>
        <div className="tlx-summary-people"><Avatar role="buyer" name="B" /><Avatar role="seller" name="S" /><Avatar role="sol" name="D" /><Avatar role="staff" name="P" /></div>
      </div>
      <div className="tlx-summary-facts">
        <div><span>Stage</span><strong>Moving</strong></div><div><span>Exchange est.</span><strong>~4 weeks</strong></div><div><span>Value</span><strong>£415,000</strong></div><div><span>Fee</span><strong>£4.2k</strong></div>
      </div>
    </div>
  );
}

/* ── Milestones — the journey (done / current / future) ──────────────────────── */
const JOURNEY = [
  { label: "Offer", date: "12 Aug", state: "done" }, { label: "Solicitors", date: "19 Aug", state: "done" },
  { label: "Searches", date: "14 Sep", state: "done" }, { label: "Enquiries", date: "2 Oct", state: "done" },
  { label: "Replies", date: "now", state: "current" }, { label: "Exchange", date: "~4 wks", state: "future" }, { label: "Completion", date: "—", state: "future" },
];
export function Milestones() {
  const cur = JOURNEY.findIndex((n) => n.state === "current");
  return (
    <div className="tlx-journey">
      <div className="tlx-journey-track"><span className="tlx-journey-fill" style={{ width: `${(cur / (JOURNEY.length - 1)) * 100}%` }} />
        {JOURNEY.map((n, i) => <span key={n.label} className="tlx-journey-node" data-state={n.state} style={{ left: `${(i / (JOURNEY.length - 1)) * 100}%` }} />)}
      </div>
      <div className="tlx-journey-labels">{JOURNEY.map((n) => <div key={n.label} className="tlx-journey-lab" data-cur={n.state === "current" || undefined}><span>{n.label}</span><span>{n.date}</span></div>)}</div>
    </div>
  );
}

/* ── TransactionProgress — compact % to exchange ─────────────────────────────── */
export function TransactionProgress({ pct = 62, stage = "Legal work" }: { pct?: number; stage?: string }) {
  return (
    <div className="tlx-txprog"><div className="tlx-txprog-head"><span>{stage}</span><strong>{pct}% to exchange</strong></div><span className="tlx-txprog-bar"><span style={{ width: `${pct}%` }} /></span></div>
  );
}

/* ── ChainView — linked properties ───────────────────────────────────────────── */
export function ChainView() {
  const chain = [{ addr: "63 Elm Grove", role: "Below", tone: "ok" }, { addr: "3 Maple Court", role: "This sale", tone: "warn" }, { addr: "7 Victoria Road", role: "Above", tone: "ok" }, { addr: "22 Nathaniels Walk", role: "Top", tone: "ok" }];
  return (
    <div className="tlx-chain">
      {chain.map((c, i) => (
        <div key={c.addr} className="tlx-chain-seg">
          {i > 0 && <span className="tlx-chain-link"><Path weight="bold" /></span>}
          <button className={cn("tlx-chain-node", c.role === "This sale" && "tlx-chain-node--self")}>
            <span className="tlx-status-dot" data-tone={c.tone} /><span><strong>{c.addr}</strong><span>{c.role}</span></span>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── EnquiryItem ─────────────────────────────────────────────────────────────── */
export function EnquiryItem() {
  return (
    <div className="tlx-enquiry">
      <span className="tlx-enquiry-ic"><ChatCircle weight="fill" /></span>
      <div className="tlx-enquiry-body"><div className="tlx-enquiry-top"><strong>Enquiry loop silent</strong><span className="tlx-status" data-tone="warn"><span className="tlx-status-dot" />23 days</span></div><p>With Duggan &amp; Co · boundary and planning points outstanding.</p></div>
      <Button size="sm" variant="primary"><PaperPlaneTilt weight="fill" /> Chase</Button>
    </div>
  );
}

/* ── Reminder ────────────────────────────────────────────────────────────────── */
export function Reminder() {
  return (
    <div className="tlx-reminder" data-tone="danger">
      <span className="tlx-reminder-tone" />
      <div className="tlx-reminder-body"><div className="tlx-reminder-top"><strong>Chase the buyer&rsquo;s solicitor</strong><span className="tlx-reminder-urg">Escalated</span></div><p>3 Maple Court · 3 chases, no reply · escalated by Priya</p></div>
      <div className="tlx-reminder-act"><Button size="sm" variant="primary">Chase</Button><DropdownMenu label="More" align="end" items={[{ label: "Mark as chased" }, { label: "Confirm step done" }, { label: "Snooze to tomorrow" }]} /></div>
    </div>
  );
}

/* ── DiaryEvent ──────────────────────────────────────────────────────────────── */
export function DiaryEvent({ type = "exchange" as "exchange" | "completion", addr = "7 Victoria Road, Ware", ready = true }) {
  return (
    <div className="tlx-diary">
      <span className="tlx-diary-ic"><CheckCircle weight="fill" /></span>
      <div className="tlx-diary-body"><strong>{type === "exchange" ? "Exchange" : "Completion"} today</strong><span>{addr}</span></div>
      {ready ? <Button size="sm" variant="primary">Confirm</Button> : <span className="tlx-diary-tag">Not ready</span>}
    </div>
  );
}

/* ── ActivityUpdate — the Updates message row ────────────────────────────────── */
export function ActivityUpdate({ kind = "comm" as "comm" | "milestone" | "doc", text = "A solicitor replied to our chase", body = "We confirm the boundary runs along the eastern fence line; a copy of the deed plan is enclosed.", who = "D" as string, role = "sol" as "staff" | "sol" | "buyer" | "seller", at = "52m ago" }) {
  return (
    <div className="tlx-update">
      <Avatar role={role} name={who} />
      <div className="tlx-update-body"><p className="tlx-update-text">{text}</p>{body && <p className="tlx-update-sub">{body}</p>}</div>
      <time className="tlx-update-at">{at}</time>
    </div>
  );
}

/* ── PersonDisplay ───────────────────────────────────────────────────────────── */
export function PersonDisplay({ name = "Priya Shah", role = "Progressor", side = "staff" as "staff" | "sol" | "buyer" | "seller", initials = "PS" }) {
  return <span className="tlx-person"><Avatar role={side} name={initials} /><span className="tlx-person-body"><strong>{name}</strong><span>{role}</span></span></span>;
}

/* ── ContextualActions — primary + overflow (composed from library) ──────────── */
export function ContextualActions() {
  return (
    <div className="tlx-ctxactions">
      <Button variant="primary"><CalendarBlank weight="bold" /> Set a new date</Button>
      <Button variant="secondary"><PaperPlaneTilt weight="regular" /> Chase</Button>
      <DropdownMenu label="More" align="end" items={[{ label: "Recalculate the estimate" }, { label: "Snooze a few days" }, { label: "Open the file", icon: <ArrowUpRight weight="bold" /> }, { label: "Withdraw the file", danger: true, icon: <Warning weight="fill" /> }]} />
    </div>
  );
}

export const TSP_REG: RegEntry[] = [
  { name: "PropertyRow", purpose: "A sale as a scannable row with live state.", source: "/dev/updates-glass file row + progress-line (our benchmark).", licence: "TSP", adaptations: "Address hero, status dot (not pill), hairline progress line toned by health, next-step line.", variants: "tone ok/warn/danger", states: "rest · hover · focus", importPath: "app/dev/library/tsp.tsx → PropertyRow", whenToUse: "Any list of sales (hub, files, search results)." },
  { name: "PropertySummary", purpose: "A file header with people + key facts.", source: "/dev/hub-slice summary.", licence: "TSP", adaptations: "Status stated, address hero, people avatars, fact row — no stat tiles.", variants: "—", states: "static", importPath: "app/dev/library/tsp.tsx → PropertySummary", whenToUse: "Top of a property file / focus surface." },
  { name: "Milestones", purpose: "The sale's journey (done/current/future).", source: "/dev/hub-slice journey line (the signature).", licence: "TSP", adaptations: "Coral fill to current, labelled nodes + dates, current pulse.", variants: "—", states: "done · current · future", importPath: "app/dev/library/tsp.tsx → Milestones", whenToUse: "Show where a sale is and what's next." },
  { name: "TransactionProgress", purpose: "Compact % to exchange.", source: "Hub pipeline-health pattern.", licence: "TSP", adaptations: "Stage + % + coral bar.", variants: "pct; stage", states: "value-driven", importPath: "app/dev/library/tsp.tsx → TransactionProgress", whenToUse: "Inline progress in rows/cards." },
  { name: "ChainView", purpose: "The linked chain of sales.", source: "Custom (our chain concept) — no suitable source.", licence: "TSP", adaptations: "Linked nodes, this-sale highlighted, per-link status dots.", variants: "—", states: "node hover · self highlight", importPath: "app/dev/library/tsp.tsx → ChainView", whenToUse: "Chain context on a file." },
  { name: "EnquiryItem", purpose: "An enquiry thread's state + action.", source: "Hub stalled-enquiries pattern.", licence: "TSP", adaptations: "Silence duration stated, chase action.", variants: "—", states: "rest · action", importPath: "app/dev/library/tsp.tsx → EnquiryItem", whenToUse: "Enquiry lists / file enquiry tab." },
  { name: "Reminder", purpose: "A reminder needing action.", source: "Hub AttentionCard reminder row.", licence: "TSP", adaptations: "Tone rail, grounded meta, split primary + overflow menu.", variants: "tone; urgency", states: "rest · hover · menu open", importPath: "app/dev/library/tsp.tsx → Reminder", whenToUse: "Needs-you / work-queue lists." },
  { name: "DiaryEvent", purpose: "Exchange/completion due today.", source: "Hub DiaryCard.", licence: "TSP", adaptations: "Time-critical, confirm vs not-ready.", variants: "exchange/completion; ready", states: "ready (confirm) · not-ready", importPath: "app/dev/library/tsp.tsx → DiaryEvent", whenToUse: "Today's time-critical events." },
  { name: "ActivityUpdate", purpose: "A real update/message.", source: "/dev/updates-glass message row (Leading + UpdateLine).", licence: "TSP", adaptations: "Leading person avatar, grounded sentence + body, time.", variants: "kind comm/milestone/doc", states: "static · hover", importPath: "app/dev/library/tsp.tsx → ActivityUpdate", whenToUse: "Activity feeds, file history, Updates." },
  { name: "PersonDisplay", purpose: "A person (buyer/seller/solicitor/staff).", source: "Our actor-avatar pattern.", licence: "TSP", adaptations: "Role-tinted avatar + name + role; identity, not a coloured square.", variants: "side staff/sol/buyer/seller", states: "static", importPath: "app/dev/library/tsp.tsx → PersonDisplay", whenToUse: "Wherever a person appears (woven in, not floating)." },
  { name: "ContextualActions", purpose: "The actions for a situation.", source: "Composed from library Button + DropdownMenu.", licence: "TSP", adaptations: "One coral primary + secondary + overflow menu (with danger).", variants: "—", states: "rest · menu open", importPath: "app/dev/library/tsp.tsx → ContextualActions", whenToUse: "On a focus surface / row — the action cluster." },
];

export const TSP_CSS = `
.tlx-av{ display:inline-grid; place-items:center; width:26px; height:26px; border-radius:50%; font-size:10px; font-weight:700; color:#fff; flex-shrink:0; } .tlx-av[data-role="staff"]{ background:linear-gradient(180deg,#ff8a65,#ff6b4a); } .tlx-av[data-role="sol"]{ background:linear-gradient(180deg,#8b94a6,#5f6675); } .tlx-av[data-role="buyer"]{ background:linear-gradient(180deg,#56c596,#2f9d6b); } .tlx-av[data-role="seller"]{ background:linear-gradient(180deg,#5e9bff,#3a6fd8); }
.tlx-status{ display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:650; } .tlx-status-dot{ width:8px; height:8px; border-radius:50%; background:var(--lg-ok); } .tlx-status[data-tone="warn"]{ color:var(--lg-warn); } .tlx-status[data-tone="warn"] .tlx-status-dot,.tlx-status-dot[data-tone="warn"]{ background:var(--lg-warn); } .tlx-status[data-tone="danger"]{ color:var(--lg-danger-ink); } .tlx-status[data-tone="danger"] .tlx-status-dot,.tlx-status-dot[data-tone="danger"]{ background:var(--lg-danger); } .tlx-status[data-tone="ok"]{ color:#45c46a; } .tlx-status-dot[data-tone="ok"]{ background:var(--lg-ok); }

.tlx-row{ display:flex; align-items:center; gap:13px; width:100%; max-width:560px; padding:13px 15px; border-radius:14px; background:var(--lg-fill); border:1px solid var(--lg-line-2); cursor:pointer; text-align:left; transition:background .18s,border-color .18s; } .tlx-row:hover{ background:var(--lg-hover); border-color:var(--lg-line); } .tlx-row-ic{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center; background:var(--lg-hover); color:var(--lg-ink-2); flex-shrink:0; } .tlx-row-ic svg{ width:18px; height:18px; }
.tlx-row-main{ flex:1; min-width:0; } .tlx-row-top{ display:flex; align-items:baseline; gap:8px; } .tlx-row-top strong{ font-size:14.5px; font-weight:650; } .tlx-row-loc{ font-size:11.5px; color:var(--lg-ink-3); } .tlx-row-prog{ display:block; height:3px; border-radius:3px; background:var(--lg-line); margin:7px 0 5px; overflow:hidden; } .tlx-row-prog-fill{ display:block; height:100%; border-radius:3px; background:var(--lg-ok); } .tlx-row-prog-fill[data-tone="warn"]{ background:var(--lg-warn); } .tlx-row-prog-fill[data-tone="danger"]{ background:var(--lg-danger); } .tlx-row-prog-fill[data-tone="ok"]{ background:linear-gradient(90deg,var(--lg-accent-2),var(--lg-accent)); } .tlx-row-next{ font-size:11.5px; color:var(--lg-ink-3); } .tlx-row-tail{ display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; } .tlx-row-tail > svg{ width:13px; height:13px; color:var(--lg-ink-3); }

.tlx-summary{ max-width:560px; padding:18px; border-radius:16px; background:var(--lg-fill); border:1px solid var(--lg-line-2); } .tlx-summary-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:12px; } .tlx-summary-head h3{ font-size:22px; font-weight:780; letter-spacing:-.02em; margin-top:5px; } .tlx-summary-head h3 span{ font-size:13px; font-weight:500; color:var(--lg-ink-3); margin-left:9px; } .tlx-summary-people{ display:flex; } .tlx-summary-people .tlx-av{ margin-left:-7px; box-shadow:0 0 0 2px var(--lg-base); } .tlx-summary-people .tlx-av:first-child{ margin-left:0; }
.tlx-summary-facts{ display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-top:16px; padding-top:14px; border-top:1px solid var(--lg-line-2); } .tlx-summary-facts div span{ display:block; font-size:11px; color:var(--lg-ink-3); } .tlx-summary-facts div strong{ font-size:15px; font-weight:700; }

.tlx-journey{ max-width:560px; } .tlx-journey-track{ position:relative; height:12px; } .tlx-journey-track::before{ content:""; position:absolute; top:50%; left:0; right:0; height:2px; transform:translateY(-50%); background:var(--lg-line); border-radius:2px; } .tlx-journey-fill{ position:absolute; top:50%; left:0; height:3px; transform:translateY(-50%); background:linear-gradient(90deg,var(--lg-accent-2),var(--lg-accent)); border-radius:3px; } .tlx-journey-node{ position:absolute; top:50%; width:11px; height:11px; margin:-5.5px 0 0 -5.5px; border-radius:50%; background:var(--lg-base); border:2px solid var(--lg-ink-3); } .tlx-journey-node[data-state="done"]{ background:var(--lg-accent); border-color:var(--lg-accent); } .tlx-journey-node[data-state="current"]{ border-color:var(--lg-accent); box-shadow:0 0 0 5px var(--lg-accent-soft); }
.tlx-journey-labels{ display:flex; justify-content:space-between; margin-top:12px; } .tlx-journey-lab{ display:flex; flex-direction:column; align-items:center; gap:1px; } .tlx-journey-lab span:first-child{ font-size:10.5px; font-weight:600; color:var(--lg-ink-2); } .tlx-journey-lab span:last-child{ font-size:9.5px; color:var(--lg-ink-3); } .tlx-journey-lab[data-cur] span:first-child{ color:var(--lg-ink); }

.tlx-txprog{ max-width:360px; } .tlx-txprog-head{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:6px; } .tlx-txprog-head span{ font-size:12px; color:var(--lg-ink-3); } .tlx-txprog-head strong{ font-size:12.5px; font-weight:700; } .tlx-txprog-bar{ display:block; height:6px; border-radius:999px; background:var(--lg-fill); overflow:hidden; } .tlx-txprog-bar span{ display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,var(--lg-accent-2),var(--lg-accent)); }

.tlx-chain{ display:flex; align-items:center; flex-wrap:wrap; } .tlx-chain-seg{ display:flex; align-items:center; } .tlx-chain-link{ display:grid; place-items:center; width:26px; color:var(--lg-ink-3); } .tlx-chain-link svg{ width:14px; height:14px; } .tlx-chain-node{ display:flex; align-items:center; gap:9px; padding:9px 12px; border-radius:12px; background:var(--lg-fill); border:1px solid var(--lg-line-2); cursor:pointer; } .tlx-chain-node:hover{ border-color:var(--lg-ink-3); } .tlx-chain-node--self{ background:var(--lg-accent-soft); border-color:rgba(255,107,74,.3); } .tlx-chain-node strong{ display:block; font-size:12.5px; font-weight:650; } .tlx-chain-node span span{ font-size:10.5px; color:var(--lg-ink-3); }

.tlx-enquiry{ display:flex; align-items:center; gap:12px; max-width:560px; padding:13px 15px; border-radius:14px; background:var(--lg-fill); border:1px solid var(--lg-line-2); } .tlx-enquiry-ic{ width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:var(--lg-hover); color:var(--lg-ink-2); flex-shrink:0; } .tlx-enquiry-ic svg{ width:17px; height:17px; } .tlx-enquiry-body{ flex:1; min-width:0; } .tlx-enquiry-top{ display:flex; align-items:center; gap:9px; } .tlx-enquiry-top strong{ font-size:13.5px; font-weight:650; } .tlx-enquiry-body p{ font-size:12px; color:var(--lg-ink-2); margin-top:2px; }

.tlx-reminder{ position:relative; display:flex; align-items:center; gap:13px; max-width:560px; padding:13px 15px 13px 18px; border-radius:14px; background:var(--lg-fill); border:1px solid var(--lg-line-2); overflow:hidden; } .tlx-reminder-tone{ position:absolute; left:0; top:0; bottom:0; width:3px; background:var(--lg-danger); } .tlx-reminder[data-tone="warn"] .tlx-reminder-tone{ background:var(--lg-warn); } .tlx-reminder-body{ flex:1; min-width:0; } .tlx-reminder-top{ display:flex; align-items:center; gap:9px; } .tlx-reminder-top strong{ font-size:13.5px; font-weight:650; } .tlx-reminder-urg{ font-size:10px; font-weight:700; color:var(--lg-danger-ink); background:rgba(255,69,58,.14); padding:1px 7px; border-radius:999px; } .tlx-reminder-body p{ font-size:12px; color:var(--lg-ink-3); margin-top:2px; } .tlx-reminder-act{ display:flex; align-items:center; gap:7px; flex-shrink:0; }

.tlx-diary{ display:flex; align-items:center; gap:11px; max-width:420px; padding:11px 13px; border-radius:13px; background:var(--lg-fill); border:1px solid var(--lg-line); } .tlx-diary-ic{ width:34px; height:34px; border-radius:10px; display:grid; place-items:center; background:var(--lg-accent-soft); color:var(--lg-accent-ink); flex-shrink:0; } .tlx-diary-ic svg{ width:18px; height:18px; } .tlx-diary-body{ flex:1; } .tlx-diary-body strong{ display:block; font-size:13px; font-weight:650; } .tlx-diary-body span{ font-size:11.5px; color:var(--lg-ink-3); } .tlx-diary-tag{ font-size:11px; font-weight:650; color:var(--lg-ink-3); padding:4px 10px; border-radius:999px; background:var(--lg-hover); }

.tlx-update{ display:flex; align-items:flex-start; gap:11px; max-width:560px; padding:11px 0; } .tlx-update-body{ flex:1; min-width:0; } .tlx-update-text{ font-size:13.5px; color:var(--lg-ink); } .tlx-update-sub{ font-size:12.5px; color:var(--lg-ink-2); margin-top:3px; line-height:1.45; } .tlx-update-at{ font-size:11px; color:var(--lg-ink-3); flex-shrink:0; }

.tlx-person{ display:inline-flex; align-items:center; gap:9px; } .tlx-person-body strong{ display:block; font-size:13px; font-weight:650; } .tlx-person-body span{ font-size:11px; color:var(--lg-ink-3); }

.tlx-ctxactions{ display:flex; align-items:center; gap:9px; flex-wrap:wrap; }
`;

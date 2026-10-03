"use client";

// One client agency's workspace (opened from a Clients row). Tabs: Overview,
// Branding (logo + brand colour that saves and flows to the agency's portal +
// emails, with a live preview), Sales (their files), People (their logins),
// Access (status + resend the set-up invite). Owner-scoped data comes in via
// props; the colour + resend actions re-check ownership server-side.
// SectionReveal entrance, tab-panel fade, hover states, polished primary button.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, Clock, CaretRight, ArrowClockwise, CheckCircle, Copy, PencilSimple, Check, X } from "@phosphor-icons/react";
import { SectionReveal } from "@/components/hub/SectionReveal";
import { useTabIndicator } from "@/lib/agent/use-tab-indicator";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { resendClientInviteAction, createClientSetupLinkAction, renameClientAgencyAction, removeClientAgencyAction } from "@/app/actions/progression-clients";
import { UserAvatar } from "@/components/ui/Avatar";
import { ClientOverview } from "./ClientOverview";
import { ClientPeople } from "./ClientPeople";
import { SenderDomainSection } from "./SenderDomainSection";
import { EmailBrandingStudio } from "@/components/account/v2/EmailBrandingStudio";
import type { ClientAgencyDetail } from "@/lib/services/progression-clients";

const TABS = ["Overview", "Branding", "Sales", "People", "Access"] as const;
type Tab = (typeof TABS)[number];

function salePill(status: string): { label: string; cls: string } {
  if (status === "completed") return { label: "Completed", cls: "done" };
  if (status === "withdrawn") return { label: "Withdrawn", cls: "muted" };
  if (status === "draft") return { label: "Draft", cls: "muted" };
  return { label: "Active", cls: "live" };
}
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function AgencyWorkspace({ detail }: { detail: ClientAgencyDetail }) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [resending, setResending] = useState(false);
  const [copying, setCopying] = useState(false);
  // Rename (pending clients only): the agency is a real Agency row the agency edits
  // once it logs in, so we only let the progressor correct the name while pending.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(detail.name);
  const [savingName, setSavingName] = useState(false);
  // Remove client: two-step inline confirm, blocked server-side if active sales.
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const activeIdx = TABS.indexOf(tab);
  const { btnRefs, ind } = useTabIndicator(activeIdx);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function saveName() {
    const next = nameDraft.trim();
    if (!next || next === detail.name) { setEditingName(false); setNameDraft(detail.name); return; }
    setSavingName(true);
    const res = await renameClientAgencyAction(detail.agencyId, next);
    setSavingName(false);
    if (res.ok) { setEditingName(false); toast.success("Client renamed"); router.refresh(); }
    else { toast.error(res.error); }
  }

  async function removeClient() {
    setRemoving(true);
    const res = await removeClientAgencyAction(detail.agencyId);
    setRemoving(false);
    if (res.ok) { toast.success(`${detail.name} removed`); router.push("/agent/clients"); }
    else { setConfirmRemove(false); toast.error(res.error); }
  }

  async function resend() {
    setResending(true);
    const res = await resendClientInviteAction(detail.agencyId);
    setResending(false);
    if (res.ok) toast.success("Invite re-sent", { description: detail.email ? `We've emailed ${detail.email}.` : undefined });
    else toast.error(res.error);
  }
  async function copyLink() {
    setCopying(true);
    const res = await createClientSetupLinkAction(detail.agencyId);
    setCopying(false);
    if (!res.ok) { toast.error(res.error); return; }
    try {
      await navigator.clipboard.writeText(res.url);
      toast.success("Set-up link copied", { description: "Share it with them directly." });
    } catch {
      toast.error("Couldn't copy the link. Try again.");
    }
  }

  const contactPerson = detail.people.find((p) => p.role === "director") ?? detail.people[0] ?? null;

  const logo = detail.logoUrl
    ? (<span className="aw-logo" style={{ background: detail.branding.tileColor ?? "#ffffff" }}><img src={detail.logoUrl} alt="" /></span>)
    : (<span className="aw-logo aw-logo-mono" style={{ background: detail.brandColor }}>{initials(detail.name)}</span>);

  return (
    <div className="aw">
      <SectionReveal order={0}>
        <Link href="/agent/clients" className="aw-back"><CaretLeft size={15} weight="bold" /> Clients</Link>

        <div className="aw-head">
          <div className="aw-who">
            {logo}
            <div>
              {editingName ? (
                <div className="aw-nameedit">
                  <input
                    autoFocus
                    className="aw-nameinput"
                    value={nameDraft}
                    maxLength={120}
                    disabled={savingName}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setEditingName(false); setNameDraft(detail.name); } }}
                    aria-label="Agency name"
                  />
                  <button type="button" className="aw-namebtn save" onClick={saveName} disabled={savingName} aria-label="Save name"><Check size={15} weight="bold" /></button>
                  <button type="button" className="aw-namebtn" onClick={() => { setEditingName(false); setNameDraft(detail.name); }} disabled={savingName} aria-label="Cancel"><X size={15} weight="bold" /></button>
                </div>
              ) : (
                <h1 className="aw-name">
                  {detail.name}
                  {detail.pending && (
                    <button type="button" className="aw-nameedit-btn" onClick={() => { setNameDraft(detail.name); setEditingName(true); }} title="Rename client" aria-label="Rename client">
                      <PencilSimple size={15} weight="bold" />
                    </button>
                  )}
                </h1>
              )}
              <div className="aw-csub">
                <UserAvatar user={{ name: detail.contact ?? "Agent", image: contactPerson?.image ?? null }} size={20} />
                <span>{detail.contact ?? "Agent"}</span>
                {detail.email && <span className="aw-dot">·</span>}
                {detail.email && <span>{detail.email}</span>}
                <span className="aw-dot">·</span>
                {detail.status === "active"
                  ? <span className="aw-stat live"><span className="d" />Active</span>
                  : <span className="aw-stat invite"><Clock size={11} weight="bold" />Invite sent</span>}
              </div>
            </div>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal order={1}>
        <div className="aw-tabs agent-tab-bar" role="tablist">
          {ind && (
            <div aria-hidden style={{ position: "absolute", bottom: 0, left: ind.left, width: ind.width, height: 2, background: "var(--agent-coral)", borderRadius: "1px 1px 0 0", transition: reduceMotion ? "none" : "left 200ms ease, width 200ms ease", pointerEvents: "none" }} />
          )}
          {TABS.map((t, i) => (
            <button key={t} ref={(el) => { btnRefs.current[i] = el; }} role="tab" aria-selected={t === tab} className="agent-tab" onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="aw-panel" key={tab}>
          {tab === "Overview" && (
            <ClientOverview detail={detail} onTab={setTab} onResend={resend} />
          )}

          {tab === "Branding" && (
            <div className="aw-branding">
              <div className="aw-branding-intro">
                <h4>Email branding</h4>
                <p>
                  Upload {detail.name}&rsquo;s logo and choose their brand colours. We&rsquo;ll use them on every
                  client-facing email sent for their sales, and the live preview on the left shows exactly what
                  their buyers and sellers will receive.
                </p>
              </div>
              <EmailBrandingStudio
                initial={detail.branding}
                endpoint={`/api/agent/clients/${detail.agencyId}/logo`}
              />
              <SenderDomainSection base={`/api/agent/clients/${detail.agencyId}/sender`} scope="client" subjectName={detail.name} />
            </div>
          )}

          {tab === "Sales" && (
            <div className="aw-card full">
              <h4>Their sales · {detail.active} active</h4>
              {detail.sales.length === 0
                ? <p className="aw-empty">No sales yet. Add their first sale to get started.</p>
                : detail.sales.map((s) => {
                    const p = salePill(s.status);
                    return (
                      <Link key={s.id} href={`/agent/transactions/${s.id}`} className="aw-salerow">
                        <span className="ad">{s.address}</span>
                        <span className={`aw-spill ${p.cls}`}>{p.label}</span>
                        <CaretRight size={15} weight="bold" className="aw-salechev" />
                      </Link>
                    );
                  })}
            </div>
          )}

          {tab === "People" && (
            <ClientPeople agencyId={detail.agencyId} agencyName={detail.name} people={detail.people} removed={detail.removedPeople} />
          )}

          {tab === "Access" && (
            <>
            <div className="aw-cards">
              <div className="aw-card">
                <h4>Login &amp; access</h4>
                {detail.status === "active" ? (
                  <p className="aw-accesstxt">
                    <span className="aw-ok"><CheckCircle size={15} weight="fill" /></span>
                    {detail.contact ?? "The agent"} has set up their login. They&rsquo;ll only see the sales you progress for them.
                  </p>
                ) : (
                  <>
                    <p className="aw-accesstxt">
                      Invite sent to {detail.email ?? "the agent"}. We&rsquo;re waiting for them to set up their login.
                    </p>
                    <div className="aw-access-actions">
                      <button className="agent-btn agent-btn-secondary agent-btn-sm" onClick={resend} disabled={resending}>
                        <ArrowClockwise size={14} weight="bold" /> {resending ? "Sending…" : "Resend set-up link"}
                      </button>
                      <button className="agent-btn agent-btn-ghost agent-btn-sm" onClick={copyLink} disabled={copying}>
                        <Copy size={14} weight="bold" /> {copying ? "Preparing…" : "Copy set-up link"}
                      </button>
                    </div>
                    <p className="aw-note">Prefer to send it yourself? Copy the link and share it by WhatsApp, text or while you&rsquo;re on a call.</p>
                  </>
                )}
              </div>
              <div className="aw-card">
                <h4>What they can do</h4>
                <ul className="aw-can">
                  <li><CheckCircle size={17} weight="fill" /><span>See the sales you progress for them in real time.</span></li>
                  <li><CheckCircle size={17} weight="fill" /><span>Follow the progress of each sale and view its documents.</span></li>
                  <li><CheckCircle size={17} weight="fill" /><span>They&rsquo;ll never see another agency&rsquo;s sales or any of your other clients.</span></li>
                </ul>
              </div>
            </div>

            <div className="aw-removezone">
              {!confirmRemove ? (
                <div className="aw-removerow">
                  <div className="aw-removetxt">
                    <span className="t">Remove this client</span>
                    <span className="d">Takes {detail.name} off your Clients list. Their completed sales and account stay; you can add them again later.</span>
                  </div>
                  <button type="button" className="aw-removebtn" onClick={() => setConfirmRemove(true)}>Remove client</button>
                </div>
              ) : (
                <div className="aw-removerow confirm">
                  <div className="aw-removetxt">
                    <span className="t">Remove {detail.name}?</span>
                    <span className="d">{detail.active > 0 ? `They have ${detail.active} active ${detail.active === 1 ? "sale" : "sales"} — you'll need to complete or withdraw those first.` : "This can't be undone from here, but you can re-add them any time."}</span>
                  </div>
                  <div className="aw-removeactions">
                    <button type="button" className="agent-btn agent-btn-ghost agent-btn-sm" onClick={() => setConfirmRemove(false)} disabled={removing}>Cancel</button>
                    <button type="button" className="aw-removebtn danger" onClick={removeClient} disabled={removing}>{removing ? "Removing…" : "Yes, remove"}</button>
                  </div>
                </div>
              )}
            </div>
            </>
          )}
        </div>
      </SectionReveal>

      <style>{`
        .aw { width: 100%; }
        .aw-back { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--agent-text-muted); font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; margin-bottom: 14px; transition: color .15s, transform .15s; }
        .aw-back:hover { color: var(--agent-coral-deep, #E2452A); transform: translateX(-2px); }

        .aw-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .aw-who { display: flex; align-items: center; gap: 16px; min-width: 0; }
        .aw-logo { width: 60px; height: 60px; border-radius: 16px; overflow: hidden; flex-shrink: 0; border: 0.5px solid var(--agent-border-subtle); display: grid; place-items: center; }
        .aw-logo img { width: 100%; height: 100%; object-fit: contain; display: block; padding: 7px; box-sizing: border-box; }
        .aw-logo-mono { color: #fff; font-weight: 800; font-size: 20px; }
        .aw-name { margin: 0 0 3px; font-size: clamp(22px, 3.4vw, 28px); font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); }
        .aw-csub { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; font-size: 13px; color: var(--agent-text-muted); }
        .aw-dot { opacity: 0.5; }
        .aw-stat { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; }
        .aw-stat.live { color: var(--agent-success, #2F7D53); } .aw-stat.live .d { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .aw-stat.invite { color: #B5831E; } :root[data-theme="dark"] .aw-stat.invite { color: #E0B050; }

        .aw-banner { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 15px 18px; border-radius: 14px; border: 1px solid rgba(var(--agent-coral-rgb),0.25); background: rgba(var(--agent-coral-rgb),0.08); margin-bottom: 18px; }
        .aw-banner .tt { font-size: 13.5px; font-weight: 750; color: var(--agent-text-primary); }
        .aw-banner .ds { font-size: 12px; color: var(--agent-text-secondary); margin-top: 2px; }
        .aw-banner-right { min-width: 210px; flex: 1; max-width: 290px; }
        .aw-meter { height: 8px; border-radius: 999px; background: rgba(var(--agent-coral-rgb),0.18); overflow: hidden; margin-bottom: 6px; }
        .aw-meter i { display: block; height: 100%; background: linear-gradient(90deg, var(--agent-coral), var(--agent-coral-deep)); border-radius: 999px; transition: width .9s cubic-bezier(.22,1,.36,1); }
        .aw-legend { font-size: 10.5px; color: var(--agent-text-muted); }

        /* Tabs use the canonical .agent-tab / .agent-tab-bar (hover-preview
           underline + sliding active indicator); .aw-tabs just adds the rule
           line + spacing. */
        .aw-tabs { border-bottom: 1px solid var(--agent-border-subtle); margin-bottom: 18px; }
        .aw-panel { animation: aw-panelin .32s cubic-bezier(.22,1,.36,1) both; }
        @keyframes aw-panelin { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

        .aw-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 760px) { .aw-cards { grid-template-columns: 1fr; } }
        .aw-card { background: var(--agent-glass-bg, rgba(255,255,255,0.5)); border: 1px solid var(--agent-border-subtle); border-radius: 15px; padding: 17px; -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
        .aw-card.full { grid-column: 1 / -1; }
        .aw-card h4 { margin: 0 0 13px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .aw-empty { font-size: 13px; color: var(--agent-text-muted); margin: 0; }

        .aw-ov { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .aw-ov-stat { text-align: center; }
        .aw-ov-stat .v { font-size: 26px; font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); }
        .aw-ov-stat .k { font-size: 10.5px; color: var(--agent-text-muted); margin-top: 3px; }

        .aw-salerow { display: flex; align-items: center; gap: 12px; padding: 11px 0; border-top: 1px solid var(--agent-border-subtle); text-decoration: none; transition: padding .15s; }
        .aw-salerow:first-of-type { border-top: 0; }
        .aw-salerow:hover { padding-left: 4px; }
        .aw-salerow .ad { font-size: 13px; font-weight: 600; color: var(--agent-text-primary); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .aw-salechev { color: var(--agent-text-muted); flex-shrink: 0; }
        .aw-spill { font-size: 10px; font-weight: 700; padding: 4px 9px; border-radius: 999px; white-space: nowrap; flex-shrink: 0; }
        .aw-spill.live { background: rgba(var(--agent-coral-rgb),0.12); color: var(--agent-coral-deep, #E2452A); }
        .aw-spill.done { background: rgba(47,125,83,0.14); color: var(--agent-success, #2F7D53); }
        .aw-spill.muted { background: var(--agent-glass-bg, rgba(0,0,0,0.05)); color: var(--agent-text-muted); }
        .aw-link { appearance: none; background: none; border: none; cursor: pointer; font-size: 12.5px; color: var(--agent-coral-ink, #BE3C1C); font-weight: 700; margin-top: 10px; padding: 0; }
        .aw-link:hover { text-decoration: underline; }

        .aw-branding-intro { margin-bottom: 18px; }
        .aw-branding-intro h4 { margin: 0 0 6px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--agent-text-muted); }
        .aw-branding-intro p { margin: 0; font-size: 13px; color: var(--agent-text-secondary); line-height: 1.6; max-width: 72ch; }
        .aw-note { font-size: 11px; color: var(--agent-text-muted); margin: 10px 0 0; }

        .aw-accesstxt { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--agent-text-secondary); line-height: 1.6; margin: 0; }
        .aw-ok { color: var(--agent-coral-deep, #E2452A); flex-shrink: 0; margin-top: 1px; display: inline-flex; }
        .aw-access-actions { margin-top: 14px; display: flex; gap: 9px; flex-wrap: wrap; }
        .aw-can { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
        .aw-can li { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: var(--agent-text-secondary); line-height: 1.5; }
        .aw-can li svg { color: var(--agent-coral-deep, #E2452A); flex-shrink: 0; margin-top: 1px; }

        /* Inline rename (pending clients only) */
        .aw-name { display: inline-flex; align-items: center; gap: 9px; }
        .aw-nameedit-btn { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; border: 1px solid var(--agent-border-subtle); background: var(--agent-surface, transparent); color: var(--agent-text-muted); cursor: pointer; opacity: 0; transform: translateY(1px); transition: opacity .15s, color .15s, border-color .15s; }
        .aw-who:hover .aw-nameedit-btn, .aw-nameedit-btn:focus-visible { opacity: 1; }
        .aw-nameedit-btn:hover { color: var(--agent-coral-deep, #E2452A); border-color: var(--agent-coral); }
        .aw-nameedit { display: flex; align-items: center; gap: 7px; margin: 0 0 3px; }
        .aw-nameinput { font-size: clamp(20px, 3.2vw, 26px); font-weight: 820; letter-spacing: -0.02em; color: var(--agent-text-primary); background: var(--agent-surface, #fff); border: 1px solid var(--agent-coral); border-radius: 10px; padding: 3px 10px; max-width: 420px; outline: none; font-family: inherit; }
        .aw-nameinput:disabled { opacity: 0.6; }
        .aw-namebtn { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--agent-border-subtle); background: var(--agent-surface, transparent); color: var(--agent-text-muted); cursor: pointer; transition: color .15s, border-color .15s, background .15s; }
        .aw-namebtn:hover:not(:disabled) { color: var(--agent-text-primary); border-color: var(--agent-border-strong, rgba(0,0,0,0.2)); }
        .aw-namebtn.save { color: #fff; background: var(--agent-coral-deep, #E2452A); border-color: transparent; }
        .aw-namebtn.save:hover:not(:disabled) { background: var(--agent-coral, #FF6B4A); color: #fff; }
        .aw-namebtn:disabled { opacity: 0.55; cursor: default; }

        /* Remove client (Access tab footer) */
        .aw-removezone { margin-top: 16px; }
        .aw-removerow { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 15px 17px; border-radius: 14px; border: 1px solid var(--agent-border-subtle); background: var(--agent-glass-bg, rgba(255,255,255,0.5)); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); transition: border-color .18s; }
        .aw-removerow.confirm { border-color: rgba(190,60,28,0.4); background: rgba(190,60,28,0.05); }
        .aw-removetxt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .aw-removetxt .t { font-size: 13.5px; font-weight: 750; color: var(--agent-text-primary); }
        .aw-removetxt .d { font-size: 12px; color: var(--agent-text-muted); line-height: 1.5; max-width: 64ch; }
        .aw-removeactions { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
        .aw-removebtn { font-family: inherit; font-size: 12.5px; font-weight: 700; padding: 8px 15px; border-radius: 10px; border: 1px solid var(--agent-border-strong, rgba(0,0,0,0.16)); background: var(--agent-surface, transparent); color: var(--agent-coral-ink, #BE3C1C); cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: background .15s, border-color .15s, color .15s; }
        .aw-removebtn:hover:not(:disabled) { border-color: var(--agent-coral-ink, #BE3C1C); background: rgba(190,60,28,0.06); }
        .aw-removebtn.danger { background: var(--agent-coral-ink, #BE3C1C); color: #fff; border-color: transparent; }
        .aw-removebtn.danger:hover:not(:disabled) { background: #a3300f; }
        .aw-removebtn:disabled { opacity: 0.55; cursor: default; }

        @media (prefers-reduced-motion: reduce) { .aw-panel { animation: none; } .aw-meter i { transition: none; } .aw-nameedit-btn, .aw-namebtn, .aw-removerow, .aw-removebtn { transition: none; } }
      `}</style>
    </div>
  );
}

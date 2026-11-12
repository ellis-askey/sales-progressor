"use client";

// Solicitor-firm PROFILE (Phase B visual refinement). A crafted, typographic
// continuation of the Partners page: an unboxed masthead (name-led, no icon
// tile), a number-first performance strip, subtly-elevated content cards with
// primary content weighted over the right rail, and a dedicated mobile header.
// Visual only — same data, actions, referral-income gating and permissions.
// Performance timings/trend, the activity feed, the firm note and per-person
// roles remain Phase-C data; their seams are kept in place.

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CaretLeft, Phone, EnvelopeSimple, Plus, Check,
  ClockCountdown, ChartLineUp, NotePencil, UserPlus, X,
} from "@phosphor-icons/react";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { PartnerPopup } from "@/components/agent/partners/PartnerPopup";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { extractFirstName } from "@/lib/contacts/displayName";
import type { FirmContactRow, FirmFileRow } from "@/lib/services/solicitors";

// ── Props ───────────────────────────────────────────────────────────────────
export type SolicitorProfileProps = {
  firmId: string;
  firmName: string;
  contacts: FirmContactRow[];
  files: FirmFileRow[];
  exchange: { avgDaysToExchange: number | null; exchangeCount: number } | null;
  // Referral income (director / admin only; null otherwise). Figures + gate are
  // resolved server-side — the view just renders what it's given.
  income: { receivedPence: number; pendingPence: number } | null;
  recommendedStatus: "recommended" | "not_recommended" | null;
  canAddContact: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}
function fmtGBP(pence: number): string {
  const p = pence / 100;
  if (p >= 1_000_000) return `£${(p / 1_000_000).toFixed(2)}m`;
  return `£${Math.round(p).toLocaleString("en-GB")}`;
}
function sinceAgreed(createdAt: string | Date): string {
  const days = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000));
  if (days === 0) return "Agreed today";
  if (days === 1) return "1 day since agreed";
  return `${days} days since agreed`;
}
const ROLE_LABEL: Record<FirmFileRow["role"], string> = { vendor: "Seller's solicitor", purchaser: "Buyer's solicitor", both: "Both sides" };
const STATUS_PILL: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "sp-pill-active" },
  on_hold:   { label: "On hold",   cls: "sp-pill-hold" },
  completed: { label: "Completed", cls: "sp-pill-done" },
  withdrawn: { label: "Withdrawn", cls: "sp-pill-muted" },
};
function statusPill(status: string) {
  return STATUS_PILL[status] ?? { label: status.replace(/_/g, " "), cls: "sp-pill-muted" };
}

// ── Component ───────────────────────────────────────────────────────────────
export function SolicitorProfileView(props: SolicitorProfileProps) {
  const { firmId, firmName, contacts, files, exchange, income, recommendedStatus, canAddContact } = props;
  const router = useRouter();

  const activeFiles = useMemo(() => files.filter((f) => f.status === "active" || f.status === "on_hold"), [files]);
  const completedFiles = useMemo(() => files.filter((f) => f.status === "completed"), [files]);
  const exchangeCount = exchange?.exchangeCount ?? 0;
  const avgDays = exchange?.avgDaysToExchange ?? null;

  const [tab, setTab] = useState<"active" | "completed">("active");
  const shownFiles = tab === "active" ? activeFiles : completedFiles;
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="sp-wrap">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <Link href="/agent/partners" className="sp-back"><CaretLeft size={13} weight="bold" /> Partners</Link>

      {/* ── Masthead (unboxed, typographic) ─────────────────────────────── */}
      <header className="sp-mast">
        <h1 className="sp-name">{firmName}</h1>
        <p className="sp-mast-sub">
          <span>Conveyancing firm</span>
          {recommendedStatus && (
            <span className={"sp-recmark " + (recommendedStatus === "recommended" ? "on" : "off")}>
              <span className="sp-recdot" />{recommendedStatus === "recommended" ? "Recommended" : "Not recommended"}
            </span>
          )}
        </p>

        <div className="sp-mast-detail">
          <div className="sp-counts">
            <span className="sp-count"><b>{contacts.length}</b>{contacts.length === 1 ? " contact" : " contacts"}</span>
            <span className="sp-count"><b>{activeFiles.length}</b> active {activeFiles.length === 1 ? "file" : "files"}</span>
            <span className="sp-count"><b>{exchangeCount}</b> {exchangeCount === 1 ? "exchange" : "exchanges"}</span>
          </div>
        </div>

        {canAddContact && (
          <button type="button" className="sp-mast-action sp-btn sp-btn-primary" onClick={() => setAddOpen(true)}>
            <Plus size={15} weight="bold" /> Add contact
          </button>
        )}
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="sp-cols">
        <div className="sp-main">

          {/* Transaction performance — number-first strip */}
          <section className="sp-card agent-glass">
            <div className="sp-cardhead">
              <div>
                <h2 className="sp-cardtitle">Transaction performance</h2>
                <p className="sp-cardsub">Average timings for sales involving this firm</p>
              </div>
            </div>
            <div className="sp-metrics">
              <Metric
                value={avgDays != null ? String(avgDays) : "—"}
                unit={avgDays != null ? "days" : undefined}
                label="Time to exchange"
                sub={exchangeCount > 0 ? `over ${exchangeCount} exchange${exchangeCount === 1 ? "" : "s"}` : "No exchanges yet"}
                empty={avgDays == null}
              />
              <Metric value="—" label="Time to draft pack" sub="Instruction → issued" empty />
              <Metric value="—" label="Enquiries turnaround" sub="Raised → satisfied" empty />
              <Metric value="—" label="Exchange rate" sub="Exchanged ÷ resolved" empty />
            </div>
          </section>

          {/* Timings + trend — Phase C data */}
          <div className="sp-two">
            <SeamCard icon={<ClockCountdown size={17} weight="regular" />} title="Transaction timings" note="Stage-by-stage timings land with the performance metrics." />
            <SeamCard icon={<ChartLineUp size={17} weight="regular" />} title="Exchange time trend" note="Average exchange time over recent months." />
          </div>

          {/* Associated sales */}
          <section className="sp-card agent-glass">
            <div className="sp-cardhead">
              <div>
                <h2 className="sp-cardtitle">Associated sales</h2>
                <p className="sp-cardsub">Sales worked on with this firm</p>
              </div>
              <div className="sp-seg" role="tablist" aria-label="File status">
                <button role="tab" aria-selected={tab === "active"} className={"sp-segbtn" + (tab === "active" ? " on" : "")} onClick={() => setTab("active")}>Active {activeFiles.length > 0 && <span className="sp-segn">{activeFiles.length}</span>}</button>
                <button role="tab" aria-selected={tab === "completed"} className={"sp-segbtn" + (tab === "completed" ? " on" : "")} onClick={() => setTab("completed")}>Completed {completedFiles.length > 0 && <span className="sp-segn">{completedFiles.length}</span>}</button>
              </div>
            </div>
            {shownFiles.length === 0 ? (
              <div className="sp-empty">No {tab} sales with this firm{tab === "active" ? " right now" : " yet"}.</div>
            ) : (
              <div className="sp-filelist">
                {shownFiles.map((f) => {
                  const pill = statusPill(f.status);
                  return (
                    <Link key={f.id} href={`/agent/transactions/${f.id}`} className="sp-filerow">
                      <PropertyThumb photoUrl={f.photoUrl} size={46} />
                      <div className="sp-fileinfo">
                        <p className="sp-fileaddr">{f.propertyAddress}</p>
                        <div className="sp-filemeta">
                          <span>{ROLE_LABEL[f.role]}</span>
                          {f.conveyancerName && <><span className="sp-mdot">·</span><span>{f.conveyancerName}</span></>}
                          {f.isReferral && <><span className="sp-mdot">·</span><span className="sp-ref">Referral</span></>}
                        </div>
                      </div>
                      <div className="sp-fileright">
                        <span className={"sp-pill " + pill.cls}>{pill.label}</span>
                        <span className="sp-filesince">{sinceAgreed(f.createdAt)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ── Right rail ──────────────────────────────────────────────── */}
        <div className="sp-side">

          {/* People at this firm */}
          <section className="sp-card agent-glass">
            <div className="sp-cardhead">
              <div>
                <h2 className="sp-cardtitle">People at this firm</h2>
                <p className="sp-cardsub">Contacts and their associated sales</p>
              </div>
              {canAddContact && (
                <button type="button" className="sp-ghostbtn" onClick={() => setAddOpen(true)}><UserPlus size={14} weight="bold" /> Add</button>
              )}
            </div>
            {contacts.length === 0 ? (
              <div className="sp-empty">No contacts recorded for this firm yet.</div>
            ) : (
              <div className="sp-people">
                {contacts.map((c) => (
                  <div key={c.id} className="sp-person">
                    <span className="sp-avatar">{c.image ? <img src={c.image} alt="" /> : <span>{initials(c.name)}</span>}</span>
                    <div className="sp-personbody">
                      <div className="sp-personhead">
                        <p className="sp-personname">{c.name}</p>
                        <span className="sp-personcount">{c.activeFileCount} active</span>
                      </div>
                      {(c.email || c.phone) && (
                        <div className="sp-personlinks">
                          {c.email && <a href={`mailto:${c.email}`} className="sp-personlink sp-link" title={c.email}><EnvelopeSimple size={12} weight="regular" /><span>{c.email}</span></a>}
                          {c.phone && <a href={`tel:${c.phone}`} className="sp-personlink" title={c.phone}><Phone size={12} weight="regular" /><span>{c.phone}</span></a>}
                        </div>
                      )}
                      {c.secondaryEmail && <p className="sp-personcc">cc {c.secondaryEmail}</p>}
                      {!c.email && !c.phone && !c.secondaryEmail && <p className="sp-personcc sp-personcc-none">No contact details</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Referral income — director / admin only (gated server-side) */}
          {income && (
            <section className="sp-card sp-income agent-glass">
              <p className="sp-cardtitle">Referral income</p>
              <p className="sp-income-main">{fmtGBP(income.receivedPence)}<span> received in</span></p>
              {income.pendingPence > 0 && <p className="sp-income-sub">{fmtGBP(income.pendingPence)} still due</p>}
            </section>
          )}

          {/* Recent activity + firm note — Phase C */}
          <SeamCard icon={<ClockCountdown size={17} weight="regular" />} title="Recent activity" note="Latest emails, calls and updates across this firm's sales." />
          <SeamCard icon={<NotePencil size={17} weight="regular" />} title="Firm note (internal only)" note="A private note about this firm, visible only to your team." />
        </div>
      </div>

      {addOpen && (
        <AddContactPopup firmId={firmId} firmName={firmName} onClose={() => setAddOpen(false)} onAdded={() => { setAddOpen(false); router.refresh(); }} />
      )}
    </div>
  );
}

// ── Metric (number-first) ───────────────────────────────────────────────────
function Metric({ value, unit, label, sub, empty }: { value: string; unit?: string; label: string; sub?: string; empty?: boolean }) {
  return (
    <div className="sp-metric">
      <p className={"sp-metricval" + (empty ? " sp-metricval-empty" : "")}>
        {value}{unit && <span className="sp-metricunit">{unit}</span>}
      </p>
      <p className="sp-metriclabel">{label}</p>
      {sub && <p className="sp-metricsub">{sub}</p>}
    </div>
  );
}

// ── Phase-C seam card (compact) ─────────────────────────────────────────────
function SeamCard({ icon, title, note }: { icon: React.ReactNode; title: string; note: string }) {
  return (
    <section className="sp-card sp-seam agent-glass">
      <span className="sp-seam-icon">{icon}</span>
      <div style={{ minWidth: 0 }}>
        <h2 className="sp-cardtitle">{title}</h2>
        <p className="sp-seam-note">{note}</p>
      </div>
    </section>
  );
}

// ── Add contact ────────────────────────────────────────────────────────────────
function AddContactPopup({ firmId, firmName, onClose, onAdded }: { firmId: string; firmName: string; onClose: () => void; onAdded: () => void }) {
  const { toast } = useAgentToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/solicitor-firms/${firmId}/handlers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Couldn't add that contact.");
        setSaving(false);
        return;
      }
      toast.success(`${extractFirstName(name.trim())} added to ${firmName}`);
      onAdded();
    } catch {
      toast.error("Couldn't add that contact. Try again.");
      setSaving(false);
    }
  }

  return (
    <PartnerPopup open onClose={onClose} title="Add contact" subtitle={firmName} ariaLabel="Add a contact to this firm">
      <div className="sp-form">
        <label className="sp-field"><span>Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sarah Jenkins" /></label>
        <label className="sp-field"><span>Email <em>(optional)</em></span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firm.co.uk" /></label>
        <label className="sp-field"><span>Phone <em>(optional)</em></span><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0117 970 0000" /></label>
        <div className="sp-formfoot">
          <button type="button" className="sp-ghostbtn" onClick={onClose}><X size={14} weight="bold" /> Cancel</button>
          <button type="button" className="sp-btn sp-btn-primary" disabled={!name.trim() || saving} onClick={save}>
            {saving ? "Adding…" : <><Check size={14} weight="bold" /> Add contact</>}
          </button>
        </div>
      </div>
    </PartnerPopup>
  );
}

// ── Scoped styles ──────────────────────────────────────────────────────────────
const CSS = `
.sp-wrap { max-width: 1180px; margin: 0 auto; padding: 18px 20px 80px; }
@media (min-width: 768px) { .sp-wrap { padding: 24px 28px 96px; } }
.sp-back { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--agent-text-muted); text-decoration: none; }
.sp-back:hover { color: var(--agent-text-secondary); }

/* ── Masthead (unboxed) ── */
.sp-mast { position: relative; margin: 18px 0 22px; }
.sp-name { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.08; color: var(--agent-text-primary); text-wrap: balance; padding-right: 150px; }
.sp-mast-sub { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 8px 0 0; font-size: 13.5px; color: var(--agent-text-muted); }
.sp-recmark { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; }
.sp-recmark.on { color: var(--agent-text-secondary); }
.sp-recmark.off { color: var(--agent-text-muted); }
.sp-recdot { width: 6px; height: 6px; border-radius: 999px; flex-shrink: 0; }
.sp-recmark.on .sp-recdot { background: var(--agent-success); box-shadow: 0 0 0 3px var(--agent-success-bg); }
.sp-recmark.off .sp-recdot { background: var(--agent-text-tertiary); }

.sp-mast-detail { display: flex; align-items: center; justify-content: space-between; gap: 18px; flex-wrap: wrap; margin-top: 16px; }
.sp-counts { display: flex; align-items: center; }
.sp-count { font-size: 13.5px; color: var(--agent-text-secondary); white-space: nowrap; }
.sp-count b { font-weight: 700; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
.sp-count + .sp-count { margin-left: 16px; padding-left: 16px; border-left: 1px solid var(--agent-border-subtle); }
.sp-mast-action { position: absolute; top: 2px; right: 0; }

@media (max-width: 640px) {
  .sp-name { font-size: 25px; padding-right: 0; }
  .sp-mast-detail { flex-direction: column; align-items: flex-start; gap: 13px; }
  .sp-mast-action { position: static; width: 100%; justify-content: center; margin-top: 16px; }
}

/* ── Buttons ── */
.sp-btn { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; padding: 9px 15px; border-radius: 10px; border: 1px solid transparent; transition: filter .14s, background .14s, border-color .14s; white-space: nowrap; }
.sp-btn-primary { color: #fff; background: var(--agent-coral-deep); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), 0 1px 2px rgba(var(--agent-shadow-rgb),.2); }
.sp-btn-primary:hover { background: var(--agent-coral); }
.sp-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.sp-ghostbtn { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12.5px; font-weight: 600; cursor: pointer; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--agent-border-default); background: transparent; color: var(--agent-text-secondary); transition: border-color .14s, color .14s; }
.sp-ghostbtn:hover { border-color: var(--agent-coral); color: var(--agent-coral-deep); }

/* ── Cards ── surface/elevation/light-dark come from .agent-glass (the app's
   glass system, same as the Partners list); this only owns radius + padding. */
.sp-card { border-radius: 14px; padding: 18px 20px; }
.sp-cardhead { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 15px; flex-wrap: wrap; }
.sp-cardtitle { margin: 0; font-size: 14.5px; font-weight: 650; color: var(--agent-text-primary); letter-spacing: -0.01em; }
.sp-cardsub { margin: 3px 0 0; font-size: 12px; color: var(--agent-text-muted); }

/* ── Columns: primary wider + weighted, right rail quieter ── */
.sp-cols { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 1000px) { .sp-cols { grid-template-columns: minmax(0, 1.9fr) minmax(0, 1fr); align-items: start; } }
.sp-main, .sp-side { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.sp-two { display: grid; grid-template-columns: 1fr; gap: 16px; }
@media (min-width: 640px) { .sp-two { grid-template-columns: 1fr 1fr; } }

/* ── Performance strip (number-first, hairline dividers) ── */
.sp-metrics { display: grid; grid-template-columns: 1fr 1fr; }
@media (min-width: 620px) { .sp-metrics { grid-template-columns: repeat(4, 1fr); } }
.sp-metric { padding: 10px 16px; }
.sp-metric:nth-child(even) { border-left: 1px solid var(--agent-border-subtle); }
.sp-metric:nth-child(n+3) { border-top: 1px solid var(--agent-border-subtle); margin-top: 4px; padding-top: 16px; }
@media (min-width: 620px) {
  .sp-metric { padding: 2px 20px; }
  .sp-metric:nth-child(n+3) { border-top: 0; margin-top: 0; padding-top: 2px; }
  .sp-metric:nth-child(even), .sp-metric:nth-child(odd) { border-left: 1px solid var(--agent-border-subtle); }
  .sp-metric:first-child { border-left: 0; padding-left: 0; }
}
.sp-metricval { margin: 0; font-size: 29px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: var(--agent-text-primary); font-variant-numeric: tabular-nums; }
.sp-metricval-empty { color: var(--agent-text-tertiary); font-weight: 600; }
.sp-metricunit { font-size: 13px; font-weight: 600; color: var(--agent-text-muted); letter-spacing: 0; margin-left: 4px; }
.sp-metriclabel { margin: 7px 0 0; font-size: 12.5px; font-weight: 600; color: var(--agent-text-secondary); }
.sp-metricsub { margin: 2px 0 0; font-size: 11px; color: var(--agent-text-muted); font-variant-numeric: tabular-nums; }

/* ── Segmented tabs ── */
.sp-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 9px; background: var(--agent-surface-nested, rgba(15,23,42,.045)); }
.sp-segbtn { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; font: inherit; font-size: 12px; font-weight: 600; color: var(--agent-text-muted); padding: 5px 11px; border-radius: 7px; cursor: pointer; white-space: nowrap; transition: color .14s, background .14s; }
.sp-segbtn.on { color: var(--agent-text-primary); background: var(--agent-surface-elevated); box-shadow: 0 1px 2px rgba(var(--agent-shadow-rgb),.08); }
.sp-segbtn:hover:not(.on) { color: var(--agent-text-secondary); }
.sp-segn { font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 99px; background: var(--agent-border-subtle); color: var(--agent-text-secondary); font-variant-numeric: tabular-nums; }
.sp-segbtn.on .sp-segn { background: rgba(var(--agent-coral-rgb),.14); color: var(--agent-coral-deep); }

/* ── File rows ── */
.sp-filelist { display: flex; flex-direction: column; margin: 0 -6px; }
.sp-filerow { display: flex; align-items: center; gap: 13px; padding: 11px 10px; text-decoration: none; border-radius: 10px; transition: background .12s; }
.sp-filerow + .sp-filerow { border-top: 1px solid var(--agent-border-subtle); border-radius: 0; }
.sp-filerow:hover { background: var(--agent-hover-shade, rgba(0,0,0,.028)); border-radius: 10px; }
.sp-filerow:hover + .sp-filerow { border-top-color: transparent; }
.sp-fileinfo { min-width: 0; flex: 1; }
.sp-fileaddr { margin: 0; font-size: 14px; font-weight: 600; color: var(--agent-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.01em; }
.sp-filemeta { display: flex; align-items: center; gap: 6px; margin-top: 3px; font-size: 11.5px; color: var(--agent-text-muted); flex-wrap: wrap; }
.sp-mdot { color: var(--agent-text-tertiary); }
.sp-ref { color: #b45309; font-weight: 600; }
.sp-fileright { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.sp-filesince { font-size: 11px; color: var(--agent-text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.sp-pill { font-size: 10.5px; font-weight: 600; padding: 2px 9px; border-radius: 6px; white-space: nowrap; letter-spacing: 0.01em; }
.sp-pill-active { color: var(--agent-info, #2f74e0); background: rgba(47,116,224,.09); }
.sp-pill-hold { color: var(--agent-warning); background: var(--agent-warning-bg); }
.sp-pill-done { color: var(--agent-success); background: var(--agent-success-bg); }
.sp-pill-muted { color: var(--agent-text-muted); background: var(--agent-surface-nested, rgba(15,23,42,.05)); }

/* ── People ── */
.sp-people { display: flex; flex-direction: column; }
.sp-person { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; }
.sp-person + .sp-person { border-top: 1px solid var(--agent-border-subtle); }
.sp-avatar { width: 40px; height: 40px; border-radius: 999px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: var(--agent-surface-nested, rgba(47,116,224,.09)); color: var(--agent-text-secondary); font-size: 13px; font-weight: 700; }
.sp-avatar img { width: 100%; height: 100%; object-fit: cover; }
.sp-personbody { min-width: 0; flex: 1; }
.sp-personhead { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.sp-personname { margin: 0; font-size: 13.5px; font-weight: 600; color: var(--agent-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-personcount { font-size: 11.5px; color: var(--agent-text-muted); white-space: nowrap; flex-shrink: 0; font-variant-numeric: tabular-nums; }
.sp-personlinks { display: flex; flex-direction: column; gap: 3px; margin-top: 5px; }
.sp-personlink { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: var(--agent-text-secondary); text-decoration: none; max-width: 100%; }
.sp-personlink svg { color: var(--agent-text-muted); flex-shrink: 0; }
.sp-personlink > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-personlink.sp-link { color: var(--agent-info, #2f74e0); }
.sp-personlink:hover > span { text-decoration: underline; }
.sp-personcc { margin: 5px 0 0; font-size: 11px; color: var(--agent-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sp-personcc-none { font-style: italic; color: var(--agent-text-tertiary); }

/* ── Referral income ── */
.sp-income-main { margin: 10px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -0.03em; color: var(--agent-success); font-variant-numeric: tabular-nums; line-height: 1; }
.sp-income-main span { font-size: 12px; font-weight: 500; color: var(--agent-text-muted); letter-spacing: 0; }
.sp-income-sub { margin: 5px 0 0; font-size: 12px; color: var(--agent-text-muted); }

/* ── Empty / seam ── */
.sp-empty { padding: 22px 10px; text-align: center; font-size: 12.5px; color: var(--agent-text-muted); }
.sp-seam { display: flex; align-items: center; gap: 13px; padding: 15px 18px; }
.sp-seam-icon { width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: var(--agent-surface-nested, rgba(15,23,42,.05)); color: var(--agent-text-muted); }
.sp-seam-note { margin: 3px 0 0; font-size: 12px; color: var(--agent-text-muted); line-height: 1.4; }

/* ── Add-contact form ── */
.sp-form { display: flex; flex-direction: column; gap: 13px; padding: 2px; }
.sp-field { display: flex; flex-direction: column; gap: 5px; }
.sp-field > span { font-size: 12px; font-weight: 600; color: var(--agent-text-secondary); }
.sp-field em { font-style: normal; font-weight: 400; color: var(--agent-text-muted); }
.sp-field input { font: inherit; font-size: 13.5px; padding: 9px 12px; border-radius: 10px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-elevated); color: var(--agent-text-primary); outline: none; transition: border-color .14s; }
.sp-field input:focus { border-color: var(--agent-coral-deep); }
.sp-formfoot { display: flex; justify-content: flex-end; gap: 9px; margin-top: 4px; }
`;

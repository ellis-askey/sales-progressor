"use client";

// BrokersSection — the referral brokers (buyer's mortgage broker + the seller's
// onward-purchase broker) rendered in the same roster style as SolicitorSection,
// so the Professionals tab reads consistently: a "Brokers (X)" header + hairline
// divider, then flush people-item rows with avatar / firm / side pill / comms /
// expand / edit. Replaces the old standalone "MORTGAGE BROKER" glass band.
// 2026-10-30. All commercial logic (fee gating, add gates, save payloads) is
// carried over from the former BrokerSection unchanged.

import { useState, useTransition } from "react";
import { Phone, ChatCircleText, EnvelopeSimple, PencilSimple } from "@phosphor-icons/react";
import { BrokerPicker, type BrokerSelection } from "@/components/brokers/BrokerPicker";
import { saveBrokerReferralAction } from "@/app/actions/transactions";
import { getAdvisorPortalLinkAction } from "@/app/actions/advisor-portal";
import { PriceInput } from "@/components/ui/PriceInput";
import { Checkbox } from "@/components/ui/Checkbox";
import { SavingPulse } from "@/components/ui/SavingPulse";
import { CommsButton } from "@/components/ui/CommsButton";
import { ContactAvatar } from "@/components/ui/Avatar";
import { useAgentToast } from "@/components/agent/AgentToaster";

export type BrokerSlot = {
  side: "purchaser" | "vendor";
  firmId: string | null;
  contactId: string | null;
  firmName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  referralFee: number | null;
  received: boolean;
  referred: boolean;
};

const COPY = {
  purchaser: {
    pill: "Purchaser",
    empty: "No purchaser broker yet",
    referredPill: "Purchaser referred to broker",
    addBlurb: "Add the purchaser's broker.",
    referredLabel: "Referred the purchaser to this broker",
  },
  vendor: {
    pill: "Vendor",
    empty: "No vendor broker yet",
    referredPill: "Vendor referred to broker",
    addBlurb: "Add the vendor's broker.",
    referredLabel: "Referred the vendor to this broker",
  },
} as const;

export function BrokersSection({
  transactionId,
  slots,
  canEditFee = true,
}: {
  transactionId: string;
  slots: BrokerSlot[];
  // Whether the viewer may see / edit the referral FEE (agency commercial
  // income). Agency / admin only; an external progressor attaches a broker but
  // never touches the fee. Mirrors the old BrokerSection prop.
  canEditFee?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  if (slots.length === 0) return null;

  const assignedCount = slots.filter((s) => s.firmId).length;

  return (
    <div style={{ overflow: "hidden" }}>
      {/* Header — mirrors SolicitorSection exactly (title + count pill, subtext,
          hairline divider) so Solicitors and Brokers read identically. */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--agent-border-default)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", margin: 0 }}>Brokers</h3>
            {assignedCount > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--agent-text-muted)", padding: "1px 7px", borderRadius: 10, background: "rgba(15,23,42,0.06)" }}>
                {assignedCount}
              </span>
            )}
            {saving && <SavingPulse />}
          </div>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>Brokers involved in this transaction</span>
        </div>
      </div>

      <div className="people-rows">
        {slots.map((slot) => (
          <BrokerTile
            key={slot.side}
            transactionId={transactionId}
            slot={slot}
            canEditFee={canEditFee}
            onSavingChange={setSaving}
          />
        ))}
      </div>
    </div>
  );
}

function BrokerTile({
  transactionId,
  slot,
  canEditFee,
  onSavingChange,
}: {
  transactionId: string;
  slot: BrokerSlot;
  canEditFee: boolean;
  onSavingChange: (v: boolean) => void;
}) {
  const [, startTransition] = useTransition();
  const { toast } = useAgentToast();
  const copy = COPY[slot.side];

  // Optimistic local copy of the broker identity + fee, so the row reflects
  // saves immediately without waiting for the server revalidation.
  const [firm, setFirm] = useState<{ id: string; name: string } | null>(
    slot.firmId ? { id: slot.firmId, name: slot.firmName ?? "" } : null,
  );
  const [contact, setContact] = useState<{ id: string | null; name: string | null; phone: string | null; email: string | null }>({
    id: slot.contactId, name: slot.contactName, phone: slot.phone, email: slot.email,
  });
  const [referred, setReferred] = useState(slot.referred);
  const [feePence, setFeePence] = useState<number | null>(slot.referralFee);
  const [received, setReceived] = useState(slot.received);
  const [feeDirty, setFeeDirty] = useState(false);

  const [editing, setEditing] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<BrokerSelection | null>(
    slot.firmId
      ? { firmId: slot.firmId, firmName: slot.firmName ?? "", contactId: slot.contactId, contactName: slot.contactName, phone: slot.phone, email: slot.email }
      : null,
  );

  function openEdit() { setEditing(true); setExiting(false); }
  function closeEdit() {
    setExiting(true);
    setTimeout(() => {
      setEditing(false);
      setExiting(false);
      setDraft(firm ? { firmId: firm.id, firmName: firm.name, contactId: contact.id, contactName: contact.name, phone: contact.phone, email: contact.email } : null);
    }, 150);
  }

  function persist(payload: Parameters<typeof saveBrokerReferralAction>[1], successMsg: string) {
    onSavingChange(true);
    startTransition(async () => {
      try {
        await saveBrokerReferralAction(transactionId, payload, slot.side);
        toast.success(successMsg);
      } catch {
        toast.error("Couldn't save. Try again.");
      } finally {
        onSavingChange(false);
      }
    });
  }

  function saveFee() {
    persist({
      brokerFirmId: firm?.id ?? null,
      brokerContactId: contact.id,
      brokerReferralFee: feePence,
      brokerReferralFeeReceived: received,
    }, "Saved");
    setFeeDirty(false);
  }

  function saveBroker() {
    if (!draft) return;
    setFirm({ id: draft.firmId, name: draft.firmName });
    setContact({ id: draft.contactId, name: draft.contactName, phone: draft.phone, email: draft.email });
    persist({
      brokerFirmId: draft.firmId,
      brokerContactId: draft.contactId,
      brokerReferralFee: feePence,
      brokerReferralFeeReceived: received,
      purchaserBrokerReferral: referred,
    }, "Broker saved");
    setExiting(true);
    setTimeout(() => { setEditing(false); setExiting(false); }, 150);
  }

  function removeBroker() {
    setFirm(null);
    setContact({ id: null, name: null, phone: null, email: null });
    setFeePence(null);
    setReceived(false);
    persist({
      brokerFirmId: null,
      brokerContactId: null,
      brokerReferralFee: null,
      brokerReferralFeeReceived: false,
    }, "Broker removed");
  }

  // Side colour for the role eyebrow above the firm name — seller blue, buyer green.
  const sideTint = slot.side === "vendor" ? "var(--agent-info)" : "var(--agent-success)";
  const emailHref = contact.email ? `mailto:${contact.email}` : null;
  const telHref = contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : undefined;
  const waHref = contact.phone ? `https://wa.me/${contact.phone.replace(/[^\d]/g, "")}` : undefined;

  // Empty row — no broker assigned yet. Matches the empty SolicitorTile.
  if (!firm && !editing && !exiting) {
    return (
      <div className="people-item">
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 14px" }}>
          <ContactAvatar contact={{ name: copy.pill, roleType: "broker" }} size={40} sideTint={slot.side} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: sideTint, lineHeight: 1.3, letterSpacing: "0.01em" }}>{copy.pill}</span>
            <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1, fontStyle: "italic" }}>
              {copy.empty}
            </div>
          </div>
          <button type="button" onClick={openEdit} className="agent-link" style={{ fontSize: 12, fontWeight: 500, flexShrink: 0 }}>
            + Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`people-item${editing || exiting ? "" : " agent-hover-row"}`}>
      {firm && !editing && !exiting && (
        <>
          <div className="people-row" style={{ padding: "10px 16px" }}>
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              className="people-row-main"
            >
              <ContactAvatar contact={{ name: firm.name, roleType: "broker" }} size={40} sideTint={slot.side} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: sideTint, lineHeight: 1.3, letterSpacing: "0.01em" }}>{copy.pill}</span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", marginTop: 1, lineHeight: 1.25 }}>{firm.name}</span>
                <div style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {contact.name ? contact.name : "No handler on file"}
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-expanded={expanded}
              aria-label={expanded ? `Hide details for ${firm.name}` : `Show details for ${firm.name}`}
              className="people-row-chevron"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 160ms ease" }}>
                <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="people-row-actions">
              <CommsButton compact href={telHref} label="Call" icon={<Phone size={15} weight="regular" />} disabled={!contact.phone} title={contact.phone ? "Call" : "No phone number on file"} />
              <CommsButton compact href={waHref} label="WhatsApp" icon={<ChatCircleText size={15} weight="regular" />} disabled={!contact.phone} title={contact.phone ? "WhatsApp" : "No phone number on file"} />
              <CommsButton compact href={emailHref ?? undefined} label="Email" icon={<EnvelopeSimple size={15} weight="regular" />} disabled={!contact.email} title={contact.email ? "Email" : "No email on file"} />
              {/* Change / remove an existing broker is an agency action — the
                  server blocks a progressor from editing a broker that's already
                  set (attach-only), so the pencil only shows when canEditFee. */}
              {canEditFee && (
                <button
                  type="button"
                  onClick={openEdit}
                  aria-label={`Edit ${slot.side} broker`}
                  title="Edit"
                  className="agent-chip-hover"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, border: "0.5px solid var(--agent-border-default)", background: "var(--agent-surface-elevated)", color: "var(--agent-text-muted)", cursor: "pointer", flexShrink: 0 }}
                >
                  <PencilSimple size={15} weight="regular" />
                </button>
              )}
            </div>
          </div>

          {/* Expanded detail — referred pill, advisor portal, fee controls. */}
          <div className={`agent-acc${expanded ? " open" : ""}`}>
            <div className="agent-acc-in">
              <div style={{ padding: "0 16px 14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {referred && (
                  <span style={{
                    alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 4,
                    fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 20,
                    color: "var(--agent-success)", background: "var(--agent-success-bg)", border: "1px solid var(--agent-success-border)",
                  }}>
                    {copy.referredPill}
                  </span>
                )}

                {contact.phone && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <Phone size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                    <a href={telHref} className="agent-link agent-link-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.phone}</a>
                  </div>
                )}
                {contact.email && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <EnvelopeSimple size={13} weight="regular" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
                    <a href={emailHref ?? undefined} className="agent-link agent-link-muted" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{contact.email}</a>
                  </div>
                )}

                {/* Buyer-side advisor portal link — lets an agent share the
                    broker's private progress view. Purchaser side only. */}
                {slot.side === "purchaser" && contact.id && <AdvisorPortalLink transactionId={transactionId} />}

                {/* Referral fee + received — agency commercial income. Hidden
                    from an external progressor (canEditFee false). */}
                {canEditFee && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2, borderTop: "0.5px solid var(--agent-border-subtle)" }}>
                    <div>
                      <label className="block text-xs font-semibold text-slate-900/40 uppercase tracking-wide mb-1.5" style={{ marginTop: 10 }}>
                        Referral fee
                      </label>
                      <PriceInput
                        value={feePence}
                        onChange={(p) => { setFeePence(p); setFeeDirty(true); }}
                        variant="referral"
                        placeholder="0"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-slate-900/70">Fee received</label>
                      <button
                        type="button"
                        onClick={() => { setReceived((v) => !v); setFeeDirty(true); }}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${received ? "bg-emerald-500" : "bg-slate-200"}`}
                        role="switch"
                        aria-checked={received}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${received ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    </div>
                    {feePence != null && feePence > 0 && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${received ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"}`}>
                        <span className="text-base">{received ? "✓" : "⏳"}</span>
                        <span>
                          £{(feePence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} broker referral
                          {received ? " received" : " pending"}
                        </span>
                      </div>
                    )}
                    {feeDirty && (
                      <button onClick={saveFee} className="self-start text-xs agent-link-primary font-medium">Save fee</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Edit form — pick a different broker firm / handler, or remove. The
          subtext names whose broker it is (no separate title); the Referred
          toggle and the actions share one row to keep the bottom tight. */}
      {(editing || exiting) && (
        <div
          className={exiting ? "agent-reveal-out" : "agent-reveal-in"}
          style={{ padding: "13px 16px 11px", display: "flex", flexDirection: "column", gap: 10 }}
        >
          <p style={{ fontSize: 11.5, color: "var(--agent-text-muted)", margin: "0 0 -5px", lineHeight: 1.45 }}>
            {firm ? copy.pill : copy.addBlurb}
          </p>
          <BrokerPicker label="" value={draft} onChange={setDraft} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", rowGap: 8 }}>
            <Checkbox checked={referred} onChange={setReferred} label={copy.referredLabel} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
              {firm && (
                <button
                  type="button"
                  onClick={() => { removeBroker(); closeEdit(); }}
                  className="agent-link"
                  style={{ fontSize: 11, color: "var(--agent-danger, #dc2626)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  Remove
                </button>
              )}
              <button type="button" onClick={closeEdit} className="agent-btn agent-btn-xs agent-btn-neutral">Cancel</button>
              <button type="button" onClick={saveBroker} disabled={!draft} className="agent-btn agent-btn-xs agent-btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "Copy advisor portal link" — mints the broker's private portal link on demand
// and copies it. Carried over from the former BrokerSection.
function AdvisorPortalLink({ transactionId }: { transactionId: string }) {
  const [state, setState] = useState<"idle" | "working" | "copied" | "error">("idle");

  async function copy() {
    setState("working");
    const res = await getAdvisorPortalLinkAction(transactionId);
    if (!res.ok) { setState("error"); return; }
    try {
      await navigator.clipboard.writeText(res.url);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      window.prompt("Advisor portal link", res.url);
      setState("idle");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={state === "working"}
      className="self-start text-xs agent-link-primary font-medium disabled:opacity-50"
    >
      {state === "copied" ? "Link copied" : state === "error" ? "Couldn't create link" : state === "working" ? "Creating…" : "Copy advisor portal link"}
    </button>
  );
}

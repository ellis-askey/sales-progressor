"use client";

// Housing association professional row — shared-ownership files only (2026-10-19).
// Lightweight: just the association name + one contact + email/phone, no firm
// directory or referral/chase machinery. Mirrors the broker/solicitor section
// shell so it sits naturally in the Professionals view. Rendered by OverviewPanel
// only when the file is marked shared ownership.

import { useState } from "react";
import { Buildings, Phone, EnvelopeSimple } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { saveHousingAssociationAction } from "@/app/actions/transactions";

export function HousingAssociationSection({
  transactionId, name, contactName, email, phone, canEdit = false,
}: {
  transactionId: string;
  name: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  canEdit?: boolean;
}) {
  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: name ?? "", contactName: contactName ?? "", email: email ?? "", phone: phone ?? "" });

  const hasAny = !!(name || contactName || email || phone);

  function openEdit() {
    setForm({ name: name ?? "", contactName: contactName ?? "", email: email ?? "", phone: phone ?? "" });
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await saveHousingAssociationAction(transactionId, form);
      toast.success(hasAny ? "Housing association updated" : "Housing association added");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">Housing association</h2>
        {canEdit && hasAny && (
          <button onClick={openEdit} className="text-xs agent-link-primary font-medium">Edit</button>
        )}
      </div>

      <GlassCard glassId="overview-housing-association" label="Overview · Housing association" defaultVariant="v22" className="px-5 py-4">
        {hasAny ? (
          <div className="flex items-start gap-3">
            <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--agent-coral) 10%, transparent)", color: "var(--agent-coral-deep)" }}>
              <Buildings size={18} weight="regular" />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="text-sm font-semibold text-slate-900/80">{name || "Housing association"}</p>
              {contactName && <p className="text-xs text-slate-900/50 mt-0.5">{contactName}</p>}
              {(email || phone) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 6 }}>
                  {email && (
                    <a href={`mailto:${email}`} className="agent-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <EnvelopeSimple size={13} /> {email}
                    </a>
                  )}
                  {phone && (
                    <a href={`tel:${phone}`} className="agent-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                      <Phone size={13} /> {phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : canEdit ? (
          <button
            type="button"
            onClick={openEdit}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--agent-coral-deep)", fontFamily: "inherit" }}
          >
            <Buildings size={16} weight="regular" /> Add the housing association
          </button>
        ) : (
          <p className="text-sm text-slate-900/40">No housing association on file yet.</p>
        )}
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} ariaLabel="Housing association" size="sm" zLayer="deep">
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            {hasAny ? "Edit housing association" : "Add housing association"}
          </h2>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <Field label="Housing association" value={form.name} placeholder="e.g. Peabody" onChange={(v) => setForm((f) => ({ ...f, name: v }))} autoFocus />
            <Field label="Contact name" value={form.contactName} placeholder="Who you deal with there" onChange={(v) => setForm((f) => ({ ...f, contactName: v }))} />
            <Field label="Email" value={form.email} placeholder="e.g. sales@peabody.org.uk" inputMode="email" onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            <Field label="Phone" value={form.phone} placeholder="e.g. 020 7021 4000" inputMode="tel" onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          </div>
        </Modal.Body>
        <Modal.Footer style={{ gap: 10 }}>
          <button type="button" onClick={() => setOpen(false)} className="agent-btn agent-btn-neutral agent-btn-md" disabled={saving}>Cancel</button>
          <button type="button" onClick={save} className="agent-btn agent-btn-color-primary agent-btn-md" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  );
}

function Field({ label, value, placeholder, onChange, autoFocus, inputMode }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void; autoFocus?: boolean; inputMode?: "email" | "tel";
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-900/65 mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value}
        autoFocus={autoFocus}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="glass-input agent-focus w-full px-3 py-2.5 text-sm"
      />
    </div>
  );
}

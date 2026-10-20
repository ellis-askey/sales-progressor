"use client";

// Other professionals on a file — the free-form "Add professional" area on the
// Professionals tab (surveyor, managing agent, anyone without a wired slot).
// Contact cards only: call/email links, edit, remove; nothing automated chases
// these people. Mirrors the HousingAssociationSection shell + Modal pattern so
// it sits naturally beside the solicitors and broker. Currently rendered
// superadmin-only (founder checking pass) — ungated by the parent, not here.

import { useState } from "react";
import { IdentificationBadge, Phone, EnvelopeSimple, PencilSimple } from "@phosphor-icons/react";
import { GlassCard } from "@/components/glass/GlassCard";
import { Modal } from "@/components/ui/Modal";
import { useAgentToast } from "@/components/agent/AgentToaster";
import {
  addProfessionalAction,
  updateProfessionalAction,
  removeProfessionalAction,
} from "@/app/actions/professionals";

export type ProfessionalRow = {
  id: string;
  name: string;
  firmName: string | null;
  role: string;
  email: string | null;
  phone: string | null;
};

const EMPTY = { name: "", role: "", firmName: "", email: "", phone: "" };

export function ProfessionalsList({
  transactionId,
  professionals,
}: {
  transactionId: string;
  professionals: ProfessionalRow[];
}) {
  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfessionalRow | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY);
    setConfirmRemove(false);
    setOpen(true);
  }
  function openEdit(p: ProfessionalRow) {
    setEditing(p);
    setForm({ name: p.name, role: p.role, firmName: p.firmName ?? "", email: p.email ?? "", phone: p.phone ?? "" });
    setConfirmRemove(false);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editing) {
        await updateProfessionalAction(transactionId, editing.id, form);
        toast.success(`${form.name.trim()} updated`);
      } else {
        await addProfessionalAction(transactionId, form);
        toast.success(`${form.name.trim()} added`);
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!confirmRemove) { setConfirmRemove(true); return; }
    setSaving(true);
    try {
      await removeProfessionalAction(transactionId, editing.id);
      toast.success(`${editing.name} removed`);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-900/40 uppercase tracking-wide">Other professionals</h2>
        {professionals.length > 0 && (
          <button onClick={openAdd} className="text-xs agent-link-primary font-medium">+ Add professional</button>
        )}
      </div>

      <GlassCard glassId="overview-professionals" label="Overview · Other professionals" defaultVariant="v22" className="px-5 py-4">
        {professionals.length === 0 ? (
          <button
            type="button"
            onClick={openAdd}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--agent-coral-deep)", fontFamily: "inherit" }}
          >
            <IdentificationBadge size={16} weight="regular" /> Add a professional
          </button>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {professionals.map((p) => (
              <div key={p.id} className="flex items-start gap-3">
                <span style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "color-mix(in srgb, var(--agent-coral) 10%, transparent)", color: "var(--agent-coral-deep)" }}>
                  <IdentificationBadge size={18} weight="regular" />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <p className="text-sm font-semibold text-slate-900/80" style={{ margin: 0 }}>{p.name}</p>
                    <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--agent-text-muted)", padding: "1px 7px", borderRadius: 8, background: "rgba(15,23,42,0.06)" }}>
                      {p.role}
                    </span>
                  </div>
                  {p.firmName && <p className="text-xs text-slate-900/50 mt-0.5" style={{ margin: "2px 0 0" }}>{p.firmName}</p>}
                  {(p.email || p.phone) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 6 }}>
                      {p.email && (
                        <a href={`mailto:${p.email}`} className="agent-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                          <EnvelopeSimple size={13} /> {p.email}
                        </a>
                      )}
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className="agent-link" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                          <Phone size={13} /> {p.phone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  className="agent-btn agent-btn-sm agent-btn-ghost-bordered"
                  style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px", flexShrink: 0 }}
                  aria-label={`Edit ${p.name}`}
                  title={`Edit ${p.name}`}
                >
                  <PencilSimple size={12} weight="regular" />
                </button>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} ariaLabel="Professional" size="sm" zLayer="deep">
        <Modal.Header>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>
            {editing ? "Edit professional" : "Add a professional"}
          </h2>
        </Modal.Header>
        <Modal.Body>
          <div className="space-y-4">
            <Field label="Name" value={form.name} placeholder="Who you deal with" onChange={(v) => setForm((f) => ({ ...f, name: v }))} autoFocus />
            <Field label="What they do" value={form.role} placeholder="e.g. Surveyor, Managing agent" onChange={(v) => setForm((f) => ({ ...f, role: v }))} />
            <Field label="Firm" value={form.firmName} placeholder="Company name (optional)" onChange={(v) => setForm((f) => ({ ...f, firmName: v }))} />
            <Field label="Email" value={form.email} placeholder="name@example.com" inputMode="email" onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
            <Field label="Phone" value={form.phone} placeholder="07700 900 000" inputMode="tel" onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          </div>
        </Modal.Body>
        <Modal.Footer style={{ gap: 10 }}>
          {editing && (
            <button
              type="button"
              onClick={remove}
              className="agent-btn agent-btn-ghost agent-btn-md"
              disabled={saving}
              style={{ marginRight: "auto", color: "var(--agent-danger)" }}
            >
              {confirmRemove ? "Tap again to remove" : "Remove"}
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} className="agent-btn agent-btn-neutral agent-btn-md" disabled={saving}>Cancel</button>
          <button type="button" onClick={save} className="agent-btn agent-btn-color-primary agent-btn-md" disabled={saving || !form.name.trim() || !form.role.trim()}>
            {saving ? "Saving…" : editing ? "Save" : "Add professional"}
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

"use client";

import { useState } from "react";
import { submitOutsourceLead } from "./actions";

export function OutsourceIntakeForm() {
  const [name, setName] = useState("");
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canSubmit = name.trim() && agency.trim() && email.trim() && propertyAddress.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    const res = await submitOutsourceLead({ name, agency, email, phone, propertyAddress, notes });
    setLoading(false);
    if (res.ok) setDone(true);
    else setError(res.error ?? "Something went wrong. Try again.");
  }

  if (done) {
    return (
      <div className="claim-form-card" style={{ textAlign: "center" }}>
        <h2 className="claim-sub-h1" style={{ marginBottom: 10 }}>Got it, thank you.</h2>
        <p className="claim-sub-p" style={{ margin: 0 }}>
          We&apos;ve received your sale and we&apos;ll be in touch shortly to get started. Nothing to pay unless it exchanges.
        </p>
      </div>
    );
  }

  return (
    <div className="claim-form-card">
      <h2 className="claim-sub-h1" style={{ marginBottom: 6 }}>Hand us your first file</h2>
      <p className="claim-sub-p">Takes a minute. We&apos;ll take it from there.</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="claim-field">
            <label className="claim-field-label">Your name</label>
            <input className="claim-field-input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Jane Smith" />
          </div>
          <div className="claim-field">
            <label className="claim-field-label">Agency</label>
            <input className="claim-field-input" value={agency} onChange={(e) => setAgency(e.target.value)} required autoComplete="organization" placeholder="Your estate agency" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="claim-field">
            <label className="claim-field-label">Email</label>
            <input className="claim-field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@youragency.co.uk" />
          </div>
          <div className="claim-field">
            <label className="claim-field-label">Phone <span style={{ color: "var(--claim-text-3)", fontWeight: 400 }}>(optional)</span></label>
            <input className="claim-field-input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07…" />
          </div>
        </div>

        <div className="claim-field">
          <label className="claim-field-label">The sale</label>
          <input className="claim-field-input" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} required placeholder="Property address of the agreed sale" />
        </div>

        <div className="claim-field">
          <label className="claim-field-label">Anything we should know? <span style={{ color: "var(--claim-text-3)", fontWeight: 400 }}>(optional)</span></label>
          <textarea className="claim-field-input" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ resize: "vertical", minHeight: 72 }} placeholder="Chain, target dates, anything useful" />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={!canSubmit || loading} className="claim-btn">
          {loading ? "Sending…" : "Send it over"}
        </button>
        <p className="claim-microcopy">No upfront cost. You pay £250 only when it exchanges.</p>
      </form>
    </div>
  );
}

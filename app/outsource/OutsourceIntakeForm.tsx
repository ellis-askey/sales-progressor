"use client";

import { useState, type CSSProperties } from "react";
import { submitOutsourceLead } from "./actions";
import { A } from "./ui";

const label: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: A.textSecondary, marginBottom: 6 };
const optional: CSSProperties = { color: A.textFaint, fontWeight: 400 };
const inputBase: CSSProperties = {
  width: "100%", padding: "11px 14px", fontSize: 16, color: A.textPrimary,
  background: A.inputBg, border: `1px solid ${A.inputBorder}`, borderRadius: 10,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

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
      <div style={{ textAlign: "center", padding: "12px 4px" }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: A.textPrimary }}>Got it, thank you.</h2>
        <p style={{ margin: 0, fontSize: 14, color: A.textSecondary, lineHeight: 1.6 }}>
          We&apos;ve received your sale and we&apos;ll be in touch shortly to get started. Nothing to pay unless it exchanges.
        </p>
      </div>
    );
  }

  return (
    <>
      <style>{`.os-input:focus{border-color:${A.coralDeep};box-shadow:0 0 0 3px rgba(255,107,74,0.12);}`}</style>
      <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 800, color: A.textPrimary, letterSpacing: "-0.02em" }}>Hand us your first file</h2>
      <p style={{ margin: "0 0 20px", fontSize: 14, color: A.textSecondary, lineHeight: 1.55 }}>Takes a minute. From there, it&apos;s ours to progress.</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Your name</label>
            <input className="os-input" style={inputBase} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="Jane Smith" />
          </div>
          <div>
            <label style={label}>Agency</label>
            <input className="os-input" style={inputBase} value={agency} onChange={(e) => setAgency(e.target.value)} required autoComplete="organization" placeholder="Your estate agency" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={label}>Email</label>
            <input className="os-input" style={inputBase} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@youragency.co.uk" />
          </div>
          <div>
            <label style={label}>Phone <span style={optional}>(optional)</span></label>
            <input className="os-input" style={inputBase} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="07…" />
          </div>
        </div>

        <div>
          <label style={label}>The sale</label>
          <input className="os-input" style={inputBase} value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} required placeholder="Property address of the agreed sale" />
        </div>

        <div>
          <label style={label}>Anything we should know? <span style={optional}>(optional)</span></label>
          <textarea className="os-input" style={{ ...inputBase, resize: "vertical", minHeight: 76 }} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Chain, target dates, anything useful" />
        </div>

        {error && (
          <div style={{ fontSize: 13, color: A.danger, background: A.dangerBg, border: `1px solid ${A.dangerBorder}`, borderRadius: 8, padding: "10px 14px" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          style={{
            padding: "14px 20px", borderRadius: 12, border: "none",
            background: A.coralGradient, color: "#fff", fontSize: 15, fontWeight: 700,
            cursor: canSubmit && !loading ? "pointer" : "not-allowed",
            opacity: canSubmit && !loading ? 1 : 0.55,
            boxShadow: "0 6px 20px rgba(255,107,74,0.25)", fontFamily: "inherit",
          }}
        >
          {loading ? "Sending…" : "Hand it over"}
        </button>
        <p style={{ margin: 0, fontSize: 12, color: A.textMuted, textAlign: "center" }}>£250 per sale. Nothing to pay unless it exchanges.</p>
      </form>
    </>
  );
}

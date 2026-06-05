"use client";

// components/account/v2/ProfileFormPlain.tsx
//
// Profile form re-housed for the Account/Profile tab. Same wiring as the
// original ProfileForm — calls updateProfileAction, dispatches the
// sp_onboarding_step event when phone is set, same dirty-check, same
// email-changed warning. Restyled for the clean Account register:
// no glass field chrome, no coral gradient save button, hairline borders
// and a flat primary button instead.
//
// Original at components/agent/ProfileForm.tsx remains in use by the
// legacy /agent/settings page until Stage 4 retire.

import { useState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { useAgentToast } from "@/components/agent/AgentToaster";

export function ProfileFormPlain({
  initialName,
  initialEmail,
  initialPhone,
  role,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  role: string;
}) {
  const { toast } = useAgentToast();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const emailChanged = email.trim().toLowerCase() !== initialEmail.toLowerCase();
  const dirty =
    name.trim() !== initialName ||
    email.trim().toLowerCase() !== initialEmail.toLowerCase() ||
    phone.trim() !== initialPhone;

  const isDirector = role === "director";

  async function handleSave() {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateProfileAction({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      toast.success(
        "Profile updated",
        emailChanged ? { description: "Sign out and back in for your new email to take effect." } : undefined,
      );
      if (phone.trim()) {
        window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasPhone: true } }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 13.5,
    color: "#111827",
    background: "#fff",
    border: "0.5px solid rgba(0,0,0,0.16)",
    borderRadius: 8,
    outline: "none",
    transition: "border-color 120ms, box-shadow 120ms",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: 500,
    marginBottom: 5,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <div>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+44 7700 000000"
            style={fieldStyle}
          />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "#374151",
            background: "#f3f4f6",
            border: "0.5px solid rgba(0,0,0,0.08)",
            borderRadius: 6,
          }}
        >
          {isDirector ? "Director" : "Negotiator"}
        </span>
        {!isDirector && (
          <span style={{ fontSize: 11.5, color: "#9ca3af" }}>
            Role changes are managed by your director.
          </span>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 12.5, color: "#dc2626" }}>{error}</p>
      )}

      {emailChanged && (
        <p
          style={{
            fontSize: 11.5,
            color: "#92400e",
            background: "#fef3c7",
            border: "0.5px solid #fde68a",
            borderRadius: 8,
            padding: "8px 12px",
            margin: 0,
          }}
        >
          Changing your email updates your login. You&apos;ll need to sign out and back in for it to take effect.
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty || !name.trim() || !email.trim()}
          style={{
            padding: "9px 18px",
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "var(--agent-coral, #FF6B4A)",
            border: "none",
            borderRadius: 8,
            cursor: saving || !dirty ? "default" : "pointer",
            opacity: saving || !dirty || !name.trim() || !email.trim() ? 0.45 : 1,
            transition: "opacity 150ms, filter 150ms",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

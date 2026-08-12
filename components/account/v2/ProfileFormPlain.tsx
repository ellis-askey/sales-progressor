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

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/app/actions/profile";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { UserAvatar } from "@/components/ui/Avatar";

export function ProfileFormPlain({
  initialName,
  initialEmail,
  initialPhone,
  initialImage = null,
  role,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialImage?: string | null;
  role: string;
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [image, setImage] = useState<string | null>(initialImage);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/agent/upload-avatar", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImage(data.url);
      toast.success("Photo updated");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

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
      {/* Profile photo — shown wherever your name appears (files, updates,
          notes, and to your clients in the portal). */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <UserAvatar user={{ name: name || initialName, image }} size={56} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            style={{
              alignSelf: "flex-start",
              padding: "7px 14px",
              fontSize: 12.5,
              fontWeight: 500,
              color: "#374151",
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.16)",
              borderRadius: 8,
              cursor: uploadingPhoto ? "default" : "pointer",
              opacity: uploadingPhoto ? 0.5 : 1,
            }}
          >
            {uploadingPhoto ? "Uploading…" : image ? "Change photo" : "Upload photo"}
          </button>
          <span style={{ fontSize: 11.5, color: "#9ca3af" }}>JPG, PNG or WEBP, up to 5 MB.</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoPick}
          style={{ display: "none" }}
        />
      </div>

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

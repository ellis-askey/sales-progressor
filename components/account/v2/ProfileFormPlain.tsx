"use client";

// components/account/v2/ProfileFormPlain.tsx
//
// Profile form for the Account/Profile tab. Self-cards (renders its own
// AccountCard) so the Save button can sit top-right of the card header on
// desktop and drop to the bottom on mobile. Same wiring as the original
// ProfileForm — updateProfileAction, sp_onboarding_step on phone, email-change
// warning. Identity block up top (avatar + live name + role + upload) doubles
// as a live preview: editing the Name field updates the name shown there.

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProfileAction } from "@/app/actions/profile";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { UserAvatar } from "@/components/ui/Avatar";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Camera, User } from "@phosphor-icons/react";
import { titleCaseKeepAcronyms, normalizePhone } from "@/lib/utils";

const MIN_NAME = 2;

export function ProfileFormPlain({
  initialName,
  initialEmail,
  initialPhone,
  initialJobTitle = "",
  initialDirectMobile = "",
  initialImage = null,
  role,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialJobTitle?: string;
  initialDirectMobile?: string;
  initialImage?: string | null;
  role: string;
}) {
  const { toast } = useAgentToast();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [jobTitle, setJobTitle] = useState(initialJobTitle);
  const [directMobile, setDirectMobile] = useState(initialDirectMobile);
  const [image, setImage] = useState<string | null>(initialImage);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isDirector = role === "director";

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

  async function handleRemovePhoto() {
    setRemovingPhoto(true);
    setError("");
    try {
      const res = await fetch("/api/agent/upload-avatar", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't remove that photo.");
      }
      setImage(null);
      toast.success("Photo removed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that photo.");
    } finally {
      setRemovingPhoto(false);
    }
  }

  const emailChanged = email.trim().toLowerCase() !== initialEmail.toLowerCase();
  const dirty =
    name.trim() !== initialName ||
    email.trim().toLowerCase() !== initialEmail.toLowerCase() ||
    phone.trim() !== initialPhone ||
    jobTitle.trim() !== initialJobTitle.trim() ||
    directMobile.trim() !== initialDirectMobile.trim();
  const nameTooShort = name.trim().length > 0 && name.trim().length < MIN_NAME;
  const disabledSave = saving || !dirty || name.trim().length < MIN_NAME || !email.trim();

  async function handleSave() {
    if (name.trim().length < MIN_NAME || !email.trim()) return;
    setSaving(true);
    setError("");
    try {
      await updateProfileAction({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        jobTitle: jobTitle.trim(),
        directMobile: directMobile.trim(),
      });
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

  const saveButton = (cls: string) => (
    <button
      type="button"
      onClick={handleSave}
      disabled={disabledSave}
      className={`account-btn-primary ${cls}`}
      style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: disabledSave ? "default" : "pointer" }}
    >
      {saving ? "Saving…" : "Save changes"}
    </button>
  );

  return (
    <AccountCard
      icon={<User size={20} weight="bold" />}
      title="Personal details"
      subtitle="Update your name, email and phone number."
      headerAction={saveButton("profile-save-desktop")}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Identity block — avatar + live name + role + upload. The name here
            mirrors the Name field below (editing it updates this live). */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div className="account-avatar-lift" data-lift={image ? "" : undefined}>
              {image ? (
                <UserAvatar user={{ name: name || initialName, image }} size={64} />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="account-avatar-btn"
                  aria-label="Upload photo"
                  style={{
                    position: "relative",
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    overflow: "hidden",
                    flexShrink: 0,
                    padding: 0,
                    border: "0.5px solid rgba(0,0,0,0.08)",
                    background: "rgba(255,107,74,0.10)",
                    cursor: uploadingPhoto ? "default" : "pointer",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/agent-avatar-fallback.png"
                    alt=""
                    aria-hidden
                    style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 32%", display: "block" }}
                  />
                  <span className="account-avatar-cam" aria-hidden>
                    <span className="account-avatar-cam-badge">
                      <Camera size={16} weight="fill" />
                    </span>
                  </span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleRemovePhoto}
              disabled={uploadingPhoto || removingPhoto}
              className="account-avatar-remove"
              data-show={image ? "" : undefined}
              tabIndex={image ? 0 : -1}
            >
              {removingPhoto ? "Removing…" : "Remove"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 16.5, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>
              {name.trim() || "Your name"}
            </span>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              {isDirector ? "Director" : "Negotiator"}
              {jobTitle.trim() ? ` · ${jobTitle.trim()}` : ""}
            </span>
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                title="JPG, PNG or WEBP"
                className="account-btn-secondary"
                style={{
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
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoPick}
            style={{ display: "none" }}
          />
        </div>

        <div className="profile-fields-grid">
          <div className="pf-name">
            <label style={labelStyle}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((n) => titleCaseKeepAcronyms(n))}
              placeholder="Your full name"
              className="account-input"
              style={fieldStyle}
            />
          </div>
          <div className="pf-job">
            <label style={labelStyle}>Job title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onBlur={() => setJobTitle((t) => titleCaseKeepAcronyms(t))}
              placeholder="e.g. Sales Manager"
              className="account-input"
              style={fieldStyle}
            />
          </div>
          <div className="pf-email">
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail((v) => v.trim().toLowerCase())}
              placeholder="your@email.com"
              className="account-input"
              style={fieldStyle}
            />
          </div>
          <div className="pf-phone">
            <label style={labelStyle}>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhone((p) => normalizePhone(p))}
              placeholder="+44 7700 000000"
              className="account-input"
              style={fieldStyle}
            />
          </div>
          <div className="pf-mobile">
            <label style={labelStyle}>Direct mobile</label>
            <input
              type="tel"
              value={directMobile}
              onChange={(e) => setDirectMobile(e.target.value)}
              onBlur={() => setDirectMobile((p) => normalizePhone(p))}
              placeholder="+44 7700 000000"
              className="account-input"
              style={fieldStyle}
            />
          </div>
        </div>

        {!isDirector && (
          <span style={{ fontSize: 11.5, color: "#9ca3af" }}>
            Role changes are managed by your director.
          </span>
        )}

        {nameTooShort && (
          <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>Your name needs at least {MIN_NAME} characters.</p>
        )}

        {error && <p style={{ margin: 0, fontSize: 12.5, color: "#dc2626" }}>{error}</p>}

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

        {/* Mobile-only Save (desktop Save lives in the card header). */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          {saveButton("profile-save-mobile")}
        </div>
      </div>

      <style>{`
        .account-avatar-cam {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .account-avatar-btn:hover .account-avatar-cam { transform: scale(1.16); }
        .account-avatar-cam-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.42); color: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        /* When a photo exists, the avatar lifts a touch and the Remove link
           fades in below it (and fades back out on removal). */
        .account-avatar-lift { transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1); }
        .account-avatar-lift[data-lift] { transform: translateY(-4px); }
        .account-avatar-remove {
          padding: 2px 4px; border: none; background: transparent;
          font-size: 11.5px; font-weight: 500; color: #6b7280; cursor: pointer;
          opacity: 0; max-height: 0; margin-top: 0; overflow: hidden; pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 220ms ease, max-height 260ms ease, margin-top 260ms ease, transform 260ms ease, color 150ms ease;
        }
        .account-avatar-remove[data-show] {
          opacity: 1; max-height: 22px; margin-top: 3px; transform: translateY(0); pointer-events: auto;
        }
        .account-avatar-remove:hover { color: #dc2626; }
        .profile-save-mobile { display: none; }
        @media (max-width: 640px) {
          .profile-save-desktop { display: none !important; }
          .profile-save-mobile { display: inline-flex !important; }
        }

        /* Never lopsided: 3 (name/job/email) + 2 stretched (phone/mobile) by
           default; all 5 in a row when wide; one column when narrow. */
        .profile-fields-grid { display: grid; gap: 12px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
        .profile-fields-grid .pf-name,
        .profile-fields-grid .pf-job,
        .profile-fields-grid .pf-email { grid-column: span 2; }
        .profile-fields-grid .pf-phone,
        .profile-fields-grid .pf-mobile { grid-column: span 3; }
        @media (min-width: 1200px) {
          .profile-fields-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
          .profile-fields-grid .pf-name,
          .profile-fields-grid .pf-job,
          .profile-fields-grid .pf-email,
          .profile-fields-grid .pf-phone,
          .profile-fields-grid .pf-mobile { grid-column: auto; }
        }
        @media (max-width: 640px) {
          .profile-fields-grid { grid-template-columns: 1fr; }
          .profile-fields-grid .pf-name,
          .profile-fields-grid .pf-job,
          .profile-fields-grid .pf-email,
          .profile-fields-grid .pf-phone,
          .profile-fields-grid .pf-mobile { grid-column: auto; }
        }

        @media (prefers-reduced-motion: reduce) {
          .account-avatar-cam, .account-avatar-lift, .account-avatar-remove { transition: none; }
        }
      `}</style>
    </AccountCard>
  );
}

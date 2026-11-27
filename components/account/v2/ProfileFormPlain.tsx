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
import { SuccessButton } from "@/components/ui/SuccessButton";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { UserAvatar } from "@/components/ui/Avatar";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { Camera, User } from "@phosphor-icons/react";
import { titleCaseKeepAcronyms, normalizePhone } from "@/lib/utils";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Button } from "@/components/arc/button/button";
import { LabelInput } from "@/components/ui/LabelInput";

const MIN_NAME = 2;
const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

export function ProfileFormPlain({
  initialName,
  initialEmail,
  initialPhone,
  initialJobTitle = "",
  initialDirectMobile = "",
  initialImage = null,
  role,
  roleLabel,
  hideRoleNote = false,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialJobTitle?: string;
  initialDirectMobile?: string;
  initialImage?: string | null;
  role: string;
  /** Override the role shown in the identity block (e.g. "Owner" for a
   *  progression-business owner). Defaults to Director/Negotiator by role. */
  roleLabel?: string;
  /** Hide the "Role changes are managed by your director" note (true for a
   *  business owner, who has no director above them). */
  hideRoleNote?: boolean;
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

  // Returns true on success so the Save button can confirm inline (SuccessButton).
  // The success toast is kept only for the email-change caveat; the ordinary
  // "saved" confirmation is now the button's own inline tick (interaction audit).
  async function handleSave(): Promise<boolean> {
    if (name.trim().length < MIN_NAME || !email.trim()) return false;
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
      if (emailChanged) {
        toast.success("Profile updated", { description: "Sign out and back in for your new email to take effect." });
      }
      if (phone.trim()) {
        window.dispatchEvent(new CustomEvent("sp_onboarding_step", { detail: { hasPhone: true } }));
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  const saveButton = (cls: string) => (
    <SuccessButton
      run={handleSave}
      variant="primary"
      size="sm"
      className={cls}
      disabled={disabledSave}
      style={coralVars}
    >
      Save changes
    </SuccessButton>
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
                    background: "rgba(var(--agent-coral-rgb), 0.10)",
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
            <span style={{ fontSize: 16.5, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>
              {name.trim() || "Your name"}
            </span>
            <span style={{ fontSize: 13, color: "var(--agent-text-muted)" }}>
              {/* One label only: their job title if they've set one, else their
                  role. The role is already shown on the Team page and under their
                  name in the sidebar, so repeating it here ("Director · Director")
                  was redundant. */}
              {jobTitle.trim() || (roleLabel ?? (isDirector ? "Director" : "Negotiator"))}
            </span>
            <div style={{ marginTop: 8 }}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                loading={uploadingPhoto}
                title="JPG, PNG or WEBP"
              >
                {image ? "Change photo" : "Upload photo"}
              </Button>
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

        <div className="profile-fields-grid" style={{ "--lbi-top": "0px" } as React.CSSProperties}>
          <div className="pf-name">
            <LabelInput
              label="Name" type="text" accent={CORAL} fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setName((n) => titleCaseKeepAcronyms(n))}
            />
          </div>
          <div className="pf-job">
            <LabelInput
              label="Job title" type="text" accent={CORAL} fullWidth
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onBlur={() => setJobTitle((t) => titleCaseKeepAcronyms(t))}
            />
          </div>
          <div className="pf-email">
            <LabelInput
              label="Email" type="email" accent={CORAL} fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setEmail((v) => v.trim().toLowerCase())}
            />
          </div>
          <div className="pf-phone">
            <LabelInput
              label="Contact number" type="tel" accent={CORAL} fullWidth
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhone((p) => normalizePhone(p))}
            />
          </div>
          <div className="pf-mobile">
            <LabelInput
              label="Direct mobile" type="tel" accent={CORAL} fullWidth
              value={directMobile}
              onChange={(e) => setDirectMobile(e.target.value)}
              onBlur={() => setDirectMobile((p) => normalizePhone(p))}
            />
          </div>
        </div>

        {!isDirector && !hideRoleNote && (
          <span style={{ fontSize: 11.5, color: "var(--agent-text-tertiary)" }}>
            Role changes are managed by your director.
          </span>
        )}

        {nameTooShort && (
          <InlineAlert kind="danger">Your name needs at least {MIN_NAME} characters.</InlineAlert>
        )}

        {error && <InlineAlert kind="danger">{error}</InlineAlert>}

        {emailChanged && (
          <InlineAlert kind="warning">
            Changing your email also changes your login. You&apos;ll need to sign out and back in for the change to take effect.
          </InlineAlert>
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
          font-size: 11.5px; font-weight: 500; color: var(--agent-text-muted); cursor: pointer;
          opacity: 0; max-height: 0; margin-top: 0; overflow: hidden; pointer-events: none;
          transform: translateY(-4px);
          transition: opacity 220ms ease, max-height 260ms ease, margin-top 260ms ease, transform 260ms ease, color 150ms ease;
        }
        .account-avatar-remove[data-show] {
          opacity: 1; max-height: 22px; margin-top: 3px; transform: translateY(0); pointer-events: auto;
        }
        .account-avatar-remove:hover { color: #C73E3E; }
        .profile-save-mobile { display: none; }
        @media (max-width: 640px) {
          .profile-save-desktop { display: none !important; }
          .profile-save-mobile { display: inline-flex !important; }
        }

        /* Never lopsided: 3 (name/job/email) + 2 stretched (phone/mobile) by
           default; all 5 in a row when wide; one column when narrow. */
        .profile-fields-grid { display: grid; gap: 16px 12px; grid-template-columns: repeat(6, minmax(0, 1fr)); }
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

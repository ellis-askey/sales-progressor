"use client";

// components/account/v2/MemberManageDrawer.tsx
//
// Director-facing "Manage member" drawer on the Team tab. Lets a director set a
// team member's display picture (upload / remove) and edit their name, job
// title and direct mobile. Photo goes through /api/agent/team/[id]/photo and
// details through PATCH /api/agent/team/[id] — both director-only, same-agency.
// Email + role are deliberately not editable here (login + permissions): the
// email is shown locked.

import { useRef, useState } from "react";
import { Camera, Lock } from "@phosphor-icons/react";
import { AccountDrawer } from "@/components/account/chrome/AccountDrawer";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { titleCaseKeepAcronyms } from "@/lib/utils";
import { cleanPhone, formatUKPhone } from "@/lib/utils/address";

export type ManageableMember = {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  directMobile?: string | null;
  image?: string | null;
  imageFocusX?: number | null;
  imageFocusY?: number | null;
};

const fieldLabel: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)", marginBottom: 6,
};

export function MemberManageDrawer({
  member,
  onClose,
  onSaved,
}: {
  member: ManageableMember;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useAgentToast();
  const [name, setName] = useState(member.name);
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? "");
  const [mobile, setMobile] = useState(member.directMobile ?? "");
  const [image, setImage] = useState<string | null>(member.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/agent/team/${member.id}/photo`, { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImage(data.url);
      toast.success("Photo updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setRemoving(true);
    try {
      const res = await fetch(`/api/agent/team/${member.id}/photo`, { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove that photo.");
      setImage(null);
      toast.success("Photo removed");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove that photo.");
    } finally {
      setRemoving(false);
    }
  }

  const dirty =
    name.trim() !== member.name.trim() ||
    jobTitle.trim() !== (member.jobTitle ?? "").trim() ||
    mobile.trim() !== (member.directMobile ?? "").trim();

  async function save() {
    if (name.trim().length < 2) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), jobTitle: jobTitle.trim(), directMobile: mobile.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Couldn't save.");
      }
      toast.success("Member updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const canSave = !saving && dirty && name.trim().length >= 2;

  return (
    <AccountDrawer open onClose={onClose} title="Manage member">
      <div style={{ display: "flex", flexDirection: "column", gap: 20, minHeight: "100%" }}>
        {/* Identity — avatar (hover camera → click to upload, same as settings)
            + name / role / email, with change / remove beneath the avatar. */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 9, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => !uploading && fileRef.current?.click()}
              disabled={uploading}
              className="mm-avatar-btn"
              aria-label={image ? "Change photo" : "Upload photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image ?? "/agent-avatar-fallback.png"}
                alt=""
                aria-hidden
                style={{ objectPosition: `${member.imageFocusX ?? 50}% ${image ? (member.imageFocusY ?? 50) : 32}%` }}
              />
              <span className="mm-avatar-cam" aria-hidden>
                <span className="mm-avatar-cam-badge"><Camera size={17} weight="fill" /></span>
              </span>
            </button>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mm-btn-ghost"
              >
                {uploading ? "Uploading…" : image ? "Change photo" : "Upload photo"}
              </button>
              {image && (
                <button type="button" onClick={removePhoto} disabled={removing} className="mm-btn-remove">
                  {removing ? "Removing…" : "Remove"}
                </button>
              )}
              <span style={{ fontSize: 11, color: "var(--agent-text-muted)", marginTop: 2 }}>JPG, PNG or WEBP</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, paddingTop: 4 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em", wordBreak: "break-word" }}>
              {name.trim() || member.name}
            </span>
            {jobTitle.trim() && <span style={{ fontSize: 13, color: "var(--agent-text-secondary)" }}>{jobTitle.trim()}</span>}
            <span style={{ fontSize: 13, color: "var(--agent-text-muted)", wordBreak: "break-word" }}>{member.email}</span>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display: "none" }} />
        </div>

        <div style={{ height: 1, background: "var(--agent-border-default)" }} aria-hidden />

        {/* Profile details */}
        <div>
          <p style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "var(--agent-text-primary)" }}>Profile details</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={fieldLabel}>Name</label>
              <input
                className="mm-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={(e) => { if (e.target.value.trim()) setName(titleCaseKeepAcronyms(e.target.value)); }}
                placeholder="Full name"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 16 }}>
              <div>
                <label style={fieldLabel}>Job title</label>
                <input className="mm-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Sales Negotiator" />
              </div>
              <div>
                <label style={fieldLabel}>Direct mobile</label>
                <input className="mm-input" type="tel" value={mobile} onChange={(e) => setMobile(cleanPhone(e.target.value))} onBlur={(e) => { if (e.target.value.trim()) setMobile(formatUKPhone(e.target.value)); }} placeholder="07700 000000" />
              </div>
            </div>

            {/* Email — locked (it's their login) */}
            <div>
              <label style={fieldLabel}>Email address</label>
              <div style={{ position: "relative" }}>
                <input className="mm-input mm-input-locked" value={member.email} readOnly disabled aria-label="Email address (locked)" />
                <Lock size={15} weight="fill" style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--agent-text-muted)", pointerEvents: "none" }} aria-hidden />
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>Email is linked to their account.</p>
            </div>
          </div>
        </div>

        {/* Footer — pinned to the bottom for a short form, flows after long content */}
        <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 18, borderTop: "0.5px solid var(--agent-border-default)" }}>
          <button type="button" onClick={onClose} className="mm-btn-cancel">Cancel</button>
          <button type="button" onClick={save} disabled={!canSave} className="account-btn-primary" style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, cursor: canSave ? "pointer" : "default" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <style>{`
        .mm-avatar-btn {
          position: relative; width: 80px; height: 80px; border-radius: 50%; overflow: hidden;
          flex-shrink: 0; padding: 0; cursor: pointer;
          border: 0.5px solid var(--agent-border-default); background: rgba(var(--agent-coral-rgb), 0.10);
        }
        .mm-avatar-btn:disabled { cursor: default; }
        .mm-avatar-btn img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mm-avatar-cam {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0); opacity: 0; transition: opacity 150ms ease, background 150ms ease;
        }
        .mm-avatar-btn:hover .mm-avatar-cam { opacity: 1; background: rgba(0,0,0,0.32); }
        .mm-avatar-btn:focus-visible .mm-avatar-cam { opacity: 1; background: rgba(0,0,0,0.32); }
        .mm-avatar-cam-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,0.5); color: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .mm-btn-ghost {
          align-self: flex-start; padding: 6px 12px; font-size: 12.5px; font-weight: 500;
          color: var(--agent-text-primary); background: transparent;
          border: 0.5px solid var(--agent-border-strong); border-radius: 8px; cursor: pointer;
          transition: background 120ms, border-color 120ms;
        }
        .mm-btn-ghost:hover:not(:disabled) { background: var(--agent-surface-glass); border-color: var(--agent-text-muted); }
        .mm-btn-ghost:disabled { opacity: 0.5; cursor: default; }
        .mm-btn-remove {
          align-self: flex-start; padding: 2px 0; font-size: 11.5px; font-weight: 500;
          color: var(--agent-text-muted); background: none; border: none; cursor: pointer; transition: color 120ms;
        }
        .mm-btn-remove:hover:not(:disabled) { color: var(--agent-danger, #dc2626); }
        .mm-btn-cancel {
          padding: 9px 18px; font-size: 13px; font-weight: 500; border-radius: 8px; cursor: pointer;
          color: var(--agent-text-secondary); background: transparent; border: 0.5px solid var(--agent-border-strong);
          transition: background 140ms, border-color 140ms;
        }
        .mm-btn-cancel:hover { background: var(--agent-surface-glass); border-color: var(--agent-text-muted); }
        .mm-input {
          width: 100%; padding: 10px 12px; font-size: 14px; border-radius: 8px; outline: none;
          color: var(--agent-text-primary); background: var(--agent-surface-elevated);
          border: 0.5px solid var(--agent-border-strong); transition: border-color 140ms;
        }
        .mm-input::placeholder { color: var(--agent-text-muted); }
        .mm-input:hover { border-color: var(--agent-coral); }
        .mm-input:focus { border-color: var(--agent-coral-deep); }
        .mm-input-locked {
          color: var(--agent-text-muted); background: rgba(128,128,128,0.08);
          padding-right: 34px; cursor: default;
        }
        .mm-input-locked:hover { border-color: var(--agent-border-strong); }
        @media (prefers-reduced-motion: reduce) {
          .mm-avatar-cam { transition: none; }
        }
      `}</style>
    </AccountDrawer>
  );
}

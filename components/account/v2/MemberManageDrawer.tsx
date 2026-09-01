"use client";

// components/account/v2/MemberManageDrawer.tsx
//
// Director-facing "Manage member" drawer on the Team tab. Lets a director set a
// team member's display picture (upload / remove) and edit their name, job
// title and direct mobile. Photo goes through /api/agent/team/[id]/photo and
// details through PATCH /api/agent/team/[id] — both director-only, same-agency.
// Email + role are deliberately not editable here (login + permissions).

import { useRef, useState } from "react";
import { AccountDrawer } from "@/components/account/chrome/AccountDrawer";
import { UserAvatar } from "@/components/ui/Avatar";
import { useAgentToast } from "@/components/agent/AgentToaster";

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

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: "#6b7280",
  textTransform: "uppercase",
  letterSpacing: 0.7,
  fontWeight: 500,
  marginBottom: 5,
};

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

  return (
    <AccountDrawer open onClose={onClose} title="Manage member" subtitle={member.email}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Display picture */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <UserAvatar
            user={{ name: name || member.name, image, imageFocusX: member.imageFocusX ?? 50, imageFocusY: member.imageFocusY ?? 50 }}
            size={64}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="account-btn-secondary account-press"
                style={{ padding: "7px 14px", fontSize: 12.5, fontWeight: 500, color: "#374151", background: "#fff", border: "0.5px solid rgba(0,0,0,0.16)", borderRadius: 8, cursor: uploading ? "default" : "pointer", opacity: uploading ? 0.5 : 1 }}
              >
                {uploading ? "Uploading…" : image ? "Change photo" : "Upload photo"}
              </button>
              {image && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={removing}
                  className="account-press"
                  style={{ padding: "7px 12px", fontSize: 12.5, fontWeight: 500, color: "#b91c1c", background: "transparent", border: "none", borderRadius: 8, cursor: removing ? "default" : "pointer" }}
                >
                  {removing ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>JPG, PNG or WEBP. Max 5 MB.</span>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pickPhoto} style={{ display: "none" }} />
        </div>

        <div>
          <label style={labelStyle}>Name</label>
          <input className="account-input" style={fieldStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </div>
        <div>
          <label style={labelStyle}>Job title</label>
          <input className="account-input" style={fieldStyle} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Sales Negotiator" />
        </div>
        <div>
          <label style={labelStyle}>Direct mobile</label>
          <input className="account-input" style={fieldStyle} type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+44 7700 000000" />
        </div>

        <span style={{ fontSize: 11.5, color: "#9ca3af", lineHeight: 1.5 }}>
          Email and role sit outside this drawer. To remove someone from the team, use the roster menu.
        </span>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty || name.trim().length < 2}
            className="account-btn-primary"
            style={{ padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: saving || !dirty || name.trim().length < 2 ? "default" : "pointer" }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </AccountDrawer>
  );
}

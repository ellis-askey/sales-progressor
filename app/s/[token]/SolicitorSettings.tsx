"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "@phosphor-icons/react/dist/ssr";
import { titleCaseKeepAcronyms, normalizePhone } from "@/lib/utils";
import { solicitorUpdateMyDetailsAction } from "./actions";
import { S } from "./ui";

export type MyDetails = { name: string; phone: string; email: string; secondaryEmail: string; image: string | null };

// Blue equivalent of the client portal's coral hero gradient (the avatar sits on
// this when there's no photo, exactly like PortalMenuDrawer's ProfileHeader).
const AVATAR_GRADIENT = "linear-gradient(135deg, #3a6fd8 0%, #6f97ea 100%)";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "?").toUpperCase();
}

export function SolicitorSettings({ token, firmName, details }: { token: string; firmName: string | null; details: MyDetails }) {
  const [form, setForm] = useState({ name: details.name, phone: details.phone, email: details.email, secondaryEmail: details.secondaryEmail });
  const [image, setImage] = useState(details.image);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  // Tidy input as focus leaves the field, matching the client portal's edit
  // drawer: names title-cased (acronyms like "CJ" kept), phones formatted UK
  // mobile/landline, emails lower-cased.
  function blurFmt(k: keyof typeof form, fmt: (v: string) => string) {
    setForm((f) => (f[k].trim() ? { ...f, [k]: fmt(f[k]) } : f));
  }
  const lower = (v: string) => v.trim().toLowerCase();

  function save() {
    const cleaned = {
      name: form.name.trim() ? titleCaseKeepAcronyms(form.name) : "",
      phone: form.phone.trim() ? normalizePhone(form.phone) : "",
      email: lower(form.email),
      secondaryEmail: lower(form.secondaryEmail),
    };
    setForm(cleaned);
    start(async () => {
      try {
        await solicitorUpdateMyDetailsAction(token, cleaned);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        /* keep the form; the field values are still there to retry */
      }
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/s/${token}/avatar`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Upload failed. Please try again.");
      if (json.url) setImage(json.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function pick() {
    if (!uploading) fileRef.current?.click();
  }

  return (
    <div>
      <p style={{ margin: "16px 2px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>Your details</p>

      {/* Photo + firm — clone of the client portal's profile header (gradient
          avatar, clickable, camera badge), recoloured blue. */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Change your photo"
            onClick={pick}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } }}
            style={{ width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, color: "#fff", background: image ? "#eee" : AVATAR_GRADIENT, boxShadow: "0 2px 8px rgba(47,95,208,0.28)", overflow: "hidden", opacity: uploading ? 0.6 : 1, transition: "opacity 150ms ease", cursor: uploading ? "wait" : "pointer" }}
          >
            {image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={image} alt="" width={64} height={64} style={{ width: 64, height: 64, objectFit: "cover" }} />
            ) : (
              initials(form.name || "?")
            )}
          </div>
          <button
            type="button"
            onClick={pick}
            disabled={uploading}
            aria-label="Change your photo"
            style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: `1px solid ${S.nestedBorder}`, color: S.accent, cursor: uploading ? "wait" : "pointer", boxShadow: "0 1px 3px rgba(15,39,64,0.18)" }}
          >
            <Camera size={13} weight="fill" />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} style={{ display: "none" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          {firmName && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: S.ink, lineHeight: 1.25 }}>{firmName}</p>}
          <button type="button" onClick={pick} disabled={uploading} style={{ margin: "3px 0 0", padding: 0, border: "none", background: "transparent", fontSize: 12.5, fontWeight: 600, color: S.accent, cursor: uploading ? "wait" : "pointer" }}>
            {uploading ? "Uploading…" : image ? "Change your picture" : "Upload your picture"}
          </button>
          {uploadError && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: S.danger }}>{uploadError}</p>}
        </div>
      </div>

      <Field label="Name" value={form.name} onChange={(v) => set("name", v)} onBlur={() => blurFmt("name", titleCaseKeepAcronyms)} />
      <Field label="Direct phone" value={form.phone} onChange={(v) => set("phone", v)} onBlur={() => blurFmt("phone", normalizePhone)} type="tel" />
      <Field label="Email" value={form.email} onChange={(v) => set("email", v)} onBlur={() => blurFmt("email", lower)} type="email" />
      <Field label="Assistant / CC email" value={form.secondaryEmail} onChange={(v) => set("secondaryEmail", v)} onBlur={() => blurFmt("secondaryEmail", lower)} type="email" />

      <button type="button" onClick={save} disabled={pending} style={{ marginTop: 6, width: "100%", padding: "11px", borderRadius: 9, border: "none", background: S.primary, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}>
        {pending ? "Saving…" : saved ? "✓ Saved" : "Save details"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, onBlur, type = "text" }: { label: string; value: string; onChange: (v: string) => void; onBlur?: () => void; type?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "10px 12px", border: "1px solid #d5deea", borderRadius: 9, color: S.ink, fontFamily: "inherit", background: "#fff" }} />
    </div>
  );
}

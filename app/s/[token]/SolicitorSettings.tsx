"use client";

import { useRef, useState, useTransition } from "react";
import { Camera } from "@phosphor-icons/react/dist/ssr";
import { solicitorUpdateMyDetailsAction } from "./actions";
import { S } from "./ui";

export type MyDetails = { name: string; phone: string; email: string; secondaryEmail: string; image: string | null };

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
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  function save() {
    start(async () => {
      try {
        await solicitorUpdateMyDetailsAction(token, form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        /* keep the form; the field values are still there to retry */
      }
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/s/${token}/avatar`, { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) setImage(json.url);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <p style={{ margin: "16px 2px 8px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: S.muted }}>Your details</p>

      {/* Photo + firm */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 12 }}>
        {image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={image} alt="" style={{ width: 52, height: 52, borderRadius: 26, objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <span style={{ width: 52, height: 52, borderRadius: 26, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: S.accentBg, color: S.accent, fontSize: 17, fontWeight: 700 }}>{initials(form.name || "?")}</span>
        )}
        <div style={{ minWidth: 0 }}>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: S.accent, background: S.accentBg, border: "none", borderRadius: 9, padding: "7px 12px", cursor: uploading ? "default" : "pointer" }}>
            <Camera size={15} weight="regular" /> {uploading ? "Uploading…" : image ? "Change photo" : "Add photo"}
          </button>
          {firmName && <p style={{ margin: "6px 0 0", fontSize: 12.5, color: S.muted }}>{firmName} <span style={{ color: S.faint }}>· firm</span></p>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} style={{ display: "none" }} />
        </div>
      </div>

      <Field label="Name" value={form.name} onChange={(v) => set("name", v)} />
      <Field label="Direct phone" value={form.phone} onChange={(v) => set("phone", v)} type="tel" />
      <Field label="Email" value={form.email} onChange={(v) => set("email", v)} type="email" />
      <Field label="Assistant / CC email" value={form.secondaryEmail} onChange={(v) => set("secondaryEmail", v)} type="email" />

      <button type="button" onClick={save} disabled={pending} style={{ marginTop: 6, width: "100%", padding: "11px", borderRadius: 9, border: "none", background: S.primary, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: pending ? "default" : "pointer", opacity: pending ? 0.6 : 1 }}>
        {pending ? "Saving…" : saved ? "✓ Saved" : "Save details"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: S.muted, marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", boxSizing: "border-box", fontSize: 14, padding: "10px 12px", border: "1px solid #d5deea", borderRadius: 9, color: S.ink, fontFamily: "inherit", background: "#fff" }} />
    </div>
  );
}

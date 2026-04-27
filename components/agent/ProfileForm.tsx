"use client";

import { useState } from "react";
import { updateProfileAction } from "@/app/actions/profile";
import { useAgentToast } from "@/components/agent/AgentToaster";

const FIELD = "w-full px-4 py-3 text-base rounded-xl bg-white/60 border border-white/30 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-400/60 focus:bg-white/80";

export function ProfileForm({
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
      toast.success("Profile updated", emailChanged ? { description: "Sign out and back in for your new email to take effect." } : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Three-column field row — stacks on mobile, 3-col from sm: */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-900/50 uppercase tracking-wide">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-900/50 uppercase tracking-wide">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-900/50 uppercase tracking-wide">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 000000" className={FIELD} />
        </div>
      </div>

      {/* Role */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/50 border border-white/40 text-slate-900/70">
          {isDirector ? "Director" : "Negotiator"}
        </span>
        {!isDirector && (
          <span className="text-xs text-slate-900/40">Role changes are managed by your director.</span>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {emailChanged && (
        <p className="text-xs text-amber-600 bg-amber-50/80 rounded-lg px-3 py-2 border border-amber-200/60">
          Changing your email updates your login — you&apos;ll need to sign out and back in for it to take effect.
        </p>
      )}

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || !dirty || !name.trim() || !email.trim()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)", boxShadow: "0 4px 12px rgba(37,99,235,0.30)" }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

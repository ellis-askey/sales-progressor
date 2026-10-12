"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/forms/types";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwField, useBwToast } from "./ui";

export function AccountPanel({ session }: { session: SessionUser }) {
  const { toast } = useBwToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await formsApi("/api/forms/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Password updated. Other devices have been signed out.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 560, width: "100%", margin: "0 auto", padding: "32px 20px 60px" }}>
      <h1 className="bw-display" style={{ fontSize: 26, margin: "0 0 24px" }}>Account</h1>

      <section className="bw-card" style={{ padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Your details</h2>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 10, fontSize: 13.5 }}>
          <dt style={{ color: "var(--bw-ink-faint)" }}>Name</dt>
          <dd style={{ margin: 0 }}>{session.name}</dd>
          <dt style={{ color: "var(--bw-ink-faint)" }}>Email</dt>
          <dd style={{ margin: 0 }}>{session.email}</dd>
          <dt style={{ color: "var(--bw-ink-faint)" }}>Workspace</dt>
          <dd style={{ margin: 0 }}>{session.tenantName}</dd>
        </dl>
      </section>

      <section className="bw-card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 4px" }}>Change password</h2>
        <p className="bw-hint" style={{ margin: "0 0 16px" }}>
          At least 10 characters, with letters and numbers. Changing it signs out your other devices.
        </p>
        <form onSubmit={submit}>
          <BwField label="Current password">
            <input className="bw-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </BwField>
          <BwField label="New password">
            <input className="bw-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </BwField>
          <BwField label="Confirm new password">
            <input className="bw-input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </BwField>
          {error && <p style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
          <BwButton type="submit" variant="primary" loading={busy}>
            Update password
          </BwButton>
        </form>
      </section>
    </div>
  );
}

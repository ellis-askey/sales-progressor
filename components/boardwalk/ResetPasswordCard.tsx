"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwField } from "./ui";
import { BoardwalkWordmark } from "./BoardwalkWordmark";

export function ResetPasswordCard({ token }: { token: string }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await formsApi("/api/forms/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token, newPassword: next }),
      });
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div className="bw-fade-up" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <BoardwalkWordmark size={26} />
        </div>
        <div className="bw-card" style={{ padding: 28 }}>
          {!token ? (
            <>
              <h1 className="bw-display" style={{ fontSize: 20, margin: "0 0 8px" }}>This link isn&apos;t valid</h1>
              <p style={{ fontSize: 13.5, color: "var(--bw-ink-soft)", margin: "0 0 18px" }}>
                Request a fresh reset link from the sign-in page.
              </p>
              <BwButton onClick={() => router.push("/boardwalk/login")} style={{ width: "100%" }}>
                Back to sign in
              </BwButton>
            </>
          ) : done ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>✅</div>
              <h1 className="bw-display" style={{ fontSize: 20, margin: "0 0 8px" }}>Password updated</h1>
              <p style={{ fontSize: 13.5, color: "var(--bw-ink-soft)", margin: "0 0 18px" }}>
                Sign in with your new password.
              </p>
              <BwButton variant="primary" onClick={() => router.push("/boardwalk/login")} style={{ width: "100%" }}>
                Sign in
              </BwButton>
            </div>
          ) : (
            <form onSubmit={submit}>
              <h1 className="bw-display" style={{ fontSize: 20, margin: "0 0 6px" }}>Choose a new password</h1>
              <p style={{ fontSize: 13.5, color: "var(--bw-ink-soft)", margin: "0 0 18px" }}>
                At least 10 characters, with letters and numbers.
              </p>
              <BwField label="New password">
                <input className="bw-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required autoFocus />
              </BwField>
              <BwField label="Confirm new password">
                <input className="bw-input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </BwField>
              {error && <p style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
              <BwButton type="submit" variant="primary" size="lg" loading={busy} style={{ width: "100%" }}>
                Update password
              </BwButton>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

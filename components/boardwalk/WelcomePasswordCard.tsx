"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formsApi } from "@/lib/forms/client";
import { extractFirstName } from "@/lib/contacts/displayName";
import { BwButton, BwField } from "./ui";
import { BoardwalkWordmark } from "./BoardwalkWordmark";

export function WelcomePasswordCard({ name }: { name: string }) {
  const router = useRouter();
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
      router.replace("/boardwalk/typeform");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const firstName = extractFirstName(name) || "there";

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div className="bw-fade-up" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <BoardwalkWordmark size={26} />
        </div>
        <div className="bw-card" style={{ padding: 28 }}>
          <h1 className="bw-display" style={{ fontSize: 21, margin: "0 0 6px" }}>
            Welcome, {firstName}.
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--bw-ink-soft)", margin: "0 0 20px" }}>
            You signed in with a temporary password. Choose your own to finish setting up: at
            least 10 characters, with letters and numbers.
          </p>
          <form onSubmit={submit}>
            <BwField label="Temporary password">
              <input className="bw-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
            </BwField>
            <BwField label="New password">
              <input className="bw-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
            </BwField>
            <BwField label="Confirm new password">
              <input className="bw-input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </BwField>
            {error && <p style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
            <BwButton type="submit" variant="primary" size="lg" loading={busy} style={{ width: "100%" }}>
              Set password and continue
            </BwButton>
          </form>
        </div>
      </div>
    </main>
  );
}

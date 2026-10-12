"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwField } from "./ui";
import { BoardwalkWordmark } from "./BoardwalkWordmark";

const TENANT = "boardwalk";

export function LoginCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot" | "forgot_sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await formsApi<{ ok: boolean; mustChangePassword: boolean }>(
        "/api/forms/auth/login",
        { method: "POST", body: JSON.stringify({ tenant: TENANT, email, password }) }
      );
      router.replace(result.mustChangePassword ? "/boardwalk/welcome" : "/boardwalk/typeform");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await formsApi("/api/forms/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ tenant: TENANT, email }),
      });
      setMode("forgot_sent");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(1200px 600px at 70% -10%, rgba(26,95,74,0.08), transparent 60%), var(--bw-paper)",
      }}
    >
      <div className="bw-fade-up" style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <BoardwalkWordmark size={30} />
          <p style={{ color: "var(--bw-ink-soft)", fontSize: 14, margin: "10px 0 0" }}>
            Forms, built around your agency.
          </p>
        </div>

        <div className="bw-card" style={{ padding: 28 }}>
          {mode === "login" && (
            <form onSubmit={submitLogin}>
              <h1 className="bw-display" style={{ fontSize: 20, margin: "0 0 18px" }}>
                Sign in
              </h1>
              <BwField label="Email">
                <input
                  className="bw-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </BwField>
              <BwField label="Password">
                <input
                  className="bw-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </BwField>
              {error && (
                <p style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
              )}
              <BwButton type="submit" variant="primary" size="lg" loading={busy} style={{ width: "100%" }}>
                Sign in
              </BwButton>
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(null); }}
                className="bw-btn bw-btn-ghost bw-btn-sm"
                style={{ width: "100%", marginTop: 10 }}
              >
                Forgotten your password?
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={submitForgot}>
              <h1 className="bw-display" style={{ fontSize: 20, margin: "0 0 6px" }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 13.5, color: "var(--bw-ink-soft)", margin: "0 0 18px" }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>
              <BwField label="Email">
                <input
                  className="bw-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </BwField>
              {error && (
                <p style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
              )}
              <BwButton type="submit" variant="primary" size="lg" loading={busy} style={{ width: "100%" }}>
                Send reset link
              </BwButton>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                className="bw-btn bw-btn-ghost bw-btn-sm"
                style={{ width: "100%", marginTop: 10 }}
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === "forgot_sent" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📬</div>
              <h1 className="bw-display" style={{ fontSize: 19, margin: "0 0 8px" }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 13.5, color: "var(--bw-ink-soft)", margin: "0 0 18px" }}>
                If an account exists for {email || "that address"}, a reset link is on its way. It&apos;s
                valid for an hour.
              </p>
              <BwButton onClick={() => setMode("login")} style={{ width: "100%" }}>
                Back to sign in
              </BwButton>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

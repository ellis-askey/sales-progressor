"use client";

// Boardwalk Forms sign-in — premium split-screen. Left: genuine Boardwalk
// property photography (their homepage hero, public/boardwalk/login-hero.jpg)
// with the real wordmark and an editorial strapline. Right: the sign-in form
// on stone. On narrow screens the photography becomes a compact top band.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formsApi } from "@/lib/forms/client";
import { BwButton, BwField } from "./ui";
import { BoardwalkLogo } from "./BoardwalkLogo";

const TENANT = "boardwalk";

export function LoginCard() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "forgot" | "forgot_sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: narrow ? "column" : "row" }}>
      {/* ── Photography panel ── */}
      <section
        aria-hidden
        style={{
          position: "relative",
          flex: narrow ? "0 0 220px" : "1 1 52%",
          minHeight: narrow ? 220 : "100vh",
          background:
            "linear-gradient(to top, rgba(43,48,50,0.62) 0%, rgba(43,48,50,0.16) 45%, rgba(43,48,50,0.30) 100%), center/cover no-repeat url(/boardwalk/interior-1.jpg)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: narrow ? "22px 24px" : "40px 48px",
          overflow: "hidden",
        }}
      >
        <BoardwalkLogo height={narrow ? 20 : 26} style={{ color: "#ffffff" }} />
        <div>
          <p
            className="bw-display"
            style={{
              color: "#ffffff",
              fontSize: narrow ? 22 : "clamp(28px, 3.2vw, 42px)",
              lineHeight: 1.18,
              margin: 0,
              maxWidth: 480,
              textShadow: "0 1px 18px rgba(43,48,50,0.35)",
            }}
          >
            Beautiful forms, built around your business.
          </p>
          {!narrow && (
            <p
              style={{
                color: "rgba(255,255,255,0.82)",
                fontSize: 14,
                letterSpacing: "0.05em",
                margin: "14px 0 0",
              }}
            >
              Valuations, viewings, offers and feedback, all on your own brand.
            </p>
          )}
        </div>
      </section>

      {/* ── Form panel ── */}
      <section
        style={{
          flex: narrow ? "1 1 auto" : "1 1 48%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: narrow ? "36px 24px 48px" : "48px",
          background: "var(--bw-paper)",
        }}
      >
        <div className="bw-fade-up" style={{ width: "100%", maxWidth: 380 }}>
          {mode === "login" && (
            <form onSubmit={submitLogin}>
              <p className="bw-kicker" style={{ margin: "0 0 10px" }}>Boardwalk Forms</p>
              <h1 className="bw-display" style={{ fontSize: 30, margin: "0 0 6px" }}>
                Welcome back
              </h1>
              <p style={{ fontSize: 14, color: "var(--bw-ink-soft)", margin: "0 0 28px" }}>
                Sign in to your forms workspace.
              </p>
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
                <p role="alert" style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 14px" }}>{error}</p>
              )}
              <BwButton type="submit" variant="primary" size="lg" loading={busy} style={{ width: "100%" }}>
                Sign in
              </BwButton>
              <button
                type="button"
                onClick={() => { setMode("forgot"); setError(null); }}
                className="bw-btn bw-btn-ghost bw-btn-sm"
                style={{ width: "100%", marginTop: 12 }}
              >
                Forgotten your password?
              </button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={submitForgot}>
              <p className="bw-kicker" style={{ margin: "0 0 10px" }}>Boardwalk Forms</p>
              <h1 className="bw-display" style={{ fontSize: 28, margin: "0 0 6px" }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 14, color: "var(--bw-ink-soft)", margin: "0 0 24px", lineHeight: 1.55 }}>
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
                <p role="alert" style={{ color: "var(--bw-red)", fontSize: 13, margin: "0 0 14px" }}>{error}</p>
              )}
              <BwButton type="submit" variant="primary" size="lg" loading={busy} style={{ width: "100%" }}>
                Send reset link
              </BwButton>
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); }}
                className="bw-btn bw-btn-ghost bw-btn-sm"
                style={{ width: "100%", marginTop: 12 }}
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode === "forgot_sent" && (
            <div>
              <p className="bw-kicker" style={{ margin: "0 0 10px" }}>Boardwalk Forms</p>
              <h1 className="bw-display" style={{ fontSize: 28, margin: "0 0 8px" }}>
                Check your inbox
              </h1>
              <p style={{ fontSize: 14, color: "var(--bw-ink-soft)", margin: "0 0 24px", lineHeight: 1.6 }}>
                If an account exists for {email || "that address"}, a reset link is on its way. It&apos;s
                valid for an hour.
              </p>
              <BwButton onClick={() => setMode("login")} size="lg" style={{ width: "100%" }}>
                Back to sign in
              </BwButton>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

"use client";

import { useState } from "react";
import { PButton } from "@/components/proposal/ui";
import { ThemeToggle } from "@/components/proposal/ThemeToggle";

// The access screen. Clones the feel of the canonical TSP sign-in (centred card
// on a calm field, coral primary, inline validation, honest loading state) but
// in the editorial proposal theme. The password is validated server-side; it is
// never in this bundle.

export function ProposalGate({ inviteToken, inviteLabel }: { inviteToken: string | null; inviteLabel: string | null }) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/proposal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, invite: inviteToken }),
      });
      if (res.ok) {
        // Full reload so the server page re-renders in its authenticated state.
        window.location.reload();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data?.error ?? "Something went wrong. Please try again.");
      setLoading(false);
    } catch {
      setError("Couldn't reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main style={{ position: "relative", minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem 1.25rem" }}>
      <div style={{ position: "absolute", top: 18, right: 18 }}>
        <ThemeToggle />
      </div>

      {/* Quiet vignette so the card reads as a lit focal point. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(60% 55% at 50% 42%, var(--prop-coral-tint) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative", width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center", marginBottom: "1.6rem" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: "1.4rem" }}>
            <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--prop-coral)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 15 }}>
              T
            </span>
            <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--prop-coral-strong)", letterSpacing: "0.02em" }}>TSP</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: "var(--prop-ink-3)", letterSpacing: "0.14em", marginTop: 3 }}>
                × BOARDWALK
              </span>
            </span>
          </div>
          <h1 className="prop-h1" style={{ fontSize: "clamp(1.7rem, 4vw, 2.2rem)" }}>
            Beyond Sales Progression<span className="prop-stop">.</span>
          </h1>
          <p className="prop-body" style={{ marginTop: "0.9rem" }}>
            {inviteLabel ? (
              <>A private strategic partnership proposal, prepared for <strong style={{ color: "var(--prop-ink)" }}>{inviteLabel}</strong>.</>
            ) : (
              <>A private strategic partnership proposal prepared for Nick and Jack.</>
            )}
          </p>
        </div>

        <div className="prop-card prop-card--pad-lg" style={{ boxShadow: "var(--prop-shadow-md)" }}>
          <form onSubmit={submit} className="prop-stack">
            <div>
              <label htmlFor="prop-pw" className="prop-field-label" style={{ display: "block", marginBottom: 8 }}>
                Access password
              </label>
              <input
                id="prop-pw"
                className="prop-input"
                type="password"
                inputMode="text"
                autoComplete="off"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "prop-pw-err" : undefined}
                placeholder="Enter your access password"
              />
              {error && (
                <p id="prop-pw-err" className="prop-caption" role="alert" style={{ color: "var(--prop-coral-strong)", marginTop: 8 }}>
                  {error}
                </p>
              )}
            </div>

            <PButton type="submit" loading={loading} disabled={!password.trim()} style={{ width: "100%" }}>
              {loading ? "Opening…" : "View proposal"}
            </PButton>
          </form>
        </div>

        <p className="prop-fnote" style={{ textAlign: "center", marginTop: "1.2rem", maxWidth: 380, marginInline: "auto" }}>
          Confidential. This page records basic, first-party access and engagement analytics (which link was used, sections
          viewed, device and approximate region) so the sender can see interest. It never captures the figures you enter into
          the models, and uses no third-party tracking.
        </p>
      </div>
    </main>
  );
}

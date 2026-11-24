"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { acceptNegotiatorInvitationPassword } from "@/app/actions/accept-negotiator-invitation-password";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { LabelInput } from "@/components/ui/LabelInput";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Button } from "@/components/arc/button/button";
import { titleCaseKeepAcronyms } from "@/lib/utils";

interface Props {
  token: string;
  negotiatorEmail: string;
  negotiatorName: string;
}

// Canonical auth controls — matches /login and /register: LabelInput + arc Button,
// coral primary via the arc token override.
const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as React.CSSProperties;

export function InvitedNegotiatorPasswordSignupForm({ token, negotiatorEmail, negotiatorName }: Props) {
  const [name, setName] = useState(negotiatorName);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    const fd = new FormData();
    fd.set("token", token);
    fd.set("name", name.trim());
    fd.set("password", password);
    fd.set("confirm", confirm);

    startTransition(async () => {
      const result = await acceptNegotiatorInvitationPassword(fd);
      if (result?.ok) {
        await signIn("credentials", {
          email: negotiatorEmail,
          password,
          callbackUrl: "/",
        });
      } else {
        setError(result?.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  return (
    <div style={{
      background: "#ffffff",
      borderRadius: "18px",
      border: "1px solid rgba(23,23,30,0.06)",
      boxShadow: "0 18px 50px rgba(30,20,15,0.10), 0 4px 14px rgba(30,20,15,0.05)",
      padding: "1.75rem",
    }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px", "--lbi-top": "0px" } as React.CSSProperties}>

        {/* Email — pre-filled, locked (tied to the invitation) */}
        <LabelInput
          label="Email address"
          type="email"
          name="email"
          value={negotiatorEmail}
          onChange={() => {}}
          locked
          fullWidth
        />

        {/* Full name — pre-filled from invitation, editable */}
        <LabelInput
          label="Full name"
          type="text"
          name="name"
          autoComplete="name"
          accent={CORAL}
          fullWidth
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={(e) => { if (e.target.value.trim()) setName(titleCaseKeepAcronyms(e.target.value)); }}
        />

        {/* Password */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <LabelInput
            field="Password"
            name="password"
            autoComplete="new-password"
            accent={CORAL}
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password.length > 0 && password.length < 10 && (
            <p style={{ fontSize: "11px", color: "#C97D1A", margin: 0 }}>At least 10 characters required</p>
          )}
          <PasswordStrength password={password} />
        </div>

        {/* Confirm password */}
        <LabelInput
          field="Password"
          label="Confirm password"
          name="confirm"
          autoComplete="new-password"
          accent={CORAL}
          fullWidth
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && <InlineAlert kind="danger">{error}</InlineAlert>}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isPending}
          disabled={!name.trim() || !password || !confirm}
          style={{ ...coralVars, width: "100%" }}
        >
          Create account
        </Button>

        <p style={{ margin: 0, fontSize: "12px", color: "rgba(45,24,16,0.55)", textAlign: "center", lineHeight: 1.5 }}>
          Already have an account?{" "}
          <a href="/login" style={{ color: CORAL, textDecoration: "none", fontWeight: 500 }}>Sign in</a>
        </p>
      </form>
    </div>
  );
}

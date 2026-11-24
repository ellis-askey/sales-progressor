"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { OtpInput } from "@/components/arc/otp-input/otp-input";
import { Button } from "@/components/arc/button/button";
import "@/components/arc/cookie-consent/scope.css";

// The 2FA activation form — the canonical coral OtpInput (same control as the
// login 2FA stage) + an arc primary. Posts the entered code alongside the
// server-issued encrypted secret to /api/command/setup-2fa. `preview` renders the
// same UI but never submits (for the /dev sandbox).

const CORAL = "#FF6B4A";
const coralVars = { "--foreground": CORAL, "--background": "#ffffff" } as CSSProperties;
const otpScope = { "--accent": CORAL, "--accent-strong": CORAL, "--accent-subtle": "rgba(255,107,74,0.08)" } as CSSProperties;

export function SetupTwoFaForm({ encryptedSecret, preview = false }: { encryptedSecret: string; preview?: boolean }) {
  const [code, setCode] = useState("");

  return (
    <form
      action={preview ? undefined : "/api/command/setup-2fa"}
      method={preview ? undefined : "POST"}
      onSubmit={preview ? (e) => e.preventDefault() : undefined}
      style={{ marginTop: 20 }}
    >
      <input type="hidden" name="encryptedSecret" value={encryptedSecret} />
      {/* Mirror the OtpInput value into a named field so the native POST carries it. */}
      <input type="hidden" name="code" value={code} />

      {/* Centre the OtpInput block (its .field is a full-width grid otherwise, so
          the boxes sit left). A content-width flex item in a centred row. */}
      <div className="arc-scope" style={{ ...otpScope, display: "flex", justifyContent: "center" }}>
        <OtpInput
          label="Enter the 6-digit code from your app"
          length={6}
          inputMode="numeric"
          autoFocus={!preview}
          value={code}
          onChange={(v: string) => setCode(v)}
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={code.length < 6}
        style={{ ...coralVars, width: "100%", marginTop: 18 }}
      >
        Activate
      </Button>
    </form>
  );
}

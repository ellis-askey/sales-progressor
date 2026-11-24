import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { AuthNoticeShell } from "@/components/ui/AuthNoticeShell";
import { PageTitle } from "@/components/ui/PageTitle";
import { SetupTwoFaForm } from "@/components/auth/SetupTwoFaForm";

// Dev sandbox for the 2FA SETUP (enrollment) screen — the real one at
// /command/setup-2fa is hard-gated (role === superadmin, redirects once enrolled)
// so it can't easily be reviewed. Renders the canonical screen with a sample QR;
// the form is in preview mode (never submits). Dev-only.

export const dynamic = "force-dynamic";

export default async function SetupTwoFaSandbox() {
  if (process.env.NODE_ENV === "production") notFound();

  const otpAuthUrl = "otpauth://totp/Sales%20Progressor%20Command:you@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Sales%20Progressor%20Command";
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 360 });

  return (
    <AuthNoticeShell maxWidth={440}>
      <PageTitle
        title="Two-step verification."
        subtitle="Scan the code with your authenticator app, then enter the 6-digit code to switch it on."
        style={{ marginBottom: 20 }}
      />
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ padding: 10, background: "#fff", borderRadius: 14, border: "1px solid rgba(23,23,30,0.10)", boxShadow: "0 2px 8px rgba(45,24,16,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Two-factor QR code" width={180} height={180} style={{ display: "block", borderRadius: 6 }} />
        </div>
      </div>
      <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 12, color: "rgba(45,24,16,0.5)", lineHeight: 1.5 }}>
        Use Google Authenticator, Authy, or any TOTP app.
      </p>
      <SetupTwoFaForm encryptedSecret="preview" preview />
    </AuthNoticeShell>
  );
}

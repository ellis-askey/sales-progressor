import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptTotpSecret } from "@/lib/command/crypto";
import { generateTotpSecret, totpKeyUri } from "@/lib/command/totp";
import { AuthNoticeShell } from "@/components/ui/AuthNoticeShell";
import { PageTitle } from "@/components/ui/PageTitle";
import { SetupTwoFaForm } from "@/components/auth/SetupTwoFaForm";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

type UserWithTotp = { id: string; email: string; totpActivatedAt: Date | null };

export default async function SetupTwoFaPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "superadmin") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, totpActivatedAt: true },
  }) as UserWithTotp | null;

  if (!user) redirect("/dashboard");
  if (user.totpActivatedAt) redirect("/command/overview");

  const secret = generateTotpSecret();
  const otpAuthUrl = totpKeyUri(user.email, "Sales Progressor Command", secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, { margin: 1, width: 360 });
  const encryptedSecret = encryptTotpSecret(secret);

  return (
    <AuthNoticeShell maxWidth={440}>
      <PageTitle
        title="Two-step verification."
        subtitle="Scan the code with your authenticator app, then enter the 6-digit code to switch it on."
        style={{ marginBottom: 20 }}
      />
      <QrPanel qrDataUrl={qrDataUrl} />
      <SetupTwoFaForm encryptedSecret={encryptedSecret} />
    </AuthNoticeShell>
  );
}

function QrPanel({ qrDataUrl }: { qrDataUrl: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ padding: 10, background: "#fff", borderRadius: 14, border: "1px solid rgba(23,23,30,0.10)", boxShadow: "0 2px 8px rgba(45,24,16,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="Two-factor QR code" width={180} height={180} style={{ display: "block", borderRadius: 6 }} />
        </div>
      </div>
      <p style={{ margin: "12px 0 0", textAlign: "center", fontSize: 12, color: "rgba(45,24,16,0.5)", lineHeight: 1.5 }}>
        Use Google Authenticator, Authy, or any TOTP app.
      </p>
    </div>
  );
}

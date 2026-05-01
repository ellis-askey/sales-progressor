import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptTotpSecret } from "@/lib/command/crypto";
import { generateTotpSecret, totpKeyUri } from "@/lib/command/totp";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
  const encryptedSecret = encryptTotpSecret(secret);

  return (
    <main style={{ padding: "2rem", maxWidth: 480, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
        Set up two-factor authentication
      </h1>
      <p style={{ marginBottom: "1rem", color: "#555" }}>
        Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt="TOTP QR code" width={200} height={200} />
      <form action="/api/command/setup-2fa" method="POST" style={{ marginTop: "1.5rem" }}>
        <input type="hidden" name="encryptedSecret" value={encryptedSecret} />
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
          Enter the 6-digit code from your app
        </label>
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          style={{ fontSize: "1.25rem", letterSpacing: "0.3em", padding: "0.5rem", width: "10rem" }}
        />
        <button
          type="submit"
          style={{
            display: "block",
            marginTop: "1rem",
            padding: "0.6rem 1.5rem",
            background: "#111",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Activate
        </button>
      </form>
    </main>
  );
}

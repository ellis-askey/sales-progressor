import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { withFormsAuth, formsBaseUrl } from "@/lib/forms/api";
import { getForm } from "@/lib/forms/service";

export const runtime = "nodejs";

// PNG QR code for the public form URL. Session-gated (it's fetched from the
// Share tab), so this is not an open QR generator.
export const GET = withFormsAuth(async (_req, session, params) => {
  const form = await getForm(session.tenantId, params.formId);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const url = `${formsBaseUrl()}/f/${form.publicId}`;
  const png = await QRCode.toBuffer(url, {
    type: "png",
    width: 640,
    margin: 1,
    color: { dark: "#1c2420", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `inline; filename="form-qr.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});

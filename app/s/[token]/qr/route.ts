// Serves the QR code for a solicitor's confirm link as a PNG image.
//
// Referenced by URL from the chasing digest email (Gmail/Outlook strip inline
// data-URI images, so the QR has to be hosted rather than embedded). Encodes
// {base}/s/{token} — the solicitor scans it on their phone and lands on the
// same confirm page, which is the trust play: tapping a QR with your phone
// feels safer than clicking a link on a locked-down work computer.
//
// Lives under the already-public /s/ prefix (middleware whitelist). Node
// runtime because the qrcode PNG encoder is pure-JS but not Edge-safe.

import QRCode from "qrcode";
import { verifySolicitorToken } from "@/lib/solicitor-confirm/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function baseUrl(): string {
  return process.env.NEXTAUTH_URL ?? "https://portal.thesalesprogressor.co.uk";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Only render for a validly-signed token so this isn't an open QR generator
  // for arbitrary URLs.
  if (!verifySolicitorToken(token)) {
    return new Response("Not found", { status: 404 });
  }

  const png = await QRCode.toBuffer(`${baseUrl()}/s/${token}`, {
    type: "png",
    width: 320,
    margin: 1,
    color: { dark: "#0f2740", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // The token is stable, so the QR is too — let the mail proxy cache it.
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}

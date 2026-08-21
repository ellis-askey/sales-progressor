/**
 * @jest-environment node
 */

// describeUploadError guarantees a failed photo upload never surfaces the raw
// response body to the user. Regression for the 2026-08-21 bug where a plain
// -text platform 413 ("Request Entity Too Large") reached res.json() and the
// toast showed "Unexpected token 'R', "Request En"... is not valid JSON".

import { describeUploadError, SAFE_UPLOAD_BYTES } from "../prepare-upload";

describe("describeUploadError", () => {
  it("turns a plain-text 413 into a clean size message (the reported crash)", async () => {
    const res = new Response("Request Entity Too Large", {
      status: 413,
      headers: { "content-type": "text/plain" },
    });
    const msg = await describeUploadError(res);
    expect(msg).toBe("That image is too large to upload. Please use one under 4 MB.");
    expect(msg).not.toMatch(/JSON|token|undefined/i);
  });

  it("prefers our own JSON error message when the route sends one", async () => {
    const res = new Response(JSON.stringify({ error: "File must be an image (JPG, PNG, WEBP, HEIC)." }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
    expect(await describeUploadError(res)).toBe("File must be an image (JPG, PNG, WEBP, HEIC).");
  });

  it("maps auth failures to a permission message", async () => {
    for (const status of [401, 403]) {
      const res = new Response("Unauthorized", { status });
      expect(await describeUploadError(res)).toBe(
        "You do not have permission to do that. Please sign in again.",
      );
    }
  });

  it("falls back to a generic message for an HTML error page, never the raw body", async () => {
    const res = new Response("<!DOCTYPE html><html><body>500</body></html>", {
      status: 500,
      headers: { "content-type": "text/html" },
    });
    const msg = await describeUploadError(res);
    expect(msg).toBe("We couldn't upload that photo. Please try again.");
    expect(msg).not.toMatch(/DOCTYPE|html/i);
  });

  it("keeps the client guard just below the platform body limit", () => {
    // Vercel's serverless request body cap is ~4.5 MB; our guard must sit under it.
    expect(SAFE_UPLOAD_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});

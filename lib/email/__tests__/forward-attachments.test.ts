/**
 * @jest-environment node
 */

// Faithful reply forwarding (founder ask 2026-10-23): inline images carry their
// Content-ID so the forwarded HTML's cid: references resolve (no broken
// signature boxes); real files ride along; size-capped so a huge part can't
// blow the forward.

import {
  forwardAttachmentFor,
  parseInboundParts,
  FORWARD_MAX_PER_FILE,
  FORWARD_MAX_TOTAL,
} from "../forward-attachments";

const buf = (n: number) => Buffer.alloc(n, 1);

describe("forwardAttachmentFor", () => {
  it("inline image → disposition inline + bracket-stripped content_id", () => {
    const a = forwardAttachmentFor(
      { filename: "logo.png", contentType: "image/png", content: buf(10), contentId: "<ii_abc123>" },
      0,
    );
    expect(a).not.toBeNull();
    expect(a!.disposition).toBe("inline");
    expect(a!.content_id).toBe("ii_abc123");
    expect(a!.filename).toBe("logo.png");
    expect(a!.type).toBe("image/png");
    expect(a!.content).toBe(buf(10).toString("base64"));
  });

  it("real file (no content-id) → disposition attachment, no content_id", () => {
    const a = forwardAttachmentFor(
      { filename: "contract.pdf", contentType: "application/pdf", content: buf(10), contentId: null },
      0,
    );
    expect(a!.disposition).toBe("attachment");
    expect(a!.content_id).toBeUndefined();
  });

  it("a part over the per-file cap is skipped (still filed to Documents elsewhere)", () => {
    const a = forwardAttachmentFor(
      { filename: "huge.pdf", contentType: "application/pdf", content: buf(FORWARD_MAX_PER_FILE + 1), contentId: null },
      0,
    );
    expect(a).toBeNull();
  });

  it("a part that would breach the running total is skipped", () => {
    const a = forwardAttachmentFor(
      { filename: "big.pdf", contentType: "application/pdf", content: buf(1024), contentId: null },
      FORWARD_MAX_TOTAL, // already at the ceiling
    );
    expect(a).toBeNull();
  });
});

describe("parseInboundParts", () => {
  // Minimal FormData/File stand-ins — only the fields the parser reads.
  function fakeFile(name: string, type: string, bytes: number): File {
    const data = buf(bytes);
    return {
      name,
      type,
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    } as unknown as File;
  }
  function fakeForm(entries: Record<string, unknown>): FormData {
    return { get: (k: string) => entries[k] ?? null } as unknown as FormData;
  }

  it("files everything to ingest, forwards inline with CID and real files plainly", async () => {
    const form = fakeForm({
      attachments: "2",
      "attachment-info": JSON.stringify({
        attachment1: { "content-id": "<sig@x>" },
        attachment2: {},
      }),
      attachment1: fakeFile("sig.png", "image/png", 20),
      attachment2: fakeFile("doc.pdf", "application/pdf", 30),
    });
    const { ingest, forward } = await parseInboundParts(form);
    expect(ingest).toHaveLength(2);
    expect(forward).toHaveLength(2);
    const inline = forward.find((f) => f.filename === "sig.png")!;
    expect(inline.disposition).toBe("inline");
    expect(inline.content_id).toBe("sig@x");
    const real = forward.find((f) => f.filename === "doc.pdf")!;
    expect(real.disposition).toBe("attachment");
    expect(real.content_id).toBeUndefined();
  });

  it("no attachments → empty both", async () => {
    const { ingest, forward } = await parseInboundParts(fakeForm({ attachments: "0" }));
    expect(ingest).toHaveLength(0);
    expect(forward).toHaveLength(0);
  });

  it("malformed attachment-info is tolerated (everything forwards as a normal attachment)", async () => {
    const form = fakeForm({
      attachments: "1",
      "attachment-info": "{not json",
      attachment1: fakeFile("x.png", "image/png", 5),
    });
    const { forward } = await parseInboundParts(form);
    expect(forward).toHaveLength(1);
    expect(forward[0].disposition).toBe("attachment");
  });
});

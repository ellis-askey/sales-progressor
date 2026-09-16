/**
 * @jest-environment node
 */

import {
  filterStorableAttachments,
  safeAttachmentName,
  MAX_EMAIL_ATTACHMENT_BYTES,
  MIN_IMAGE_ATTACHMENT_BYTES,
} from "../attachments";
import type { IngestAttachment } from "../types";

function att(over: Partial<IngestAttachment>): IngestAttachment {
  const content = over.content ?? Buffer.from("x".repeat(over.size ?? 1024));
  return {
    filename: "doc.pdf",
    contentType: "application/pdf",
    size: over.size ?? content.length,
    ...over,
    content,
  };
}

describe("filterStorableAttachments", () => {
  it("keeps a normal PDF attachment", () => {
    const out = filterStorableAttachments([att({ filename: "contract.pdf", size: 200_000 })]);
    expect(out).toHaveLength(1);
    expect(out[0]!.filename).toBe("contract.pdf");
    expect(out[0]!.contentType).toBe("application/pdf");
  });

  it("keeps common conveyancing types (docx, xlsx, images)", () => {
    const out = filterStorableAttachments([
      att({ filename: "TA6.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 50_000 }),
      att({ filename: "searches.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 50_000 }),
      att({ filename: "floorplan.png", contentType: "image/png", size: 50_000 }),
    ]);
    expect(out.map((o) => o.filename)).toEqual(["TA6.docx", "searches.xlsx", "floorplan.png"]);
  });

  it("skips inline parts (signature logos, body images)", () => {
    const out = filterStorableAttachments([
      att({ filename: "logo.png", contentType: "image/png", size: 40_000, isInline: true, cid: "logo@x" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("drops disallowed types (zip, exe, calendar)", () => {
    const out = filterStorableAttachments([
      att({ filename: "a.zip", contentType: "application/zip", size: 50_000 }),
      att({ filename: "b.exe", contentType: "application/octet-stream", size: 50_000 }),
      att({ filename: "invite.ics", contentType: "text/calendar", size: 5_000 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("drops attachments over the size cap", () => {
    const out = filterStorableAttachments([
      att({ filename: "huge.pdf", size: MAX_EMAIL_ATTACHMENT_BYTES + 1 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("drops tiny images (stray logos/pixels) but keeps tiny PDFs", () => {
    const out = filterStorableAttachments([
      att({ filename: "pixel.gif", contentType: "image/gif", size: MIN_IMAGE_ATTACHMENT_BYTES - 1 }),
      att({ filename: "small.pdf", contentType: "application/pdf", size: 500 }),
    ]);
    expect(out.map((o) => o.filename)).toEqual(["small.pdf"]);
  });

  it("de-dupes the same file (name + size) within one email", () => {
    const out = filterStorableAttachments([
      att({ filename: "contract.pdf", size: 200_000 }),
      att({ filename: "Contract.pdf", size: 200_000 }), // same name (case-insensitive) + size
    ]);
    expect(out).toHaveLength(1);
  });

  it("keeps same-named files of different sizes (genuinely different)", () => {
    const out = filterStorableAttachments([
      att({ filename: "contract.pdf", size: 200_000 }),
      att({ filename: "contract.pdf", size: 300_000 }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("ignores empty-content parts", () => {
    const out = filterStorableAttachments([
      att({ filename: "empty.pdf", content: Buffer.alloc(0), size: 0 }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("returns [] for undefined / empty input", () => {
    expect(filterStorableAttachments(undefined)).toEqual([]);
    expect(filterStorableAttachments([])).toEqual([]);
  });

  it("uses the attachment's real byte length when size is missing/zero", () => {
    const content = Buffer.from("x".repeat(20_000));
    const out = filterStorableAttachments([
      att({ filename: "photo.jpg", contentType: "image/jpeg", size: 0, content }),
    ]);
    expect(out).toHaveLength(1); // 20 KB real length clears the image floor
    expect(out[0]!.size).toBe(20_000);
  });
});

describe("safeAttachmentName", () => {
  it("strips path separators and illegal characters", () => {
    expect(safeAttachmentName("../../etc/passwd", "application/pdf")).not.toContain("/");
    expect(safeAttachmentName('a"b?c*.pdf', "application/pdf")).toBe("abc.pdf");
  });

  it("falls back to a typed default when there is no name", () => {
    expect(safeAttachmentName("", "application/pdf")).toBe("attachment.pdf");
    expect(safeAttachmentName(null, "image/png")).toBe("attachment.png");
    expect(safeAttachmentName(undefined, "application/octet-stream")).toBe("attachment.bin");
  });
});

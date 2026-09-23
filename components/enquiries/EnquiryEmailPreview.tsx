"use client";

// Opens a chase email from the enquiry timeline exactly as it was sent — the
// true-to-inbox HTML in a sandboxed iframe. Composes the canonical ui/Drawer
// (ARIA, Escape, focus, scroll-lock, dark mode all free) and reuses the same
// previewSrcDoc sanitiser the automated-emails detail drawer uses, so the
// render matches everywhere.
//
// The HTML comes from getEnquiryChaseEmailAction, which shows the archived
// email where we stored it, and otherwise rebuilds the branded shell from the
// stored body (client chases) so the preview is true-to-inbox regardless.

import { useEffect, useState } from "react";
import { PaperPlaneTilt, ArrowSquareOut } from "@phosphor-icons/react";
import { Drawer } from "@/components/ui/Drawer";
import { SHEET_BAND_STYLE } from "@/components/ui/SheetHeader";
import { getEnquiryChaseEmailAction, type EnquiryChaseEmail } from "@/app/actions/enquiries";
import { previewSrcDoc } from "@/lib/email/preview-srcdoc";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
const fmtWhen = (d: Date | null | undefined) => (d ? `${dateFmt.format(new Date(d))} at ${timeFmt.format(new Date(d))}` : "");

export function EnquiryEmailPreview({ messageId, onClose }: { messageId: string | null; onClose: () => void }) {
  const [preview, setPreview] = useState<EnquiryChaseEmail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!messageId) return;
    setPreview(null); setError(null); setLoading(true);
    let live = true;
    getEnquiryChaseEmailAction(messageId)
      .then((res) => {
        if (!live) return;
        if (res.ok) setPreview(res.data);
        else setError(res.error);
      })
      .catch(() => { if (live) setError("Couldn't load this email."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [messageId]);

  // Open the email's own HTML in a new tab, exactly as the inbox renders it.
  function openInNewWindow() {
    if (!preview?.html) return;
    const blob = new Blob([preview.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  return (
    // zLayer="escalated": must clear the fixed agent topbar (z-index 101) —
    // same precedent as EmailSettingsDrawer, per the DESIGN_TOKENS.md
    // escalation rule (Raised tier: above a page-level overlay).
    <Drawer open={!!messageId} onClose={onClose} ariaLabel="Chase email preview" size="lg" closeTone="onDark" zLayer="escalated">
      <Drawer.Header style={SHEET_BAND_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <PaperPlaneTilt size={26} weight="regular" style={{ flexShrink: 0, color: "var(--agent-text-on-coral, #fff)" }} aria-hidden />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--sheet-band-kicker, rgba(255,255,255,0.78))" }}>
              Chase email
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 700, color: "var(--agent-text-on-coral, #fff)", lineHeight: 1.25 }}>
              {preview ? `To ${preview.recipientName}` : "Chase email"}
            </p>
            {preview?.sentAt && (
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.9)" }}>Sent {fmtWhen(preview.sentAt)}</p>
            )}
          </div>
        </div>
      </Drawer.Header>

      <Drawer.Body>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
          <p className="agent-eyebrow" style={{ margin: 0 }}>Email preview</p>
          {preview?.html && (
            <button
              type="button"
              onClick={openInNewWindow}
              className="agent-link"
              style={{ fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Preview in new window <ArrowSquareOut size={14} weight="bold" />
            </button>
          )}
        </div>

        {loading && <p style={{ fontSize: 13, color: "var(--agent-text-muted)", fontStyle: "italic", margin: 0 }}>Loading…</p>}
        {error && <p style={{ fontSize: 13, color: "var(--agent-danger)", margin: 0 }}>{error}</p>}

        {preview && (
          /* One white card — an email is white in both themes, so the To/Subject
             chrome uses explicit hex rather than agent tokens that would vanish
             in dark mode. */
          <div style={{ border: "1px solid var(--agent-border-strong)", borderRadius: 14, overflow: "hidden", background: "#fff" }}>
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 7 }}>
              <Row label="To">{preview.recipientName}{preview.recipientEmail ? ` <${preview.recipientEmail}>` : ""}</Row>
              <Row label="Subject"><span style={{ color: "#111827", fontWeight: 700 }}>{preview.subject}</span></Row>
            </div>
            <div style={{ height: 1, background: "#e5e7eb" }} aria-hidden />
            <iframe
              title="Chase email preview"
              srcDoc={previewSrcDoc(preview.html)}
              sandbox=""
              style={{ width: "100%", minHeight: 420, border: "none", background: "#fff", display: "block" }}
            />
          </div>
        )}
      </Drawer.Body>
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13, lineHeight: 1.4 }}>
      <span style={{ width: 58, flexShrink: 0, color: "#6b7280" }}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, wordBreak: "break-word", color: "#1f2937" }}>{children}</span>
    </div>
  );
}

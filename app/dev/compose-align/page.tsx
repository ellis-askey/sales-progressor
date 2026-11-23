"use client";

// Sign-off preview for critique #1 ("align signature + rich-text buttons across
// the new email modal and the chase drawers"). This is NOT a mock — it renders
// the REAL shared editor (components/compose/MessageEditor) that both composers
// will adopt, in both contexts, so you can confirm the writing experience is
// identical and nothing is lost before anything live is touched. /dev throwaway.

import { useState } from "react";
import { MessageEditor, type MessageAttachment, type SigStyle } from "@/components/compose/MessageEditor";
import type { SignatureStyleOption } from "@/lib/email/signature-options";

// Sample signature blocks (matching the real app's look) so the in-body,
// editable signature reads true. The style menu swaps between these in place.
const SIG_HTML: Record<SigStyle, string> = {
  basic:
    `<div style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:16px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">` +
    `<div style="font-size:14px;font-weight:700;color:#111827;line-height:1.4;">Ellis Askey</div>` +
    `<div style="font-size:13px;font-weight:600;color:#374151;margin-top:2px;">VIA Properties</div>` +
    `<div style="font-size:13px;color:#6b7280;margin-top:2px;">+44 7508 862929</div></div>`,
  logo:
    `<div style="margin-top:14px;border-top:1px solid #e5e7eb;padding-top:16px;font-family:-apple-system,'Segoe UI',sans-serif;">` +
    `<div style="font-size:14px;font-weight:700;color:#111827;">Ellis Askey</div>` +
    `<div style="font-size:13px;color:#6b7280;margin-top:2px;">+44 7508 862929</div>` +
    `<div style="margin-top:10px;display:inline-flex;align-items:center;gap:8px;background:#fff;border:0.5px solid #e5e7eb;border-radius:8px;padding:6px 12px;">` +
    `<span style="font-weight:800;letter-spacing:-0.02em;color:#111827;">VIA</span>` +
    `<span style="font-size:11px;color:#6b7280;">Properties</span></div></div>`,
  custom:
    `<div style="margin-top:14px;font-family:Georgia,serif;">` +
    `<div style="font-size:15px;font-style:italic;color:#1f2937;">Ellis Askey</div>` +
    `<div style="font-size:12px;color:#6b7280;margin-top:3px;letter-spacing:0.02em;">VIA PROPERTIES · Sales Progression</div>` +
    `<div style="font-size:12px;color:#9ca3af;margin-top:2px;">ellis@viaproperties.co.uk · +44 7508 862929</div></div>`,
  image:
    `<div style="margin-top:14px;"><div style="width:220px;height:70px;border-radius:8px;background:repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 8px,#e5e7eb 8px,#e5e7eb 16px);display:grid;place-items:center;color:#9ca3af;font-size:11px;">your uploaded signature image</div></div>`,
};

function seedBody(style: SigStyle, message = ""): string {
  return `${message}<p><br></p><p data-signoff="1">Kind regards,</p><div data-sig="1">${SIG_HTML[style]}</div>`;
}

// Swap only the signature block, keep whatever message was typed above it — the
// in-place behaviour the real host uses when you change signature style.
function swapSig(html: string, style: SigStyle): string {
  const sigIdx = html.indexOf('<div data-sig="1">');
  const signoffIdx = html.indexOf('<p data-signoff="1">');
  const cut = signoffIdx >= 0 ? signoffIdx : sigIdx;
  const head = cut >= 0 ? html.slice(0, cut) : html;
  return `${head}<p data-signoff="1">Kind regards,</p><div data-sig="1">${SIG_HTML[style]}</div>`;
}

function textLen(html: string): number {
  if (typeof document === "undefined") return 0;
  const d = document.createElement("div");
  d.innerHTML = html;
  return (d.textContent || "").trim().length;
}

const SIG_OPTIONS: SignatureStyleOption[] = [
  { key: "basic", label: "Basic", sub: "Name & details, no logo" },
  { key: "logo", label: "Logo", sub: "With the agency logo" },
  { key: "custom", label: "Custom", sub: "Your pasted signature" },
];

function Frame({
  title,
  subtitle,
  withRefine,
  withRegenerate,
}: {
  title: string;
  subtitle: string;
  withRefine?: boolean;
  withRegenerate?: boolean;
}) {
  const [style, setStyle] = useState<SigStyle>("basic");
  const [html, setHtml] = useState<string>(() => seedBody("basic"));
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [refining, setRefining] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  return (
    <div style={{ background: "var(--agent-surface-elevated, #fff)", borderRadius: 16, border: "0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08))", padding: 18, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary, #211d18)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--agent-text-secondary, #6b6258)", marginTop: 2 }}>{subtitle}</div>
      </div>
      <MessageEditor
        valueHtml={html}
        onChangeHtml={setHtml}
        placeholder="Write your message…"
        attachments={attachments}
        onAttachmentsChange={setAttachments}
        charCount={textLen(html)}
        sigStyle={style}
        sigOptions={SIG_OPTIONS}
        onSigStyleChange={(s) => { setStyle(s); setHtml((prev) => swapSig(prev, s)); }}
        onTemplates={() => setTemplatesOpen((v) => !v)}
        templatesOpen={templatesOpen}
        infoTooltip="How sending works, your signature, and what gets logged."
        onRefine={withRefine ? () => { setRefining(true); setTimeout(() => setRefining(false), 900); } : undefined}
        refining={refining}
        onRegenerate={withRegenerate ? () => { setRegenerating(true); setTimeout(() => setRegenerating(false), 900); } : undefined}
        regenerating={regenerating}
      />
      {templatesOpen && (
        <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 10, border: "0.5px dashed var(--agent-border-default, rgba(0,0,0,0.12))", background: "var(--agent-surface-glass, rgba(0,0,0,0.02))", fontSize: 12, color: "var(--agent-text-secondary, #6b6258)" }}>
          The existing template picker opens here (search, live preview, insert) — same component the New-email pop-up already uses, now available in the chase drawer too.
        </div>
      )}
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, lineHeight: 1.5, color: "var(--agent-text-secondary, #4a5162)" }}>
      <span aria-hidden style={{ color: "#10b981", fontWeight: 800, flexShrink: 0 }}>✓</span>
      <span>{children}</span>
    </li>
  );
}

export default function ComposeAlignPreview() {
  return (
    <div data-theme="sunset" style={{ minHeight: "100vh", background: "var(--agent-bg, #faf7f4)", fontFamily: "var(--font-geist-sans, system-ui, sans-serif)", padding: "44px 24px 120px", color: "var(--agent-text-primary, #211d18)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 28 }}>
        <header>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>One writing experience</h1>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "var(--agent-text-secondary, #6b6258)", lineHeight: 1.6, maxWidth: 760 }}>
            The two panels below are the <strong>same editor</strong> — the one both the New-email pop-up and the chase drawers will use. Type and format in either; they behave identically. The signature sits <strong>inside the email, editable</strong> (your pick). Nothing here is a mock — it&rsquo;s the real component.
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <Frame
            title="As it looks in the New-email pop-up"
            subtitle="Everything the chase editor has, plus the pop-up's Refine button."
            withRefine
          />
          <Frame
            title="As it looks in a Chase drawer"
            subtitle="Byte-for-byte the same editor; chase drafts from a tone, so Regenerate (refresh) sits top-right instead of Refine."
            withRegenerate
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
          <section style={{ background: "var(--agent-surface-elevated, #fff)", borderRadius: 16, border: "0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08))", padding: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>What each button does</h2>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              <Check><strong>Above the box</strong> (same spot on both): templates, mic and (i). On the chase drawer a <strong>refresh / Regenerate</strong> sits furthest right, with (i) on its left.</Check>
              <Check><strong>🎤 Dictate</strong>: speak your message; it types at the cursor.</Check>
              <Check><strong>B / I</strong> — bold / italic. They now <strong>light up</strong> when the text you&rsquo;re on is already bold/italic (new upgrade to the pop-up).</Check>
              <Check><strong>• / 1.</strong> — bulleted and numbered lists.</Check>
              <Check><strong>🔗 Link</strong> — a tidy inline box to paste a link (no more clunky browser pop-up in the New-email composer).</Check>
              <Check><strong>📎 Attach</strong> — add files (max 10MB each, 20MB total).</Check>
              <Check><strong>🪪 Signature style</strong> — switch between Basic / Logo / Custom. Try it — only your signature changes, your typed message stays put.</Check>
              <Check><strong>✦ Refine</strong> — (New-email only) neatens your text in your voice.</Check>
              <Check>Pasting always comes in as <strong>clean text</strong> — no messy formatting from other apps.</Check>
            </ul>
          </section>

          <section style={{ background: "var(--agent-surface-elevated, #fff)", borderRadius: 16, border: "0.5px solid var(--agent-border-subtle, rgba(0,0,0,0.08))", padding: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Nothing gets lost</h2>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--agent-text-secondary, #6b6258)", lineHeight: 1.5 }}>
              Every formatting + signature feature from <strong>both</strong> screens is carried over:
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9 }}>
              <Check>Bold, italic, bullet &amp; numbered lists, links, attachments, dictation, character count — all present.</Check>
              <Check>Signature stays <strong>inside the email, editable</strong>, with the style switcher — in <strong>both</strong> composers.</Check>
              <Check>The pop-up <strong>gains</strong> the chase editor&rsquo;s better bits: active button highlighting, clean paste, inline link box.</Check>
              <Check>The chase editor <strong>keeps</strong> everything it has; it simply moves the signature inside the email to match.</Check>
            </ul>
            <p style={{ margin: "14px 0 6px", fontSize: 12.5, fontWeight: 700, color: "var(--agent-text-primary, #211d18)" }}>Each composer&rsquo;s own extras stay exactly where they are — untouched:</p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              <li style={{ fontSize: 12.5, color: "var(--agent-text-secondary, #4a5162)" }}>• <strong>New-email pop-up:</strong> To/Cc/Bcc, sale picker, templates, send-later scheduling, reply-threading, &ldquo;share our latest&rdquo;, minimise/float.</li>
              <li style={{ fontSize: 12.5, color: "var(--agent-text-secondary, #4a5162)" }}>• <strong>Chase drawers:</strong> recipient picker, tone + AI draft, email/WhatsApp toggle, per-person CC, inline add-contact, &ldquo;mark as chased&rdquo;.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

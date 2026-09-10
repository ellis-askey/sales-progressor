"use client";

// Rich-text composer for the chase drawer: a contentEditable body with a clean
// toolbar (bold, italic, bullet list, numbered list, link, attach). Formatting
// uses execCommand — deprecated but universally supported and the right weight
// for a small inline editor. Active buttons show the primary colour and toggle
// on/off from queryCommandState. Paste is coerced to plain text so nothing messy
// enters the HTML; the server re-sanitises authoritatively on send.

import { useRef, useEffect, useState, useCallback } from "react";
import { TextB, TextItalic, ListBullets, ListNumbers, LinkSimple, Paperclip, X } from "@phosphor-icons/react";
import { isHtmlEmpty } from "@/lib/chase/rich-text";

export type ChaseAttachment = { id: string; file: File };

// 10MB per file, 20MB total (SendGrid caps ~30MB; leave headroom for encoding).
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ToolButton({
  active, disabled, title, onMouseDown, children,
}: {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={onMouseDown}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 28, borderRadius: 7, border: "none",
        background: "transparent",
        color: active ? "var(--agent-coral-deep)" : "var(--agent-text-muted)",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
        transition: "color 120ms",
      }}
    >
      {children}
    </button>
  );
}

export function ChaseComposer({
  valueHtml,
  onChangeHtml,
  placeholder,
  attachments,
  onAttachmentsChange,
  charCount,
}: {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  placeholder: string;
  attachments: ChaseAttachment[];
  onAttachmentsChange: (next: ChaseAttachment[]) => void;
  charCount: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const [active, setActive] = useState({ bold: false, italic: false, ul: false, ol: false });
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [attachError, setAttachError] = useState<string | null>(null);

  // Push external value changes (AI generate / regenerate) into the editor
  // without clobbering the caret while the agent types. We only reset innerHTML
  // when the incoming value differs from what we last emitted ourselves.
  useEffect(() => {
    const el = ref.current;
    if (el && valueHtml !== lastEmitted.current && valueHtml !== el.innerHTML) {
      el.innerHTML = valueHtml;
    }
  }, [valueHtml]);

  const emit = useCallback(() => {
    const html = ref.current?.innerHTML ?? "";
    lastEmitted.current = html;
    onChangeHtml(html);
  }, [onChangeHtml]);

  const refreshActive = useCallback(() => {
    if (typeof document === "undefined") return;
    // Only reflect state while the editor holds the selection.
    if (ref.current && document.activeElement !== ref.current) return;
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        ul: document.queryCommandState("insertUnorderedList"),
        ol: document.queryCommandState("insertOrderedList"),
      });
    } catch {
      // queryCommandState throws in some engines when nothing is focused.
    }
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const exec = (command: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
    refreshActive();
  };

  // mousedown + preventDefault keeps the editor's selection while the button is
  // pressed (a click would blur it first, losing the range).
  const toolMouseDown = (command: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    exec(command);
  };

  const applyLink = () => {
    const raw = linkUrl.trim();
    if (raw) {
      const url = /^(https?:|mailto:|tel:)/i.test(raw) ? raw : `https://${raw}`;
      exec("createLink", url);
    }
    setLinkOpen(false);
    setLinkUrl("");
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachError(null);
    const next = [...attachments];
    let total = next.reduce((sum, a) => sum + a.file.size, 0);
    for (const f of Array.from(files)) {
      if (f.size > MAX_FILE_BYTES) { setAttachError(`${f.name} is over 10MB.`); continue; }
      if (total + f.size > MAX_TOTAL_BYTES) { setAttachError("Attachments are over the 20MB total."); break; }
      if (next.some((a) => a.file.name === f.name && a.file.size === f.size)) continue;
      next.push({ id: `${f.name}-${f.size}-${next.length}`, file: f });
      total += f.size;
    }
    onAttachmentsChange(next);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeFile = (id: string) => onAttachmentsChange(attachments.filter((a) => a.id !== id));

  const showPlaceholder = isHtmlEmpty(valueHtml);

  return (
    <div>
      {/* Editor */}
      <div style={{ position: "relative" }}>
        {showPlaceholder && (
          <div aria-hidden style={{ position: "absolute", top: 12, left: 14, fontSize: 13, lineHeight: 1.6, color: "var(--agent-text-muted)", pointerEvents: "none" }}>
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Message"
          onInput={emit}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onFocus={refreshActive}
          onPaste={(e) => {
            e.preventDefault();
            const text = e.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, text);
            emit();
          }}
          className="chase-editor agent-focus"
          style={{
            minHeight: 150, boxSizing: "border-box",
            padding: "12px 14px", borderRadius: "12px 12px 0 0", fontSize: 13, lineHeight: 1.6,
            border: "0.5px solid var(--agent-border-subtle)", borderBottom: "none", outline: "none",
            background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)",
            overflowY: "auto",
          }}
        />
      </div>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 2,
        padding: "5px 8px", borderRadius: "0 0 12px 12px",
        border: "0.5px solid var(--agent-border-subtle)", borderTop: "0.5px solid var(--agent-border-subtle)",
        background: "var(--agent-surface-glass)",
      }}>
        <ToolButton title="Bold" active={active.bold} onMouseDown={toolMouseDown("bold")}>
          <TextB size={16} weight={active.bold ? "bold" : "regular"} />
        </ToolButton>
        <ToolButton title="Italic" active={active.italic} onMouseDown={toolMouseDown("italic")}>
          <TextItalic size={16} weight={active.italic ? "bold" : "regular"} />
        </ToolButton>
        <ToolButton title="Bulleted list" active={active.ul} onMouseDown={toolMouseDown("insertUnorderedList")}>
          <ListBullets size={16} weight={active.ul ? "bold" : "regular"} />
        </ToolButton>
        <ToolButton title="Numbered list" active={active.ol} onMouseDown={toolMouseDown("insertOrderedList")}>
          <ListNumbers size={16} weight={active.ol ? "bold" : "regular"} />
        </ToolButton>
        <ToolButton title="Add link" active={linkOpen} onMouseDown={(e) => { e.preventDefault(); setLinkOpen((v) => !v); }}>
          <LinkSimple size={16} weight={linkOpen ? "bold" : "regular"} />
        </ToolButton>
        <ToolButton title="Attach a file" onMouseDown={(e) => { e.preventDefault(); fileRef.current?.click(); }}>
          <Paperclip size={16} weight="regular" />
        </ToolButton>
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />

        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--agent-text-tertiary)", paddingRight: 4 }}>
          {charCount} characters
        </span>
      </div>

      {/* Link entry */}
      {linkOpen && (
        <div className="agent-reveal-in" style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyLink(); } if (e.key === "Escape") { setLinkOpen(false); setLinkUrl(""); } }}
            placeholder="Paste or type a link, then Enter"
            className="agent-focus"
            style={{ flex: 1, boxSizing: "border-box", padding: "8px 12px", borderRadius: 10, fontSize: 12.5, border: "0.5px solid var(--agent-border-subtle)", outline: "none", background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)" }}
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); applyLink(); }}
            style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: "none", background: "var(--agent-coral-deep)", color: "white", cursor: "pointer" }}
          >
            Add
          </button>
        </div>
      )}

      {/* Attachment chips */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {attachments.map((a) => (
            <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", borderRadius: 9, background: "var(--agent-surface-glass)", border: "0.5px solid var(--agent-border-subtle)", fontSize: 11.5, color: "var(--agent-text-primary)", maxWidth: "100%" }}>
              <Paperclip size={12} weight="bold" style={{ color: "var(--agent-text-muted)", flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150 }}>{a.file.name}</span>
              <span style={{ color: "var(--agent-text-tertiary)", flexShrink: 0 }}>{formatBytes(a.file.size)}</span>
              <button type="button" aria-label={`Remove ${a.file.name}`} onClick={() => removeFile(a.id)} style={{ display: "inline-flex", background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--agent-text-muted)", flexShrink: 0 }}>
                <X size={12} weight="bold" />
              </button>
            </span>
          ))}
        </div>
      )}
      {attachError && (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: "#dc2626" }}>{attachError}</p>
      )}
    </div>
  );
}

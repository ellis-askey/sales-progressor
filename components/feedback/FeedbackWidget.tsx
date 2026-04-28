"use client";

import { useState, useEffect, useRef } from "react";

type Category = "bug" | "suggestion" | "question";
type Stage = "categories" | "form" | "success" | "error";

interface Screenshot {
  base64: string;
  filename: string;
  preview: string;
  size: number;
}

// ── Browser detection ─────────────────────────────────────────────────────────

function parseBrowser(ua: string): string {
  const os = /Mac/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS"
    : /Linux/i.test(ua) ? "Linux" : "Unknown";
  if (/Edg\/(\d+)/.test(ua))     return `Edge ${ua.match(/Edg\/(\d+)/)?.[1]} on ${os}`;
  if (/OPR\/(\d+)/.test(ua))     return `Opera ${ua.match(/OPR\/(\d+)/)?.[1]} on ${os}`;
  if (/Firefox\/(\d+)/.test(ua)) return `Firefox ${ua.match(/Firefox\/(\d+)/)?.[1]} on ${os}`;
  if (/Chrome\/(\d+)/.test(ua))  return `Chrome ${ua.match(/Chrome\/(\d+)/)?.[1]} on ${os}`;
  if (/Version\/(\d+).*Safari/.test(ua)) return `Safari ${ua.match(/Version\/(\d+)/)?.[1]} on ${os}`;
  return `Browser on ${os}`;
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

function IconChat() {
  return (
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}
function IconBug() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}
function IconBulb() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.355a3.375 3.375 0 01-3 0m3-11.25a5.25 5.25 0 10-7.5 4.77V15h7.5v-1.477A5.25 5.25 0 0017.25 9z" />
    </svg>
  );
}
function IconQuestion() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}
function IconChevron() {
  return (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
function IconBack() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}
function IconClose() {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function IconWarning() {
  return (
    <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

// ── Screenshot upload ─────────────────────────────────────────────────────────

function ScreenshotUpload({ value, onChange }: { value: Screenshot | null; onChange: (s: Screenshot | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState("");

  const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"];

  function handleFile(file: File) {
    setErr("");
    if (!ALLOWED.includes(file.type)) { setErr("Only PNG, JPG, GIF or WebP accepted."); return; }
    if (file.size > 5 * 1024 * 1024) { setErr("Max 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      onChange({ base64: result.split(",")[1], filename: file.name, preview: URL.createObjectURL(file), size: file.size });
    };
    reader.readAsDataURL(file);
  }

  if (value) {
    return (
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Screenshot</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#f9faf8", border: "0.5px solid #e5e7eb", borderRadius: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.preview} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: "#374151", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value.filename}</p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>{(value.size / 1024).toFixed(0)} KB</p>
          </div>
          <button type="button" onClick={() => onChange(null)} style={{ flexShrink: 0, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", color: "#9ca3af", borderRadius: 4 }} aria-label="Remove screenshot">
            <IconClose />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Screenshot (optional)</p>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" capture="environment" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      <button type="button"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        style={{ width: "100%", padding: "14px 12px", border: `1px dashed ${dragging ? "#f97316" : "#d1d5db"}`, borderRadius: 10, background: dragging ? "rgba(249,115,22,0.04)" : "#fafaf9", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, transition: "all 150ms ease" }}
      >
        <span style={{ color: "#9ca3af" }}><IconCamera /></span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>Click or drag to upload screenshot</span>
      </button>
      {err && <p style={{ fontSize: 11, color: "#ef4444", marginTop: 6 }}>{err}</p>}
    </div>
  );
}

// ── Textarea / label helpers ──────────────────────────────────────────────────

function Field({ label, value, onChange, rows = 3, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  rows?: number; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
        {label}{required && <span style={{ color: "#f97316", marginLeft: 2 }}>*</span>}
      </label>
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} rows={rows} placeholder={placeholder} required={required}
        style={{ width: "100%", padding: "10px 12px", border: "0.5px solid #e5e7eb", borderRadius: 10, background: "rgba(255,255,255,0.7)", fontSize: 13, color: "#111827", resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.5, transition: "border-color 150ms" }}
        onFocus={(e) => { e.target.style.borderColor = "#f97316"; }}
        onBlur={(e) => { e.target.style.borderColor = "#e5e7eb"; }}
      />
    </div>
  );
}

// ── Category card ─────────────────────────────────────────────────────────────

function CategoryCard({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: hovered ? "#fff7ed" : "#fafaf9", border: `0.5px solid ${hovered ? "#fed7aa" : "#e5e7eb"}`, borderRadius: 10, cursor: "pointer", transition: "all 150ms ease", textAlign: "left" }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "rgba(249,115,22,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#f97316" }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{title}</p>
        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9ca3af" }}>{description}</p>
      </div>
      <span style={{ color: "#d1d5db", flexShrink: 0 }}><IconChevron /></span>
    </button>
  );
}

// ── Submit button ─────────────────────────────────────────────────────────────

function SubmitBtn({ label, disabled }: { label: string; disabled: boolean }) {
  return (
    <button type="submit" disabled={disabled}
      style={{ width: "100%", padding: "11px 16px", background: disabled ? "#fed7aa" : "#f97316", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", transition: "background 150ms ease" }}
    >
      {disabled ? "Sending…" : label}
    </button>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export function FeedbackWidget({ portalToken, checklistAware }: { portalToken?: string; checklistAware?: boolean }) {
  const [isCompact, setIsCompact]   = useState(false);
  const [isOpen, setIsOpen]         = useState(false);
  const [stage, setStage]           = useState<Stage>("categories");
  const [category, setCategory]     = useState<Category | null>(null);
  const [field1, setField1]         = useState("");
  const [field2, setField2]         = useState("");
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [capturedCtx, setCapturedCtx] = useState<{ url: string; browser: string; viewportSize: string; userAgent: string } | null>(null);
  const [triggerPosition, setTriggerPosition] = useState<"left" | "right">("right");

  const triggerRef    = useRef<HTMLButtonElement>(null);
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const closeRef      = useRef<HTMLButtonElement>(null);
  const scrollTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll compact behaviour
  useEffect(() => {
    function onScroll() {
      if (window.scrollY > 100) {
        setIsCompact(true);
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => setIsCompact(false), 1000);
      } else {
        setIsCompact(false);
        if (scrollTimer.current) clearTimeout(scrollTimer.current);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); if (scrollTimer.current) clearTimeout(scrollTimer.current); };
  }, []);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape" && isOpen) close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Focus management
  useEffect(() => { if (isOpen) setTimeout(() => closeRef.current?.focus(), 60); }, [isOpen]);

  // Auto-close success
  useEffect(() => {
    if (stage === "success") {
      const t = setTimeout(() => close(), 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Checklist-aware positioning: sit at left while onboarding checklist is active, animate to right on dismiss
  useEffect(() => {
    if (!checklistAware) return;
    const done = !!localStorage.getItem("sp_onboarding_dismissed");
    if (!done) setTriggerPosition("left");

    function handleDismiss() {
      const el = triggerWrapRef.current;
      if (!el) { setTriggerPosition("right"); return; }
      const width = el.offsetWidth;
      const translateX = window.innerWidth - 48 - width;
      el.style.transition = "transform 500ms cubic-bezier(0.34, 1.56, 0.64, 1)";
      el.style.transform = `translateX(${translateX}px)`;
      setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
        setTriggerPosition("right");
      }, 510);
    }

    window.addEventListener("sp_checklist_dismissed", handleDismiss);
    return () => window.removeEventListener("sp_checklist_dismissed", handleDismiss);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checklistAware]);

  function open() {
    setCapturedCtx({
      url:          window.location.href,
      browser:      parseBrowser(navigator.userAgent),
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      userAgent:    navigator.userAgent,
    });
    setStage("categories");
    setCategory(null);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setStage("categories");
    setCategory(null);
    setField1("");
    setField2("");
    setScreenshot(null);
    setTimeout(() => triggerRef.current?.focus(), 60);
  }

  function selectCategory(cat: Category) {
    setCategory(cat);
    setField1(""); setField2(""); setScreenshot(null);
    setStage("form");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !field1.trim()) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        category, field1: field1.trim(), field2: field2.trim() || null,
        ...(capturedCtx ?? {}),
        ...(portalToken ? { portalToken } : {}),
        ...(screenshot ? { screenshotBase64: screenshot.base64, screenshotFilename: screenshot.filename } : {}),
      };
      const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setStage(res.ok ? "success" : "error");
    } catch { setStage("error"); }
    finally { setSubmitting(false); }
  }

  const CATEGORY_META: Record<Category, { title: string; description: string; label: string }> = {
    bug:        { title: "Report an issue",       description: "Something's not working",   label: "Send report" },
    suggestion: { title: "Suggest an improvement",description: "Share your idea",            label: "Send suggestion" },
    question:   { title: "Ask a question",        description: "Get help and advice",        label: "Send question" },
  };

  // Panel content
  function panelContent() {
    if (stage === "success") {
      return (
        <div style={{ padding: "40px 24px", textAlign: "center", flex: 1 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#16a34a" }}>
            <IconCheck />
          </div>
          <p style={{ fontSize: 18, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>Thanks!</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>We'll get back to you within 1 business day.</p>
          <button onClick={close} style={{ padding: "9px 28px", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Done</button>
        </div>
      );
    }

    if (stage === "error") {
      return (
        <div style={{ padding: "40px 24px", textAlign: "center", flex: 1 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#d97706" }}>
            <IconWarning />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 8px" }}>Couldn't send your message</p>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>Please check your connection and try again.</p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button onClick={() => setStage("form")} style={{ padding: "9px 20px", background: "#f97316", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Try again</button>
            <button onClick={close} style={{ padding: "9px 20px", background: "none", color: "#6b7280", border: "0.5px solid #e5e7eb", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      );
    }

    if (stage === "categories") {
      return (
        <>
          <div style={{ padding: "18px 20px 14px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>Support &amp; Feedback</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>How can we help today?</p>
            </div>
            <button ref={closeRef} onClick={close} aria-label="Close feedback panel"
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", color: "#9ca3af", borderRadius: 6 }}>
              <IconClose />
            </button>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
            <CategoryCard icon={<IconBug />}      title="Report an issue"        description="Something's not working" onClick={() => selectCategory("bug")} />
            <CategoryCard icon={<IconBulb />}     title="Suggest an improvement" description="Share your idea"         onClick={() => selectCategory("suggestion")} />
            <CategoryCard icon={<IconQuestion />} title="Ask a question"         description="Get help and advice"     onClick={() => selectCategory("question")} />
          </div>
        </>
      );
    }

    if (stage === "form" && category) {
      const meta = CATEGORY_META[category];
      return (
        <>
          <div style={{ padding: "18px 20px 14px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10 }}>
            <button type="button" onClick={() => setStage("categories")} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, border: "none", background: "none", cursor: "pointer", color: "#6b7280", borderRadius: 6, flexShrink: 0 }} aria-label="Back to categories">
              <IconBack />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#111827" }}>{meta.title}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9ca3af" }}>Please provide details to help us understand</p>
            </div>
            <button ref={closeRef} onClick={close} aria-label="Close feedback panel"
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", cursor: "pointer", color: "#9ca3af", borderRadius: 6, flexShrink: 0 }}>
              <IconClose />
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
            {category === "bug" && (
              <>
                <Field label="What were you trying to do?" value={field1} onChange={setField1} rows={3} placeholder="Describe what you were doing…" required />
                <Field label="What happened instead?" value={field2} onChange={setField2} rows={3} placeholder="Describe what went wrong…" required />
              </>
            )}
            {category === "suggestion" && (
              <>
                <Field label="What's the suggestion?" value={field1} onChange={setField1} rows={4} placeholder="Tell us what would make this better…" required />
                <Field label="Why would this help?" value={field2} onChange={setField2} rows={3} placeholder="Optional — what problem does it solve?" />
              </>
            )}
            {category === "question" && (
              <Field label="What's your question?" value={field1} onChange={setField1} rows={4} placeholder="Ask away — we'll get back to you soon…" required />
            )}
            <ScreenshotUpload value={screenshot} onChange={setScreenshot} />
            <SubmitBtn label={meta.label} disabled={submitting || !field1.trim() || (category === "bug" && !field2.trim())} />
          </form>
        </>
      );
    }

    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "fixed", inset: 0, zIndex: 39,
          background: "rgba(45,24,16,0.18)",
          opacity: isOpen ? 1 : 0,
          transition: "opacity 200ms ease",
          pointerEvents: isOpen ? "auto" : "none",
        }}
        aria-hidden
      />

      {/* Panel */}
      <div
        className="feedback-panel-wrap"
        role="dialog" aria-modal="true" aria-label="Support and Feedback"
        style={{
          ...(triggerPosition === "left" ? { left: 24, right: "auto" } : {}),
          width: "min(380px, calc(100vw - 32px))",
          maxHeight: "80vh",
          background: "#fff",
          border: "0.5px solid #e5e7eb",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(45,24,16,0.15), 0 0 0 0.5px rgba(255,255,255,0.4) inset",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          transform: isOpen ? "translateY(0)" : "translateY(20px)",
          opacity: isOpen ? 1 : 0,
          transition: "transform 250ms cubic-bezier(0.0,0.0,0.2,1), opacity 200ms ease",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {panelContent()}
      </div>

      {/* Trigger button */}
      <div
        ref={triggerWrapRef}
        className="feedback-trigger-wrap"
        style={{ zIndex: 40, ...(triggerPosition === "left" ? { left: 24, right: "auto" } : {}) }}
      >
        <button
          ref={triggerRef}
          onClick={isOpen ? close : open}
          aria-label="Open feedback widget"
          aria-expanded={isOpen}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: isCompact ? 0 : 8,
            padding: isCompact ? "11px" : "10px 16px 10px 12px",
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            border: "0.5px solid rgba(255,255,255,0.70)",
            borderRadius: 999,
            boxShadow: "0 8px 24px rgba(45,24,16,0.10), 0 1px 0 rgba(255,255,255,0.80) inset",
            cursor: "pointer",
            transition: "padding 250ms ease, gap 250ms ease, box-shadow 200ms ease",
            color: "#f97316",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 12px 32px rgba(45,24,16,0.16), 0 1px 0 rgba(255,255,255,0.80) inset"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(45,24,16,0.10), 0 1px 0 rgba(255,255,255,0.80) inset"; (e.currentTarget as HTMLButtonElement).style.transform = ""; }}
        >
          <IconChat />
          <span style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#1f2937",
            maxWidth: isCompact ? 0 : 80,
            opacity: isCompact ? 0 : 1,
            overflow: "hidden",
            transition: "max-width 250ms ease, opacity 200ms ease",
          }}>
            Feedback
          </span>
        </button>
      </div>
    </>
  );
}

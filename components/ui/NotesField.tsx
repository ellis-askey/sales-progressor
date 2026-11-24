"use client";

// Canonical multi-line field — the arc Textarea mapped to the agent look (coral
// focus ring, token border, label + optional hint/error that roll in). Keeps the
// label inside the component so it reads as one field.

import type { CSSProperties } from "react";
import { Textarea } from "@/components/arc/textarea/textarea";
import "@/components/arc/cookie-consent/scope.css";

const TOKENS: CSSProperties = {
  ["--space-2" as string]: "8px",
  ["--space-3" as string]: "12px",
  ["--text-sm" as string]: "12px",
  ["--text-xs" as string]: "12px",
  ["--text-field" as string]: "14px",
  ["--leading-body" as string]: "1.5",
  ["--radius-control" as string]: "10px",
  ["--surface" as string]: "var(--agent-surface-elevated, #ffffff)",
  ["--surface-muted" as string]: "var(--agent-surface-muted, rgba(45,24,16,0.05))",
  ["--border-strong" as string]: "var(--agent-border-default, rgba(45,24,16,0.14))",
  // Clear-but-neutral hover border (the arc default darkens to --foreground, near-black);
  // focus goes coral to match the field's accent + ring.
  ["--border-hover" as string]: "rgba(45,24,16,0.42)",
  ["--border-focus" as string]: "var(--agent-coral-deep, #E55B3D)",
  ["--foreground" as string]: "var(--agent-text-primary, #2D1810)",
  ["--text-muted" as string]: "var(--agent-text-muted, rgba(45,24,16,0.55))",
  ["--danger" as string]: "#C73E3E",
  ["--focus-ring" as string]: "rgba(255,107,74,0.18)",
  ["--duration-fast" as string]: "150ms",
  ["--duration-standard" as string]: "200ms",
  ["--ease-standard" as string]: "cubic-bezier(0.22,1,0.36,1)",
  // The built-in label inherits this (the textarea paints its own --foreground).
  color: "var(--agent-text-secondary, rgba(45,24,16,0.62))",
};

export function NotesField({
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  rows = 3,
  maxLength,
  // Hide the built-in label visually (kept for screen readers) — use when a
  // section header already names the field, so it isn't printed twice.
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  description?: string;
  error?: string;
  rows?: number;
  maxLength?: number;
  hideLabel?: boolean;
}) {
  return (
    <div className="arc-scope notes-field" style={TOKENS}>
      {/* Scoped to .notes-field so it never hides other arc-scope labels on the page. */}
      {hideLabel && <style>{".notes-field label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);margin:0;padding:0}"}</style>}
      <Textarea label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} description={description} error={error} rows={rows} maxLength={maxLength} />
    </div>
  );
}

"use client";

import { useState, useRef, useCallback } from "react";
import type { DraftEntry } from "@/components/transactions-v2/types";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif"];

function relativeTime(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return "over a month ago";
}

type Props = {
  drafts: DraftEntry[];
  onFile: (file: File) => void;
  onFillManually: () => void;
  onLoadDraft: (draft: DraftEntry) => void;
  onDeleteDraft: (id: string) => void;
};

export function HeroCard({ drafts, onFile, onFillManually, onLoadDraft, onDeleteDraft }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [showAllDrafts, setShowAllDrafts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const mostRecentDraft = drafts[0] ?? null;

  const validateAndSubmit = useCallback((file: File) => {
    setFileError(null);
    const type = file.type.toLowerCase();
    const name = file.name.toLowerCase();
    if (HEIC_TYPES.includes(type) || name.endsWith(".heic") || name.endsWith(".heif")) {
      setFileError("iPhone photos need to be saved as JPEG. Use the 'Files' option to pick the memo instead.");
      return;
    }
    if (!ACCEPTED_TYPES.includes(type) && !type.startsWith("image/")) {
      setFileError("Please upload a PDF or image (JPEG, PNG, WEBP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError("File is too large — maximum 10 MB.");
      return;
    }
    onFile(file);
  }, [onFile]);

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSubmit(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) validateAndSubmit(file);
    e.target.value = "";
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        borderRadius: 20,
        background: dragOver
          ? "rgba(var(--agent-coral-base-rgb), 0.06)"
          : "rgba(255,255,255,0.52)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        border: dragOver
          ? "2px dashed rgba(var(--agent-coral-base-rgb), 0.40)"
          : "0.5px solid rgba(255,255,255,0.70)",
        boxShadow: "0 4px 32px rgba(var(--agent-shadow-rgb), 0.08)",
        padding: "36px 32px 32px",
        transition: "background 200ms, border 200ms",
      }}
    >
      {/* Breathing AI dot */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--agent-coral-deep)",
        animation: "agent-pulse-dot 2.4s ease-in-out infinite",
        marginBottom: 20,
      }} />

      {/* Headline */}
      <h2 style={{
        margin: "0 0 8px",
        fontSize: 24,
        fontWeight: 600,
        color: dragOver ? "var(--agent-coral-deep)" : "var(--agent-text-primary)",
        letterSpacing: "var(--agent-tracking-tight)",
        lineHeight: 1.2,
        transition: "color 200ms",
      }}>
        {dragOver ? "Drop it here." : "Ready to add a sale?"}
      </h2>

      {/* Sub-copy */}
      <p style={{
        margin: "0 0 28px",
        fontSize: 14,
        color: "var(--agent-text-tertiary)",
        lineHeight: 1.6,
        minHeight: 24,
        transition: "opacity 200ms",
        opacity: dragOver ? 0 : 1,
      }}>
        {dragOver ? " " : "Drop a memo and we’ll fill the form for you."}
      </p>

      {/* Action buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="agent-btn agent-btn-primary agent-btn-lg"
          style={{ width: "100%", borderRadius: 14, justifyContent: "center" }}
        >
          Drop a memo of sale
        </button>

        <button
          type="button"
          onClick={onFillManually}
          className="agent-btn agent-btn-secondary agent-btn-lg"
          style={{ width: "100%", borderRadius: 14, justifyContent: "center" }}
        >
          Fill in manually
        </button>

        {mostRecentDraft && (
          <button
            type="button"
            onClick={() => onLoadDraft(mostRecentDraft)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              padding: "10px 16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--agent-text-secondary)",
              textAlign: "center",
              borderRadius: 10,
              transition: "background 150ms, color 150ms",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(var(--agent-coral-base-rgb), 0.06)";
              e.currentTarget.style.color = "var(--agent-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.color = "var(--agent-text-secondary)";
            }}
          >
            <span style={{ opacity: 0.5, flexShrink: 0 }}>Resume</span>
            <span style={{ fontWeight: 500 }}>
              {mostRecentDraft.propertyAddress.length > 32
                ? mostRecentDraft.propertyAddress.slice(0, 32) + "…"
                : mostRecentDraft.propertyAddress}
            </span>
            <span style={{ opacity: 0.5, flexShrink: 0 }}>{relativeTime(mostRecentDraft.createdAt)}</span>
          </button>
        )}
      </div>

      {/* View all drafts */}
      {drafts.length > 1 && (
        <div style={{ marginTop: 14, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setShowAllDrafts((v) => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--agent-text-muted)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              padding: "2px 0",
            }}
          >
            {showAllDrafts ? "Hide drafts" : `View all drafts (${drafts.length})`}
          </button>

          {showAllDrafts && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, textAlign: "left" }}>
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.48)",
                    border: "0.5px solid rgba(255,255,255,0.70)",
                    gap: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onLoadDraft(draft)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--agent-text-primary)",
                      textAlign: "left",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: 0,
                    }}
                  >
                    {draft.propertyAddress.length > 38
                      ? draft.propertyAddress.slice(0, 38) + "…"
                      : draft.propertyAddress}
                  </button>
                  <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flexShrink: 0 }}>
                    {relativeTime(draft.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteDraft(draft.id)}
                    aria-label="Remove draft"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "var(--agent-text-muted)",
                      lineHeight: 1,
                      padding: "2px 4px",
                      flexShrink: 0,
                    }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File error */}
      {fileError && (
        <p style={{
          marginTop: 12,
          fontSize: 12,
          color: "rgb(180,100,0)",
          background: "rgba(251,191,36,0.12)",
          border: "1px solid rgba(251,191,36,0.35)",
          borderRadius: 8,
          padding: "6px 12px",
          textAlign: "center",
          margin: "12px 0 0",
        }}>
          {fileError}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        onChange={onInputChange}
        style={{ display: "none" }}
        aria-hidden="true"
      />
    </div>
  );
}

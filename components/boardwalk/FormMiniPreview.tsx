"use client";

// A true miniature of a form's welcome screen, drawn from its REAL theme and
// welcome copy (FormPreviewSummary) — used on dashboard cards and the template
// gallery so every card shows the actual form, never placeholder imagery.

import type { FormPreviewSummary } from "@/lib/forms/types";

const FONT_STACKS: Record<string, string> = {
  sans: "brandon-grotesque, var(--font-bw-sans), 'Helvetica Neue', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  display: "blacker-pro-display, var(--font-bw-display), Georgia, serif",
  mono: "ui-monospace, Menlo, monospace",
};

export function FormMiniPreview({
  preview,
  height = 150,
}: {
  preview: FormPreviewSummary;
  height?: number;
}) {
  return (
    <div
      aria-hidden
      style={{
        height,
        background: preview.backgroundColor,
        color: preview.textColor,
        fontFamily: FONT_STACKS[preview.font] ?? FONT_STACKS.sans,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 22px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <span
        style={{
          fontSize: 15,
          lineHeight: 1.3,
          fontWeight: preview.font === "display" || preview.font === "serif" ? 450 : 600,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          maxWidth: 260,
        }}
      >
        {preview.welcomeTitle || "Untitled form"}
      </span>
      <span
        style={{
          marginTop: 12,
          background: preview.primaryColor,
          color: preview.buttonTextColor,
          fontSize: 10.5,
          fontWeight: 650,
          letterSpacing: "0.04em",
          padding: "6px 16px",
          borderRadius: preview.buttonRadius,
          fontFamily: FONT_STACKS.sans,
        }}
      >
        {preview.buttonText || "Start"}
      </span>
      {/* progress sliver, like the live runner */}
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "34%",
          height: 3,
          background: preview.primaryColor,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

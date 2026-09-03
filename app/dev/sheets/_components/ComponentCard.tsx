"use client";

// One dense inspection card in the catalogue grid. Shows the human name, a
// type chip, where it's used, how many states it exposes, a verified toggle
// and an Inspect button. Dev metadata (file path + export) hides behind a
// small disclosure so code paths never dominate.

import { useState } from "react";
import { MagnifyingGlass, DotsThree, CheckCircle, Circle } from "@phosphor-icons/react";
import type { SheetEntry } from "../_registry/types";

const TYPE_CHIP: Record<SheetEntry["type"], string> = {
  drawer: "Drawer",
  modal: "Modal",
  notification: "Notification",
};

export function ComponentCard({
  entry,
  verified,
  onToggleVerified,
  onInspect,
}: {
  entry: SheetEntry;
  verified: boolean;
  onToggleVerified: () => void;
  onInspect: () => void;
}) {
  const [showDev, setShowDev] = useState(false);
  const stateCount = entry.states.length;

  return (
    <div
      className="glass-card rounded-[14px]"
      style={{
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 148,
        position: "relative",
        outline: verified ? "1px solid var(--agent-success-border-strong)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.3 }}>
            {entry.name}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: 11, color: "var(--agent-text-muted)" }}>
            <span style={{ fontWeight: 600, color: "var(--agent-coral-deep)" }}>{TYPE_CHIP[entry.type]}</span>
            {" · "}
            {entry.usedIn}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleVerified}
          aria-label={verified ? "Unmark verified" : "Mark verified"}
          title={verified ? "Verified" : "Mark verified"}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 0, color: verified ? "var(--agent-success)" : "var(--agent-text-muted)", display: "inline-flex" }}
        >
          {verified ? <CheckCircle size={22} weight="fill" /> : <Circle size={22} weight="regular" />}
        </button>
      </div>

      {entry.note && (
        <p style={{ margin: 0, fontSize: 11.5, color: "var(--agent-text-secondary)", lineHeight: 1.5, flex: 1 }}>
          {entry.note}
        </p>
      )}
      {!entry.note && <div style={{ flex: 1 }} />}

      {showDev && (
        <p
          style={{
            margin: 0,
            fontSize: 10,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            color: "var(--agent-text-muted)",
            wordBreak: "break-all",
            lineHeight: 1.5,
            background: "var(--agent-hover-tint)",
            padding: "6px 8px",
            borderRadius: 8,
          }}
        >
          {entry.componentName ? `${entry.componentName} — ` : ""}
          {entry.file}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" onClick={onInspect} className="agent-btn agent-btn-sm agent-btn-primary" style={{ gap: 6 }}>
          <MagnifyingGlass size={13} weight="bold" />
          Inspect
        </button>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
          {stateCount} {stateCount === 1 ? "state" : "states"}
        </span>
        <button
          type="button"
          onClick={() => setShowDev((v) => !v)}
          className="agent-icon-btn agent-icon-btn-sm"
          aria-label="Toggle developer info"
          title="Component file"
          style={{ marginLeft: "auto" }}
        >
          <DotsThree size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}

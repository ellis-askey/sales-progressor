"use client";

import { CheckCircle } from "@phosphor-icons/react";
import type { MemoSource } from "@/components/transactions-v2/types";

type Props = {
  source: MemoSource;
  failedText?: string;
  notOnMemosText?: string;
};

export function FieldIndicator({ source }: { source: MemoSource }) {
  if (source === "extracted") {
    return (
      <CheckCircle
        size={12}
        weight="fill"
        color="#10b981"
        style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", marginLeft: 5 }}
      />
    );
  }
  if (source === "failed") {
    return (
      <span
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "#f59e0b",
          marginLeft: 5,
          verticalAlign: "middle",
          flexShrink: 0,
        }}
      />
    );
  }
  return null;
}

export function FieldHint({
  source,
  failedText = "We couldn't read this — please add",
  notOnMemosText = "Not on memos — please complete",
}: Props) {
  if (source === "failed") {
    return (
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#d97706", display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", flexShrink: 0, display: "inline-block" }} />
        {failedText}
      </p>
    );
  }
  if (source === "not_on_memos") {
    return (
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(15,23,42,0.38)" }}>
        {notOnMemosText}
      </p>
    );
  }
  return null;
}

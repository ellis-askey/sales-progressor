"use client";

// Global search (press / or Ctrl+K). Searches titles, descriptions and
// comments server-side (permission-scoped), plus quick client-side matches
// on projects and labels. Arrow keys + Enter to open.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Hash, Tag, CircleCheck } from "lucide-react";
import { formsApi } from "@/lib/forms/client";
import type { TaskDto } from "@/lib/todo/types";
import { useTodo } from "./TodoProvider";
import { formatDueLabel, dueTone } from "./Pickers";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const todo = useTodo();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TaskDto[]>([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const needle = q.trim();
    if (needle.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await formsApi<{ tasks: TaskDto[] }>(`/api/todo/tasks?view=search&search=${encodeURIComponent(needle)}`);
        setResults(res.tasks);
        setCursor(0);
      } finally {
        setBusy(false);
      }
    }, 240);
  }, [q]);

  const needle = q.trim().toLowerCase();
  const projectHits = needle.length >= 2 ? todo.projects.filter((p) => !p.isTemplate && p.name.toLowerCase().includes(needle)).slice(0, 3) : [];
  const labelHits = needle.length >= 2 ? todo.labels.filter((l) => l.name.toLowerCase().includes(needle)).slice(0, 3) : [];
  const totalRows = projectHits.length + labelHits.length + results.length;

  function openRow(index: number) {
    if (index < projectHits.length) {
      router.push(`/boardwalk/todo/project/${projectHits[index].id}`);
      onClose();
      return;
    }
    index -= projectHits.length;
    if (index < labelHits.length) {
      router.push(`/boardwalk/todo/label/${labelHits[index].id}`);
      onClose();
      return;
    }
    index -= labelHits.length;
    const task = results[index];
    if (task) {
      todo.openTask(task.id);
      onClose();
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="bw-scope">
      <div className="bw-backdrop" onClick={onClose} />
      <div className="bw-modal" role="dialog" aria-modal="true" aria-label="Search" style={{ alignItems: "flex-start", paddingTop: "12vh" }}>
        <div className="bw-modal-panel" style={{ maxWidth: 580 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--bw-line)" }}>
            <Search size={16} style={{ color: "var(--bw-ink-faint)", flexShrink: 0 }} />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCursor((c) => Math.min(c + 1, totalRows - 1));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCursor((c) => Math.max(c - 1, 0));
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  openRow(cursor);
                }
              }}
              placeholder="Search tasks, projects, labels, comments…"
              style={{ flex: 1, border: "none", outline: "none", fontSize: 15.5, fontFamily: "var(--bw-font-sans)", background: "transparent", color: "var(--bw-ink)" }}
            />
            {busy && <span className="bw-hint">Searching…</span>}
          </div>

          <div className="bw-scroll" style={{ maxHeight: "52vh", overflowY: "auto", padding: 8 }}>
            {needle.length < 2 && (
              <p className="bw-hint" style={{ padding: "18px 12px", textAlign: "center" }}>
                Type at least two characters. Results respect project access.
              </p>
            )}
            {projectHits.map((p, i) => (
              <ResultRow key={p.id} active={cursor === i} onClick={() => openRow(i)}>
                <Hash size={13} style={{ color: p.color }} />
                <span style={{ flex: 1 }}>{p.name}</span>
                <span className="bw-hint">Project</span>
              </ResultRow>
            ))}
            {labelHits.map((l, i) => (
              <ResultRow key={l.id} active={cursor === projectHits.length + i} onClick={() => openRow(projectHits.length + i)}>
                <Tag size={13} style={{ color: l.color }} />
                <span style={{ flex: 1 }}>{l.name}</span>
                <span className="bw-hint">Label</span>
              </ResultRow>
            ))}
            {results.map((t, i) => {
              const idx = projectHits.length + labelHits.length + i;
              return (
                <ResultRow key={t.id} active={cursor === idx} onClick={() => openRow(idx)}>
                  <CircleCheck size={13} style={{ color: t.completedAt ? "var(--bw-sage-ink)" : "var(--bw-ink-faint)", flexShrink: 0 }} />
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: t.completedAt ? "line-through" : "none", color: t.completedAt ? "var(--bw-ink-faint)" : undefined }}>
                    {t.title}
                  </span>
                  {t.dueDate && <span style={{ fontSize: 11, fontWeight: 600, color: dueTone(t.dueDate), flexShrink: 0 }}>{formatDueLabel(t.dueDate)}</span>}
                </ResultRow>
              );
            })}
            {needle.length >= 2 && !busy && totalRows === 0 && (
              <p className="bw-hint" style={{ padding: "18px 12px", textAlign: "center" }}>Nothing matches that.</p>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResultRow({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "9px 10px",
        borderRadius: 9,
        border: "none",
        background: active ? "var(--bw-paper-sunken)" : "transparent",
        cursor: "pointer",
        fontSize: 13.5,
        fontFamily: "var(--bw-font-sans)",
        color: "var(--bw-ink)",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}

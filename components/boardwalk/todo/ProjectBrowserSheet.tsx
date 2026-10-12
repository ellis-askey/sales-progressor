"use client";

// Mobile "Browse" sheet — projects, favourites, filters, labels and the
// remaining standing views, in a bottom sheet sized for thumbs.

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleCheck, Hash, SlidersHorizontal, Star, Tag, CalendarRange } from "lucide-react";
import { useTodo } from "./TodoProvider";

export function ProjectBrowserSheet({ onClose }: { onClose: () => void }) {
  const todo = useTodo();
  const router = useRouter();

  const go = (href: string) => {
    router.push(href);
    onClose();
  };

  if (typeof document === "undefined") return null;

  const row = (icon: React.ReactNode, label: string, href: string, count?: number) => (
    <button
      key={href}
      onClick={() => go(href)}
      style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", border: "none", background: "transparent", padding: "13px 6px", borderBottom: "1px solid var(--bw-line)", cursor: "pointer", fontSize: 14.5, fontFamily: "var(--bw-font-sans)", color: "var(--bw-ink)", textAlign: "left" }}
    >
      {icon}
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && count > 0 && <span className="bw-hint">{count}</span>}
    </button>
  );

  return createPortal(
    <div className="bw-scope">
      <div className="bw-backdrop" onClick={onClose} />
      <div
        className="bw-fade-up bw-scroll"
        role="dialog"
        aria-label="Browse"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 86,
          background: "var(--bw-paper-raised)",
          borderRadius: "18px 18px 0 0",
          maxHeight: "78dvh",
          overflowY: "auto",
          padding: "10px 18px calc(24px + env(safe-area-inset-bottom))",
          boxShadow: "var(--bw-shadow-lg)",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 99, background: "var(--bw-line-strong)", margin: "4px auto 14px" }} />
        {row(<CalendarRange size={16} />, "Upcoming", "/boardwalk/todo/upcoming", todo.counts.upcoming)}
        {row(<CircleCheck size={16} />, "Completed", "/boardwalk/todo/completed")}
        {row(<SlidersHorizontal size={16} />, "Filters & labels", "/boardwalk/todo/filters")}

        <p className="bw-kicker" style={{ fontSize: 10, margin: "18px 0 4px" }}>Projects</p>
        {todo.projects
          .filter((p) => !p.isTemplate)
          .map((p) =>
            row(
              p.isFavorite ? <Star size={15} style={{ color: "var(--bw-amber)" }} fill="var(--bw-amber)" /> : <Hash size={15} style={{ color: p.color }} />,
              p.name,
              `/boardwalk/todo/project/${p.id}`,
              todo.counts.byProject[p.id]
            )
          )}

        {todo.labels.length > 0 && (
          <>
            <p className="bw-kicker" style={{ fontSize: 10, margin: "18px 0 4px" }}>Labels</p>
            {todo.labels.map((l) => row(<Tag size={15} style={{ color: l.color }} />, l.name, `/boardwalk/todo/label/${l.id}`))}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

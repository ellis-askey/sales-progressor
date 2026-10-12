"use client";

// Shared popover pickers for Boardwalk To Do: due date (mini calendar +
// natural-language box + recurrence shortcuts), priority, labels, assignee
// and project/section. All close on outside click / Escape.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Flag, Repeat, Sun, Sofa, ArrowRight, X } from "lucide-react";
import type { RecurrenceRule } from "@/lib/todo/types";
import { addDays, isoWeekday, todayInLondon, toParts, daysInMonth } from "@/lib/todo/recurrence";
import { parseQuickAdd } from "@/lib/todo/nlp";
import { useTodo } from "./TodoProvider";

// ─── Popover shell ───────────────────────────────────────────────────────────

export function Popover({
  onClose,
  children,
  width = 272,
  align = "left",
}: {
  onClose: () => void;
  children: ReactNode;
  width?: number;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);
  return (
    <div
      ref={ref}
      className="bw-menu bw-fade-up"
      style={{ position: "absolute", top: "calc(100% + 6px)", [align]: 0, zIndex: 70, width, padding: 10 }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// ─── Due date ────────────────────────────────────────────────────────────────

export const PRIORITY_COLORS: Record<number, string> = {
  1: "#a8453a",
  2: "#996c1f",
  3: "#3b6ea5",
  4: "#9aa0a2",
};

export function formatDueLabel(dueDate: string | null, dueTime?: string | null): string {
  if (!dueDate) return "";
  const today = todayInLondon();
  const label =
    dueDate === today
      ? "Today"
      : dueDate === addDays(today, 1)
        ? "Tomorrow"
        : dueDate === addDays(today, -1)
          ? "Yesterday"
          : new Date(`${dueDate}T00:00:00Z`).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              ...(dueDate.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
              timeZone: "UTC",
            });
  return dueTime ? `${label} ${dueTime}` : label;
}

export function dueTone(dueDate: string | null): string {
  if (!dueDate) return "var(--bw-ink-faint)";
  const today = todayInLondon();
  if (dueDate < today) return "var(--bw-red)";
  if (dueDate === today) return "var(--bw-sage-ink)";
  if (dueDate === addDays(today, 1)) return "var(--bw-amber)";
  return "var(--bw-ink-soft)";
}

export function DuePicker({
  value,
  time,
  recurrence,
  onChange,
  onClose,
}: {
  value: string | null;
  time: string | null;
  recurrence: RecurrenceRule | null;
  onChange: (due: { dueDate: string | null; dueTime: string | null; recurrence: RecurrenceRule | null }) => void;
  onClose: () => void;
}) {
  const today = todayInLondon();
  const [month, setMonth] = useState(() => (value ?? today).slice(0, 7));
  const [nl, setNl] = useState("");
  const [timeDraft, setTimeDraft] = useState(time ?? "");

  const { y, m } = toParts(`${month}-01`);
  const firstWd = isoWeekday(`${month}-01`);
  const days = daysInMonth(y, m);

  const commit = (dueDate: string | null, opts?: { recurrence?: RecurrenceRule | null }) => {
    onChange({
      dueDate,
      dueTime: dueDate ? (timeDraft.match(/^\d{2}:\d{2}$/) ? timeDraft : null) : null,
      recurrence: opts?.recurrence !== undefined ? opts.recurrence : recurrence,
    });
    onClose();
  };

  const tryNl = () => {
    const parsed = parseQuickAdd(`x ${nl}`, today);
    if (parsed.dueDate || parsed.recurrence) {
      onChange({
        dueDate: parsed.dueDate ?? value,
        dueTime: parsed.dueTime ?? (timeDraft || null),
        recurrence: parsed.recurrence ?? recurrence,
      });
      onClose();
    }
  };

  const shortcut = (label: string, icon: ReactNode, date: string | null) => (
    <button key={label} className="bw-menu-item" style={{ padding: "6px 8px", fontSize: 12.5 }} onClick={() => commit(date)}>
      {icon}
      {label}
      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--bw-ink-faint)" }}>
        {date ? new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }) : ""}
      </span>
    </button>
  );

  const monday = addDays(today, ((8 - isoWeekday(today)) % 7) || 7);

  return (
    <Popover onClose={onClose} width={286}>
      <input
        className="bw-input bw-input-sm"
        placeholder='Try "next friday at 2pm" or "every monday"'
        value={nl}
        autoFocus
        onChange={(e) => setNl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), tryNl())}
        style={{ marginBottom: 8 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 8 }}>
        {shortcut("Today", <Sun size={13} />, today)}
        {shortcut("Tomorrow", <ArrowRight size={13} />, addDays(today, 1))}
        {shortcut("This weekend", <Sofa size={13} />, addDays(today, ((6 - isoWeekday(today) + 7) % 7) || 7))}
        {shortcut("Next week", <CalendarDays size={13} />, monday)}
        <button className="bw-menu-item" style={{ padding: "6px 8px", fontSize: 12.5 }} onClick={() => commit(null, { recurrence: null })}>
          <X size={13} /> No date
        </button>
      </div>

      {/* Mini calendar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 26, padding: 0 }} onClick={() => setMonth(addDays(`${month}-01`, -1).slice(0, 7))}>‹</button>
        <span style={{ fontSize: 12.5, fontWeight: 650 }}>
          {new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
        <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 26, padding: 0 }} onClick={() => setMonth(addDays(`${month}-${String(days).padStart(2, "0")}`, 1).slice(0, 7))}>›</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 8 }}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} style={{ fontSize: 10, textAlign: "center", color: "var(--bw-ink-faint)", fontWeight: 700 }}>{d}</span>
        ))}
        {Array.from({ length: firstWd - 1 }).map((_, i) => (
          <span key={`pad${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const selected = date === value;
          const isToday = date === today;
          const past = date < today;
          return (
            <button
              key={date}
              onClick={() => commit(date)}
              disabled={false}
              style={{
                height: 26,
                borderRadius: 7,
                border: "none",
                background: selected ? "var(--bw-brand)" : "transparent",
                color: selected ? "#fff" : past ? "var(--bw-ink-faint)" : "var(--bw-ink)",
                fontWeight: isToday ? 800 : 500,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "var(--bw-font-sans)",
                textDecoration: isToday && !selected ? "underline" : "none",
              }}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Time + recurrence row */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          className="bw-input bw-input-sm"
          type="time"
          value={timeDraft}
          onChange={(e) => setTimeDraft(e.target.value)}
          onBlur={() => {
            if (value) onChange({ dueDate: value, dueTime: timeDraft || null, recurrence });
          }}
          style={{ width: 104 }}
          aria-label="Due time"
        />
        {recurrence ? (
          <button className="bw-btn bw-btn-secondary bw-btn-sm" style={{ flex: 1, gap: 6 }} onClick={() => { onChange({ dueDate: value, dueTime: timeDraft || null, recurrence: null }); onClose(); }}>
            <Repeat size={12} /> {recurrence.label} ✕
          </button>
        ) : (
          <span className="bw-hint" style={{ flex: 1 }}>Type &quot;every monday&quot; above to repeat</span>
        )}
      </div>
    </Popover>
  );
}

// ─── Priority ────────────────────────────────────────────────────────────────

export function PriorityPicker({ value, onChange, onClose }: { value: number; onChange: (p: number) => void; onClose: () => void }) {
  return (
    <Popover onClose={onClose} width={180}>
      {[1, 2, 3, 4].map((p) => (
        <button
          key={p}
          className="bw-menu-item"
          onClick={() => {
            onChange(p);
            onClose();
          }}
        >
          <Flag size={13} style={{ color: PRIORITY_COLORS[p] }} fill={p < 4 ? PRIORITY_COLORS[p] : "none"} />
          Priority {p}
          {value === p && <span style={{ marginLeft: "auto" }}>✓</span>}
        </button>
      ))}
    </Popover>
  );
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export function LabelPicker({ value, onChange, onClose }: { value: string[]; onChange: (ids: string[]) => void; onClose: () => void }) {
  const todo = useTodo();
  const [draft, setDraft] = useState("");
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  async function createAndAdd() {
    const name = draft.trim();
    if (!name) return;
    const res = await fetch("/api/todo/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json();
    if (res.ok && body.label) {
      await todo.refreshBootstrap();
      onChange([...value, body.label.id]);
      setDraft("");
    }
  }

  return (
    <Popover onClose={onClose} width={230}>
      <input
        className="bw-input bw-input-sm"
        placeholder="Search or create…"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createAndAdd())}
        style={{ marginBottom: 6 }}
      />
      <div className="bw-scroll" style={{ maxHeight: 220, overflowY: "auto" }}>
        {todo.labels
          .filter((l) => !draft || l.name.toLowerCase().includes(draft.toLowerCase()))
          .map((l) => (
            <button key={l.id} className="bw-menu-item" onClick={() => toggle(l.id)}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: l.color, flexShrink: 0 }} />
              {l.name}
              {value.includes(l.id) && <span style={{ marginLeft: "auto" }}>✓</span>}
            </button>
          ))}
        {draft.trim() && !todo.labels.some((l) => l.name.toLowerCase() === draft.trim().toLowerCase()) && (
          <button className="bw-menu-item" onClick={createAndAdd}>
            + Create &quot;{draft.trim()}&quot;
          </button>
        )}
      </div>
    </Popover>
  );
}

// ─── Assignee ────────────────────────────────────────────────────────────────

export function AssigneePicker({ value, onChange, onClose }: { value: string | null; onChange: (id: string | null) => void; onClose: () => void }) {
  const todo = useTodo();
  return (
    <Popover onClose={onClose} width={230}>
      <button className="bw-menu-item" onClick={() => { onChange(null); onClose(); }}>
        Unassigned {value === null && <span style={{ marginLeft: "auto" }}>✓</span>}
      </button>
      {todo.members.map((m) => (
        <button key={m.id} className="bw-menu-item" onClick={() => { onChange(m.id); onClose(); }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 99,
              background: "var(--bw-blush)",
              color: "var(--bw-blush-ink)",
              fontSize: 9.5,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {m.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          {m.name}
          {m.id === todo.me && <span className="bw-hint">(you)</span>}
          {value === m.id && <span style={{ marginLeft: "auto" }}>✓</span>}
        </button>
      ))}
    </Popover>
  );
}

// ─── Project / section ───────────────────────────────────────────────────────

export function ProjectPicker({
  onPick,
  onClose,
  includeInbox = true,
}: {
  onPick: (projectId: string | null, sectionId: string | null) => void;
  onClose: () => void;
  includeInbox?: boolean;
}) {
  const todo = useTodo();
  return (
    <Popover onClose={onClose} width={250}>
      <div className="bw-scroll" style={{ maxHeight: 280, overflowY: "auto" }}>
        {includeInbox && (
          <button className="bw-menu-item" onClick={() => { onPick(null, null); onClose(); }}>
            Inbox
          </button>
        )}
        {todo.projects
          .filter((p) => !p.isTemplate)
          .map((p) => (
            <div key={p.id}>
              <button className="bw-menu-item" onClick={() => { onPick(p.id, null); onClose(); }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color, flexShrink: 0 }} />
                {p.name}
              </button>
              {p.sections.map((s) => (
                <button key={s.id} className="bw-menu-item" style={{ paddingLeft: 30, fontSize: 12.5 }} onClick={() => { onPick(p.id, s.id); onClose(); }}>
                  / {s.name}
                </button>
              ))}
            </div>
          ))}
      </div>
    </Popover>
  );
}

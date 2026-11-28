"use client";

// A textarea with @mention autocomplete for the Activity thread composer.
// Type "@" + a name to get a suggestion list of the file's internal people;
// pick one to insert "@Full Name". Native to the agent look (glass-input +
// agent tokens), light/dark alike. The autocomplete logic (caret query, keyboard
// nav, insertion) mirrors the /dev arc comment-thread prototype we refined.

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ActorAvatar, type ActorRole } from "@/components/ui/Avatar";

export type MentionPerson = { id: string; name: string; image?: string | null; role?: ActorRole };

// Escape a name for use inside a RegExp.
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** User ids whose "@Full Name" appears as a token in the text. */
export function extractMentions(text: string, people: MentionPerson[]): string[] {
  const ids = new Set<string>();
  for (const p of people) {
    if (new RegExp(`(^|\\s)@${esc(p.name)}(?=$|[\\s.,!?;:])`).test(text)) ids.add(p.id);
  }
  return [...ids];
}

/** Render body text with "@Full Name" of known people highlighted (coral, medium). */
export function MentionText({ text, people }: { text: string; people: MentionPerson[] }) {
  const parts = useMemo(() => {
    const names = people.map((p) => p.name).filter(Boolean).sort((a, b) => b.length - a.length).map(esc);
    if (!names.length) return [text];
    return text.split(new RegExp(`(@(?:${names.join("|")}))`, "g"));
  }, [people, text]);
  return (
    <>
      {parts.map((part, i) =>
        i % 2
          ? <span key={i} style={{ color: "var(--agent-coral-deep)", fontWeight: 600 }}>{part}</span>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}

export function MentionTextarea({
  value, onChange, people, placeholder, ariaLabel, autoFocus, rows = 2,
}: {
  value: string;
  onChange: (next: string) => void;
  people: MentionPerson[];
  placeholder?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  rows?: number;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; term: string } | null>(null);
  const [active, setActive] = useState(0);

  const suggestions = useMemo(() => {
    if (!query) return [];
    const term = query.term.toLowerCase();
    return people
      .filter((p) => p.name.toLowerCase().startsWith(term) || p.name.toLowerCase().split(" ").some((part) => part.startsWith(term)))
      .slice(0, 5);
  }, [people, query]);
  const open = !!query && suggestions.length > 0;

  function readQuery(v: string, caret: number) {
    const match = /(^|\s)@([\p{L}]*)$/u.exec(v.slice(0, caret));
    setQuery(match ? { start: caret - match[2]!.length - 1, term: match[2]! } : null);
    setActive(0);
  }

  function insert(p: MentionPerson) {
    const node = field.current;
    if (!node || !query) return;
    const caret = node.selectionStart ?? value.length;
    const next = `${value.slice(0, query.start)}@${p.name} ${value.slice(caret)}`;
    const at = query.start + p.name.length + 2;
    onChange(next);
    setQuery(null);
    requestAnimationFrame(() => { node.focus(); node.setSelectionRange(at, at); });
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (!open) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insert(suggestions[active]!);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setQuery(null);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <textarea
        ref={field}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        rows={Math.max(rows, Math.min(8, value.split("\n").length + 1))}
        className="glass-input w-full px-3 py-2.5 text-sm resize-none"
        autoFocus={autoFocus}
        onChange={(e) => { onChange(e.target.value); readQuery(e.target.value, e.target.selectionStart ?? e.target.value.length); }}
        onSelect={(e) => readQuery(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
        onBlur={() => window.setTimeout(() => setQuery(null), 120)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          role="listbox"
          aria-label="People"
          style={{
            position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 40,
            margin: 0, padding: 4, listStyle: "none", display: "flex", flexDirection: "column", gap: 1,
            background: "var(--agent-surface-elevated)", border: "1px solid var(--agent-border-default)",
            borderRadius: 10, boxShadow: "0 8px 24px rgba(var(--agent-shadow-rgb), 0.16)", maxHeight: 220, overflowY: "auto",
          }}
        >
          {suggestions.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => setActive(i)}
              onClick={() => insert(p)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 7, cursor: "pointer",
                fontSize: 13, color: "var(--agent-text-primary)",
                background: i === active ? "var(--agent-hover-surface, rgba(var(--agent-shadow-rgb), 0.06))" : "transparent",
              }}
            >
              <ActorAvatar name={p.name} role={p.role ?? "other"} image={p.image ?? null} size={20} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

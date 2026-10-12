"use client";

// Left pane of the builder: welcome screen, the sortable question list
// (dnd-kit), endings, and the add-question type picker.

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormDefinition, QuestionType } from "@/lib/forms/types";
import type { LogicIssue } from "@/lib/forms/logic";
import { QUESTION_TYPE_LABELS } from "@/lib/forms/defaults";
import { BwMenu } from "../ui";
import type { Selection } from "./BuilderApp";

const TYPE_ICONS: Record<QuestionType, string> = {
  short_text: "✏️",
  long_text: "📝",
  email: "✉️",
  phone: "📞",
  url: "🔗",
  number: "#",
  address: "📍",
  single_choice: "◉",
  multiple_choice: "☑",
  dropdown: "▾",
  yes_no: "⚖",
  picture_choice: "🖼",
  date: "📅",
  time: "🕐",
  opinion_scale: "📊",
  star_rating: "★",
  ranking: "↕",
  file_upload: "📎",
  statement: "💬",
  consent: "✓",
  signature: "✍️",
};

const TYPE_GROUPS: { label: string; types: QuestionType[] }[] = [
  { label: "Text", types: ["short_text", "long_text", "email", "phone", "url", "number", "address"] },
  { label: "Choices", types: ["single_choice", "multiple_choice", "dropdown", "yes_no", "picture_choice"] },
  { label: "Dates & ratings", types: ["date", "time", "opinion_scale", "star_rating", "ranking"] },
  { label: "Advanced", types: ["file_upload", "statement", "consent", "signature"] },
];

function SortableRow({
  id,
  index,
  selected,
  hasIssue,
  icon,
  title,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  id: string;
  index: number;
  selected: boolean;
  hasIssue: boolean;
  icon: string;
  title: string;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 5 : undefined,
        position: "relative",
      }}
    >
      <div
        onClick={onSelect}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 8px 8px 6px",
          borderRadius: 10,
          cursor: "pointer",
          background: selected ? "var(--bw-green-tint)" : "transparent",
          border: `1px solid ${selected ? "var(--bw-green)" : "transparent"}`,
          transition: "background 130ms ease, border-color 130ms ease",
        }}
      >
        <button
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          style={{
            cursor: "grab",
            border: "none",
            background: "transparent",
            color: "var(--bw-ink-faint)",
            fontSize: 13,
            padding: "2px 2px",
            touchAction: "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          ⠿
        </button>
        <span
          style={{
            width: 30,
            height: 24,
            borderRadius: 6,
            background: selected ? "var(--bw-green)" : "var(--bw-paper-sunken)",
            color: selected ? "#fff" : "var(--bw-ink-soft)",
            fontSize: 11,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 550,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            color: title ? "var(--bw-ink)" : "var(--bw-ink-faint)",
          }}
        >
          {title || "Untitled question"}
        </span>
        {hasIssue && (
          <span title="This question has a logic problem" style={{ color: "var(--bw-amber)", fontSize: 12 }}>
            ⚠
          </span>
        )}
        <BwMenu
          trigger={
            <button className="bw-btn bw-btn-ghost bw-btn-sm" style={{ width: 24, height: 24, padding: 0, fontSize: 13 }} aria-label="Question actions">
              ⋯
            </button>
          }
        >
          <button className="bw-menu-item" onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>Duplicate</button>
          <button className="bw-menu-item bw-menu-danger" onClick={(e) => { e.stopPropagation(); onRemove(); }}>Remove</button>
        </BwMenu>
      </div>
    </div>
  );
}

export function QuestionRail({
  def,
  selection,
  onSelect,
  onAdd,
  onDuplicate,
  onRemove,
  onMove,
  logicIssues,
}: {
  def: FormDefinition;
  selection: Selection;
  onSelect: (sel: Selection) => void;
  onAdd: (type: QuestionType) => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
  onMove: (from: number, to: number) => void;
  logicIssues: LogicIssue[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = def.questions.findIndex((q) => q.id === active.id);
    const to = def.questions.findIndex((q) => q.id === over.id);
    if (from !== -1 && to !== -1) onMove(from, to);
  }

  const issueQuestionIds = new Set(logicIssues.map((i) => i.questionId).filter(Boolean));

  return (
    <aside
      className="bw-scroll"
      style={{
        width: 290,
        minWidth: 240,
        flex: "0 0 auto",
        borderRight: "1px solid var(--bw-line)",
        background: "var(--bw-paper-raised)",
        overflowY: "auto",
        padding: "14px 10px 40px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* Welcome */}
      <RailHeading label="Welcome" />
      <RailStaticRow
        selected={selection.kind === "welcome"}
        onClick={() => onSelect({ kind: "welcome" })}
        icon="👋"
        title={def.welcome.enabled ? def.welcome.title || "Welcome screen" : "Welcome screen (off)"}
        dim={!def.welcome.enabled}
      />

      {/* Questions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 4px 4px" }}>
        <span className="bw-label" style={{ margin: 0 }}>Questions</span>
        <button className="bw-btn bw-btn-primary bw-btn-sm" onClick={() => setPickerOpen((o) => !o)}>
          + Add
        </button>
      </div>

      {pickerOpen && (
        <div className="bw-card bw-fade-up" style={{ padding: 10, marginBottom: 6 }}>
          {TYPE_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--bw-ink-faint)", margin: "0 0 4px 4px" }}>
                {group.label}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}>
                {group.types.map((t) => (
                  <button
                    key={t}
                    className="bw-menu-item"
                    style={{ padding: "6px 8px", fontSize: 12.5 }}
                    onClick={() => {
                      onAdd(t);
                      setPickerOpen(false);
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{TYPE_ICONS[t]}</span>
                    {QUESTION_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {def.questions.length === 0 && !pickerOpen && (
        <button
          onClick={() => setPickerOpen(true)}
          style={{
            border: "1.5px dashed var(--bw-line-strong)",
            borderRadius: 10,
            background: "transparent",
            padding: "18px 12px",
            fontSize: 13,
            color: "var(--bw-ink-soft)",
            cursor: "pointer",
            fontFamily: "var(--bw-font-sans)",
          }}
        >
          Add your first question
        </button>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={def.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          {def.questions.map((q, i) => (
            <SortableRow
              key={q.id}
              id={q.id}
              index={i}
              selected={selection.kind === "question" && selection.id === q.id}
              hasIssue={issueQuestionIds.has(q.id)}
              icon={TYPE_ICONS[q.type] ?? "•"}
              title={q.title}
              onSelect={() => onSelect({ kind: "question", id: q.id })}
              onDuplicate={() => onDuplicate(q.id)}
              onRemove={() => onRemove(q.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Endings */}
      <RailHeading label="Endings" style={{ marginTop: 14 }} />
      {def.endings.map((e) => (
        <RailStaticRow
          key={e.id}
          selected={selection.kind === "ending" && selection.id === e.id}
          onClick={() => onSelect({ kind: "ending", id: e.id })}
          icon="🏁"
          title={e.title || "Ending"}
          badge={e.isDefault ? "default" : undefined}
        />
      ))}
    </aside>
  );
}

function RailHeading({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <span className="bw-label" style={{ margin: "0 4px 4px", ...style }}>
      {label}
    </span>
  );
}

function RailStaticRow({
  selected,
  onClick,
  icon,
  title,
  dim,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  icon: string;
  title: string;
  dim?: boolean;
  badge?: string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "9px 10px",
        borderRadius: 10,
        cursor: "pointer",
        background: selected ? "var(--bw-green-tint)" : "transparent",
        border: `1px solid ${selected ? "var(--bw-green)" : "transparent"}`,
        opacity: dim ? 0.55 : 1,
        transition: "background 130ms ease, border-color 130ms ease",
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 550, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
      {badge && <span className="bw-chip bw-chip-grey" style={{ height: 18, fontSize: 10 }}>{badge}</span>}
    </div>
  );
}

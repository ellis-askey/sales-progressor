"use client";

// Left pane of the builder: welcome screen, the sortable question list
// (dnd-kit), endings, and the add-question type picker. Lucide icons per
// field type, numbered chips, grip handles.

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
import {
  Type, AlignLeft, Mail, Phone, Link2, Hash, MapPin, CircleDot, CheckSquare,
  ChevronDown, Image as ImageIcon, Calendar, Clock, SlidersHorizontal, Star,
  ArrowUpDown, Paperclip, MessageSquare, ShieldCheck, PenLine, ToggleLeft,
  GripVertical, Flag, Hand, AlertTriangle,
} from "lucide-react";
import type { FormDefinition, QuestionType } from "@/lib/forms/types";
import type { LogicIssue } from "@/lib/forms/logic";
import { QUESTION_TYPE_LABELS } from "@/lib/forms/defaults";
import { BwMenu } from "../ui";
import type { Selection } from "./BuilderApp";

export const TYPE_ICONS: Record<QuestionType, React.ComponentType<{ size?: number | string; strokeWidth?: number | string }>> = {
  short_text: Type,
  long_text: AlignLeft,
  email: Mail,
  phone: Phone,
  url: Link2,
  number: Hash,
  address: MapPin,
  single_choice: CircleDot,
  multiple_choice: CheckSquare,
  dropdown: ChevronDown,
  yes_no: ToggleLeft,
  picture_choice: ImageIcon,
  date: Calendar,
  time: Clock,
  opinion_scale: SlidersHorizontal,
  star_rating: Star,
  ranking: ArrowUpDown,
  file_upload: Paperclip,
  statement: MessageSquare,
  consent: ShieldCheck,
  signature: PenLine,
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
  type,
  title,
  onSelect,
  onDuplicate,
  onRemove,
}: {
  id: string;
  index: number;
  selected: boolean;
  hasIssue: boolean;
  type: QuestionType;
  title: string;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const Icon = TYPE_ICONS[type] ?? Type;
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 5 : undefined,
        position: "relative",
      }}
    >
      <div
        onClick={onSelect}
        className="bw-rail-row"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 6px 7px 2px",
          borderRadius: 10,
          cursor: "pointer",
          background: selected ? "var(--bw-paper-sunken)" : "transparent",
          boxShadow: selected ? "inset 2.5px 0 0 var(--bw-brand)" : "none",
          transition: "background 130ms ease",
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
            padding: "4px 1px",
            touchAction: "none",
            display: "flex",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={13} />
        </button>
        <span
          style={{
            width: 42,
            height: 26,
            borderRadius: 7,
            background: selected ? "var(--bw-brand)" : "var(--bw-paper-sunken)",
            color: selected ? "#fff" : "var(--bw-ink-soft)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            flexShrink: 0,
            fontSize: 11,
            fontWeight: 700,
            border: selected ? "none" : "1px solid var(--bw-line)",
          }}
        >
          <Icon size={11} strokeWidth={2.2} />
          {index + 1}
        </span>
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
          <span title="This question has a logic problem" style={{ color: "var(--bw-amber)", display: "flex" }}>
            <AlertTriangle size={13} />
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
        width: 288,
        minWidth: 244,
        flex: "0 0 auto",
        borderRight: "1px solid var(--bw-line)",
        background: "var(--bw-paper-raised)",
        overflowY: "auto",
        padding: "16px 12px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Welcome */}
      <span className="bw-label" style={{ margin: "0 4px 5px" }}>Welcome</span>
      <RailStaticRow
        selected={selection.kind === "welcome"}
        onClick={() => onSelect({ kind: "welcome" })}
        icon={<Hand size={13} strokeWidth={2.2} />}
        title={def.welcome.enabled ? def.welcome.title || "Welcome screen" : "Welcome screen (off)"}
        dim={!def.welcome.enabled}
      />

      {/* Questions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 4px 5px" }}>
        <span className="bw-label" style={{ margin: 0 }}>Questions</span>
        <button className="bw-btn bw-btn-primary bw-btn-sm" onClick={() => setPickerOpen((o) => !o)}>
          + Add
        </button>
      </div>

      {pickerOpen && (
        <div className="bw-card bw-fade-up" style={{ padding: 11, marginBottom: 8, borderRadius: 12 }}>
          {TYPE_GROUPS.map((group) => (
            <div key={group.label} style={{ marginBottom: 9 }}>
              <p className="bw-kicker" style={{ fontSize: 9.5, margin: "0 0 4px 4px" }}>
                {group.label}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                {group.types.map((t) => {
                  const Icon = TYPE_ICONS[t];
                  return (
                    <button
                      key={t}
                      className="bw-menu-item"
                      style={{ padding: "6px 7px", fontSize: 12.5, gap: 7 }}
                      onClick={() => {
                        onAdd(t);
                        setPickerOpen(false);
                      }}
                    >
                      <Icon size={12} strokeWidth={2} />
                      {QUESTION_TYPE_LABELS[t]}
                    </button>
                  );
                })}
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
            padding: "20px 12px",
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
              type={q.type}
              title={q.title}
              onSelect={() => onSelect({ kind: "question", id: q.id })}
              onDuplicate={() => onDuplicate(q.id)}
              onRemove={() => onRemove(q.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Endings */}
      <span className="bw-label" style={{ margin: "16px 4px 5px" }}>Endings</span>
      {def.endings.map((e) => (
        <RailStaticRow
          key={e.id}
          selected={selection.kind === "ending" && selection.id === e.id}
          onClick={() => onSelect({ kind: "ending", id: e.id })}
          icon={<Flag size={13} strokeWidth={2.2} />}
          title={e.title || "Ending"}
          badge={e.isDefault ? "default" : undefined}
        />
      ))}
    </aside>
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
  icon: React.ReactNode;
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
        background: selected ? "var(--bw-paper-sunken)" : "transparent",
        boxShadow: selected ? "inset 2.5px 0 0 var(--bw-brand)" : "none",
        opacity: dim ? 0.55 : 1,
        transition: "background 130ms ease",
        color: selected ? "var(--bw-ink-strong)" : "var(--bw-ink)",
      }}
    >
      <span style={{ display: "flex", color: selected ? "var(--bw-brand)" : "var(--bw-ink-soft)" }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 550, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </span>
      {badge && <span className="bw-chip bw-chip-grey" style={{ height: 18, fontSize: 9 }}>{badge}</span>}
    </div>
  );
}

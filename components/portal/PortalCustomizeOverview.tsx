"use client";

// "Customize overview" (Batch 1, 2026-08-17). A bottom-of-overview Edit button
// opens a full-page panel that slides in from the right (a drawer on mobile:
// swipe right to dismiss). The client reorders the moveable cards by dragging
// the handle, hides one with the X (or by dragging it into Hidden), and brings
// it back with +. Fixed cards show greyed and can't be moved. Layout persists
// per client (portalSaveOverviewLayout).

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PencilSimple, X, Plus, List, LockSimple, ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { PortalGlassCard } from "./PortalGlassCard";
import { P } from "./portal-ui";
import { portalSaveOverviewLayout } from "@/app/actions/portal";

type Item = { key: string; label: string };
type Container = "visible" | "hidden";

export function PortalCustomizeOverview({
  token,
  movable,
  order,
  hidden,
  fixed,
}: {
  token: string;
  movable: Item[];
  order: string[];
  hidden: string[];
  fixed: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <PortalGlassCard
        glassId="customize-edit"
        label="Customize overview"
        defaultVariant="v05"
        radius={16}
        className="pbtn pbtn-press"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
        }}
        style={{ cursor: "pointer" }}
      >
        <div className="flex items-center justify-center gap-2 py-3.5">
          <PencilSimple size={17} weight="bold" style={{ color: P.textPrimary }} />
          <span className="text-[14px] font-bold" style={{ color: P.textPrimary }}>Edit</span>
        </div>
      </PortalGlassCard>

      {open && typeof document !== "undefined" &&
        createPortal(<Panel token={token} movable={movable} order={order} hidden={hidden} fixed={fixed} onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Panel({
  token,
  movable,
  order,
  hidden,
  fixed,
  onClose,
}: {
  token: string;
  movable: Item[];
  order: string[];
  hidden: string[];
  fixed: string[];
  onClose: () => void;
}) {
  const labelOf = new Map(movable.map((m) => [m.key, m.label]));
  const presentKeys = movable.map((m) => m.key);
  const hiddenSet = new Set(hidden.filter((k) => labelOf.has(k)));
  const orderedPresent = [
    ...order.filter((k) => labelOf.has(k)),
    ...presentKeys.filter((k) => !order.includes(k)),
  ];

  const [items, setItems] = useState<{ visible: string[]; hidden: string[] }>({
    visible: orderedPresent.filter((k) => !hiddenSet.has(k)),
    hidden: orderedPresent.filter((k) => hiddenSet.has(k)),
  });
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  function containerOf(prev: { visible: string[]; hidden: string[] }, id: string): Container | null {
    if (id === "visible" || prev.visible.includes(id)) return "visible";
    if (id === "hidden" || prev.hidden.includes(id)) return "hidden";
    return null;
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setItems((prev) => {
      const from = containerOf(prev, activeId);
      const to = containerOf(prev, overId);
      if (!from || !to || from === to) return prev;
      const nextFrom = prev[from].filter((i) => i !== activeId);
      const overArr = prev[to];
      const overIndex = overId === to ? overArr.length : overArr.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : overArr.length;
      const nextTo = [...overArr.slice(0, insertAt), activeId, ...overArr.slice(insertAt)];
      return { ...prev, [from]: nextFrom, [to]: nextTo };
    });
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setItems((prev) => {
      const from = containerOf(prev, activeId);
      const to = containerOf(prev, overId);
      if (!from || !to || from !== to) return prev;
      const arr = prev[from];
      const oldIndex = arr.indexOf(activeId);
      const newIndex = arr.indexOf(overId);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;
      return { ...prev, [from]: arrayMove(arr, oldIndex, newIndex) };
    });
  }

  function move(id: string, to: Container) {
    setItems((prev) => {
      const from: Container = to === "visible" ? "hidden" : "visible";
      if (!prev[from].includes(id)) return prev;
      return { ...prev, [from]: prev[from].filter((i) => i !== id), [to]: [...prev[to], id] };
    });
  }

  function reset() {
    setItems({ visible: presentKeys.slice(), hidden: [] });
  }

  async function save() {
    setSaving(true);
    try {
      await portalSaveOverviewLayout({ token, order: items.visible, hidden: items.hidden });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Escape also closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Swipe right to dismiss (mobile drawer feel). A quick horizontal swipe won't
  // trip the drag handle (TouchSensor has a 150ms delay).
  const touch = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (t.clientX - start.x > 100 && Math.abs(t.clientY - start.y) < 70) onClose();
  }

  return (
    <div
      className="portal-panel fixed inset-0 z-[60] overflow-hidden"
      style={{
        backgroundColor: "#f6f8fc",
        backgroundImage: [
          "radial-gradient(40% 28% at 50% -4%, rgba(56,225,255,0.16), transparent 70%)",
          "radial-gradient(75% 55% at 8% 6%, rgba(255,188,168,0.28), transparent 72%)",
          "radial-gradient(70% 50% at 92% 12%, rgba(196,180,255,0.26), transparent 72%)",
          "radial-gradient(85% 60% at 50% 96%, rgba(255,208,176,0.30), transparent 75%)",
        ].join(","),
        backgroundRepeat: "no-repeat",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="max-w-lg mx-auto h-full flex flex-col">
        {/* Header: X top-left, centred title */}
        <div className="relative flex items-center justify-center px-5 pt-5 pb-3">
          <button
            type="button"
            onClick={() => onClose()}
            aria-label="Close"
            className="pbtn-press absolute left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: "rgba(15,23,42,0.06)", color: P.textPrimary }}
          >
            <X size={18} weight="bold" />
          </button>
          <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: P.textPrimary }}>
            Customize overview
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <Eyebrow>Visible</Eyebrow>

            {fixed.map((label) => (
              <FixedRow key={label} label={label} />
            ))}

            <SortableContext items={items.visible} strategy={verticalListSortingStrategy}>
              <DroppableZone id="visible">
                {items.visible.map((key) => (
                  <Row key={key} id={key} label={labelOf.get(key) ?? key} container="visible" onHide={(id) => move(id, "hidden")} onShow={() => {}} />
                ))}
              </DroppableZone>
            </SortableContext>

            <div className="h-4" />
            <Eyebrow>Hidden</Eyebrow>

            <SortableContext items={items.hidden} strategy={verticalListSortingStrategy}>
              <DroppableZone id="hidden">
                {items.hidden.length === 0 ? (
                  <div className="rounded-2xl px-4 py-6 text-center" style={{ border: `1px dashed ${P.border}` }}>
                    <p className="text-[13px]" style={{ color: P.textMuted }}>Drag a card here to hide it.</p>
                  </div>
                ) : (
                  items.hidden.map((key) => (
                    <Row key={key} id={key} label={labelOf.get(key) ?? key} container="hidden" onHide={() => {}} onShow={(id) => move(id, "visible")} />
                  ))
                )}
              </DroppableZone>
            </SortableContext>
          </DndContext>
        </div>

        {/* Footer: a floating Reset above our Save button (per the mock). */}
        <div className="px-5 pt-3 pb-4">
          <div className="flex justify-center mb-3">
            <button
              type="button"
              onClick={reset}
              className="pbtn-press inline-flex items-center gap-1.5 text-[13px] font-bold"
              style={{ color: P.accent }}
            >
              <ArrowClockwise size={15} weight="bold" />
              Reset
            </button>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="pbtn pbtn-press w-full py-3.5 rounded-xl text-[15px] font-bold text-white disabled:opacity-60"
            style={{ background: P.heroGradient, boxShadow: "0 2px 8px rgba(255,107,74,0.35)" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.09em] mb-2.5 mt-1 px-1" style={{ color: P.textMuted }}>
      {children}
    </p>
  );
}

function DroppableZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="min-h-[8px]">
      {children}
    </div>
  );
}

function Row({
  id,
  label,
  container,
  onHide,
  onShow,
}: {
  id: string;
  label: string;
  container: Container;
  onHide: (id: string) => void;
  onShow: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: "relative",
  };
  return (
    <div ref={setNodeRef} style={style} className="mb-2.5">
      <PortalGlassCard glassId="customize-row" label="Customize row" defaultVariant="v05" radius={14} className="flex items-center gap-2 pl-4 pr-2.5 py-3.5" style={{ boxShadow: "0 2px 6px rgba(15,23,42,0.05)" }}>
        <span className="flex-1 text-[15px] font-semibold truncate" style={{ color: P.textPrimary }}>{label}</span>
        {container === "hidden" ? (
          <button
            onClick={() => onShow(id)}
            aria-label={`Show ${label}`}
            className="pbtn-press w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ color: P.primary }}
          >
            <Plus size={18} weight="bold" />
          </button>
        ) : (
          <>
            <button
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${label}`}
              className="w-9 h-9 rounded-lg flex items-center justify-center cursor-grab"
              style={{ color: P.textMuted, touchAction: "none" }}
            >
              <List size={18} weight="bold" />
            </button>
            <button
              onClick={() => onHide(id)}
              aria-label={`Hide ${label}`}
              className="pbtn-press w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ color: P.textMuted }}
            >
              <X size={16} weight="bold" />
            </button>
          </>
        )}
      </PortalGlassCard>
    </div>
  );
}

function FixedRow({ label }: { label: string }) {
  return (
    <div className="mb-2.5">
      <PortalGlassCard glassId="customize-fixed" label="Fixed row" defaultVariant="v05" radius={14} className="flex items-center gap-2 px-4 py-3.5" style={{ opacity: 0.55, boxShadow: "0 2px 6px rgba(15,23,42,0.05)" }}>
        <span className="flex-1 text-[15px] font-semibold truncate" style={{ color: P.textPrimary }}>{label}</span>
        <LockSimple size={15} weight="regular" color={P.textMuted} aria-label="Fixed" />
      </PortalGlassCard>
    </div>
  );
}

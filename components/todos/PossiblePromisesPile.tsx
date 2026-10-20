"use client";

// The folded "Possible promises" pile on a file's To-Do tab (internal viewers
// only). Holds WhatsApp-scanned promises that were undated or the model was
// unsure about — deliberately quiet: no badge, no notification, just this
// collapsed row. One tap promotes one to a real to-do (pick the day) or
// dismisses it. Approved via the 2026-10-19 mock (whatsapp-todo artifact).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ManualTaskWithRelations } from "@/lib/services/manual-tasks";
import { promotePossiblePromiseAction, dismissPossiblePromiseAction } from "@/app/actions/manual-tasks";

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function PossiblePromisesPile({ initial }: { initial: ManualTaskWithRelations[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [day, setDay] = useState(tomorrowStr());
  const [pending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const promote = (id: string) => {
    startTransition(async () => {
      try {
        await promotePossiblePromiseAction(id, new Date(day + "T09:00:00").toISOString());
        setItems((xs) => xs.filter((x) => x.id !== id));
        setPickingFor(null);
        router.refresh();
      } catch {
        /* row stays; retry available */
      }
    });
  };

  const dismiss = (id: string) => {
    startTransition(async () => {
      try {
        await dismissPossiblePromiseAction(id);
        setItems((xs) => xs.filter((x) => x.id !== id));
      } catch {
        /* row stays; retry available */
      }
    });
  };

  return (
    <div
      className="mt-4 rounded-xl overflow-hidden"
      style={{ border: "1px dashed var(--agent-border-default)", background: "var(--agent-surface-sunken, rgba(0,0,0,0.02))" }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
        style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-muted)" }}
      >
        Possible promises
        <span
          className="rounded-full px-2 py-0.5"
          style={{ fontSize: 10.5, fontWeight: 700, background: "var(--agent-surface-raised, rgba(0,0,0,0.05))", color: "var(--agent-text-secondary)" }}
        >
          {items.length}
        </span>
        <span className="ml-auto" style={{ fontSize: 11, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>
          ›
        </span>
      </button>

      {open && (
        <div>
          {items.map((t) => (
            <div
              key={t.id}
              className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2"
              style={{ borderTop: "0.5px solid var(--agent-border-default)" }}
            >
              <div className="flex-1 min-w-[180px]">
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)", lineHeight: 1.4 }}>{t.title}</p>
                {t.notes && (
                  <p style={{ fontSize: 11, color: "var(--agent-text-muted)", lineHeight: 1.45, marginTop: 2 }}>
                    {t.notes}
                    {t.dueDate ? "" : " · no time given"}
                  </p>
                )}
              </div>

              {pickingFor === t.id ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="date"
                    value={day}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDay(e.target.value)}
                    className="rounded-lg px-2 py-1"
                    style={{ fontSize: 12, border: "1px solid var(--agent-border-default)", background: "var(--agent-surface, #fff)", color: "var(--agent-text-primary)" }}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => promote(t.id)}
                    className="agent-btn-primary rounded-lg px-3 py-1.5 disabled:opacity-50"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {pending ? "Adding…" : "Add to-do"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => setPickingFor(null)}
                    className="rounded-lg px-2.5 py-1.5"
                    style={{ fontSize: 12, border: "1px solid var(--agent-border-default)", color: "var(--agent-text-secondary)", background: "transparent" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setPickingFor(t.id);
                      setDay(t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : tomorrowStr());
                    }}
                    className="agent-btn-primary rounded-lg px-3 py-1.5 disabled:opacity-50"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    Add · pick day
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => dismiss(t.id)}
                    className="rounded-lg px-2.5 py-1.5 disabled:opacity-50"
                    style={{ fontSize: 12, border: "1px solid var(--agent-border-default)", color: "var(--agent-text-secondary)", background: "transparent" }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
          <p className="px-4 py-2" style={{ fontSize: 10.5, color: "var(--agent-text-muted)", borderTop: "0.5px solid var(--agent-border-default)" }}>
            Spotted in WhatsApp but missing a date, or we weren&rsquo;t certain. They wait here quietly; add the real ones, dismiss the rest.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

// Filters & labels. Left: saved filters with a visual builder (no query
// language — dropdown conditions with all/any matching). Right: label
// management. Favourited filters pin to the sidebar.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, Star, Tag, Trash2, Pencil, Plus } from "lucide-react";
import { useTodo } from "@/components/boardwalk/todo/TodoProvider";
import { ViewHeader, ViewShell } from "@/components/boardwalk/todo/ViewHeader";
import { BwButton, BwField, BwModal, useBwToast } from "@/components/boardwalk/ui";
import { formsApi } from "@/lib/forms/client";
import type { FilterCondition, FilterDto, FilterQuery } from "@/lib/todo/types";

const LABEL_COLORS = ["#c3c5c1", "#f4dfde", "#8f5a56", "#996c1f", "#3b6ea5", "#4d5a4d", "#404648"];

const DUE_OPTIONS = [
  ["today", "Due today"],
  ["overdue", "Overdue"],
  ["next_7_days", "Due in the next 7 days"],
  ["no_date", "No due date"],
] as const;

export default function FiltersPage() {
  const todo = useTodo();
  const router = useRouter();
  const { toast } = useBwToast();
  const [editing, setEditing] = useState<FilterDto | "new" | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [labelColor, setLabelColor] = useState(LABEL_COLORS[0]);

  async function addLabel() {
    const name = labelDraft.trim();
    if (!name) return;
    setLabelDraft("");
    await formsApi("/api/todo/labels", { method: "POST", body: JSON.stringify({ name, color: labelColor }) });
    await todo.refreshBootstrap();
  }

  async function removeLabel(id: string) {
    await formsApi(`/api/todo/labels/${id}`, { method: "DELETE" });
    await todo.refreshBootstrap();
    toast("Label removed from all tasks.");
  }

  async function recolourLabel(id: string, color: string) {
    await formsApi(`/api/todo/labels/${id}`, { method: "PATCH", body: JSON.stringify({ color }) });
    await todo.refreshBootstrap();
  }

  async function toggleFavouriteFilter(f: FilterDto) {
    await formsApi("/api/todo/filters", { method: "POST", body: JSON.stringify({ id: f.id, name: f.name, query: f.query, isFavorite: !f.isFavorite }) });
    await todo.refreshBootstrap();
  }

  async function removeFilter(id: string) {
    await formsApi(`/api/todo/filters/${id}`, { method: "DELETE" });
    await todo.refreshBootstrap();
  }

  return (
    <ViewShell>
      <ViewHeader kicker="Organise" title="Filters & labels" meta="Saved views and the label system, shared across every task." />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 18, alignItems: "start" }}>
        {/* ── Filters ── */}
        <section className="bw-card" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 7 }}>
              <SlidersHorizontal size={14} /> Saved filters
            </h2>
            <BwButton size="sm" variant="primary" onClick={() => setEditing("new")}>
              <Plus size={12} /> New filter
            </BwButton>
          </div>
          {todo.filters.length === 0 && (
            <p className="bw-hint" style={{ margin: 0 }}>
              A filter is a saved view: &quot;Priority 1 assigned to me&quot;, &quot;Overdue in Launch&quot;. Build one with dropdowns, favourite it, and it pins to your sidebar.
            </p>
          )}
          {todo.filters.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", borderBottom: "1px solid var(--bw-line)" }}>
              <button
                onClick={() => router.push(`/boardwalk/todo/filter/${f.id}`)}
                style={{ flex: 1, textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--bw-ink)", fontFamily: "var(--bw-font-sans)", padding: 0 }}
              >
                {f.name}
                <span className="bw-hint" style={{ display: "block", fontWeight: 500 }}>{describeQuery(f.query, todo)}</span>
              </button>
              <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Favourite" style={{ width: 26, padding: 0 }} onClick={() => void toggleFavouriteFilter(f)}>
                <Star size={13} fill={f.isFavorite ? "var(--bw-amber)" : "none"} style={{ color: f.isFavorite ? "var(--bw-amber)" : undefined }} />
              </button>
              <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Edit" style={{ width: 26, padding: 0 }} onClick={() => setEditing(f)}>
                <Pencil size={12} />
              </button>
              <button className="bw-btn bw-btn-danger bw-btn-sm" aria-label="Remove" style={{ width: 26, padding: 0 }} onClick={() => void removeFilter(f.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </section>

        {/* ── Labels ── */}
        <section className="bw-card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 7 }}>
            <Tag size={14} /> Labels
          </h2>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <input
              className="bw-input bw-input-sm"
              placeholder="New label name"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void addLabel()}
            />
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {LABEL_COLORS.slice(0, 4).map((c) => (
                <button key={c} aria-label={`Colour ${c}`} onClick={() => setLabelColor(c)} style={{ width: 16, height: 16, borderRadius: 99, background: c, border: labelColor === c ? "2px solid var(--bw-ink)" : "2px solid transparent", cursor: "pointer" }} />
              ))}
            </div>
            <BwButton size="sm" onClick={() => void addLabel()}>Add</BwButton>
          </div>
          {todo.labels.length === 0 && <p className="bw-hint" style={{ margin: 0 }}>Tag tasks across projects: @Valuations, @Urgent, @WaitingOn. Add labels from any task or in quick-add with @name.</p>}
          {todo.labels.map((l) => (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--bw-line)" }}>
              <button
                onClick={() => router.push(`/boardwalk/todo/label/${l.id}`)}
                style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: "var(--bw-ink)", fontFamily: "var(--bw-font-sans)", padding: 0 }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 99, background: l.color }} />
                {l.name}
              </button>
              <div style={{ display: "flex", gap: 3 }}>
                {LABEL_COLORS.map((c) => (
                  <button key={c} aria-label={`Set colour ${c}`} onClick={() => void recolourLabel(l.id, c)} style={{ width: 13, height: 13, borderRadius: 99, background: c, border: l.color === c ? "1.5px solid var(--bw-ink)" : "1.5px solid var(--bw-line)", cursor: "pointer" }} />
                ))}
              </div>
              <button className="bw-btn bw-btn-danger bw-btn-sm" aria-label="Remove label" style={{ width: 26, padding: 0 }} onClick={() => void removeLabel(l.id)}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </section>
      </div>

      {editing && <FilterBuilderModal existing={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </ViewShell>
  );
}

function describeQuery(q: FilterQuery, todo: ReturnType<typeof useTodo>): string {
  if (!q.conditions.length) return "No conditions";
  const parts = q.conditions.map((c) => {
    switch (c.field) {
      case "due": return DUE_OPTIONS.find(([v]) => v === c.value)?.[1] ?? c.value;
      case "priority": return `Priority ${c.value}`;
      case "assignee": return c.value === "me" ? "Assigned to me" : c.value === "none" ? "Unassigned" : `Assigned to ${todo.memberName(c.value)}`;
      case "project": return `In ${todo.projects.find((p) => p.id === c.value)?.name ?? "project"}`;
      case "label": return `@${todo.labels.find((l) => l.id === c.value)?.name ?? "label"}`;
      case "created": return "Created this week";
      default: return "";
    }
  });
  return parts.join(q.combinator === "or" ? " · or · " : " · and · ");
}

function FilterBuilderModal({ existing, onClose }: { existing: FilterDto | null; onClose: () => void }) {
  const todo = useTodo();
  const { toast } = useBwToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [combinator, setCombinator] = useState<"and" | "or">(existing?.query.combinator ?? "and");
  const [conditions, setConditions] = useState<FilterCondition[]>(existing?.query.conditions ?? [{ field: "due", value: "today" }]);
  const [busy, setBusy] = useState(false);

  function setCondition(i: number, patch: Partial<FilterCondition>) {
    setConditions((cs) => cs.map((c, x) => (x === i ? { ...c, ...patch } : c)));
  }

  function defaultValue(field: FilterCondition["field"]): string {
    switch (field) {
      case "due": return "today";
      case "priority": return "1";
      case "assignee": return "me";
      case "project": return todo.projects[0]?.id ?? "";
      case "label": return todo.labels[0]?.id ?? "";
      case "created": return "this_week";
    }
  }

  async function save() {
    if (!name.trim() || !conditions.length) return;
    setBusy(true);
    try {
      await formsApi("/api/todo/filters", {
        method: "POST",
        body: JSON.stringify({ id: existing?.id, name, query: { combinator, conditions }, isFavorite: existing?.isFavorite }),
      });
      await todo.refreshBootstrap();
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BwModal
      open
      onClose={onClose}
      title={existing ? "Edit filter" : "New filter"}
      width={520}
      footer={
        <>
          <BwButton onClick={onClose}>Cancel</BwButton>
          <BwButton variant="primary" loading={busy} disabled={!name.trim()} onClick={() => void save()}>Save filter</BwButton>
        </>
      }
    >
      <BwField label="Name">
        <input className="bw-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My urgent work" autoFocus />
      </BwField>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span className="bw-label" style={{ margin: 0 }}>Show tasks matching</span>
        <div className="bw-seg">
          <button data-active={combinator === "and"} onClick={() => setCombinator("and")}>all conditions</button>
          <button data-active={combinator === "or"} onClick={() => setCombinator("or")}>any condition</button>
        </div>
      </div>

      {conditions.map((c, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 7 }}>
          <select
            className="bw-select bw-input-sm"
            value={c.field}
            onChange={(e) => {
              const field = e.target.value as FilterCondition["field"];
              setCondition(i, { field, value: defaultValue(field) });
            }}
            style={{ width: 140 }}
          >
            <option value="due">Due</option>
            <option value="priority">Priority</option>
            <option value="assignee">Assignee</option>
            <option value="project">Project</option>
            <option value="label">Label</option>
            <option value="created">Created</option>
          </select>
          <select className="bw-select bw-input-sm" value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} style={{ flex: 1 }}>
            {c.field === "due" && DUE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            {c.field === "priority" && [1, 2, 3, 4].map((p) => <option key={p} value={String(p)}>Priority {p}</option>)}
            {c.field === "assignee" && (
              <>
                <option value="me">Me</option>
                <option value="none">Unassigned</option>
                {todo.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </>
            )}
            {c.field === "project" && todo.projects.filter((p) => !p.isTemplate).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {c.field === "label" && todo.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            {c.field === "created" && <option value="this_week">This week</option>}
          </select>
          <button className="bw-btn bw-btn-ghost bw-btn-sm" aria-label="Remove condition" style={{ width: 28, padding: 0 }} onClick={() => setConditions((cs) => cs.filter((_, x) => x !== i))}>
            ✕
          </button>
        </div>
      ))}
      <BwButton size="sm" onClick={() => setConditions((cs) => [...cs, { field: "due", value: "today" }])}>
        + Add condition
      </BwButton>
    </BwModal>
  );
}

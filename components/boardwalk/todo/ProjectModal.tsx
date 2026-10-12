"use client";

// Create / edit project modal — name, colour, visibility, description, and
// (when creating) a template picker: six built-in estate-agency templates
// plus any project the team has saved as a template. ShareModal manages
// members on a project.

import { useState } from "react";
import { useBwToast, BwButton, BwField, BwModal, BwSwitch } from "../ui";
import { formsApi } from "@/lib/forms/client";
import { TODO_TEMPLATES } from "@/lib/todo/templates";
import type { ProjectDto } from "@/lib/todo/types";
import { useTodo } from "./TodoProvider";

const PROJECT_COLORS = ["#404648", "#4d5a4d", "#8f5a56", "#996c1f", "#3b6ea5", "#55604f", "#2b3032", "#b5542d"];

export function ProjectModal({
  existing,
  onClose,
  onCreated,
}: {
  existing?: ProjectDto;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const todo = useTodo();
  const { toast } = useBwToast();
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? PROJECT_COLORS[0]);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isPrivate, setIsPrivate] = useState(existing?.visibility === "private");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [savedTemplateId, setSavedTemplateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const savedTemplates = todo.projects.filter((p) => p.isTemplate);

  async function submit() {
    setBusy(true);
    try {
      if (existing) {
        await formsApi(`/api/todo/projects/${existing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, color, description, visibility: isPrivate ? "private" : "team" }),
        });
        await todo.refreshBootstrap();
        toast("Project updated.");
        onCreated(existing.id);
        return;
      }
      let projectId: string;
      if (templateId) {
        const res = await formsApi<{ project: { id: string } }>("/api/todo/projects/from-template", {
          method: "POST",
          body: JSON.stringify({ templateId }),
        });
        projectId = res.project.id;
      } else if (savedTemplateId) {
        const res = await formsApi<{ project: { id: string } }>("/api/todo/projects/from-template", {
          method: "POST",
          body: JSON.stringify({ projectId: savedTemplateId, name: name || undefined }),
        });
        projectId = res.project.id;
      } else {
        const res = await formsApi<{ project: { id: string } }>("/api/todo/projects", {
          method: "POST",
          body: JSON.stringify({ name, color, description, visibility: isPrivate ? "private" : "team" }),
        });
        projectId = res.project.id;
      }
      await todo.refreshBootstrap();
      onCreated(projectId);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  const usingTemplate = !!(templateId || savedTemplateId);

  return (
    <BwModal
      open
      onClose={onClose}
      title={existing ? "Edit project" : "New project"}
      width={existing ? 480 : 640}
      footer={
        <>
          <BwButton onClick={onClose}>Cancel</BwButton>
          <BwButton variant="primary" loading={busy} disabled={!existing && !usingTemplate && !name.trim()} onClick={() => void submit()}>
            {existing ? "Save" : usingTemplate ? "Create from template" : "Create project"}
          </BwButton>
        </>
      }
    >
      {!existing && (
        <>
          <p className="bw-label" style={{ marginBottom: 8 }}>Start from an agency template</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 8, marginBottom: 8 }}>
            {TODO_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTemplateId(templateId === t.id ? null : t.id);
                  setSavedTemplateId(null);
                }}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  borderRadius: 11,
                  border: `2px solid ${templateId === t.id ? "var(--bw-brand)" : "var(--bw-line)"}`,
                  background: "var(--bw-paper-raised)",
                  cursor: "pointer",
                  fontFamily: "var(--bw-font-sans)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 650, marginBottom: 3 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color }} />
                  {t.name}
                </span>
                <span className="bw-hint" style={{ display: "block", fontSize: 11.5, lineHeight: 1.4 }}>{t.description}</span>
                <span style={{ fontSize: 10.5, color: "var(--bw-ink-faint)" }}>{t.tasks.length} tasks · {t.sections.length} sections</span>
              </button>
            ))}
          </div>
          {savedTemplates.length > 0 && (
            <>
              <p className="bw-label" style={{ margin: "10px 0 6px" }}>Your saved templates</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {savedTemplates.map((t) => (
                  <button
                    key={t.id}
                    className="bw-btn bw-btn-sm"
                    style={{
                      border: `2px solid ${savedTemplateId === t.id ? "var(--bw-brand)" : "var(--bw-line-strong)"}`,
                      background: "var(--bw-paper-raised)",
                      color: "var(--bw-ink)",
                    }}
                    onClick={() => {
                      setSavedTemplateId(savedTemplateId === t.id ? null : t.id);
                      setTemplateId(null);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0 14px" }}>
            <span style={{ flex: 1, height: 1, background: "var(--bw-line)" }} />
            <span className="bw-hint">or start blank</span>
            <span style={{ flex: 1, height: 1, background: "var(--bw-line)" }} />
          </div>
        </>
      )}

      {!usingTemplate && (
        <>
          <BwField label="Project name">
            <input className="bw-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!!existing} placeholder="e.g. Spring campaign" />
          </BwField>
          <BwField label="Colour">
            <div style={{ display: "flex", gap: 7 }}>
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`Colour ${c}`}
                  onClick={() => setColor(c)}
                  style={{ width: 24, height: 24, borderRadius: 999, background: c, border: color === c ? "2.5px solid var(--bw-paper)" : "2.5px solid transparent", outline: color === c ? `2px solid ${c}` : "none", cursor: "pointer" }}
                />
              ))}
            </div>
          </BwField>
          <BwField label="Description (optional)">
            <input className="bw-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </BwField>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>Private project</p>
              <p className="bw-hint" style={{ margin: "2px 0 0" }}>Only people you share it with can see it. Otherwise the whole team can.</p>
            </div>
            <BwSwitch on={isPrivate} onToggle={setIsPrivate} label="Private project" />
          </div>
        </>
      )}
    </BwModal>
  );
}

export function ShareModal({ project, onClose }: { project: ProjectDto; onClose: () => void }) {
  const todo = useTodo();
  const { toast } = useBwToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggleMember(userId: string, isMember: boolean) {
    setBusy(userId);
    try {
      await formsApi(`/api/todo/projects/${project.id}/share`, {
        method: "POST",
        body: JSON.stringify({ userId, remove: isMember }),
      });
      await todo.refreshBootstrap();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <BwModal open onClose={onClose} title={`Share "${project.name}"`} width={440} footer={<BwButton onClick={onClose}>Done</BwButton>}>
      <p className="bw-hint" style={{ margin: "0 0 12px" }}>
        {project.visibility === "team"
          ? "This project is visible to the whole team. Adding people here pins it to their sidebar and lets you assign them tasks."
          : "This project is private. Only the people below can see it."}
      </p>
      {todo.members.map((m) => {
        const isMember = project.memberIds.includes(m.id);
        const isOwner = m.id === project.createdById;
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--bw-line)" }}>
            <span style={{ width: 28, height: 28, borderRadius: 99, background: "var(--bw-blush)", color: "var(--bw-blush-ink)", fontSize: 10.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              {m.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13.5, fontWeight: 600, margin: 0 }}>
                {m.name} {m.id === todo.me && <span className="bw-hint">(you)</span>}
              </p>
              <p className="bw-hint" style={{ margin: 0 }}>{isOwner ? "Owner" : isMember ? "Member" : "Not a member"}</p>
            </div>
            {!isOwner && (
              <BwButton size="sm" variant={isMember ? "ghost" : "secondary"} loading={busy === m.id} onClick={() => void toggleMember(m.id, isMember)}>
                {isMember ? "Remove" : "Add"}
              </BwButton>
            )}
          </div>
        );
      })}
    </BwModal>
  );
}

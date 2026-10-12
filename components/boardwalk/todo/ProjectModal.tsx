"use client";

// Project creation — second-pass: a two-step flow. Step one is a visual
// template gallery (six estate-agency workflows with icons, real task and
// section counts, plus saved team templates) or "start blank"; step two is
// the simple configuration form. Editing an existing project goes straight
// to configuration. ShareModal manages members.

import { useState } from "react";
import {
  Home, Rocket, TrendingUp, Megaphone, ClipboardList, UserPlus, Hash,
  ArrowLeft, Sparkles,
} from "lucide-react";
import { useBwToast, BwButton, BwField, BwModal, BwSwitch } from "../ui";
import { formsApi } from "@/lib/forms/client";
import { TODO_TEMPLATES } from "@/lib/todo/templates";
import type { ProjectDto } from "@/lib/todo/types";
import { useTodo } from "./TodoProvider";

const PROJECT_COLORS = ["#404648", "#4d5a4d", "#8f5a56", "#996c1f", "#3b6ea5", "#55604f", "#2b3032", "#b5542d"];

const TEMPLATE_ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  Home, Rocket, TrendingUp, Megaphone, ClipboardList, UserPlus,
};

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
  const [step, setStep] = useState<"choose" | "configure">(existing ? "configure" : "choose");
  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState(existing?.color ?? PROJECT_COLORS[0]);
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isPrivate, setIsPrivate] = useState(existing?.visibility === "private");
  const [busyId, setBusyId] = useState<string | null>(null);

  const savedTemplates = todo.projects.filter((p) => p.isTemplate);

  async function createFromTemplate(templateId?: string, savedProjectId?: string) {
    setBusyId(templateId ?? savedProjectId ?? "blank");
    try {
      const res = await formsApi<{ project: { id: string } }>(
        "/api/todo/projects/from-template",
        { method: "POST", body: JSON.stringify(templateId ? { templateId } : { projectId: savedProjectId }) }
      );
      await todo.refreshBootstrap();
      onCreated(res.project.id);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusyId(null);
    }
  }

  async function submitConfigure() {
    setBusyId("blank");
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
      const res = await formsApi<{ project: { id: string } }>("/api/todo/projects", {
        method: "POST",
        body: JSON.stringify({ name, color, description, visibility: isPrivate ? "private" : "team" }),
      });
      await todo.refreshBootstrap();
      onCreated(res.project.id);
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusyId(null);
    }
  }

  // ── Step 1: template gallery ──
  if (step === "choose") {
    return (
      <BwModal open onClose={onClose} title="New project" width={660}>
        <button
          onClick={() => setStep("configure")}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px dashed var(--bw-line-strong)", background: "transparent", cursor: "pointer", fontFamily: "var(--bw-font-sans)", textAlign: "left", marginBottom: 14 }}
        >
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "var(--bw-paper-sunken)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--bw-brand)" }}>
            <Sparkles size={16} />
          </span>
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 650, color: "var(--bw-ink)" }}>Start blank</span>
            <span className="bw-hint">Name it, colour it, build your own structure.</span>
          </span>
        </button>

        <p className="bw-kicker" style={{ fontSize: 9.5, margin: "0 0 8px" }}>Agency templates</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
          {TODO_TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICONS[t.icon] ?? Hash;
            return (
              <button
                key={t.id}
                disabled={busyId !== null}
                onClick={() => void createFromTemplate(t.id)}
                style={{
                  textAlign: "left",
                  padding: "12px 13px",
                  borderRadius: 12,
                  border: "1px solid var(--bw-line)",
                  background: "var(--bw-paper-raised)",
                  cursor: "pointer",
                  fontFamily: "var(--bw-font-sans)",
                  transition: "border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                  opacity: busyId && busyId !== t.id ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--bw-line-strong)";
                  e.currentTarget.style.boxShadow = "var(--bw-shadow)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--bw-line)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "none";
                }}
              >
                <span style={{ width: 30, height: 30, borderRadius: 9, background: `color-mix(in srgb, ${t.color} 12%, transparent)`, color: t.color, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  {busyId === t.id ? <span style={{ width: 12, height: 12, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: 99, display: "inline-block", animation: "bw-spin-pm 0.7s linear infinite" }} /> : <Icon size={15} />}
                </span>
                <span style={{ display: "block", fontSize: 13, fontWeight: 650, color: "var(--bw-ink)", marginBottom: 2 }}>{t.name}</span>
                <span className="bw-hint" style={{ display: "block", fontSize: 11, lineHeight: 1.45, marginBottom: 6 }}>{t.description}</span>
                <span style={{ fontSize: 10.5, color: "var(--bw-ink-faint)", fontWeight: 600 }}>
                  {t.tasks.length} tasks · {t.sections.length} sections
                </span>
              </button>
            );
          })}
        </div>

        {savedTemplates.length > 0 && (
          <>
            <p className="bw-kicker" style={{ fontSize: 9.5, margin: "14px 0 8px" }}>Your saved templates</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {savedTemplates.map((t) => (
                <button
                  key={t.id}
                  className="bw-btn bw-btn-secondary bw-btn-sm"
                  disabled={busyId !== null}
                  onClick={() => void createFromTemplate(undefined, t.id)}
                >
                  <Hash size={11} style={{ color: t.color }} /> {t.name}
                </button>
              ))}
            </div>
          </>
        )}
        <style>{`@keyframes bw-spin-pm { to { transform: rotate(360deg); } }`}</style>
      </BwModal>
    );
  }

  // ── Step 2: configure (blank create or edit) ──
  return (
    <BwModal
      open
      onClose={onClose}
      title={existing ? "Edit project" : "New project"}
      width={460}
      footer={
        <>
          {!existing && (
            <BwButton onClick={() => setStep("choose")} style={{ marginRight: "auto" }}>
              <ArrowLeft size={12} /> Templates
            </BwButton>
          )}
          <BwButton onClick={onClose}>Cancel</BwButton>
          <BwButton variant="primary" loading={busyId !== null} disabled={!name.trim()} onClick={() => void submitConfigure()}>
            {existing ? "Save" : "Create project"}
          </BwButton>
        </>
      }
    >
      <BwField label="Project name">
        <input className="bw-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Spring campaign" />
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

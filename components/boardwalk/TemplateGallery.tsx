"use client";

// Full-page template gallery at /boardwalk/typeform/new. Every card draws a
// true miniature from the template's REAL definition (theme + welcome copy),
// lists its first questions, and offers Preview (full-screen, interactive,
// nothing saved) and Use (creates the form, straight into the builder).

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FORM_TEMPLATES, type FormTemplate, type TemplateCategory } from "@/lib/forms/templates";
import type { FormDefinition } from "@/lib/forms/types";
import { formsApi } from "@/lib/forms/client";
import { BwButton, useBwToast } from "./ui";
import { FormMiniPreview } from "./FormMiniPreview";
import { FormRunner, type RunnerForm } from "./runner/FormRunner";

const CATEGORIES: ("All" | TemplateCategory)[] = ["All", "Selling", "Buying", "Feedback", "General"];

function runnerFormFromDefinition(def: FormDefinition, name: string, tenantName: string): RunnerForm {
  return {
    publicId: "template-preview",
    title: name,
    welcome: def.welcome,
    questions: def.questions,
    endings: def.endings,
    theme: def.theme,
    hiddenFields: [],
    tenantName,
  };
}

export function TemplateGallery({ tenantName }: { tenantName: string }) {
  const router = useRouter();
  const { toast } = useBwToast();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<FormTemplate | null>(null);

  // Build each template's definition once — gives the mini previews their
  // real theme/copy and the question peek its real titles.
  const built = useMemo(
    () =>
      FORM_TEMPLATES.map((t) => {
        const def = t.build();
        return {
          template: t,
          def,
          preview: {
            primaryColor: def.theme.primaryColor,
            backgroundColor: def.theme.backgroundColor,
            textColor: def.theme.textColor,
            buttonTextColor: def.theme.buttonTextColor,
            font: def.theme.font,
            buttonRadius: def.theme.buttonRadius,
            welcomeTitle: def.welcome.title,
            buttonText: def.welcome.buttonText,
          },
          questionPeek: def.questions.filter((q) => q.type !== "statement").slice(0, 3).map((q) => q.title),
        };
      }),
    []
  );

  const visible = category === "All" ? built : built.filter((b) => b.template.category === category);

  async function createFromTemplate(templateId?: string) {
    setBusyId(templateId ?? "blank");
    try {
      const res = await formsApi<{ id: string }>("/api/forms", {
        method: "POST",
        body: JSON.stringify(templateId ? { templateId } : {}),
      });
      router.push(`/boardwalk/typeform/${res.id}`);
    } catch (err) {
      toast((err as Error).message, "error");
      setBusyId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto", padding: "34px 24px 90px" }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 26 }}>
        <Link href="/boardwalk/typeform" className="bw-btn bw-btn-ghost bw-btn-sm" style={{ marginLeft: -10, marginBottom: 14 }}>
          ← Your forms
        </Link>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <p className="bw-kicker" style={{ margin: "0 0 8px" }}>New form</p>
            <h1 className="bw-display" style={{ fontSize: 32, margin: 0, lineHeight: 1.1 }}>
              Start with a template, or a blank page.
            </h1>
            <p style={{ color: "var(--bw-ink-soft)", fontSize: 14, margin: "8px 0 0", maxWidth: 560, lineHeight: 1.55 }}>
              Every template is a working form with realistic questions and smart routing already
              wired in. Pick one, make it yours, publish.
            </p>
          </div>
          <BwButton
            variant="secondary"
            size="lg"
            loading={busyId === "blank"}
            onClick={() => createFromTemplate()}
          >
            ✦ Start from scratch
          </BwButton>
        </div>
      </div>

      {/* ── Category filter ── */}
      <div className="bw-seg" style={{ marginBottom: 24 }}>
        {CATEGORIES.map((c) => (
          <button key={c} data-active={category === c} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {/* ── Gallery ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
        {visible.map(({ template, preview, questionPeek }) => (
          <div key={template.id} className="bw-card bw-card-hover bw-fade-up" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <button
              aria-label={`Preview ${template.name}`}
              onClick={() => setPreviewTemplate(template)}
              style={{ border: "none", padding: 0, cursor: "zoom-in", display: "block", textAlign: "inherit", background: "transparent" }}
            >
              <FormMiniPreview preview={preview} height={160} />
            </button>
            <div style={{ padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 10, flex: 1, borderTop: "1px solid var(--bw-line)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <h3 style={{ fontSize: 15.5, fontWeight: 650, margin: 0 }}>{template.name}</h3>
                <span className="bw-chip bw-chip-grey">{template.category}</span>
              </div>
              <p className="bw-hint" style={{ margin: 0, lineHeight: 1.55 }}>{template.description}</p>
              <ul style={{ margin: "2px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>
                {questionPeek.map((q, i) => (
                  <li key={i} style={{ fontSize: 12.5, color: "var(--bw-ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ color: "var(--bw-ink-faint)", marginRight: 6 }}>{i + 1}.</span>
                    {q}
                  </li>
                ))}
                {template.questionCount > 3 && (
                  <li style={{ fontSize: 12, color: "var(--bw-ink-faint)" }}>+ {template.questionCount - 3} more</li>
                )}
              </ul>
              <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 12 }}>
                <BwButton size="sm" onClick={() => setPreviewTemplate(template)}>
                  Preview
                </BwButton>
                <BwButton
                  size="sm"
                  variant="primary"
                  loading={busyId === template.id}
                  onClick={() => createFromTemplate(template.id)}
                  style={{ flex: 1 }}
                >
                  Use this template
                </BwButton>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Full-screen interactive preview ── */}
      {previewTemplate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "var(--bw-paper)" }}>
          <div
            style={{
              position: "fixed",
              top: 14,
              left: 14,
              zIndex: 95,
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <BwButton size="sm" onClick={() => setPreviewTemplate(null)}>
              ← Back to templates
            </BwButton>
            <BwButton
              size="sm"
              variant="primary"
              loading={busyId === previewTemplate.id}
              onClick={() => createFromTemplate(previewTemplate.id)}
            >
              Use this template
            </BwButton>
          </div>
          <div style={{ height: "100vh", overflowY: "auto" }}>
            <FormRunner
              key={previewTemplate.id}
              form={runnerFormFromDefinition(previewTemplate.build(), previewTemplate.name, tenantName)}
              mode="preview"
            />
          </div>
        </div>
      )}
    </div>
  );
}

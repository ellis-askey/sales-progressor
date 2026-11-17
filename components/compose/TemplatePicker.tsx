"use client";

// Template picker for the email composer. A floating two-pane panel over the
// message area: search + list (left), live preview resolved against the file
// (right). Hover/focus updates the preview with a quick crossfade; a click
// inserts the resolved template into the editor with a short "zoom into place"
// animation (overlay only — the editor DOM is never moved). On mobile it's a
// touch sheet: list → populated preview → Use template.
//
// Colour rule: hover = neutral shade, active row = coral ring/text — never a
// washed-out orange fill.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, X, MapPin, Info, Stack, Buildings, User as UserIcon, CaretLeft } from "@phosphor-icons/react";
import {
  listEmailTemplates, getTemplatePreviewContext, type EmailTemplateDTO,
} from "@/app/actions/email-templates";
import { renderTemplateBody, tokensInBody, templateVarLabel, type TemplateVarValues, type TemplateVarKey } from "@/lib/email/templates/variables";

export type TemplateInsertMode = "replace" | "cursor";

export function TemplatePicker({
  open,
  onClose,
  transactionId,
  fileLabel,
  hasDraft,
  getEditorRect,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  transactionId: string | null;
  fileLabel: string | null;
  hasDraft: boolean;
  getEditorRect: () => DOMRect | null;
  onInsert: (html: string, subject: string | null, mode: TemplateInsertMode) => void;
}) {
  const [templates, setTemplates] = useState<EmailTemplateDTO[] | null>(null);
  const [values, setValues] = useState<TemplateVarValues>({});
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [fill, setFill] = useState<{ id: string; keys: TemplateVarKey[]; extra: Record<string, string> } | null>(null);
  const [animating, setAnimating] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load templates + the file's variable values when opened.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const list = await listEmailTemplates();
        if (!alive) return;
        setTemplates(list);
        setActiveId((cur) => cur ?? list[0]?.id ?? null);
      } catch { if (alive) setTemplates([]); }
      if (transactionId) {
        try { const ctx = await getTemplatePreviewContext(transactionId); if (alive) setValues(ctx?.values ?? {}); }
        catch { if (alive) setValues({}); }
      }
    })();
    return () => { alive = false; };
  }, [open, transactionId]);

  useEffect(() => {
    if (!open) { setQuery(""); setMobilePreview(false); setFill(null); }
  }, [open]);

  const filtered = useMemo(() => {
    const t = templates ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return t;
    return t.filter((x) => x.name.toLowerCase().includes(q) || (x.description ?? "").toLowerCase().includes(q));
  }, [templates, query]);

  const active = useMemo(() => filtered.find((t) => t.id === activeId) ?? filtered[0] ?? null, [filtered, activeId]);

  const preview = useMemo(() => {
    if (!active) return { html: "", missing: [] as TemplateVarKey[] };
    return renderTemplateBody(active.body, values, "preview");
  }, [active, values]);

  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Resolve a template → final HTML, merging any user-supplied missing values.
  const resolveFinal = useCallback((t: EmailTemplateDTO, extra: Record<string, string>) => {
    const merged: TemplateVarValues = { ...values };
    for (const [k, v] of Object.entries(extra)) if (v.trim()) merged[k as TemplateVarKey] = v.trim();
    return renderTemplateBody(t.body, merged, "email");
  }, [values]);

  const finishInsert = useCallback((t: EmailTemplateDTO, extra: Record<string, string>) => {
    const { html } = resolveFinal(t, extra);
    const mode: TemplateInsertMode = hasDraft ? "cursor" : "replace";
    const run = () => { onInsert(html, t.subject, mode); onClose(); };
    const src = previewRef.current?.getBoundingClientRect();
    const dst = getEditorRect();
    if (reducedMotion || !src || !dst) { run(); return; }
    // Overlay clone that scales from the preview toward the editor.
    const clone = document.createElement("div");
    clone.className = "tp-fly";
    clone.textContent = t.name;
    Object.assign(clone.style, {
      position: "fixed", left: `${src.left}px`, top: `${src.top}px`,
      width: `${src.width}px`, height: `${Math.min(src.height, 150)}px`,
    });
    document.body.appendChild(clone);
    setAnimating(true);
    requestAnimationFrame(() => {
      const tx = dst.left + dst.width / 2 - (src.left + src.width / 2);
      const ty = dst.top + 40 - src.top;
      clone.style.transform = `translate(${tx}px, ${ty}px) scale(0.26)`;
      clone.style.opacity = "0";
    });
    window.setTimeout(() => { clone.remove(); setAnimating(false); run(); }, 320);
  }, [resolveFinal, hasDraft, onInsert, onClose, getEditorRect, reducedMotion]);

  const onPick = useCallback((t: EmailTemplateDTO) => {
    const used = tokensInBody(t.body);
    const missing = used.filter((k) => { const v = values[k]; return !(typeof v === "string" && v.trim()); });
    if (missing.length > 0) { setFill({ id: t.id, keys: missing, extra: {} }); return; }
    finishInsert(t, {});
  }, [values, finishInsert]);

  if (!open) return null;

  const empty = templates !== null && templates.length === 0;

  return (
    <div className={`tp ${animating ? "tp-dim" : ""}`} role="dialog" aria-label="Email templates">
      <div className={`tp-panel ${mobilePreview ? "tp-mobile-preview" : ""}`}>
        {/* Header */}
        <div className="tp-hd">
          {mobilePreview ? (
            <button type="button" className="tp-back" onClick={() => setMobilePreview(false)}><CaretLeft size={16} weight="bold" /></button>
          ) : (
            <span className="tp-hd-ic"><Stack size={16} weight="fill" /></span>
          )}
          <span className="tp-hd-ttl">{mobilePreview && active ? active.name : "Email templates"}</span>
          <button type="button" className="tp-x" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        {empty ? (
          <div className="tp-empty">
            <div className="tp-empty-ic"><Stack size={24} weight="fill" /></div>
            <div className="tp-empty-h">No templates yet</div>
            <p className="tp-empty-p">Create templates in Settings → Email templates to reuse them here.</p>
          </div>
        ) : fill ? (
          <MissingValues
            fill={fill}
            onChange={(extra) => setFill((f) => (f ? { ...f, extra } : f))}
            onBack={() => setFill(null)}
            onConfirm={() => { const t = (templates ?? []).find((x) => x.id === fill.id); if (t) finishInsert(t, fill.extra); }}
          />
        ) : (
          <div className="tp-cols">
            {/* List */}
            <div className="tp-list-col">
              <div className="tp-search">
                <MagnifyingGlass size={15} weight="bold" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates…" aria-label="Search templates" />
              </div>
              <div className="tp-list">
                {(templates === null) ? (
                  <div className="tp-list-loading">Loading…</div>
                ) : filtered.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`tp-item ${t.id === active?.id ? "on" : ""}`}
                    onMouseEnter={() => setActiveId(t.id)}
                    onFocus={() => setActiveId(t.id)}
                    onClick={() => { if (window.matchMedia("(max-width: 640px)").matches) { setActiveId(t.id); setMobilePreview(true); } else onPick(t); }}
                  >
                    <span className="tp-item-ic"><Stack size={15} weight={t.id === active?.id ? "fill" : "regular"} /></span>
                    <span className="tp-item-txt">
                      <span className="tp-item-name">{t.name}{t.scope === "company" && <Buildings size={11} weight="fill" className="tp-item-co" />}</span>
                      {t.description && <span className="tp-item-desc">{t.description}</span>}
                    </span>
                  </button>
                ))}
                {templates !== null && filtered.length === 0 && <div className="tp-list-none">No templates match.</div>}
              </div>
            </div>

            {/* Preview */}
            <div className="tp-prev-col">
              <div className="tp-prev-top">
                <span className="tp-prev-badge">Preview</span>
                {active && <span className="tp-prev-name">{active.name}</span>}
              </div>
              <div className="tp-prev-scroll" ref={previewRef}>
                {active ? (
                  <div key={active.id} className="tp-prev-email tp-fade" dangerouslySetInnerHTML={{ __html: preview.html || "<p>Empty template.</p>" }} />
                ) : <div className="tp-prev-email">Select a template.</div>}
              </div>
              <div className="tp-prev-foot">
                {transactionId ? (
                  <><MapPin size={13} weight="fill" /> <span>Personalised for this file{fileLabel ? `: ${fileLabel}` : ""}</span></>
                ) : (
                  <><Info size={13} /> <span>Open from a file to resolve details</span></>
                )}
                {preview.missing.length > 0 && <span className="tp-prev-miss">· {preview.missing.length} not set</span>}
              </div>
              {active && (
                <button type="button" className="tp-use" onClick={() => onPick(active)}>Use template</button>
              )}
            </div>
          </div>
        )}
      </div>
      <button type="button" className="tp-scrim" aria-label="Close templates" onClick={onClose} />
      <style>{TP_CSS}</style>
    </div>
  );
}

function MissingValues({ fill, onChange, onBack, onConfirm }: {
  fill: { id: string; keys: TemplateVarKey[]; extra: Record<string, string> };
  onChange: (extra: Record<string, string>) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="tp-fill">
      <div className="tp-fill-h">Some details aren&rsquo;t on this file</div>
      <p className="tp-fill-p">Add them for this email, or leave blank to show a clear gap.</p>
      <div className="tp-fill-fields">
        {fill.keys.map((k) => (
          <label key={k} className="tp-fill-field">
            <span>{templateVarLabel(k)}</span>
            <input
              value={fill.extra[k] ?? ""}
              onChange={(e) => onChange({ ...fill.extra, [k]: e.target.value })}
              placeholder={`Add ${templateVarLabel(k).toLowerCase()}`}
            />
          </label>
        ))}
      </div>
      <div className="tp-fill-ft">
        <button type="button" className="tp-btn-ghost" onClick={onBack}>Back</button>
        <button type="button" className="tp-use tp-use-inline" onClick={onConfirm}>Insert template</button>
      </div>
    </div>
  );
}

const TP_CSS = `
.tp { position: absolute; top: 0; left: 0; right: 0; height: min(400px, 68vh); z-index: 60; display: flex; align-items: stretch; justify-content: stretch; }
.tp-scrim { position: absolute; inset: 0; background: rgba(20,14,10,0.14); backdrop-filter: blur(1px); border: 0; cursor: default; z-index: 0; animation: tp-fade .15s ease; }
.tp-panel { position: relative; z-index: 1; margin: 8px; flex: 1; display: flex; flex-direction: column; background: var(--agent-surface-glass, rgba(255,255,255,0.86)); backdrop-filter: blur(30px) saturate(1.8); border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 14px; box-shadow: 0 18px 50px rgba(20,14,10,0.22); overflow: hidden; animation: tp-pop .18s cubic-bezier(.2,.8,.3,1); min-height: 0; }
@keyframes tp-fade { from { opacity: 0; } }
@keyframes tp-pop { from { opacity: 0; transform: translateY(6px) scale(.985); } }
.tp-dim .tp-panel { opacity: 0; transition: opacity .18s ease; }
.tp-hd { display: flex; align-items: center; gap: 9px; padding: 11px 13px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); }
.tp-hd-ic { color: var(--agent-coral-deep, #E2452A); display: inline-flex; }
.tp-hd-ttl { font-size: 13.5px; font-weight: 700; color: var(--agent-text-primary, #2D1810); }
.tp-x, .tp-back { margin-left: auto; width: 28px; height: 28px; display: grid; place-items: center; border: 0; background: none; border-radius: 8px; color: var(--agent-text-muted); cursor: pointer; transition: background .13s; }
.tp-back { margin-left: 0; margin-right: 2px; }
.tp-x:hover, .tp-back:hover { background: var(--agent-hover-shade, rgba(45,24,16,0.05)); }
.tp-cols { display: grid; grid-template-columns: 0.82fr 1fr; flex: 1; min-height: 0; }
.tp-list-col { display: flex; flex-direction: column; border-right: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); min-height: 0; }
.tp-search { display: flex; align-items: center; gap: 8px; margin: 10px 10px 6px; padding: 7px 10px; background: #fff; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 9px; color: var(--agent-text-muted); }
.tp-search:focus-within { border-color: var(--agent-coral-deep, #E2452A); }
.tp-search input { flex: 1; border: 0; outline: 0; background: none; font-size: 13px; color: var(--agent-text-primary, #2D1810); }
.tp-list { flex: 1; overflow-y: auto; padding: 2px 6px 8px; min-height: 0; }
.tp-list-loading, .tp-list-none { font-size: 12.5px; color: var(--agent-text-muted); padding: 14px 10px; }
.tp-item { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left; padding: 9px 10px; border: 1px solid transparent; background: none; border-radius: 10px; cursor: pointer; transition: background .12s, border-color .12s; }
.tp-item:hover { background: var(--agent-hover-shade, rgba(45,24,16,0.05)); }
.tp-item.on { background: #fff; border-color: var(--agent-coral-deep, #E2452A); }
.tp-item-ic { width: 26px; height: 26px; flex-shrink: 0; display: grid; place-items: center; border-radius: 7px; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); color: var(--agent-text-tertiary, #7A4A2E); }
.tp-item.on .tp-item-ic { color: var(--agent-coral-deep, #E2452A); }
.tp-item-txt { min-width: 0; }
.tp-item-name { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 650; color: var(--agent-text-primary, #2D1810); }
.tp-item-co { color: var(--agent-text-muted, #9a8a7f); flex-shrink: 0; }
.tp-item-desc { display: block; font-size: 11.5px; color: var(--agent-text-muted, #9a8a7f); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-prev-col { display: flex; flex-direction: column; min-height: 0; background: var(--agent-hover-shade, rgba(45,24,16,0.03)); }
.tp-prev-top { display: flex; align-items: center; gap: 9px; padding: 11px 14px 6px; }
.tp-prev-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--agent-text-muted, #9a8a7f); }
.tp-prev-name { font-size: 13px; font-weight: 700; color: var(--agent-text-primary, #2D1810); }
.tp-prev-scroll { flex: 1; overflow-y: auto; padding: 4px 16px 10px; min-height: 0; }
.tp-prev-email { font-size: 13.5px; line-height: 1.6; color: var(--agent-text-primary, #2D1810); }
.tp-prev-email p { margin: 0 0 10px; }
.tp-prev-email ul, .tp-prev-email ol { padding-left: 20px; margin: 4px 0 10px; }
.tp-fade { animation: tp-cf .16s ease; }
@keyframes tp-cf { from { opacity: 0; } }
.tp-prev-foot { display: flex; align-items: center; gap: 6px; padding: 9px 14px; border-top: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); font-size: 11.5px; color: var(--agent-text-muted, #9a8a7f); }
.tp-prev-miss { color: #B45309; }
.tp-use { margin: 0 14px 14px; padding: 10px 14px; font-size: 13.5px; font-weight: 650; color: #fff; background: var(--agent-btn-bg, linear-gradient(180deg,#FF8A65,#E2452A)); border: 0; border-radius: 10px; cursor: pointer; box-shadow: var(--agent-btn-shadow, 0 4px 14px rgba(226,69,42,0.26)); }
.tp-use:hover { filter: brightness(1.03); }
.tp-use-inline { margin: 0; }
.tp-empty { text-align: center; padding: 34px 22px; }
.tp-empty-ic { width: 50px; height: 50px; margin: 0 auto 12px; display: grid; place-items: center; border-radius: 14px; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.08)); color: var(--agent-text-tertiary, #7A4A2E); }
.tp-empty-h { font-size: 15px; font-weight: 700; color: var(--agent-text-primary, #2D1810); }
.tp-empty-p { font-size: 12.5px; color: var(--agent-text-secondary, #5A3A28); max-width: 280px; margin: 5px auto 0; line-height: 1.5; }
.tp-fill { padding: 16px; overflow-y: auto; }
.tp-fill-h { font-size: 14px; font-weight: 700; color: var(--agent-text-primary, #2D1810); }
.tp-fill-p { font-size: 12.5px; color: var(--agent-text-secondary, #5A3A28); margin: 4px 0 14px; }
.tp-fill-fields { display: flex; flex-direction: column; gap: 10px; }
.tp-fill-field span { display: block; font-size: 11.5px; font-weight: 650; color: var(--agent-text-secondary); margin-bottom: 4px; }
.tp-fill-field input { width: 100%; box-sizing: border-box; font-size: 13.5px; padding: 8px 10px; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 9px; outline: none; color: var(--agent-text-primary); }
.tp-fill-field input:focus { border-color: var(--agent-coral-deep, #E2452A); }
.tp-fill-ft { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.tp-btn-ghost { font-size: 13px; font-weight: 600; color: var(--agent-text-secondary); background: none; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 9px; padding: 8px 14px; cursor: pointer; }
.tp-btn-ghost:hover { background: var(--agent-hover-shade); }
.tp-fly { z-index: 3000; pointer-events: none; background: var(--agent-surface-glass, rgba(255,255,255,0.95)); border: 1px solid var(--agent-coral-deep, #E2452A); border-radius: 12px; box-shadow: 0 18px 50px rgba(20,14,10,0.3); padding: 12px 14px; font-size: 13px; font-weight: 700; color: var(--agent-coral-deep, #E2452A); overflow: hidden; transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .3s ease; }
@media (max-width: 640px) {
  .tp-panel { margin: 0; border-radius: 14px 14px 0 0; position: absolute; left: 0; right: 0; bottom: 0; top: 10%; }
  .tp-cols { grid-template-columns: 1fr; }
  .tp-panel:not(.tp-mobile-preview) .tp-prev-col { display: none; }
  .tp-mobile-preview .tp-list-col { display: none; }
  .tp-mobile-preview .tp-prev-col { grid-column: 1; }
}
`;

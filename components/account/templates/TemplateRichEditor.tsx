"use client";

// Rich-text editor for the template message, mirroring the composer's toolbar
// (bold / italic / underline / lists / link) plus an "Insert variable" control
// that drops an atomic, neutral-shaded token at the cursor. Tokens persist as
// <span data-token="KEY"> and are resolved against a file at insert/preview time.
//
// Note on colour: the variable token is a QUIET NEUTRAL SHADE, never a washed-out
// orange — matching the app-wide rule (hover/active/token = shade or ring, not a
// colour wash).

import { useEffect, useRef, useState } from "react";
import {
  TextB, TextItalic, TextUnderline, ListBullets, ListNumbers, LinkSimple,
  House, User, Users, CalendarBlank, Plus, CaretDown, type Icon,
} from "@phosphor-icons/react";
import { AnchoredPanel } from "@/components/ui/Popover";
import { TEMPLATE_VARIABLES, varTokenHtml, type TemplateVarIcon } from "@/lib/email/templates/variables";

const VAR_ICON: Record<TemplateVarIcon, Icon> = {
  home: House, buyer: User, seller: Users, agent: User, calendar: CalendarBlank,
};

let injected = false;
function useEditorCss() {
  useEffect(() => {
    if (injected || typeof document === "undefined") return;
    if (document.getElementById("tmpl-rich-css")) { injected = true; return; }
    const el = document.createElement("style");
    el.id = "tmpl-rich-css";
    el.textContent = TRE_CSS;
    document.head.appendChild(el);
    injected = true;
  }, []);
}

export function TemplateRichEditor({
  initialHtml,
  onChange,
  placeholder = "Write your template…",
}: {
  initialHtml: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  useEditorCss();
  const ref = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const varBtnRef = useRef<HTMLButtonElement>(null);
  const [varOpen, setVarOpen] = useState(false);

  useEffect(() => {
    if (seeded.current || !ref.current) return;
    ref.current.innerHTML = initialHtml || "";
    seeded.current = true;
  }, [initialHtml]);

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML); };
  const exec = (cmd: string, val?: string) => { ref.current?.focus(); document.execCommand(cmd, false, val); emit(); };

  const insertVariable = (key: string) => {
    ref.current?.focus();
    // Insert at the live caret; a trailing space keeps typing natural after the token.
    document.execCommand("insertHTML", false, `${varTokenHtml(key as never)} `);
    setVarOpen(false);
    emit();
  };

  const addLink = () => {
    const url = window.prompt("Link URL");
    if (url) exec("createLink", url);
  };

  return (
    <div className="tre">
      <div className="tre-tb">
        <button type="button" className="tre-tb-b" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")}><TextB size={16} weight="bold" /></button>
        <button type="button" className="tre-tb-b" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")}><TextItalic size={16} weight="bold" /></button>
        <button type="button" className="tre-tb-b" title="Underline" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")}><TextUnderline size={16} weight="bold" /></button>
        <span className="tre-tb-sep" />
        <button type="button" className="tre-tb-b" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")}><ListBullets size={16} weight="bold" /></button>
        <button type="button" className="tre-tb-b" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")}><ListNumbers size={16} weight="bold" /></button>
        <button type="button" className="tre-tb-b" title="Add link" onMouseDown={(e) => e.preventDefault()} onClick={addLink}><LinkSimple size={16} weight="bold" /></button>
        <span style={{ marginLeft: "auto" }} />
        <button ref={varBtnRef} type="button" className="tre-var-trigger" onMouseDown={(e) => e.preventDefault()} onClick={() => setVarOpen((v) => !v)}>
          <Plus size={13} weight="bold" /> Insert variable <CaretDown size={12} weight="bold" />
        </button>
        <AnchoredPanel anchorRef={varBtnRef} open={varOpen} onClose={() => setVarOpen(false)} placement="bottom-end" width={248} bare zIndex={2300}>
          <div className="tre-var-menu">
            {TEMPLATE_VARIABLES.map((v) => {
              const Icon = VAR_ICON[v.icon];
              return (
                <button key={v.key} type="button" className="tre-var-item" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVariable(v.key)}>
                  <span className="tre-var-ic"><Icon size={15} /></span>
                  <span>{v.label}</span>
                  <Plus size={13} weight="bold" style={{ marginLeft: "auto", opacity: 0.55 }} />
                </button>
              );
            })}
          </div>
        </AnchoredPanel>
      </div>
      <div
        ref={ref}
        className="tre-editor"
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={emit}
      />
    </div>
  );
}

const TRE_CSS = `
.tre { border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 12px; overflow: hidden; background: #fff; }
.tre-tb { display: flex; align-items: center; gap: 2px; padding: 6px 8px; border-bottom: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.08)); flex-wrap: wrap; }
.tre-tb-b { width: 30px; height: 30px; display: grid; place-items: center; border: 0; background: none; border-radius: 8px; cursor: pointer; color: var(--agent-text-secondary, #5A3A28); transition: background .14s; }
.tre-tb-b:hover { background: var(--agent-hover-shade, rgba(45,24,16,0.05)); }
.tre-tb-sep { width: 1px; height: 18px; background: var(--agent-border-subtle, rgba(20,16,10,0.1)); margin: 0 4px; }
.tre-var-trigger { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; font-weight: 650; color: var(--agent-text-secondary, #5A3A28); background: none; border: 1px solid var(--agent-border-default, rgba(20,16,10,0.14)); border-radius: 9px; padding: 6px 10px; cursor: pointer; transition: background .14s, border-color .14s; }
.tre-var-trigger:hover { background: var(--agent-hover-shade, rgba(45,24,16,0.05)); }
.tre-editor { min-height: 180px; max-height: 360px; overflow-y: auto; padding: 13px 15px; font-size: 14px; line-height: 1.6; color: var(--agent-text-primary, #2D1810); outline: none; }
.tre-editor:empty::before { content: attr(data-placeholder); color: var(--agent-text-muted, #9a8a7f); }
.tre-editor p { margin: 0 0 10px; }
.tre-editor ul { list-style: disc; padding-left: 20px; margin: 4px 0 10px; }
.tre-editor ol { list-style: decimal; padding-left: 20px; margin: 4px 0 10px; }
.tre-editor a { color: var(--agent-coral-deep, #E2452A); text-decoration: underline; }
/* The variable token: a quiet neutral chip (shade, not a washed orange). */
.et-var { display: inline; background: var(--agent-hover-shade-strong, rgba(45,24,16,0.09)); color: var(--agent-text-secondary, #5A3A28); border: 1px solid var(--agent-border-subtle, rgba(20,16,10,0.1)); border-radius: 6px; padding: 1px 6px; font-weight: 650; font-size: 0.9em; white-space: nowrap; }
.tre-var-menu { padding: 5px; }
.tre-var-item { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; font-size: 13px; font-weight: 550; color: var(--agent-text-primary, #2D1810); background: none; border: 0; border-radius: 9px; padding: 8px 10px; cursor: pointer; transition: background .13s; }
.tre-var-item:hover { background: var(--agent-hover-shade, rgba(45,24,16,0.05)); }
.tre-var-ic { width: 22px; height: 22px; display: grid; place-items: center; color: var(--agent-text-tertiary, #7A4A2E); flex-shrink: 0; }
/* Missing-value indicator in previews — a clear, non-brand warning tone. */
.et-var-missing { display: inline; background: rgba(217,119,6,0.12); color: #B45309; border: 1px dashed rgba(217,119,6,0.4); border-radius: 6px; padding: 1px 6px; font-weight: 600; font-size: 0.9em; white-space: nowrap; }
`;

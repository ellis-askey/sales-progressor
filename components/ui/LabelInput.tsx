"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, FocusEvent, HTMLInputTypeAttribute } from "react";
import { Eye, EyeOff } from "lucide-react";
import "./LabelInput.css";

/* ══ Label input ══════════════════════════════════════════
   A field whose label is its placeholder until you are in it.
   On focus the label lifts into the top edge with a small hop
   running along its letters, the outline darkens in place, and
   the top line parts under the label from its middle outward.

   ── ONE THING MOVES ─────────────────────────────────────
   It used to DRAW its outline out of the notch, both ways
   round the field — and that was the field performing, which
   is too much for a thing you focus forty times a day. Now the
   outline is always whole; focus only changes its ink and
   opens the gap. The label is the event, and the line makes
   room for it.

   The gap is two short paths across the notch, each from the
   middle to one side, retracted from the middle outward by a
   negative dash offset.

   ── Adapted for real forms (TSP) ────────────────────────
   The source is a showcase that owns its own value. Added here,
   without touching the animation: optional controlled value /
   onChange / onBlur and the usual field attributes (name, type,
   autoComplete, inputMode, required, autoFocus), a `label`
   override, and `fullWidth` — which measures the container and
   redraws the outline to fit, so it fills a form column on any
   width while the corners stay crisp. */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* the resting / minimum width; fullWidth measures the container instead */
const W = 280;
/* the lifted label's size, against its resting one */
const S = 0.78;
/* the stroke sits half a stroke inside the box so none of it
   is clipped by the svg's own edge */
const IN = 0.75;

export function LabelInput({
  field = "Email",
  /* override the displayed label text (else derived from `field`) */
  label: labelProp,
  /* override the input type (password fields ignore this — the eye owns it) */
  type: typeProp,
  name,
  /* controlled value — pass with onChange to drive it from a form */
  value: valueProp,
  onChange,
  onBlur: onBlurProp,
  autoComplete,
  autoCapitalize = "off",
  inputMode,
  required,
  autoFocus,
  /* the field's corner, px — at half the height it is a pill. Defaults to the
     size's own corner when omitted. */
  corner,
  /* size preset: "md" is the roomy auth field (48px / 16px / 20px corner);
     "sm" matches the agent-app `.agent-input` footprint (40px / 14px / 8px
     corner, no top gap) so a dense form keeps its original size — only the
     treatment changes. Individual dims below still override. */
  size = "md",
  /* explicit overrides; each falls back to the size preset */
  height: heightProp,
  fontSize: fontSizeProp,
  topGap: topGapProp,
  /* focus-outline colour (and the focused label); defaults to the ink ramp.
     The login passes its coral so the field stays on-brand. */
  accent,
  /* give the field a flat opaque fill (--agent-surface-elevated) so it reads as a
     crisp, obviously-editable field on any surface. ON by default — on a white card
     (login / register) the fill is invisible (white on white, no change); on a tinted
     / glass ground (the sale hero, contact cards) it lifts the field off the surface;
     in dark mode the token is a dark slate so fields stand out on the shell. Pass
     `solid={false}` for the rare field that should dissolve into its container. */
  solid = true,
  /* fill the container (measured) instead of the fixed 280px */
  fullWidth = false,
  /* the smallest width the measured outline will draw at (fullWidth only). The
     default suits roomy forms; a tight two-up column (hero address) passes a
     smaller value so two fields sit side by side without clipping. */
  minBoxWidth = 160,
  /* a showcase, not a form: on a touch screen, keep the device's
     keyboard down. Off by default — a real field wants its
     keyboard — and the bench turns it on for its feed */
  showcase = false,
}: {
  field?: string;
  label?: string;
  type?: HTMLInputTypeAttribute;
  name?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  autoCapitalize?: string;
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  required?: boolean;
  autoFocus?: boolean;
  corner?: number;
  size?: "md" | "sm";
  height?: number;
  fontSize?: number;
  topGap?: number;
  accent?: string;
  solid?: boolean;
  fullWidth?: boolean;
  minBoxWidth?: number;
  showcase?: boolean;
} = {}) {
  /* the two presets; explicit props below win over them. "sm" changes only the
     height (and drops the top gap for dense forms) — corner and font stay the
     md values so the field keeps its established look, just shorter. */
  const preset = size === "sm"
    ? { h: 40, fs: 16, corner: 20, top: 0 as number | undefined }
    : { h: 48, fs: 16, corner: 20, top: undefined as number | undefined };
  const H = heightProp ?? preset.h;
  const FS = fontSizeProp ?? preset.fs;
  const topGap = topGapProp ?? preset.top;
  const r = clamp(corner ?? preset.corner, 0, H / 2);
  const secret = field === "Password";
  const label = labelProp ?? (secret ? "Password" : "Email");
  const id = `lbi-${useId().replace(/:/g, "")}`;

  const [focus, setFocus] = useState(false);
  const [quiet] = useState(() => showcase && typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches);
  /* controlled when both value + onChange are supplied; otherwise the
     component owns its value (the showcase behaviour) */
  const controlled = valueProp !== undefined && onChange !== undefined;
  const [ownValue, setOwnValue] = useState("");
  const value = controlled ? valueProp : ownValue;
  const [show, setShow] = useState(false);
  const [flip, setFlip] = useState(0);
  const input = useRef<HTMLInputElement | null>(null);

  /* ── full width, measured ────────────────────────────────
     When asked to fill its column, the box is as wide as the
     container and the outline is redrawn at that width, so the
     corners stay crisp rather than being stretched by the svg.
     Measured, and kept current through a resize / rotation. */
  const root = useRef<HTMLDivElement | null>(null);
  const [boxW, setBoxW] = useState(W);
  useLayoutEffect(() => {
    if (!fullWidth) { setBoxW(W); return; }
    const el = root.current;
    if (!el) return;
    const measure = () => setBoxW(Math.max(minBoxWidth, Math.round(el.clientWidth)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullWidth, minBoxWidth]);

  /* the notch is the label's own width, so it is measured */
  const lab = useRef<HTMLLabelElement | null>(null);
  const [lw, setLw] = useState(40);
  useLayoutEffect(() => {
    if (lab.current) setLw(lab.current.offsetWidth);
  }, [label]);

  /* a different kind of field starts empty — an email left in
     a password box would be shown in the clear (only when the
     component owns its own value; a controlled field is the
     form's to reset) */
  useEffect(() => {
    if (controlled) return;
    setOwnValue("");
    setShow(false);
  }, [field, controlled]);

  const up = focus || value.length > 0;

  /* ── where the label sits, and the gap it leaves ─────────
     Never inside the corner's curve: the notch has to open on
     the straight part of the top edge, so a rounder field
     starts its label further in. */
  const lx = Math.max(14, r + 4);
  const x0 = Math.max(r * 0.6, lx - 5);
  const x1 = lx + lw * S + 5;
  const a = r - IN;
  const R = boxW - IN;
  const B = H - IN;
  const mid = boxW / 2;
  /* the gap, as two halves from its middle to each side */
  const nm = (x0 + x1) / 2;
  const gapL = `M${nm},${IN} L${x0},${IN}`;
  const gapR = `M${nm},${IN} L${x1},${IN}`;
  /* right: from the notch, clockwise, to the bottom middle */
  const right = r > 0
    ? `M${x1},${IN} L${boxW - r},${IN} A${a},${a} 0 0 1 ${R},${r} L${R},${H - r} A${a},${a} 0 0 1 ${boxW - r},${B} L${mid},${B}`
    : `M${x1},${IN} L${R},${IN} L${R},${B} L${mid},${B}`;
  /* left: from the notch, the other way round, to the same point */
  const left = r > 0
    ? `M${x0},${IN} L${r},${IN} A${a},${a} 0 0 0 ${IN},${r} L${IN},${H - r} A${a},${a} 0 0 0 ${r},${B} L${mid},${B}`
    : `M${x0},${IN} L${IN},${IN} L${IN},${B} L${mid},${B}`;

  const reveal = () => {
    setShow((s) => !s);
    setFlip((f) => f + 1);
  };

  return (
    <div className="lbi" data-up={up} data-focus={focus} data-filled={value.length > 0} data-full={fullWidth || undefined} data-solid={solid || undefined} ref={root} style={{
      "--lbi-lift": `${H / 2}px`,
      "--lbi-fs": `${FS}px`,
      ...(accent ? { "--ink": accent } : {}),
      ...(topGap !== undefined ? { "--lbi-top": `${topGap}px` } : {}),
    } as React.CSSProperties}>
      <div
        className="lbi-box"
        style={{ width: boxW, height: H, borderRadius: r, "--lbi-x": `${lx}px` } as React.CSSProperties}
      >
        <svg className="lbi-ring" width={boxW} height={H} viewBox={`0 0 ${boxW} ${H}`} aria-hidden="true">
          <path d={right} />
          <path d={left} />
          <path className="lbi-gap" d={gapL} pathLength={1} />
          <path className="lbi-gap" d={gapR} pathLength={1} />
        </svg>

        <label className="lbi-label" htmlFor={id} ref={lab}>
          {[...label].map((ch, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties}>{ch}</span>
          ))}
        </label>

        <input
          ref={input}
          id={id}
          className="lbi-field"
          data-flip={flip % 2}
          /* ── no autofill, when it is only being shown ───────
             An email or password box is an invitation: the browser
             drops its saved addresses under it, a password manager
             pins its badge in it, the phone offers a contact. On
             the bench it is a preview, not a form, so it is a plain
             text field — a hidden password masked by the font
             rather than by the type — named so Safari takes it for
             a search, and marked off for the managers that read
             their own attribute. A real use keeps the real types. */
          type={showcase ? "text" : secret && !show ? "password" : secret ? "text" : (typeProp ?? "email")}
          name={showcase ? "search-preview" : name}
          data-1p-ignore={showcase || undefined}
          data-lpignore={showcase ? "true" : undefined}
          data-bwignore={showcase || undefined}
          data-form-type={showcase ? "other" : undefined}
          autoCorrect="off"
          autoCapitalize={autoCapitalize}
          value={value}
          onChange={(e) => { if (controlled) onChange?.(e); else setOwnValue(e.target.value); }}
          onFocus={() => setFocus(true)}
          onBlur={(e) => { setFocus(false); onBlurProp?.(e); }}
          autoComplete={showcase ? "off" : (autoComplete ?? "off")}
          spellCheck={false}
          required={required}
          autoFocus={autoFocus}
          /* ── no keyboard, when it is only being shown ─────
             In a feed you are scrolling on a phone, a tap that
             lands on the field threw the keyboard up over the
             page. inputMode "none" keeps everything the block is
             about — the focus, the label lifting, the gap
             opening — and only tells the device not to raise its
             keyboard. A mouse and a hardware keyboard are
             untouched, and so is any real use of this field. */
          inputMode={quiet ? "none" : inputMode}
          style={{
            paddingRight: secret ? 48 : lx,
            ...(showcase && secret && !show ? { WebkitTextSecurity: "disc" } : {}),
          } as React.CSSProperties}
        />

        {secret && (
          <button
            className="lbi-eye"
            type="button"
            data-show={show}
            /* keep focus in the field: the eye is a toggle on
               what you are typing, not somewhere to go */
            onPointerDown={(e) => e.preventDefault()}
            onClick={reveal}
            aria-label={show ? "Hide password" : "Show password"}
          >
            <Eye size={16} strokeWidth={2} aria-hidden="true" />
            <EyeOff size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

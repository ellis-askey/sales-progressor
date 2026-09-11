"use client";
// DateField — a native <input type="date"> that shows friendly "Choose a date"
// text instead of the browser's dd/mm/yyyy mask when empty, WITHOUT changing
// the input's shape (Option 1, Ellis 2026-09-11).
//
// How it preserves shape: the input is rendered exactly as before — same
// className, same inline style, same box. When the value is empty we (a) hide
// the browser's dd/mm/yyyy mask via CSS (.datefield[data-empty] …-datetime-edit
// → transparent) and (b) overlay a placeholder span that REUSES the input's own
// className + style, so its padding / font / box line the text up in exactly the
// spot the native value would sit. Nothing about the input's dimensions changes.
//
// Once a date is picked the overlay is gone and the native value renders
// normally. Click / focus behaviour is unchanged (no showPicker hijack).
//
// Browser note: the mask-hide uses the WebKit/Blink ::-webkit-datetime-edit
// pseudo-element, so Chrome / Edge / Safari get the friendly text. Firefox falls
// back to its own date field — no breakage, just no custom empty text there.

import React from "react";
import "./DateField.css";

type DateFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  // Empty-state text. Standardised on "Choose a date" (Ellis 2026-09-11).
  placeholder?: string;
  // The wrapper is display:block by default (matches the common full-width form
  // input). Pass a wrapperClassName / wrapperStyle to preserve a different
  // layout (e.g. inline-block for an intrinsic-width inline field) so the
  // surrounding row doesn't shift.
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
};

export function DateField({
  value,
  onChange,
  placeholder = "Choose a date",
  className,
  style,
  wrapperClassName,
  wrapperStyle,
  ...rest
}: DateFieldProps) {
  const empty = !value;
  return (
    <span
      className={wrapperClassName ? `datefield ${wrapperClassName}` : "datefield"}
      style={wrapperStyle}
      data-empty={empty ? "true" : undefined}
    >
      <input
        type="date"
        value={value}
        onChange={onChange}
        className={className}
        style={style}
        {...rest}
      />
      {empty && (
        <span
          className={className ? `datefield__ph ${className}` : "datefield__ph"}
          style={style}
          aria-hidden="true"
        >
          {placeholder}
        </span>
      )}
    </span>
  );
}

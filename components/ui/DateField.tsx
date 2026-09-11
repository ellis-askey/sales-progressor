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
// spot the native value would. Nothing about the input's dimensions changes.
//
// Works for controlled (value) AND uncontrolled (defaultValue) inputs: the empty
// state is tracked internally so the overlay disappears the moment a date is
// picked either way. Forwards ref to the underlying input. Click / focus
// behaviour is unchanged (no showPicker hijack).
//
// Browser note: the mask-hide uses the WebKit/Blink ::-webkit-datetime-edit
// pseudo-element, so Chrome / Edge / Safari get the friendly text. Firefox falls
// back to its own date field — no breakage, just no custom empty text there.

import React, { useEffect, useState } from "react";
import "./DateField.css";

type DateFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  // Empty-state text. Standardised on "Choose a date" (Ellis 2026-09-11).
  placeholder?: string;
  // The wrapper is display:block by default (matches the common full-width form
  // input). Pass wrapperStyle / wrapperClassName to preserve a different layout
  // (e.g. { display: "inline-block" } for an intrinsic-width inline field, or a
  // flex/grow style) so the surrounding row doesn't shift.
  wrapperClassName?: string;
  wrapperStyle?: React.CSSProperties;
};

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  function DateField(
    { value, defaultValue, onChange, placeholder = "Choose a date", className, style, wrapperClassName, wrapperStyle, ...rest },
    ref,
  ) {
    // Seed empty-state from whichever is provided (controlled value or
    // uncontrolled defaultValue), then keep it current on every change so the
    // "Choose a date" overlay disappears once a date is chosen.
    const seed = (value ?? defaultValue ?? "") as string;
    const [empty, setEmpty] = useState(!seed);

    // Keep in sync when a controlled value changes from the outside.
    useEffect(() => {
      if (value !== undefined) setEmpty(!value);
    }, [value]);

    const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
      setEmpty(!e.target.value);
      onChange?.(e);
    };

    return (
      <span
        className={wrapperClassName ? `datefield ${wrapperClassName}` : "datefield"}
        style={wrapperStyle}
        data-empty={empty ? "true" : undefined}
      >
        <input
          ref={ref}
          type="date"
          value={value}
          defaultValue={defaultValue}
          onChange={handleChange}
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
  },
);

DateField.displayName = "DateField";

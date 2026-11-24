// @ts-nocheck
// Vendored from uiarc.dev (search-field, MIT). Verbatim base, extended with an
// OPTIONAL trailing submit action (onSubmit / submitLabel / submitEnabled) so the
// same control also serves as a "lookup" field — a search that fires an explicit
// action, e.g. a postcode property lookup. With no submit props it is the
// unchanged search field. /dev gallery + agent app.
"use client";
import { forwardRef, useId, useRef } from "react";
import type { InputHTMLAttributes } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Search, X as Xmark } from "lucide-react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./search-field.module.css";
export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onSubmit"> {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  /** Optional trailing submit. When set, the field becomes a lookup field: the
   *  clear button is replaced by a labelled submit pill, shown while
   *  `submitEnabled` is true. Enter still submits via the input's own onKeyDown. */
  onSubmit?: () => void;
  submitLabel?: string;
  submitEnabled?: boolean;
}
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({ label, value, onValueChange, onSubmit, submitLabel = "Go", submitEnabled = false, id, className, ...props }, ref) {
  const generated = useId(); const controlId = id ?? generated; const reduced = useReducedMotion(); const inputRef = useRef<HTMLInputElement | null>(null);
  const setRefs = (node: HTMLInputElement | null) => { inputRef.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; };
  // Clearing returns focus to the field, since the clear button unmounts under the pointer.
  function clear() { onValueChange(""); inputRef.current?.focus(); }
  return <div className={styles.field}><label htmlFor={controlId}>{label}</label><div className={styles.shell} data-filled={value ? "true" : undefined}>
    <Search width={18} height={18} aria-hidden="true"/><input {...props} ref={setRefs} id={controlId} type="search" value={value} onChange={event => onValueChange(event.target.value)} className={[styles.input, className].filter(Boolean).join(" ")} />
    {onSubmit ? (
    // Lookup mode: a reserved-width slot holds a labelled submit pill — the tap
    // affordance on touch, where there is no Enter key.
    <span className={styles.submitSlot}><AnimatePresence initial={false}>{submitEnabled ? <motion.button key="submit" type="button" className={styles.submit} onClick={onSubmit} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .9, filter: `blur(${motionTokens.blur.subtle}px)` }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: .9, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }} whileTap={reduced ? undefined : { scale: .96, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }} transition={reduced ? { duration: motionTokens.duration.instant } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.fast } }}>{submitLabel}</motion.button> : null}</AnimatePresence></span>
    ) : (
    // The clear button has a reserved slot, so the field never changes width when it appears or leaves.
    <span className={styles.clearSlot}><AnimatePresence initial={false}>{value ? <motion.button key="clear" type="button" tabIndex={0} onClick={clear} aria-label="Clear search" initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .8, filter: `blur(${motionTokens.blur.subtle}px)` }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: .8, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }} whileTap={reduced ? undefined : { scale: .96, transition: { duration: motionTokens.duration.instant, ease: [...motionTokens.ease.standard] } }} transition={reduced ? { duration: motionTokens.duration.instant } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast }, filter: { duration: motionTokens.duration.fast } }}><Xmark width={16} height={16} aria-hidden="true" /></motion.button> : null}</AnimatePresence></span>
    )}
  </div></div>;
});

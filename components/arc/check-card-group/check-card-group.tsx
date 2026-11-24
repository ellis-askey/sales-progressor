"use client";
// A multi-select sibling of RadioGroup: each row is a selectable card that fills
// solid coral when chosen, with a white tick that draws itself into a circle
// (the radio's dot, inverted to a tick). Rows never resize. An optional `leading`
// slot carries a logo/avatar. Built for the quote flow's firm picker.
import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./check-card-group.module.css";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MotionPath = motion.path as any;

export interface CheckCardOption {
  value: string;
  label: string;
  description?: string;
  /** Optional leading element (e.g. a firm logo), shown after the tick. */
  leading?: React.ReactNode;
}

export interface CheckCardGroupProps {
  label: string;
  options: CheckCardOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  name?: string;
}

export function CheckCardGroup({ label, options, value, onValueChange, name }: CheckCardGroupProps) {
  const id = useId();
  const reduced = useReducedMotion();

  function toggle(v: string) {
    onValueChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <fieldset className={styles.group}>
      <legend>{label}</legend>
      <div className={styles.options}>
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label className={styles.option} key={option.value} data-checked={checked || undefined}>
              <input
                type="checkbox"
                name={name ?? id}
                value={option.value}
                checked={checked}
                onChange={() => toggle(option.value)}
              />
              {option.leading && <span className={styles.leading}>{option.leading}</span>}
              <span className={styles.text}>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
              <span className={styles.mark} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                  <MotionPath
                    d="M5 12.5 10 17.5 19 7"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={false}
                    animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { pathLength: { ...motionTokens.spring.snappy }, opacity: { duration: checked ? 0.12 : 0.05 } }
                    }
                  />
                </svg>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

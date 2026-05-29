// Section.when predicate. Pure function — no I/O, no side effects.
//
// Implicit AND across the four keys. Per-key, supports:
//   - literal value
//   - { in: [...] } set membership
//   - { not: X } negation (tenure / purchaseType only — route uses `in`)
//
// Hard constraint: this file is the entire condition language. If you
// need a new operator (e.g. OR across keys, predicate functions), the
// answer is "no". Restructure the section to compose paragraph-granular
// alternatives instead.

import type { ShapeCondition, FileShape } from "./types";

function matchScalar<T>(
  value: T | undefined,
  condition: T | { in: T[] } | { not: T },
): boolean {
  if (value === undefined) {
    // FileShape lacks a value for this key (e.g. route undefined on a
    // non-bilateral email) but the condition specifies one — section
    // doesn't apply.
    return false;
  }
  if (typeof condition === "object" && condition !== null) {
    if ("in" in condition) {
      const arr = (condition as { in: T[] }).in;
      return Array.isArray(arr) && arr.includes(value);
    }
    if ("not" in condition) {
      return (condition as { not: T }).not !== value;
    }
  }
  return condition === value;
}

export function matches(cond: ShapeCondition, shape: FileShape): boolean {
  if (cond.tenure !== undefined && !matchScalar(shape.tenure, cond.tenure)) {
    return false;
  }
  if (cond.purchaseType !== undefined && !matchScalar(shape.purchaseType, cond.purchaseType)) {
    return false;
  }
  if (cond.route !== undefined && !matchScalar(shape.route, cond.route)) {
    return false;
  }
  if (cond.direction !== undefined && cond.direction !== shape.direction) {
    return false;
  }
  return true;
}

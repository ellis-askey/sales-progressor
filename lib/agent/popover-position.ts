// Right-anchor a popover to a trigger, CLAMPED so a popover of `popWidth` can't
// run off either screen edge. Fixes the recurring "menu off-screen on mobile"
// bug: when a trigger wraps and left-aligns, the naive `innerWidth - triggerRight`
// pushes the popover off the LEFT edge. Every anchored menu (files filter,
// completions/target menus, chain + contact + reminder menus, etc.) computes its
// CSS `right` offset through this so the fix lives in one place.
export function clampPopoverRight(triggerRight: number, popWidth: number): number {
  if (typeof window === "undefined") return 8;
  return Math.min(
    Math.max(8, window.innerWidth - triggerRight),
    Math.max(8, window.innerWidth - popWidth - 8),
  );
}

"use client";

// The hero trigger — a little post-it icon next to the Settings pill. Clicking it
// dispatches a `sticky-add` event for this file; StickyLayer (mounted on the page)
// catches it and spawns a fresh note. Decoupled on purpose, so the button and the
// layer don't need a shared provider wrapping the whole file page.

import { Note } from "@phosphor-icons/react/dist/ssr";
import "@/components/sticky/sticky.css";

// Fire the spawn event StickyLayer listens for. Shared so the mobile menu row
// (HeroSmallControls) can trigger the same thing without re-stating the contract.
export function spawnStickyNote(transactionId: string) {
  window.dispatchEvent(new CustomEvent("sticky-add", { detail: { transactionId } }));
}

export function StickyAddButton({ transactionId }: { transactionId: string }) {
  return (
    <button
      type="button"
      className="sticky-add"
      title="Add a sticky note"
      aria-label="Add a sticky note"
      onClick={() => spawnStickyNote(transactionId)}
    >
      <Note size={17} weight="regular" />
    </button>
  );
}

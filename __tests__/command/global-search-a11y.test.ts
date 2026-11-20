/**
 * @jest-environment node
 *
 * CommandGlobalSearch accessibility / responsive guard.
 *
 * No DOM testing library is installed (and we won't add a dependency), so this
 * is a source-level guard that the palette keeps its a11y + responsive
 * affordances: modal semantics, ⌘K/Esc, focus trap, focus restoration, input
 * focus on open, keyboard-selection scroll-into-view, abortable fetch, a
 * scrollable results region, responsive sizing, and SSR-safe closed state.
 * Full interaction testing would need @testing-library/react in a jsdom run.
 */

import { readFileSync } from "fs";

const SRC = readFileSync("components/command/CommandGlobalSearch.tsx", "utf8");

describe("CommandGlobalSearch a11y / responsive", () => {
  it("has modal dialog semantics", () => {
    expect(SRC).toContain('role="dialog"');
    expect(SRC).toContain('aria-modal="true"');
    expect(SRC).toMatch(/aria-label=/);
  });

  it("opens on ⌘K/Ctrl+K and closes on Escape", () => {
    expect(SRC).toMatch(/metaKey \|\| e\.ctrlKey/);
    expect(SRC).toMatch(/e\.key === "k" \|\| e\.key === "K"/);
    expect(SRC).toMatch(/e\.key === "Escape"/);
  });

  it("traps Tab focus within the dialog", () => {
    expect(SRC).toContain("function trapTab");
    expect(SRC).toContain("onKeyDown={trapTab}");
    expect(SRC).toMatch(/shiftKey/);
  });

  it("manages focus: focuses the input on open and restores focus on close", () => {
    expect(SRC).toMatch(/inputRef\.current\?\.focus\(\)/);
    expect(SRC).toContain("prevFocusRef");
    expect(SRC).toMatch(/prevFocusRef\.current\?\.focus/);
  });

  it("keeps the keyboard-selected row visible (scrollIntoView)", () => {
    expect(SRC).toContain("scrollIntoView");
    expect(SRC).toContain("data-idx");
  });

  it("cancels stale requests (AbortController)", () => {
    expect(SRC).toContain("AbortController");
    expect(SRC).toMatch(/abortRef\.current\.abort\(\)/);
    expect(SRC).toContain("AbortError");
  });

  it("is responsive and scrollable, and renders nothing when closed (SSR-safe)", () => {
    expect(SRC).toMatch(/max-w-xl/);
    expect(SRC).toMatch(/mx-4/);
    expect(SRC).toMatch(/overflow-y-auto/);
    expect(SRC).toMatch(/if \(!open\) return null;/);
  });
});

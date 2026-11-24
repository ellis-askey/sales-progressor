"use client";

// Shared coordinator for the two bottom-right floating controls — the "(?)" Help
// pill and the cookie reopen chip — so they stack as a little deck instead of
// overlapping. The back card peeks out; tapping it springs it to the front.
//
// A module-level store read through useSyncExternalStore (no provider): the two
// widgets are mounted by different layouts (cookie at the root, Help in the
// agent layout) and both render through portals, so a plain context is awkward
// — a module store reaches both cleanly. Each widget registers its presence; the
// deck only "engages" when BOTH are present (i.e. on an agent page once the
// cookie consent has collapsed to its chip). "(?)" Help is always the default
// front per the founder's call.

import { useSyncExternalStore } from "react";

export type DeckKey = "help" | "cookie";
type State = { front: DeckKey; helpPresent: boolean; cookiePresent: boolean };

let state: State = { front: "help", helpPresent: false, cookiePresent: false };
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  const next = { ...state, ...patch };
  if (next.front === state.front && next.helpPresent === state.helpPresent && next.cookiePresent === state.cookiePresent) return;
  state = next;
  listeners.forEach((l) => l());
}

/** Register/unregister a widget's presence (helpPresent / cookiePresent). */
export function setDeckPresence(key: DeckKey, present: boolean) {
  set(key === "help" ? { helpPresent: present } : { cookiePresent: present });
}

/** Bring a card to the front of the deck (the other slips behind). */
export function bringToFront(key: DeckKey) {
  if (state.front !== key) set({ front: key });
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function snapshot() { return state; }
const SERVER: State = { front: "help", helpPresent: false, cookiePresent: false };

export function useFloatingDeck() {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

/** The deck only engages when both controls are on screen together. */
export function deckEngaged(s: State): boolean {
  return s.helpPresent && s.cookiePresent;
}

/** Position/scale/stacking for one card given which key is front. Front sits flush
 *  at the corner on top; the back card nudges up-left, shrinks and dims so it
 *  peeks out. The z values sit above normal page chrome; the front card's own
 *  overlay (e.g. the Help panel) is raised separately above both when open. */
export function deckCardStyle(key: DeckKey, s: State): { transform: string; zIndex: number; opacity: number } {
  const isFront = s.front === key;
  return {
    // Back card peeks clearly up-left (a real click target), only lightly dimmed.
    transform: isFront ? "translate(0, 0) scale(1)" : "translate(-22px, -22px) scale(0.9)",
    zIndex: isFront ? 62 : 60,
    opacity: isFront ? 1 : 0.95,
  };
}

// Spring used by both cards for the swap, matching the /dev prototype.
export const DECK_SPRING = "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease, box-shadow 240ms ease";

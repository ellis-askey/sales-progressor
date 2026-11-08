"use client";

// A tiny cross-component "open this exact add-form" signal for the People panel.
//
// The File-setup checklist's "Add seller / buyer / solicitor / broker" CTAs
// switch tab, switch the People sub-tab, then want the matching add-form to
// open on arrival — one less click. A plain CustomEvent races the mount: the
// People panel renders only the ACTIVE sub-tab (PeoplePanel.tsx), so a solicitor
// tile isn't listening yet when the event fires. This is an external store
// instead: the intent persists until the right leaf mounts and reads it
// synchronously via useSyncExternalStore, whichever order things mount in.
//
// The leaf owns its own open state (ContactsSection's showForm, a Solicitor/
// BrokerTile's `editing`). The hook just tells it WHEN — after a short beat so
// the agent lands first, then scrolls the form into view with a flash.

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

export type PeopleOpenForm = `${"contact" | "solicitor" | "broker"}:${"vendor" | "purchaser"}`;

let current: PeopleOpenForm | null = null;
let ttl: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export function requestPeopleOpen(form: PeopleOpenForm) {
  current = form;
  emit();
  // Safety net: an intent whose leaf never mounts (e.g. the agent navigates away
  // mid-jump) shouldn't fire the next time that leaf happens to mount.
  if (ttl) clearTimeout(ttl);
  ttl = setTimeout(() => { if (current === form) { current = null; emit(); } }, 6000);
}

function clearIntent(form: PeopleOpenForm) {
  if (current !== form) return;
  current = null;
  if (ttl) { clearTimeout(ttl); ttl = null; }
  emit();
}

function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot() { return current; }
function getServerSnapshot(): PeopleOpenForm | null { return null; }

// Fires `open()` once, ~`delay`ms after the intent matches `form` (a welcoming
// beat so the agent sees where they've landed before it reveals), then scrolls
// `ref` into view with a brief flash and clears the intent. The leaf owns its
// open state; this only decides the moment.
export function usePeopleOpenIntent(
  form: PeopleOpenForm,
  ref: RefObject<HTMLElement>,
  open: () => void,
  delay = 450,
) {
  const intent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const openRef = useRef(open);
  openRef.current = open;
  const handled = useRef<PeopleOpenForm | null>(null);

  useEffect(() => {
    if (intent !== form) { handled.current = null; return; }
    if (handled.current === form) return; // don't re-fire while this intent stands
    handled.current = form;
    const t = setTimeout(() => {
      openRef.current();
      const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => {
        const el = ref.current;
        if (el) {
          el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
          el.classList.add("agent-row-flash");
          window.setTimeout(() => el.classList.remove("agent-row-flash"), 900);
        }
      });
      clearIntent(form);
    }, delay);
    return () => clearTimeout(t);
  }, [intent, form, ref, delay]);
}

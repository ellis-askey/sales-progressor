"use client";

// Voice dictation for any composer — speech-to-text that streams into the body,
// stop/edit/resume, spoken punctuation ("full stop", "comma", "new line"…), and
// a live mic signal for the waveform. Browser-native (Web Speech API + Web
// Audio); nothing leaves the device. Prototyped at /dev/voice-dictation.
//
// The hook is target-agnostic: a DictationTarget knows how to insert the live
// text at the caret, so the same engine drives a <textarea> and a contentEditable
// editor. Convenience hooks for both are exported below. Chrome / Edge: full.
// Safari: webkit-prefixed. Firefox: no SpeechRecognition → status "unsupported".

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type DictationStatus = "idle" | "listening" | "unsupported" | "denied";

// ── Spoken punctuation ───────────────────────────────────────────────────────
// Command words → real punctuation, whole-word and case-insensitive; spacing is
// then tightened around the marks. Applied over the whole dictated run so a
// command never gets split. Capitalisation + deeper tidy is left to Refine.
const PUNCTUATION: Array<[RegExp, string]> = [
  [/\bnew paragraph\b/gi, "\n\n"],
  [/\bnew line\b/gi, "\n"],
  [/\b(full stop|period)\b/gi, "."],
  [/\bcomma\b/gi, ","],
  [/\bquestion mark\b/gi, "?"],
  [/\b(exclamation mark|exclamation point)\b/gi, "!"],
  [/\b(semicolon|semi colon)\b/gi, ";"],
  [/\bcolon\b/gi, ":"],
  [/\b(open bracket|open parenthesis)\b/gi, "("],
  [/\b(close bracket|close parenthesis)\b/gi, ")"],
  [/\b(dash|hyphen)\b/gi, "-"],
  [/\bapostrophe\b/gi, "'"],
];

export function applySpokenPunctuation(text: string): string {
  let t = text;
  for (const [re, mark] of PUNCTUATION) t = t.replace(re, mark);
  t = t.replace(/\s+([.,;:!?)])/g, "$1");
  t = t.replace(/([([])\s+/g, "$1");
  t = t.replace(/([.,;:!?])(?=[^\s.,;:!?)])/g, "$1 ");
  t = t.replace(/[ \t]*\n[ \t]*/g, "\n");
  t = t.replace(/ {2,}/g, " ");
  return t;
}

// ── Minimal SpeechRecognition typings ────────────────────────────────────────
type SRAlt = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRAlt; length: number };
type SRResultList = { length: number; [i: number]: SRResult };
type SREvent = { resultIndex: number; results: SRResultList };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function dictationSupported(): boolean {
  return getRecognitionCtor() != null;
}

// ── Insertion target ─────────────────────────────────────────────────────────
// begin() snapshots the caret; update(text) renders the live (punctuated) run at
// that point; end(text) commits + leaves the caret after it, focused.
export interface DictationTarget {
  begin: () => void;
  update: (text: string) => void;
  end: (finalText: string) => void;
}

export interface DictationOptions {
  onError?: (kind: "denied" | "unsupported") => void;
}

export interface DictationControls {
  status: DictationStatus;
  analyser: AnalyserNode | null;
  toggle: () => void;
}

// ── Core engine ──────────────────────────────────────────────────────────────
export function useDictation(target: DictationTarget, opts?: DictationOptions): DictationControls {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const finalRef = useRef("");
  const interimRef = useRef("");
  const targetRef = useRef(target);
  targetRef.current = target;
  const onErrorRef = useRef(opts?.onError);
  onErrorRef.current = opts?.onError;

  useEffect(() => { if (!getRecognitionCtor()) setStatus("unsupported"); }, []);

  const render = useCallback(() => {
    const fin = finalRef.current;
    const tail = interimRef.current;
    const raw = tail ? fin + (fin && !fin.endsWith(" ") ? " " : "") + tail : fin;
    targetRef.current.update(applySpokenPunctuation(raw));
  }, []);

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recRef.current;
    if (rec) { rec.onresult = null; rec.onend = null; try { rec.stop(); } catch { /* already stopped */ } }
    if (interimRef.current) {
      const fin = finalRef.current;
      finalRef.current = fin + (fin && !fin.endsWith(" ") ? " " : "") + interimRef.current;
      interimRef.current = "";
    }
    const finalText = applySpokenPunctuation(finalRef.current);
    targetRef.current.update(finalText);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioRef.current?.close().catch(() => {});
    audioRef.current = null;
    setAnalyser(null);
    setStatus("idle");
    targetRef.current.end(finalText);
  }, []);

  const start = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setStatus("unsupported"); onErrorRef.current?.("unsupported"); return; }
    finalRef.current = "";
    interimRef.current = "";
    targetRef.current.begin();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const node = ctx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.8;
      src.connect(node);
      setAnalyser(node);
    } catch {
      setStatus("denied");
      onErrorRef.current?.("denied");
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    recRef.current = rec;
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) {
          const prev = finalRef.current;
          finalRef.current = prev + (prev && !prev.endsWith(" ") ? " " : "") + txt.trim();
        } else {
          interimText += txt;
        }
      }
      interimRef.current = interimText.trim();
      render();
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { stop(); setStatus("denied"); onErrorRef.current?.("denied"); }
    };
    rec.onend = () => { if (activeRef.current) { try { rec.start(); } catch { /* restarting */ } } };

    activeRef.current = true;
    setStatus("listening");
    try { rec.start(); } catch { /* double-start */ }
  }, [render, stop]);

  const toggle = useCallback(() => { if (status === "listening") stop(); else void start(); }, [status, start, stop]);

  useEffect(() => () => {
    activeRef.current = false;
    recRef.current?.abort();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioRef.current?.close().catch(() => {});
  }, []);

  return { status, analyser, toggle };
}

// ── Target: a controlled <textarea> ──────────────────────────────────────────
export function useTextareaDictation(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  setValue: (next: string) => void,
  opts?: DictationOptions,
): DictationControls {
  const atRef = useRef(0);
  const baseRef = useRef("");
  const target = useMemo<DictationTarget>(() => ({
    begin() {
      const el = ref.current;
      atRef.current = el ? el.selectionStart : 0;
      baseRef.current = el?.value ?? "";
    },
    update(text) {
      const base = baseRef.current;
      const at = atRef.current;
      setValue(base.slice(0, at) + text + base.slice(at));
      if (at >= base.length) {
        const el = ref.current;
        if (el) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      }
    },
    end(text) {
      const el = ref.current;
      if (!el) return;
      const pos = atRef.current + text.length;
      requestAnimationFrame(() => { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* unsupported */ } });
    },
  }), [ref, setValue]);
  return useDictation(target, opts);
}

// ── Target: a contentEditable editor ─────────────────────────────────────────
function placeCaretAfter(node: Node) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.setStartAfter(node);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}
function htmlFromText(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc.replace(/\n/g, "<br>");
}

export function useContentEditableDictation(
  ref: React.RefObject<HTMLElement | null>,
  opts?: DictationOptions,
): DictationControls {
  // A single span holds the evolving dictation so each update just replaces its
  // contents; on end it's unwrapped into the surrounding content.
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const target = useMemo<DictationTarget>(() => ({
    begin() {
      const editor = ref.current;
      if (!editor) return;
      editor.focus();
      const span = document.createElement("span");
      span.setAttribute("data-dictation", "");
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(span);
      } else {
        editor.appendChild(span);
      }
      spanRef.current = span;
      placeCaretAfter(span);
    },
    update(text) {
      const span = spanRef.current;
      if (!span) return;
      span.innerHTML = htmlFromText(text);
      placeCaretAfter(span);
      ref.current?.dispatchEvent(new Event("input", { bubbles: true }));
    },
    end() {
      const span = spanRef.current;
      const editor = ref.current;
      if (span && span.parentNode) {
        const parent = span.parentNode;
        const marker = document.createTextNode("");
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.insertBefore(marker, span);
        parent.removeChild(span);
        placeCaretAfter(marker);
      }
      spanRef.current = null;
      editor?.focus();
      editor?.dispatchEvent(new Event("input", { bubbles: true }));
    },
  }), [ref]);
  return useDictation(target, opts);
}

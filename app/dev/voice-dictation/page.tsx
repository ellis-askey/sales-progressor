"use client";

// /dev/voice-dictation — prototype bench for agent voice typing into an email
// body. Real end to end: the Web Speech API (SpeechRecognition) transcribes;
// a Web Audio AnalyserNode drives the live waveform off the actual mic signal.
// Tap to start, speak, tap to stop, edit by hand, tap to resume — new speech
// inserts at the cursor. Self-contained prototype; productionises into the
// shared composer once the look + feel is signed off. Chrome / Edge: full.
// Safari: webkit-prefixed. Firefox: no SpeechRecognition — the mic degrades to
// a clear "not supported here" note rather than a dead button.

import { useCallback, useEffect, useRef, useState } from "react";

// ── Minimal SpeechRecognition typings (not in lib.dom for all targets) ───────
type SpeechRecognitionAlt = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; 0: SpeechRecognitionAlt; length: number };
type SpeechRecognitionResultList = { length: number; [i: number]: SpeechRecognitionResult };
type SpeechRecognitionEventLike = { resultIndex: number; results: SpeechRecognitionResultList };
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

// ── Spoken punctuation ───────────────────────────────────────────────────────
// Converts dictated command words into real punctuation ("full stop" → ".",
// "comma" → ",", "new line" → a line break). Whole-word, case-insensitive;
// spacing is then tightened around the marks. Applied over the whole dictated
// run so a command never gets split. Capitalisation + any deeper tidy is left
// to the composer's Refine pass.
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

function applySpokenPunctuation(text: string): string {
  let t = text;
  for (const [re, mark] of PUNCTUATION) t = t.replace(re, mark);
  t = t.replace(/\s+([.,;:!?)])/g, "$1");        // no space before a mark
  t = t.replace(/([([])\s+/g, "$1");               // no space after an opener
  t = t.replace(/([.,;:!?])(?=[^\s.,;:!?)])/g, "$1 "); // one space after a mark
  t = t.replace(/[ \t]*\n[ \t]*/g, "\n");          // trim around line breaks
  t = t.replace(/ {2,}/g, " ");                     // collapse doubles
  return t;
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// ── The live waveform ────────────────────────────────────────────────────────
// A voice-memo style waveform: thin bars mirrored around the centre line,
// streaming right-to-left, each new bar the current loudness (RMS off the
// time-domain signal). Quiet moments sit as small dots on the centre line;
// louder speech grows the bars — so it genuinely rides your voice.
function Waveform({ analyser }: { analyser: AnalyserNode | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const smoothRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const BARS = 60;
    if (samplesRef.current.length !== BARS) samplesRef.current = new Array(BARS).fill(0);
    const time = analyser ? new Uint8Array(analyser.fftSize) : null;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const { width, height } = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, width, height);

      // Current loudness (root-mean-square of the waveform around the midpoint).
      let level = 0;
      if (analyser && time) {
        analyser.getByteTimeDomainData(time);
        let sum = 0;
        for (let i = 0; i < time.length; i++) {
          const x = (time[i] - 128) / 128;
          sum += x * x;
        }
        level = Math.sqrt(sum / time.length);
      }
      // Light smoothing + boost so normal speech fills most of the height.
      smoothRef.current += (level - smoothRef.current) * 0.55;
      const s = Math.min(1, smoothRef.current * 2.6);

      const samples = samplesRef.current;
      samples.push(s);
      if (samples.length > BARS) samples.shift();

      const gap = 2;
      const barW = Math.max(2, (width - gap * (BARS - 1)) / BARS);
      const cy = height / 2;
      const minH = barW; // a dot on the centre line when silent

      for (let i = 0; i < BARS; i++) {
        const v = samples[i] ?? 0;
        const h = Math.max(minH, v * height * 0.96);
        const x = i * (barW + gap);
        const y = cy - h / 2;
        // Quiet bars read lighter, loud bars full coral — the two-tone look.
        const op = 0.28 + 0.72 * Math.min(1, v * 1.3);
        ctx.fillStyle = `rgba(240, 78, 44, ${op})`;
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, barW / 2);
        ctx.fill();
      }
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [analyser]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: 34, display: "block" }} />;
}

// ── The dictation control + its wiring to a textarea ─────────────────────────
type Status = "idle" | "listening" | "unsupported" | "denied";

function useDictation(textareaRef: React.RefObject<HTMLTextAreaElement | null>, setValue: (updater: (v: string) => string) => void) {
  const [status, setStatus] = useState<Status>("idle");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  // The point in the text where this dictation session is inserting, the base
  // value as it was at the caret, the finalised text committed so far this
  // session, and the live interim tail (both stream into the body inline, so
  // words appear as they're spoken and firm up in place).
  const insertAtRef = useRef(0);
  const baseRef = useRef("");
  const finalRef = useRef("");
  const interimRef = useRef("");

  useEffect(() => {
    if (!getRecognitionCtor()) setStatus("unsupported");
  }, []);

  // Rebuild the field from base + (finals + interim) inserted at the caret,
  // with spoken punctuation converted over the whole run.
  const commit = useCallback(() => {
    const base = baseRef.current;
    const at = insertAtRef.current;
    const fin = finalRef.current;
    const tail = interimRef.current;
    let raw = fin;
    if (tail) raw += (fin && !fin.endsWith(" ") ? " " : "") + tail;
    const inserted = applySpokenPunctuation(raw);
    const next = base.slice(0, at) + inserted + base.slice(at);
    setValue(() => next);
    // Follow the text as it grows (only when dictating at the end, the common
    // case — mid-insert shouldn't yank the view to the bottom).
    if (at >= base.length) {
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
  }, [setValue, textareaRef]);

  const stop = useCallback(() => {
    activeRef.current = false;
    const rec = recognitionRef.current;
    if (rec) {
      // Detach handlers BEFORE stopping so a late final result can't
      // double-append; fold whatever interim we have into the committed text.
      rec.onresult = null;
      rec.onend = null;
      try { rec.stop(); } catch { /* already stopped */ }
    }
    if (interimRef.current) {
      const fin = finalRef.current;
      finalRef.current = fin + (fin && !fin.endsWith(" ") ? " " : "") + interimRef.current;
      interimRef.current = "";
      commit();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    setAnalyser(null);
    setStatus("idle");
    // Drop the caret after what was just dictated and focus the field, so the
    // agent can edit straight away or tap the mic again to carry on from there.
    const pos = insertAtRef.current + applySpokenPunctuation(finalRef.current).length;
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(pos, pos); } catch { /* unsupported */ }
    });
  }, [commit, textareaRef]);

  const start = useCallback(async () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) { setStatus("unsupported"); return; }

    // Capture where we're inserting from the live cursor (or the end).
    const el = textareaRef.current;
    insertAtRef.current = el ? el.selectionStart : 0;
    baseRef.current = el?.value ?? "";
    finalRef.current = "";
    interimRef.current = "";

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const node = audioCtx.createAnalyser();
      node.fftSize = 256;
      node.smoothingTimeConstant = 0.8;
      source.connect(node);
      setAnalyser(node);
    } catch {
      setStatus("denied");
      return;
    }

    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    recognitionRef.current = rec;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0].transcript;
        if (res.isFinal) {
          // Append with smart spacing.
          const prev = finalRef.current;
          const sep = prev && !prev.endsWith(" ") ? " " : "";
          finalRef.current = prev + sep + txt.trim();
        } else {
          interimText += txt;
        }
      }
      interimRef.current = interimText.trim();
      commit(); // finals + interim both stream straight into the body
    };
    rec.onerror = (ev) => {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") { stop(); setStatus("denied"); }
    };
    rec.onend = () => {
      // Chrome ends the session on pauses; if we're still meant to be live,
      // seamlessly restart so the agent can keep talking.
      if (activeRef.current) { try { rec.start(); } catch { /* already starting */ } }
    };

    activeRef.current = true;
    setStatus("listening");
    try { rec.start(); } catch { /* ignore double-start */ }
  }, [commit, stop, textareaRef]);

  const toggle = useCallback(() => {
    if (status === "listening") stop(); else void start();
  }, [status, start, stop]);

  // Clean up on unmount.
  useEffect(() => () => { activeRef.current = false; recognitionRef.current?.abort(); streamRef.current?.getTracks().forEach((t) => t.stop()); audioCtxRef.current?.close().catch(() => {}); }, []);

  return { status, analyser, toggle };
}

function MicIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5" />
    </svg>
  );
}
function ComposeDemo() {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const applyValue = useCallback((updater: (v: string) => string) => setValue((v) => updater(v)), []);
  const { status, analyser, toggle } = useDictation(textareaRef, applyValue);
  const listening = status === "listening";

  return (
    <div className="vd-card">
      <div className="vd-head">
        <div>
          <p className="vd-head-title">New email</p>
          <p className="vd-head-sub">Sent from your own address · logged to the file</p>
        </div>
      </div>

      <div className="vd-body">
        <label className="vd-field">
          <span className="vd-label">To</span>
          <input className="vd-input" placeholder="Add people or type an email…" />
        </label>
        <label className="vd-field">
          <span className="vd-label">Subject</span>
          <input className="vd-input" defaultValue="Update on 24 Emerton Garth" />
        </label>

        <div className="vd-field">
          <div className="vd-msg-head">
            <span className="vd-label">Message</span>
            {/* Bare mic, no pill, no label. While recording it becomes the live
                voice-memo waveform — tap it to stop. */}
            {status === "unsupported" ? (
              <span className="vd-unsupported">Voice typing needs Chrome or Edge</span>
            ) : listening ? (
              <div className="vd-rec">
                <button type="button" onClick={toggle} className="vd-stop" aria-label="Stop voice typing" title="Stop">
                  <span className="vd-stop-sq" />
                </button>
                <span className="vd-wave-live"><Waveform analyser={analyser} /></span>
              </div>
            ) : (
              <button type="button" onClick={toggle} className="vd-mic-bare" aria-label="Voice type" title="Voice type">
                <MicIcon size={18} />
              </button>
            )}
          </div>

          <div className="vd-textarea-wrap">
            <textarea
              ref={textareaRef}
              className="vd-textarea"
              placeholder="Write your message, or tap the mic and speak…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={7}
            />
          </div>
          {status === "denied" && (
            <p className="vd-denied">Microphone access was blocked. Allow it in the browser’s address-bar icon, then tap Voice type again.</p>
          )}
        </div>

        <div className="vd-signoff">
          <p style={{ fontWeight: 700 }}>Ellis Askey</p>
          <p style={{ color: "var(--vd-muted)" }}>Akeman Residential</p>
        </div>
      </div>

      <div className="vd-foot">
        <span className="vd-from">From <b>Taylor at Akeman Residential</b></span>
        <button className="vd-send">Send</button>
      </div>
    </div>
  );
}

export default function VoiceDictationDevPage() {
  return (
    <div className="vd-root">
      <style>{CSS}</style>
      <header className="vd-pagehead">
        <h1>Voice typing — dictation bench</h1>
        <p>
          Tap <b>Voice type</b>, allow the mic, and talk — words land at the cursor. Tap again to stop,
          edit by hand, then tap once more to carry on where the caret sits. The waveform is driven by your
          actual voice. Real end to end (Web Speech API + Web Audio); nothing is sent anywhere.
        </p>
      </header>

      <ComposeDemo />

      <section className="vd-notes">
        <h2>How it behaves</h2>
        <ul>
          <li><b>Bare mic, no pill, no label</b> — tap the mic and it becomes the live waveform; tap the waveform to stop. Nothing else on screen.</li>
          <li><b>Voice-memo waveform</b> — thin bars mirrored around the centre, streaming with your loudness; quiet sits as small dots, speech grows them.</li>
          <li><b>Words land straight in the body</b> — interim speech streams into the message inline and firms up in place, at the caret. No separate preview line.</li>
          <li><b>Spoken punctuation</b> — say <i>“full stop”, “comma”, “question mark”, “new line”, “new paragraph”</i> (also colon, semicolon, dash, brackets) and they convert as you speak. Deeper tidy-up is one tap of <b>Refine</b> afterwards.</li>
          <li><b>Stop / resume, no pause</b> — one control. Stop, fix a word, click where you want, tap again — new speech inserts at the caret.</li>
          <li><b>Graceful degrade</b> — Firefox has no SpeechRecognition, so the mic becomes a clear note instead of a dead button; a blocked mic explains how to re-enable.</li>
        </ul>
        <p className="vd-notes-foot">
          This is the self-contained prototype. Once you’re happy with the look and feel, it extracts into one
          shared <code>&lt;DictationMic&gt;</code> + hook that drops onto every composer (list to follow).
        </p>
      </section>
    </div>
  );
}

const CSS = `
.vd-root{--vd-bg:#f3f0ea;--vd-card:#fffdf9;--vd-ink:#2d1810;--vd-muted:#8a8275;--vd-sub:#6c6459;
  --vd-border:rgba(45,24,16,.12);--vd-coral:#ff6b4a;--vd-coral-deep:#f04e2c;--vd-inset:rgba(45,24,16,.03);
  min-height:100vh;background:var(--vd-bg);color:var(--vd-ink);padding:32px 24px 72px;
  font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;flex-direction:column;align-items:center;gap:24px;}
.vd-pagehead{max-width:620px;text-align:center;}
.vd-pagehead h1{font-size:22px;font-weight:800;margin:0 0 8px;}
.vd-pagehead p{font-size:13.5px;line-height:1.6;color:var(--vd-sub);margin:0;}

.vd-card{width:620px;max-width:100%;background:var(--vd-card);border:1px solid var(--vd-border);border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(45,24,16,.12);}
.vd-head{background:linear-gradient(135deg,#ff7e5f,#f04e2c);padding:16px 20px;color:#fff;}
.vd-head-title{margin:0;font-size:16px;font-weight:800;}
.vd-head-sub{margin:2px 0 0;font-size:12px;opacity:.9;}
.vd-body{padding:18px 20px;display:flex;flex-direction:column;gap:14px;}
.vd-field{display:flex;flex-direction:column;gap:6px;}
.vd-label{font-size:12px;font-weight:700;color:var(--vd-muted);}
.vd-input{border:1px solid var(--vd-border);border-radius:10px;padding:10px 12px;font-size:14px;color:var(--vd-ink);background:#fff;outline:none;}
.vd-input:focus{border-color:var(--vd-coral);box-shadow:0 0 0 3px rgba(255,107,74,.15);}

.vd-msg-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:36px;}
.vd-mic-bare{border:0;background:transparent;color:var(--vd-coral-deep);cursor:pointer;padding:5px;border-radius:9px;display:inline-flex;transition:background .15s ease;}
.vd-mic-bare:hover{background:rgba(240,78,44,.09);}
.vd-rec{display:inline-flex;align-items:center;gap:11px;height:36px;}
.vd-stop{position:relative;width:26px;height:26px;border-radius:50%;border:0;background:var(--vd-coral-deep);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.vd-stop-sq{width:9px;height:9px;border-radius:2.5px;background:#fff;}
.vd-stop::before{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid rgba(240,78,44,.4);animation:vd-ring 1.5s ease-out infinite;}
@keyframes vd-ring{0%{transform:scale(.72);opacity:.9}100%{transform:scale(1.45);opacity:0}}
.vd-wave-live{width:150px;display:inline-flex;}
.vd-wave-live canvas{width:150px;}
.vd-unsupported{font-size:11.5px;color:var(--vd-muted);font-style:italic;}

.vd-textarea-wrap{position:relative;}
.vd-textarea{width:100%;border:1px solid var(--vd-border);border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.55;color:var(--vd-ink);background:#fff;outline:none;resize:vertical;font-family:inherit;}
.vd-textarea:focus{border-color:var(--vd-coral);box-shadow:0 0 0 3px rgba(255,107,74,.15);}
.vd-denied{margin:8px 0 0;font-size:12px;color:var(--vd-coral-deep);}

.vd-signoff{border-top:1px solid var(--vd-border);padding-top:12px;font-size:13px;line-height:1.5;}
.vd-signoff p{margin:0;}
.vd-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-top:1px solid var(--vd-border);background:var(--vd-inset);}
.vd-from{font-size:12px;color:var(--vd-muted);}
.vd-send{background:linear-gradient(180deg,var(--vd-coral),var(--vd-coral-deep));color:#fff;border:0;font-size:14px;font-weight:700;padding:10px 22px;border-radius:11px;cursor:pointer;box-shadow:0 2px 0 #c63e20;}

.vd-notes{width:620px;max-width:100%;background:var(--vd-card);border:1px solid var(--vd-border);border-radius:16px;padding:18px 20px;}
.vd-notes h2{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--vd-muted);margin:0 0 10px;}
.vd-notes ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:7px;}
.vd-notes li{font-size:13px;line-height:1.55;color:var(--vd-sub);}
.vd-notes-foot{font-size:12.5px;color:var(--vd-muted);margin:12px 0 0;line-height:1.55;}
.vd-notes code{background:var(--vd-inset);padding:1px 5px;border-radius:5px;font-size:12px;}
`;

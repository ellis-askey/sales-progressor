"use client";

// "Sold for…?" full-size prototype — a full-screen simulation of the new-sale
// SubmissionOverlay with the loading game inside, so the real feel can be
// judged before wiring it into components/transactions-v2/SubmissionOverlay.
//
// Zero input to start: a random outcode is chosen (add ?outcode=EN8 to the URL
// to pin one, which is how the real overlay behaves — it would use the postcode
// of the sale being created). Decks are real Land Registry sales, enriched with
// EPC floor area + band, dealt as a higher-or-lower chain with streaks.
// Dev-only harness; nothing here is imported by app code.

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const CardMap = dynamic(() => import("./CardMap"), { ssr: false });

type Card = {
  id: string;
  address: string;
  postcode: string;
  lat: number | null;
  lng: number | null;
  propertyType: string;
  estateType: string;
  newBuild: boolean;
  soldDate: string;
  amount: number;
  floorAreaSqm: number | null;
  epcBand: string | null;
  lastSold: { date: string; amount: number } | null;
};

// "advance" is the short beat where the answered card physically slides up
// into the anchor-strip position before the next card deals.
type Phase = "building" | "guess" | "reveal-correct" | "reveal-wrong" | "advance" | "cleared" | "error";

// Mirrors the real SubmissionOverlay copy so the simulation reads identically.
const BUILD_MESSAGES = [
  "Building your file…",
  "Setting up the milestones…",
  "Onboarding the neighbours…",
  "Lining up the solicitors…",
  "Getting the keys cut…",
  "Almost ready…",
];

// Busy residential districts across England & Wales (Land Registry coverage)
// for the no-input random start. In the real overlay the first area is the
// outcode of the property the agent just entered on the form.
const OUTCODES = [
  "EN8", "EN10", "E17", "N22", "SE15", "SW19", "BR1", "CR0", "RM1", "IG1",
  "WD18", "LU1", "SS1", "CM1", "CO1", "NR1", "IP1", "PE1", "CB1", "OX4",
  "RG1", "SL1", "GU1", "SO15", "PO2", "BH9", "BS3", "GL1", "EX1", "PL4",
  "B13", "CV6", "LE2", "NG5", "DE22", "S8", "LS6", "M20", "SK4", "L17",
  "PR1", "YO26", "HU5", "NE6", "SR4", "DH1", "CF14", "SA1", "NP19",
];

const CORAL = "#FF6B4A";
const CORAL_DEEP = "#E8512F";
const INK = "#2B2420";
const MUTED = "#8A7F74";
const LINE = "#EDE6DC";
const GREEN = "#2E8B5F";
const RED = "#D9533B";
const BEST_KEY = "dev-sold-for-best";

// A card plus the price it's judged against: a clean round number £20–40k
// above or below the real sold price (£10–20k for cheaper homes, where a £40k
// swing would give the answer away). This is the whole game — each property is
// a self-contained "how good is your valuation" test, never tied to the
// previous card.
type Round = Card & { anchor: number };

function makeAnchor(amount: number): number {
  const [lo, hi] = amount < 120_000 ? [10_000, 20_000] : [20_000, 40_000];
  const offset = lo + Math.random() * (hi - lo);
  const sign = Math.random() < 0.5 ? -1 : 1;
  let anchor = Math.round((amount + sign * offset) / 5_000) * 5_000;
  if (anchor <= 5_000) anchor = Math.round((amount + offset) / 5_000) * 5_000;
  if (anchor === amount) anchor += sign * 5_000;
  return anchor;
}

function dealRounds(cards: Card[]): Round[] {
  return shuffle(cards).map((c) => ({ ...c, anchor: makeAnchor(c.amount) }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function gbp(n: number): string {
  return `£${n.toLocaleString("en-GB")}`;
}

// Full month name on desktop; short month on mobile where the lines wrap.
function soldWhen(iso: string, mobile: boolean): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { month: mobile ? "short" : "long", year: "numeric" });
}

// Odometer price reveal: rolls from the anchor price to the real figure so the
// payoff dramatises the gap, not just the number. Reduced motion jumps straight.
function RollingPrice({ from, to, color }: { from: number; to: number; color: string }) {
  const [val, setVal] = useState(from);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    const start = performance.now();
    const dur = 480;
    let raf: number;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return (
    <p style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", color, fontVariantNumeric: "tabular-nums" }}>
      {gbp(val)}
    </p>
  );
}

function cardMeta(c: Card): string {
  const bits = [
    c.propertyType,
    c.estateType,
    c.floorAreaSqm ? `${Math.round(c.floorAreaSqm)} m²` : null,
    c.epcBand ? `EPC ${c.epcBand}` : null,
    c.newBuild ? "New build" : null,
  ];
  return bits.filter(Boolean).join(" · ");
}

export function SoldForGame() {
  const [phase, setPhase] = useState<Phase>("building");
  const [buildMsg, setBuildMsg] = useState(0);
  const [area, setArea] = useState<{ outcode: string; district: string | null } | null>(null);
  const [deck, setDeck] = useState<Round[]>([]);
  const [idx, setIdx] = useState(0); // deck[idx] = the card in play
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [readyPill, setReadyPill] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 480px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const pinnedOutcode = useRef<string | null>(null);
  const lastOutcode = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0); // invalidates in-flight loads when a new one starts

  useEffect(() => {
    const stored = parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10);
    if (stored > 0) setBest(stored);
    const fromUrl = new URLSearchParams(window.location.search).get("outcode");
    if (fromUrl && /^[A-Za-z]{1,2}[0-9][0-9A-Za-z]?$/.test(fromUrl.trim())) {
      pinnedOutcode.current = fromUrl.trim().toUpperCase();
    }
    loadArea(pinnedOutcode.current ?? undefined);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The real overlay's build messages cycle for the whole stay — the file is
  // being created behind the game, and the strip at the bottom says so. Parks
  // on "Almost ready…" exactly like SubmissionOverlay.
  useEffect(() => {
    const t = setInterval(() => setBuildMsg((i) => Math.min(i + 1, BUILD_MESSAGES.length - 1)), 1100);
    return () => clearInterval(t);
  }, []);

  const bumpBest = useCallback((s: number) => {
    setBest((prev) => {
      const next = Math.max(prev, s);
      if (next !== prev) localStorage.setItem(BEST_KEY, String(next));
      return next;
    });
  }, []);

  function pickOutcode(): string {
    const pool = OUTCODES.filter((o) => o !== lastOutcode.current);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function loadArea(outcode?: string, attempt = 1) {
    const gen = ++generation.current;
    const oc = outcode ?? pickOutcode();
    lastOutcode.current = oc;
    setPhase("building");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/dev/sold-for?outcode=${encodeURIComponent(oc)}`);
      if (gen !== generation.current) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "deck fetch failed");
      const cards: Card[] = json.cards ?? [];
      // Thin area (rural district, sparse register): quietly deal elsewhere.
      if (cards.length < 4 && attempt < 4 && !pinnedOutcode.current) {
        loadArea(undefined, attempt + 1);
        return;
      }
      if (cards.length < 2) {
        setErrorMsg(`Not enough registered sales in ${oc} for a game.`);
        setPhase("error");
        return;
      }
      setArea({ outcode: json.outcode, district: json.district });
      setDeck(dealRounds(cards));
      setIdx(0);
      setStreak(0);
      setPhase("guess");
    } catch {
      if (gen !== generation.current) return;
      if (attempt < 3) {
        loadArea(pinnedOutcode.current ?? undefined, attempt + 1);
      } else {
        setErrorMsg("Couldn't reach the sold-price data. Give it another go.");
        setPhase("error");
      }
    }
  }

  function replaySameArea() {
    setDeck((d) => dealRounds(d)); // reshuffle AND re-anchor, so replays aren't memorisable
    setIdx(0);
    setStreak(0);
    setPhase("guess");
  }

  const guess = useCallback(
    (dir: "higher" | "lower") => {
      if (phase !== "guess") return;
      const card = deck[idx];
      if (!card) return;
      const correct =
        card.amount === card.anchor ||
        (dir === "higher" ? card.amount > card.anchor : card.amount < card.anchor);
      if (correct) {
        const s = streak + 1;
        setStreak(s);
        bumpBest(s);
        setPhase("reveal-correct");
        timer.current = setTimeout(() => {
          if (idx + 1 >= deck.length) {
            setPhase("cleared");
            timer.current = setTimeout(() => loadArea(), 1800);
          } else {
            // Answered card slides up and away, then the next deals in.
            setPhase("advance");
            timer.current = setTimeout(() => {
              setIdx((i) => i + 1);
              setPhase("guess");
            }, 280);
          }
        }, 1250);
      } else {
        setPhase("reveal-wrong");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, deck, idx, streak, bumpBest],
  );

  // Arrow keys: up = higher, down = lower. Fastest possible round.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        guess("higher");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        guess("lower");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guess]);

  const card = deck[idx];
  const revealed = phase === "reveal-correct" || phase === "reveal-wrong" || phase === "advance";
  const wasCorrect = phase === "reveal-correct" || phase === "advance";
  const milestone = streak === 3 || (streak > 0 && streak % 5 === 0);
  // The pill answers the exact question asked ("more or less than £X?") in
  // absolute pounds against that figure.
  const deltaLabel = card
    ? card.amount === card.anchor
      ? "Spot on the asking figure"
      : `${gbp(Math.abs(card.amount - card.anchor))} ${card.amount > card.anchor ? "more" : "less"}`
    : "";

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#F7F1E8", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", color: INK }}>
      <style>{`
        @keyframes sf-pop { 0% { opacity: 0; transform: translateY(8px) scale(0.98); } 100% { opacity: 1; transform: none; } }
        @keyframes sf-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes sf-pill-in { 0% { opacity: 0; transform: translate(-50%, 16px); } 100% { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes sf-spin { to { transform: rotate(360deg); } }
        @keyframes sf-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.72; } }
        /* Answered card slides up toward the anchor strip as the deck advances */
        @keyframes sf-advance { 0% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateY(-84px) scale(0.9); } }
        /* Verdict stamp slams in over the map */
        .sf-stamp { animation: sf-stamp-in 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes sf-stamp-in { 0% { opacity: 0; transform: scale(0.3) rotate(-10deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } }
        /* +1 floats off the streak counter on a correct call */
        .sf-plus1 { position: absolute; top: -4px; right: 0; font-size: 12px; font-weight: 800; color: ${GREEN}; animation: sf-plus1-float 900ms ease both; pointer-events: none; }
        @keyframes sf-plus1-float { 0% { opacity: 0; transform: translateY(2px); } 25% { opacity: 1; } 100% { opacity: 0; transform: translateY(-16px); } }
        /* Milestone streaks (3, 5, 10…) flash the counter coral */
        .sf-chip-ms { animation: sf-ms-flash 700ms ease both; }
        @keyframes sf-ms-flash { 0% { transform: scale(1); } 35% { transform: scale(1.35); color: ${CORAL_DEEP}; } 100% { transform: scale(1); } }
        /* File-ready pill arrow: beckons on hover only, matching the
           Higher/Lower arrow treatment. */
        .sf-pill-arr { display: inline-block; margin-left: 2px; }
        button:hover .sf-pill-arr { animation: sf-beckon 650ms ease-in-out infinite; }
        @keyframes sf-beckon { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        /* Backdrop blobs */
        .sf-blob { position: absolute; border-radius: 50%; }
        @keyframes sf-drift1 { from { transform: translate(0, 0); } to { transform: translate(52px, 30px); } }
        @keyframes sf-drift2 { from { transform: translate(0, 0); } to { transform: translate(-64px, -36px); } }
        @keyframes sf-drift3 { from { transform: translate(0, 0); } to { transform: translate(38px, 44px); } }
        @media (prefers-reduced-motion: reduce) {
          .sf-blob { animation: none !important; }
          button:hover .sf-pill-arr { animation: none; }
          .sf-stamp { animation: none; }
          .sf-plus1 { animation: none; opacity: 0; }
          .sf-chip-ms { animation: none; }
        }
        .sf-btn { transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease; cursor: pointer; }
        .sf-btn:hover:not(:disabled) { transform: translateY(-1px); }
        .sf-btn:active:not(:disabled) { transform: translateY(0); }
        .sf-btn:disabled { opacity: 0.45; cursor: default; }
        /* Tactile coral primary — the chase-button family (.rem-chase-go,
           agent-system.css): coral -> coral-deep vertical gradient + top sheen,
           values inlined because the dev page sits outside the agent shell. */
        .sf-btn-higher {
          flex: 1; height: 48px; font-size: 15px; font-weight: 600; line-height: 1; letter-spacing: -0.005em;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          color: #fff; border: none; border-radius: 11px; cursor: pointer; white-space: nowrap;
          background: linear-gradient(180deg, #FF8A65 0%, ${CORAL} 100%);
          box-shadow: 0 4px 14px rgba(255, 107, 74, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.28);
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .sf-btn-higher:hover:not(:disabled) {
          box-shadow: 0 6px 18px rgba(255, 107, 74, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.28);
          transform: translateY(-1px);
        }
        .sf-btn-higher:active:not(:disabled) { transform: scale(0.985); }
        .sf-btn-lower {
          flex: 1; height: 48px; font-size: 15px; font-weight: 600; line-height: 1; letter-spacing: -0.005em;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          color: ${INK}; border: 1.5px solid ${LINE}; border-radius: 11px; cursor: pointer; white-space: nowrap;
          background: #fff;
          transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }
        .sf-btn-lower:hover:not(:disabled) {
          border-color: ${CORAL};
          transform: translateY(-1px);
          box-shadow: 0 4px 14px rgba(43, 36, 32, 0.08);
        }
        .sf-btn-lower:active:not(:disabled) { transform: scale(0.985); }
        .sf-arr { display: inline-block; transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1); }
        .sf-btn-higher:hover .sf-arr { animation: sf-arr-up 650ms ease-in-out infinite; }
        .sf-btn-lower:hover .sf-arr { animation: sf-arr-down 650ms ease-in-out infinite; }
        @keyframes sf-arr-up { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes sf-arr-down { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(3px); } }
        @media (prefers-reduced-motion: reduce) {
          .sf-btn-higher:hover .sf-arr, .sf-btn-lower:hover .sf-arr { animation: none; }
        }
      `}</style>

      {/* Soft colour blobs standing in for the new-sale page behind the overlay.
          They drift slowly so the frozen-screenshot feel never sets in. */}
      <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <div className="sf-blob" style={{ top: "12%", left: "10%", width: 460, height: 340, background: "radial-gradient(closest-side, rgba(255,107,74,0.15), transparent)", animation: "sf-drift1 52s ease-in-out infinite alternate" }} />
        <div className="sf-blob" style={{ top: "55%", left: "62%", width: 520, height: 380, background: "radial-gradient(closest-side, rgba(255,160,120,0.13), transparent)", animation: "sf-drift2 64s ease-in-out infinite alternate" }} />
        <div className="sf-blob" style={{ top: "4%", left: "52%", width: 420, height: 300, background: "radial-gradient(closest-side, rgba(255,200,170,0.15), transparent)", animation: "sf-drift3 47s ease-in-out infinite alternate" }} />
      </div>
      {/* The overlay surface itself, as in SubmissionOverlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(250,247,242,0.72)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px 76px" }}>

        {phase === "building" && (
          // Skeleton of the challenge card while the deck builds, so the game
          // surface is present from the first paint rather than after a wait.
          <div style={{ width: "100%", maxWidth: 520, animation: "sf-fade 250ms ease both" }}>
            <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${LINE}`, boxShadow: "0 14px 40px rgba(43,36,32,0.10)", animation: "sf-breathe 1400ms ease-in-out infinite" }}>
              <div style={{ height: 200, background: "linear-gradient(135deg, #F2ECE3, #EAE0D2)" }} />
              <div style={{ padding: "18px 22px 22px" }}>
                <div style={{ height: 18, width: "55%", borderRadius: 6, background: "#F2ECE3" }} />
                <div style={{ height: 12, width: "75%", borderRadius: 6, background: "#F6F0E8", marginTop: 10 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
                  <div style={{ flex: 1, height: 48, borderRadius: 8, background: "#F2ECE3" }} />
                  <div style={{ flex: 1, height: 48, borderRadius: 8, background: "#F6F0E8" }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", animation: "sf-pop 240ms ease both" }}>
            <p style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 600 }}>{errorMsg}</p>
            <button className="sf-btn" onClick={() => loadArea(pinnedOutcode.current ?? undefined)} style={{ padding: "12px 24px", fontSize: 15, fontWeight: 700, color: "#fff", background: CORAL, border: "none", borderRadius: 12 }}>
              Try again
            </button>
          </div>
        )}

        {phase !== "building" && phase !== "error" && card && (
          <div style={{ width: "100%", maxWidth: 520, animation: "sf-fade 300ms ease both" }}>
            {/* Header: area + streak */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: MUTED }}>
                {area?.outcode}{area?.district ? ` · ${area.district}` : ""}
              </span>
              <span style={{ position: "relative", fontSize: 13, fontWeight: 600, color: MUTED }}>
                {wasCorrect && <span key={streak} className="sf-plus1" aria-hidden>+1</span>}
                Streak{" "}
                <span key={`s${streak}`} className={milestone ? "sf-chip-ms" : undefined} style={{ color: INK, display: "inline-block" }}>
                  {streak}
                </span>
                <span style={{ margin: "0 6px", color: LINE }}>|</span>
                Best <span style={{ color: INK }}>{best}</span>
              </span>
            </div>

            {/* The card in play */}
            {phase !== "cleared" && (
              <div key={card.id} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", border: `1.5px solid ${revealed ? (wasCorrect ? "#4CAF7D" : RED) : LINE}`, boxShadow: "0 14px 40px rgba(43,36,32,0.10)", animation: phase === "advance" ? "sf-advance 280ms ease-in both" : "sf-pop 300ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
                {/* Map header */}
                <div style={{ position: "relative", height: 200, background: "linear-gradient(135deg, #F2ECE3, #EAE0D2)" }}>
                  {card.lat != null && card.lng != null && <CardMap lat={card.lat} lng={card.lng} />}
                  <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 64, background: "linear-gradient(transparent, rgba(255,255,255,0.92))", pointerEvents: "none" }} />
                  {/* Reward tick on a correct call only. A wrong call already reads
                      loud from the red border, red price and "Not this one." */}
                  {revealed && wasCorrect && (
                    <span className="sf-stamp" style={{ position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 19, fontWeight: 800, lineHeight: 1, color: GREEN, background: "rgba(255,255,255,0.95)", border: `2.5px solid ${GREEN}`, boxShadow: "0 4px 14px rgba(43,36,32,0.18)", zIndex: 5, pointerEvents: "none" }}>
                      ✓
                    </span>
                  )}
                </div>

                <div style={{ padding: "6px 22px 20px" }}>
                  <p style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em" }}>{card.address}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 13.5, color: MUTED }}>{cardMeta(card)}</p>
                  {card.lastSold && (
                    <p style={{ margin: "7px 0 0", fontSize: 13, color: MUTED }}>
                      Last changed hands {soldWhen(card.lastSold.date, isMobile)} for <span style={{ fontWeight: 700, color: INK }}>{gbp(card.lastSold.amount)}</span>
                    </p>
                  )}

                  {revealed ? (
                    <div style={{ marginTop: 14, animation: "sf-pop 220ms ease both" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                        <RollingPrice from={card.anchor} to={card.amount} color={wasCorrect ? GREEN : RED} />
                        {/* Delta pill: same tinted-gradient + hairline + inset-sheen
                            treatment as the app's coral info chips, in verdict colour */}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 13,
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color: wasCorrect ? "#256F4C" : "#B8422D",
                            background: wasCorrect
                              ? "linear-gradient(160deg, rgba(46,139,95,0.16), rgba(46,139,95,0.05))"
                              : "linear-gradient(160deg, rgba(217,83,59,0.16), rgba(217,83,59,0.05))",
                            border: `1px solid ${wasCorrect ? "rgba(46,139,95,0.28)" : "rgba(217,83,59,0.28)"}`,
                            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 3px ${wasCorrect ? "rgba(46,139,95,0.16)" : "rgba(217,83,59,0.16)"}`,
                            borderRadius: 999,
                            padding: "5px 13px",
                            animation: "sf-pop 220ms ease 420ms both",
                          }}
                        >
                          {card.amount !== card.anchor && (
                            <span aria-hidden style={{ fontSize: 11, lineHeight: 1 }}>
                              {card.amount > card.anchor ? "▲" : "▼"}
                            </span>
                          )}
                          {deltaLabel}
                        </span>
                      </div>
                      <p style={{ margin: "6px 0 0", fontSize: 13.5, fontWeight: 600, color: wasCorrect ? GREEN : RED }}>
                        {wasCorrect ? "Called it." : "Not this one."} Sold {soldWhen(card.soldDate, isMobile)}.
                      </p>
                      {phase === "reveal-wrong" && (
                        <button className="sf-btn" onClick={replaySameArea} style={{ width: "100%", marginTop: 14, padding: "13px 0", fontSize: 14.5, fontWeight: 700, color: "#fff", background: INK, border: "none", borderRadius: 11 }}>
                          Go again
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 14 }}>
                      <p style={{ margin: "0 0 10px", fontSize: 14, color: MUTED }}>
                        Sold {soldWhen(card.soldDate, isMobile)}. More or less than <span style={{ fontWeight: 700, color: INK }}>{gbp(card.anchor)}</span>?
                      </p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="sf-btn-higher" onClick={() => guess("higher")}>
                          Higher <span className="sf-arr">↑</span>
                        </button>
                        <button className="sf-btn-lower" onClick={() => guess("lower")}>
                          Lower <span className="sf-arr">↓</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {phase === "cleared" && (
              <div style={{ background: "#fff", border: `1.5px solid #4CAF7D`, borderRadius: 20, padding: "26px 22px", textAlign: "center", boxShadow: "0 14px 40px rgba(43,36,32,0.10)", animation: "sf-pop 260ms ease both" }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: GREEN }}>Area cleared. Streak {streak}.</p>
                <p style={{ margin: "6px 0 0", fontSize: 13.5, color: MUTED }}>Dealing a new area…</p>
              </div>
            )}

          </div>
        )}

        {/* File-creation status, pinned under the game for the whole stay —
            this is the overlay's truth-teller while they play. Swaps for the
            ready pill when creation completes. */}
        {!readyPill && (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, pointerEvents: "none" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2.5px solid rgba(255,107,74,0.18)", borderTopColor: CORAL_DEEP, animation: "sf-spin 800ms linear infinite", flexShrink: 0 }} />
            <p key={buildMsg} style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: MUTED, animation: "sf-pop 300ms ease both" }}>{BUILD_MESSAGES[buildMsg]}</p>
          </div>
        )}
      </div>

      {/* Dev harness: the file-ready interruption, as the real overlay would show it */}
      <button
        className="sf-btn"
        onClick={() => setReadyPill((v) => !v)}
        style={{ position: "fixed", top: 16, right: 16, zIndex: 60, padding: "8px 14px", fontSize: 12.5, fontWeight: 600, color: MUTED, background: "rgba(255,255,255,0.85)", border: `1px solid ${LINE}`, borderRadius: 10 }}
      >
        {readyPill ? "Hide pill" : "Simulate: file ready"}
      </button>
      {readyPill && (
        <button
          className="sf-btn"
          onClick={() => setReadyPill(false)}
          style={{ position: "fixed", left: "50%", bottom: 32, transform: "translateX(-50%)", animation: "sf-pill-in 280ms ease both", padding: "14px 28px", fontSize: 15, fontWeight: 700, color: "#fff", background: `linear-gradient(135deg, ${CORAL}, ${CORAL_DEEP})`, border: "none", borderRadius: 999, boxShadow: "0 10px 30px rgba(232,81,47,0.4)", zIndex: 70 }}
        >
          Your file&apos;s ready <span className="sf-pill-arr" aria-hidden>→</span>
        </button>
      )}
    </div>
  );
}

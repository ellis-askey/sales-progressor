"use client";

// "Draft for everyone" — type one fact about the sale, get a separate update
// written for each side (seller / buyer) plus an internal file note. The client
// updates open straight into the news (no greeting). Nothing sends until you
// click. Each update always saves to that client's portal, plus one alert (a
// phone notification if they have them on, otherwise email). Sending or saving a
// box collapses it away; when the last one goes, the panel closes to the
// timeline. Lives inside the file's activity composer.

import { useEffect, useRef, useState } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { sendDraftClientUpdateAction, saveDraftNoteAction } from "@/app/actions/draft-update";
import { extractFirstName } from "@/lib/contacts/displayName";

type ClientContact = { id: string; name: string; roleType: string };
type CardKey = "seller" | "buyer" | "note";

function firstName(n: string): string {
  return extractFirstName(n);
}

// Smoothly collapses its content to zero height (and fades) when `show` is
// false, so the cards below rise to fill the gap. Uses the grid-rows 1fr→0fr
// technique already used elsewhere in the app (see ChaseDrawer's step list).
function Collapse({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        transform: show ? "none" : "translateY(-4px)",
        transition:
          "grid-template-rows 320ms cubic-bezier(0.25,0,0,1), opacity 200ms ease, transform 260ms cubic-bezier(0.25,0,0,1)",
        overflow: "hidden",
      }}
    >
      <div style={{ minHeight: 0 }}>
        <div style={{ paddingBottom: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function CheckDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        width: 15,
        height: 15,
        borderRadius: 5,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        background: on ? "var(--agent-coral)" : "transparent",
        border: on ? "none" : "1px solid var(--agent-text-tertiary)",
        transition: "background 120ms ease, border-color 120ms ease",
      }}
    >
      {on && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

export function DraftForEveryonePanel({
  transactionId,
  contacts,
  onClose,
}: {
  transactionId: string;
  contacts: ClientContact[];
  onClose: () => void;
}) {
  const { toast } = useAgentToast();

  const sellers = contacts.filter((c) => c.roleType === "vendor");
  const buyers = contacts.filter((c) => c.roleType === "purchaser");

  const [fact, setFact] = useState("");
  const [drafting, setDrafting] = useState(false);

  const [sellerText, setSellerText] = useState<string | null>(null);
  const [buyerText, setBuyerText] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string | null>(null);
  // The original AI drafts, kept so edits (final vs draft) can teach the update
  // voice profile on send. Not shown; only sent alongside the edited content.
  const [sellerGen, setSellerGen] = useState("");
  const [buyerGen, setBuyerGen] = useState("");

  const [selectedSeller, setSelectedSeller] = useState<string[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<string[]>([]);

  const [busy, setBusy] = useState<Record<CardKey, boolean>>({ seller: false, buyer: false, note: false });
  const [exiting, setExiting] = useState<Set<CardKey>>(new Set());
  const [removed, setRemoved] = useState<Set<CardKey>>(new Set());

  const hasDrafts = noteText !== null;
  const presentKeys: CardKey[] = [
    ...(sellers.length && sellerText !== null ? (["seller"] as const) : []),
    ...(buyers.length && buyerText !== null ? (["buyer"] as const) : []),
    ...(noteText !== null ? (["note"] as const) : []),
  ];

  // Once every card has been sent/saved/skipped, close the whole panel so the
  // timeline below slides up into its place.
  const closedRef = useRef(false);
  useEffect(() => {
    if (!hasDrafts || closedRef.current) return;
    if (presentKeys.length > 0 && presentKeys.every((k) => removed.has(k))) {
      closedRef.current = true;
      onClose();
    }
  }, [removed, hasDrafts, presentKeys, onClose]);

  async function draft() {
    const f = fact.trim();
    if (!f) return;
    setDrafting(true);
    try {
      const res = await fetch("/api/ai/draft-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, fact: f }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Couldn't draft that."); return; }
      setSellerText(sellers.length ? (data.generated.sellerMessage ?? "") : null);
      setBuyerText(buyers.length ? (data.generated.buyerMessage ?? "") : null);
      setNoteText(data.generated.internalNote ?? "");
      setSellerGen(data.generated.sellerMessage ?? "");
      setBuyerGen(data.generated.buyerMessage ?? "");
      setSelectedSeller(sellers.map((c) => c.id));
      setSelectedBuyer(buyers.map((c) => c.id));
      setExiting(new Set());
      setRemoved(new Set());
      closedRef.current = false;
    } catch {
      toast.error("Couldn't draft that. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  function collapseAway(key: CardKey) {
    setExiting((prev) => new Set(prev).add(key));
    window.setTimeout(() => setRemoved((prev) => new Set(prev).add(key)), 340);
  }

  async function sendSide(side: "seller" | "buyer") {
    const text = side === "seller" ? sellerText : buyerText;
    const ids = side === "seller" ? selectedSeller : selectedBuyer;
    if (!text?.trim()) return;
    if (ids.length === 0) { toast.error("Pick at least one person, or skip this update."); return; }
    setBusy((b) => ({ ...b, [side]: true }));
    try {
      const res = await sendDraftClientUpdateAction({ transactionId, contactIds: ids, content: text, generatedText: side === "seller" ? sellerGen : buyerGen });
      if (res.ok) {
        toast.success(`Sent to ${res.count} ${side}${res.count === 1 ? "" : "s"}`);
        collapseAway(side);
      } else {
        toast.error(res.error);
        setBusy((b) => ({ ...b, [side]: false }));
      }
    } catch {
      toast.error("Couldn't send. Try again.");
      setBusy((b) => ({ ...b, [side]: false }));
    }
  }

  async function saveNote() {
    if (!noteText?.trim()) return;
    setBusy((b) => ({ ...b, note: true }));
    try {
      const res = await saveDraftNoteAction({ transactionId, content: noteText });
      if (res.ok) { toast.success("Note saved to the file"); collapseAway("note"); }
      else { toast.error(res.error); setBusy((b) => ({ ...b, note: false })); }
    } catch {
      toast.error("Couldn't save. Try again.");
      setBusy((b) => ({ ...b, note: false }));
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" };
  const cardStyle: React.CSSProperties = { border: "0.5px solid var(--agent-border-default)", borderRadius: 10, padding: "12px 14px", background: "var(--agent-surface-glass)" };

  // A side's editable update, its recipient toggles, and Send / Skip.
  function SideCard({ side }: { side: "seller" | "buyer" }) {
    const people = side === "seller" ? sellers : buyers;
    const text = side === "seller" ? sellerText : buyerText;
    const setText = side === "seller" ? setSellerText : setBuyerText;
    const selected = side === "seller" ? selectedSeller : selectedBuyer;
    const setSelected = side === "seller" ? setSelectedSeller : setSelectedBuyer;
    const label = side === "seller" ? "Seller update" : "Buyer update";

    return (
      <div style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={labelStyle}>{label}</span>
          <button onClick={() => collapseAway(side)} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Skip</button>
        </div>
        <textarea
          value={text ?? ""}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="glass-input w-full px-3 py-2.5 text-sm resize-none"
        />
        {/* Who it goes to — all on by default, tap a name to leave them out. */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
          <span style={{ fontSize: 11, color: "var(--agent-text-tertiary)", fontWeight: 600 }}>To</span>
          {people.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => setSelected((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                aria-pressed={on}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "3px 9px 3px 6px", borderRadius: 8, cursor: "pointer",
                  border: on ? "0.5px solid rgba(var(--agent-coral-rgb), 0.35)" : "0.5px solid var(--agent-border-subtle)",
                  background: on ? "rgba(var(--agent-coral-rgb), 0.06)" : "transparent",
                  color: on ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                  fontSize: 11.5, fontWeight: 500,
                  transition: "background 120ms ease, border-color 120ms ease, color 120ms ease",
                }}
              >
                <CheckDot on={on} />
                {firstName(c.name)}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flex: 1, minWidth: 170, lineHeight: 1.4 }}>
            One alert per update. If they have notifications switched on, they&rsquo;ll get a phone notification. If not, we&rsquo;ll send an email. Either way, it&rsquo;s always saved to their portal.
          </span>
          <button
            onClick={() => sendSide(side)}
            disabled={!text?.trim() || busy[side] || selected.length === 0}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            {busy[side] ? "Sending…" : "Send update"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="agent-reveal-in" style={{ padding: "12px 14px" }}>
      {/* Title + cancel live on the composer row above — not repeated here. */}
      {/* The fact */}
      <p style={{ ...labelStyle, marginBottom: 5 }}>The update, in your own words</p>
      <textarea
        value={fact}
        onChange={(e) => setFact(e.target.value)}
        placeholder="e.g. Spoke to the buyer's solicitor, they have everything they need to issue the draft contract pack and will do shortly."
        rows={3}
        className="glass-input w-full px-3 py-2.5 text-sm resize-none"
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button onClick={draft} disabled={!fact.trim() || drafting} className="agent-btn agent-btn-sm agent-btn-primary">
          {drafting ? "Drafting…" : hasDrafts ? "Re-draft" : "Draft"}
        </button>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
          Type the fact once. We&rsquo;ll turn it into the right update for each side and add a note to the file. Nothing goes out until you click.
        </span>
      </div>

      {/* The drafts — one box per side, plus the internal note */}
      {hasDrafts && (
        <div className="agent-reveal-in" style={{ marginTop: 14 }}>
          {sellers.length > 0 && sellerText !== null && !removed.has("seller") && (
            <Collapse show={!exiting.has("seller")}>
              <SideCard side="seller" />
            </Collapse>
          )}

          {buyers.length > 0 && buyerText !== null && !removed.has("buyer") && (
            <Collapse show={!exiting.has("buyer")}>
              <SideCard side="buyer" />
            </Collapse>
          )}

          {noteText !== null && !removed.has("note") && (
            <Collapse show={!exiting.has("note")}>
              <div style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={labelStyle}>File note (internal only)</span>
                  <button onClick={() => collapseAway("note")} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Skip</button>
                </div>
                <textarea
                  value={noteText ?? ""}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows={2}
                  className="glass-input w-full px-3 py-2.5 text-sm resize-none"
                />
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button onClick={saveNote} disabled={!noteText?.trim() || busy.note} className="agent-btn agent-btn-sm agent-btn-secondary">
                    {busy.note ? "Saving…" : "Save note"}
                  </button>
                </div>
              </div>
            </Collapse>
          )}
        </div>
      )}
    </div>
  );
}

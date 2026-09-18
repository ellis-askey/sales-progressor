"use client";

// The chase drawer's "Sent ✓" state. After a chase goes out, this asks the one
// useful follow-up question: who is now out of the loop that shouldn't be? It
// offers up to two ready-written updates, drafted from the chase that just went
// out (via /api/ai/chase-followup):
//   - the SAME-side client, when they weren't the person chased and weren't CC'd
//   - the OPPOSITE-side client, who is always waiting on this
// Each is editable, delivered feed-always + one-alert (sendDraftClientUpdateAction),
// and fades away when sent or skipped, the remaining card growing to fill.
// When both are handled, the drawer finishes. See
// docs/active/keep-other-side-posted/00-spec.md.

import { useEffect, useRef, useState } from "react";
import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { sendDraftClientUpdateAction } from "@/app/actions/draft-update";
import { extractFirstName } from "@/lib/contacts/displayName";

type Target = { id: string; name: string };
type SideData = { text: string; targets: Target[] } | null;
type CardKey = "same" | "opposite";

export type SentOffersCtx = {
  transactionId: string;
  chaseTaskIds: string[];
  sentText: string;
  chasedRole: string;
  chasedSide: "vendor" | "purchaser";
  recipientContactId: string | null;
  sameSideCcd: boolean;
  recipientName: string;
};

function joinFirstNames(ts: Target[]): string {
  const names = ts.map((t) => extractFirstName(t.name));
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function ChaseSentOffers({ ctx, onFinish }: { ctx: SentOffersCtx; onFinish: () => void }) {
  const { toast } = useAgentToast();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [same, setSame] = useState<SideData>(null);
  const [opposite, setOpposite] = useState<SideData>(null);
  const [sameText, setSameText] = useState("");
  const [oppText, setOppText] = useState("");
  const [busy, setBusy] = useState<Record<CardKey, boolean>>({ same: false, opposite: false });
  const [exiting, setExiting] = useState<Set<CardKey>>(new Set());
  const [removed, setRemoved] = useState<Set<CardKey>>(new Set());

  const sameWord = ctx.chasedSide === "vendor" ? "seller" : "buyer";
  const oppWord = ctx.chasedSide === "vendor" ? "buyer" : "seller";

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/chase-followup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chaseTaskIds: ctx.chaseTaskIds,
            sentText: ctx.sentText,
            chasedRole: ctx.chasedRole,
            chasedSide: ctx.chasedSide,
            recipientContactId: ctx.recipientContactId,
            sameSideCcd: ctx.sameSideCcd,
          }),
        });
        const data = await res.json();
        if (!alive) return;
        if (!res.ok) { setFailed(true); setLoading(false); return; }
        setSame(data.sameSide ?? null);
        setSameText(data.sameSide?.text ?? "");
        setOpposite(data.opposite ?? null);
        setOppText(data.opposite?.text ?? "");
        setLoading(false);
      } catch {
        if (alive) { setFailed(true); setLoading(false); }
      }
    })();
    return () => { alive = false; };
  }, [ctx]);

  const presentKeys: CardKey[] = [
    ...(same ? (["same"] as const) : []),
    ...(opposite ? (["opposite"] as const) : []),
  ];
  const liveKeys = presentKeys.filter((k) => !removed.has(k));

  // Auto-finish when there's nothing to offer, or once every offer is handled.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (loading || failed || finishedRef.current) return;
    if (presentKeys.length === 0 || presentKeys.every((k) => removed.has(k))) {
      finishedRef.current = true;
      onFinish();
    }
  }, [loading, failed, removed, presentKeys, onFinish]);

  function collapseAway(key: CardKey) {
    setExiting((prev) => new Set(prev).add(key));
    window.setTimeout(() => setRemoved((prev) => new Set(prev).add(key)), 340);
  }

  async function send(key: CardKey) {
    const data = key === "same" ? same : opposite;
    const text = key === "same" ? sameText : oppText;
    if (!data || !text.trim()) return;
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const res = await sendDraftClientUpdateAction({
        transactionId: ctx.transactionId,
        contactIds: data.targets.map((t) => t.id),
        content: text,
        generatedText: data.text, // the original draft, so edits teach the voice profile
      });
      if (res.ok) {
        toast.success(`Sent to ${res.count} ${res.count === 1 ? "person" : "people"}`);
        collapseAway(key);
      } else {
        toast.error(res.error);
        setBusy((b) => ({ ...b, [key]: false }));
      }
    } catch {
      toast.error("Couldn't send. Try again.");
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }

  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" };

  function OfferCard({ which }: { which: CardKey }) {
    const data = which === "same" ? same : opposite;
    if (!data) return null;
    const isExiting = exiting.has(which);
    const text = which === "same" ? sameText : oppText;
    const setText = which === "same" ? setSameText : setOppText;
    const names = joinFirstNames(data.targets);
    const heading = which === "same" ? `Let ${names} know` : `Keep ${names} posted`;
    const sub = which === "same" ? `The ${sameWord} wasn't copied in.` : `The ${oppWord} is waiting on this step.`;
    const alertLine =
      data.targets.length === 1
        ? "One alert, by notification or email, and saved to their portal."
        : "One alert each, by notification or email, saved to their portals.";

    return (
      // Each card grows to fill (flex 1), so a single offer uses the whole
      // space and two share it. On exit it collapses and fades, the remaining
      // card rising to fill.
      <div
        style={{
          flex: "1 1 0",
          minHeight: isExiting ? 0 : 150,
          maxHeight: isExiting ? 0 : 640,
          opacity: isExiting ? 0 : 1,
          transform: isExiting ? "translateY(-4px)" : "none",
          transition:
            "max-height 320ms cubic-bezier(0.25,0,0,1), min-height 320ms cubic-bezier(0.25,0,0,1), opacity 200ms ease, transform 260ms cubic-bezier(0.25,0,0,1)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          border: "0.5px solid var(--agent-border-default)",
          borderRadius: 12,
          padding: "13px 14px",
          background: "var(--agent-surface-glass)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8, flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>{heading}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "var(--agent-text-muted)" }}>{sub}</p>
          </div>
          <button onClick={() => collapseAway(which)} className="agent-link agent-link-muted" style={{ fontSize: 11, flexShrink: 0 }}>Skip</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="glass-input w-full px-3 py-2.5 text-sm"
          style={{ flex: 1, minHeight: 80, resize: "none" }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: "var(--agent-text-muted)", flex: 1, minWidth: 150, lineHeight: 1.4 }}>{alertLine}</span>
          <button
            onClick={() => send(which)}
            disabled={!text.trim() || busy[which]}
            className="agent-btn agent-btn-sm agent-btn-primary"
          >
            {busy[which] ? "Sending…" : "Send update"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "18px 20px 8px", overflowY: "auto", minHeight: 0 }}>
        {/* Confirmation */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <CheckCircle size={22} weight="fill" color="#16a34a" />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--agent-text-primary)", letterSpacing: "-0.01em" }}>Chase sent</p>
            {ctx.recipientName && (
              <p style={{ margin: "1px 0 0", fontSize: 12, color: "var(--agent-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                To {ctx.recipientName}
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 2px", fontSize: 12.5, color: "var(--agent-text-muted)", flexShrink: 0 }}>
            <CircleNotch size={15} className="animate-spin" /> Checking who else to keep in the loop…
          </div>
        )}

        {!loading && failed && (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--agent-text-muted)", lineHeight: 1.5, flexShrink: 0 }}>
            Your chase went out fine. We just couldn&rsquo;t draft the follow-up updates this time. You can post an update from the file&rsquo;s activity instead.
          </p>
        )}

        {!loading && !failed && liveKeys.length > 0 && (
          <>
            <p style={{ ...labelStyle, margin: "0 0 10px", flexShrink: 0 }}>Keep others in the loop</p>
            {/* Cards fill the remaining height; one offer uses it all, two share it. */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
              {same && !removed.has("same") && <OfferCard which="same" />}
              {opposite && !removed.has("opposite") && <OfferCard which="opposite" />}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="glass-v03" style={{ padding: "12px 20px 16px", border: "none", borderTop: "0.5px solid rgba(var(--agent-coral-rgb), 0.18)" }}>
        <button onClick={onFinish} className="agent-btn agent-btn-secondary agent-btn-md" style={{ width: "100%" }}>
          Done
        </button>
      </div>
    </div>
  );
}

"use client";

// "Draft for everyone" — type one fact about the sale, get a client-safe
// message and an internal file note. Nothing sends until you click. The client
// update posts to the portal by default, with an optional "Also email" toggle;
// the note is internal-only. Lives inside the file's activity composer.

import { useState, useTransition } from "react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { sendDraftClientUpdateAction, saveDraftNoteAction } from "@/app/actions/draft-update";

type ClientContact = { id: string; name: string; roleType: string };

function firstName(n: string): string {
  return n.trim().split(/\s+/)[0] || n;
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
  const [fact, setFact] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [clientText, setClientText] = useState<string | null>(null);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(contacts.map((c) => c.id));
  const [alsoEmail, setAlsoEmail] = useState(false);
  const [clientDone, setClientDone] = useState(false);
  const [noteDone, setNoteDone] = useState(false);
  const [posting, startPost] = useTransition();
  const [savingNote, startNote] = useTransition();

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
      setClientText(data.generated.clientMessage);
      setNoteText(data.generated.internalNote);
      setClientDone(false);
      setNoteDone(false);
    } catch {
      toast.error("Couldn't draft that. Try again.");
    } finally {
      setDrafting(false);
    }
  }

  function postClient() {
    if (!clientText?.trim()) return;
    if (selected.length === 0) { toast.error("Pick at least one client."); return; }
    startPost(async () => {
      const res = await sendDraftClientUpdateAction({ transactionId, contactIds: selected, content: clientText, alsoEmail });
      if (res.ok) {
        toast.success(alsoEmail ? `Sent to ${res.count} client${res.count === 1 ? "" : "s"} (portal + email)` : `Posted to ${res.count} client portal${res.count === 1 ? "" : "s"}`);
        setClientDone(true);
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveNote() {
    if (!noteText?.trim()) return;
    startNote(async () => {
      const res = await saveDraftNoteAction({ transactionId, content: noteText });
      if (res.ok) { toast.success("Note saved to the file"); setNoteDone(true); }
      else toast.error(res.error);
    });
  }

  const hasDrafts = clientText !== null && noteText !== null;
  const cardStyle: React.CSSProperties = {
    border: "0.5px solid var(--agent-border-default)", borderRadius: 10, padding: "12px 14px", background: "var(--agent-surface-glass)",
  };
  const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--agent-text-muted)" };

  return (
    <div className="agent-reveal-in" style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--agent-text-primary)" }}>
          ✨ Draft for everyone
        </p>
        <button onClick={onClose} className="agent-link agent-link-muted" style={{ fontSize: 11 }}>Cancel</button>
      </div>

      {/* Step 1 — the fact */}
      <p style={{ ...labelStyle, marginBottom: 5 }}>The update, in your own words</p>
      <textarea
        value={fact}
        onChange={(e) => setFact(e.target.value)}
        placeholder="e.g. Spoke to the solicitor — searches back, no issues. Contract pack being drafted, expect it early next week."
        rows={3}
        className="glass-input w-full px-3 py-2.5 text-sm resize-none"
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button onClick={draft} disabled={!fact.trim() || drafting} className="agent-btn agent-btn-sm agent-btn-primary">
          {drafting ? "Drafting…" : hasDrafts ? "Re-draft" : "Draft"}
        </button>
        <span style={{ fontSize: 11, color: "var(--agent-text-muted)" }}>
          Type the fact once. We&rsquo;ll write a client version and a file note. Nothing sends until you click.
        </span>
      </div>

      {/* Step 2 — the two drafts */}
      {hasDrafts && (
        <div className="agent-reveal-in" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          {/* Client update */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={labelStyle}>For the client</span>
              {clientDone && <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>✓ Sent</span>}
            </div>
            <textarea
              value={clientText ?? ""}
              onChange={(e) => { setClientText(e.target.value); setClientDone(false); }}
              rows={4}
              className="glass-input w-full px-3 py-2.5 text-sm resize-none"
            />
            {/* Which clients */}
            {contacts.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                {contacts.map((c) => {
                  const on = selected.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelected((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))}
                      style={{
                        fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, border: "none", cursor: "pointer",
                        background: on ? "rgba(255,107,74,0.12)" : "var(--agent-surface-glass)",
                        color: on ? "var(--agent-coral)" : "var(--agent-text-muted)",
                      }}
                    >
                      {firstName(c.name)} {c.roleType === "purchaser" ? "(buyer)" : c.roleType === "vendor" ? "(seller)" : ""}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
                <div
                  onClick={() => setAlsoEmail((v) => !v)}
                  style={{ position: "relative", width: 34, height: 19, borderRadius: 10, flexShrink: 0, background: alsoEmail ? "#3b82f6" : "rgba(15,23,42,0.15)", transition: "background 150ms" }}
                >
                  <span style={{ position: "absolute", top: 2, left: 2, width: 15, height: 15, borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transform: alsoEmail ? "translateX(15px)" : "translateX(0)", transition: "transform 150ms", display: "block" }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: alsoEmail ? "#3b82f6" : "var(--agent-text-muted)" }}>
                  Also send as email
                </span>
              </label>
              <button onClick={postClient} disabled={!clientText?.trim() || posting || clientDone} className="agent-btn agent-btn-sm agent-btn-primary">
                {posting ? "Sending…" : clientDone ? "Sent ✓" : alsoEmail ? "Post + email" : "Post to portal"}
              </button>
            </div>
          </div>

          {/* Internal note */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={labelStyle}>File note (internal only)</span>
              {noteDone && <span style={{ fontSize: 11, fontWeight: 600, color: "#059669" }}>✓ Saved</span>}
            </div>
            <textarea
              value={noteText ?? ""}
              onChange={(e) => { setNoteText(e.target.value); setNoteDone(false); }}
              rows={2}
              className="glass-input w-full px-3 py-2.5 text-sm resize-none"
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button onClick={saveNote} disabled={!noteText?.trim() || savingNote || noteDone} className="agent-btn agent-btn-sm agent-btn-secondary">
                {savingNote ? "Saving…" : noteDone ? "Saved ✓" : "Save note"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

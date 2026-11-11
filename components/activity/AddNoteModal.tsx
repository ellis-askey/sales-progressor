"use client";

// Controlled "Add a note" modal — the note flow extracted from AddNoteButton so
// it can be opened from anywhere (the header button AND the app-wide quick-action
// dock) without duplicating the logic. A note normally lives on a file, so from a
// general surface there's no property context: step 1 is a property search (the
// exact one the email composer uses), and picking a sale morphs the same sheet
// into the full "Log an update" surface (LogUpdateModal in embedded mode) with
// the property pinned at the top and an ✕ to animate back to the search.

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { searchComposeSales, type ComposeSaleResult } from "@/app/actions/compose";
import { getNoteContextAction, type NoteContext } from "@/app/actions/comms";
import { LogUpdateModal, LOG_UPDATE_CSS } from "@/components/activity/LogUpdateModal";
import { useGlassTag } from "@/lib/glass/use-glass-tag";

// The minimal sale header the "log" step needs — from a search result OR the
// file-context load (getNoteContextAction.property).
type SaleHead = { id: string; line1: string; location: string; photoUrl: string | null };

export function AddNoteModal({ open, onClose, initialTransactionId = null }: { open: boolean; onClose: () => void; initialTransactionId?: string | null }) {
  const { toast } = useAgentToast();
  // Tag the sheet with the shared card id so its glass edits alongside the
  // Activity-tab modal's card. The Design Lab itself is Ellis-gated inside
  // LogUpdateModal (useIsFounder), so this tag is an inert data attribute for
  // everyone else.
  const gCard = useGlassTag("log-update-card", "Log an update · card");
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState<"search" | "log">("search");

  // Search state.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComposeSaleResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Picked sale + its loaded log-an-update context.
  const [picked, setPicked] = useState<SaleHead | null>(null);
  const [ctx, setCtx] = useState<NoteContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);

  // Begin the close animation; the sheet's onAnimationEnd calls onClose.
  const close = useCallback(() => { setClosing(true); }, []);
  const finish = useCallback(() => { setClosing(false); onClose(); }, [onClose]);

  // (Re)initialise on open. On a file (initialTransactionId set) jump straight
  // to that sale's "Log an update"; otherwise start on the property search.
  useEffect(() => {
    if (!open) return;
    setClosing(false); setQuery(""); setResults([]);
    if (initialTransactionId) {
      setStep("log"); setPicked(null); setCtx(null); setLoadingCtx(true);
      getNoteContextAction(initialTransactionId)
        .then((res) => {
          if (!res) { setStep("search"); return; } // can't open it → let them search
          setPicked({ id: initialTransactionId, line1: res.property.line1, location: res.property.location, photoUrl: res.property.photoUrl });
          setCtx(res);
        })
        .catch(() => setStep("search"))
        .finally(() => setLoadingCtx(false));
    } else {
      setStep("search"); setPicked(null); setCtx(null);
    }
  }, [open, initialTransactionId]);

  // Escape closes (matches the file's Log-an-update sheet).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Search your sales as you type (server scopes to your own sales).
  useEffect(() => {
    if (!open || step !== "search") return;
    const q = query.trim();
    if (!q) { setResults([]); return; }
    let cancelled = false;
    setSearching(true);
    searchComposeSales(q)
      .then((r) => { if (!cancelled) setResults(r); })
      .catch(() => { if (!cancelled) setResults([]); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [query, open, step]);

  async function pick(sale: ComposeSaleResult) {
    setPicked({ id: sale.id, line1: sale.line1, location: sale.location, photoUrl: sale.photoUrl });
    setLoadingCtx(true);
    const res = await getNoteContextAction(sale.id).catch(() => null);
    setLoadingCtx(false);
    if (!res) { toast.error("Couldn't open that sale. Try another."); setPicked(null); return; }
    setCtx(res);
    setStep("log");
  }

  function backToSearch() {
    setStep("search");
    setPicked(null);
    setCtx(null);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <style dangerouslySetInnerHTML={{ __html: LOG_UPDATE_CSS }} />
      <div className="lu-ov" role="dialog" aria-modal="true" aria-label="Add a note" data-closing={closing ? "1" : undefined}>
        <div className="lu-bg" onClick={close} />
        <div
          {...gCard.props}
          className={"lu-sheet" + (closing ? " lu-closing" : "") + (gCard.className ? " " + gCard.className : "")}
          onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) finish(); }}
        >
          <div className="lu-grab" />
          {step === "log" && ctx && picked ? (
            <LogUpdateModal
              embedded
              transactionId={picked.id}
              contacts={ctx.contacts}
              solicitors={ctx.solicitors}
              canPasteChat={ctx.canPasteChat}
              emailConnected={ctx.emailConnected}
              canMarkPrivate={ctx.canMarkPrivate}
              propertyHeader={{ line1: picked.line1, location: picked.location, photoUrl: picked.photoUrl }}
              onBackToSearch={initialTransactionId ? undefined : backToSearch}
              onClose={close}
              onOptimisticAdd={() => toast.success(`Note added to ${picked.line1}`)}
            />
          ) : (
            <div className="lu-fade">
              <div className="lu-head">
                <h2 className="lu-title">Add a note</h2>
                <button className="lu-ic lu-ic-x" onClick={close} aria-label="Close">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="lu-body">
                <p className="lu-eyebrow">Which property is this about?</p>
                <div className="anb-search">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--agent-text-muted,#9a8a7f)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  <input
                    autoFocus
                    value={query}
                    placeholder="Search your sales by address…"
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="anb-results">
                  {loadingCtx ? (
                    <div className="anb-empty">Opening…</div>
                  ) : query.trim() && !searching && results.length === 0 ? (
                    <div className="anb-empty">No sales match “{query.trim()}”.</div>
                  ) : (
                    results.map((r) => (
                      <button key={r.id} className="anb-mi" onClick={() => pick(r)}>
                        <PropertyThumb photoUrl={r.photoUrl} size={30} />
                        <span className="anb-mi-addr">
                          <span className="anb-mi-l1">{r.line1}</span>
                          {r.location && <span className="anb-mi-l2">{r.location}</span>}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>,
    // Portal into the agent shell (not document.body) so the sheet inherits the
    // [data-theme] --agent-* token scope in both light and dark. On body those
    // tokens are undefined and the sheet renders transparent/unstyled.
    (document.querySelector(".agent-shell-root") as HTMLElement | null) || document.body,
  );
}

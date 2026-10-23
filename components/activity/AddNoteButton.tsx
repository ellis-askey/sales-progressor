"use client";

// Standalone "Add note" launcher (critique #275). Sits next to the "New email"
// button in the top-right of the general pages (hub, focus, chains, comms,
// to-do, files). A note normally lives on a file, so from a general page there's
// no property context — step 1 is a property search (the exact one the email
// composer uses), and picking a sale morphs the same sheet into the full
// "Log an update" surface (LogUpdateModal in embedded mode) with the property
// pinned at the top and an ✕ to animate back to the search.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { NotePencil } from "@phosphor-icons/react";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { PropertyThumb } from "@/components/ui/PropertyThumb";
import { searchComposeSales, type ComposeSaleResult } from "@/app/actions/compose";
import { getNoteContextAction, type NoteContext } from "@/app/actions/comms";
import { LogUpdateModal, LOG_UPDATE_CSS } from "@/components/activity/LogUpdateModal";

export function AddNoteButton({ variant = "ghost" }: { variant?: "primary" | "ghost" }) {
  const { toast } = useAgentToast();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [step, setStep] = useState<"search" | "log">("search");

  // Search state.
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComposeSaleResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Picked sale + its loaded log-an-update context.
  const [picked, setPicked] = useState<ComposeSaleResult | null>(null);
  const [ctx, setCtx] = useState<NoteContext | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(false);

  function openModal() {
    setStep("search"); setQuery(""); setResults([]); setPicked(null); setCtx(null); setClosing(false); setOpen(true);
  }
  const close = useCallback(() => { setClosing(true); }, []);
  function reallyClose() { setOpen(false); setClosing(false); }

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
    setPicked(sale);
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

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={variant === "primary" ? "agent-btn agent-btn-sm agent-btn-primary" : "agent-btn agent-btn-sm agent-btn-secondary"}
        style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      >
        <NotePencil size={15} weight="fill" />
        Add note
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <>
          <style dangerouslySetInnerHTML={{ __html: LOG_UPDATE_CSS }} />
          <div className="lum-ov" role="dialog" aria-modal="true" aria-label="Add a note" data-closing={closing ? "1" : undefined}>
            <div className="lum-bg" onClick={close} />
            <div
              className={"lum-sheet" + (closing ? " lum-closing" : "")}
              onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) reallyClose(); }}
            >
              <div className="lum-grab" />
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
                  onBackToSearch={backToSearch}
                  onClose={close}
                  onOptimisticAdd={() => toast.success(`Note added to ${picked.line1}`)}
                />
              ) : (
                <div className="lum-fade">
                  <div className="lum-head">
                    <h2 className="lum-title">Add a note</h2>
                    <button className="lum-ic lum-ic-x" onClick={close} aria-label="Close">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="lum-body">
                    <p className="lum-eyebrow">Which property is this about?</p>
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
        document.body,
      )}
    </>
  );
}

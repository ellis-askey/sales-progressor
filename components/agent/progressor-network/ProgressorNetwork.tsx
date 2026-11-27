"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretDown, Check, Compass } from "@phosphor-icons/react";
import { Popover, PopoverMenuItem } from "@/components/ui/Popover";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";
import { useAgentToast } from "@/components/agent/AgentToaster";
import type { ProgressorNetworkBusiness, ProgressorNetworkTab } from "@/lib/services/progressor-network";
import { NETWORK_SPECIALISMS } from "@/lib/services/progressor-network";
import type { ProgressorRelationshipStats, HandoverableSale } from "@/lib/services/progressor-network-relationship";
import { requestConnectProgressorAction, withdrawNetworkRequestAction } from "@/app/actions/progressor-network";
import { ProgressorCard } from "./ProgressorCard";
import { ConnectedProgressorCard } from "./ConnectedProgressorCard";
import { NetworkValueStrip } from "./NetworkValueStrip";
import { HowItWorksRail } from "./HowItWorksRail";
import { ProgressorStorefront } from "./ProgressorStorefront";
import { NetworkConnectModal } from "./NetworkConnectModal";
import { AssignSaleModal } from "./AssignSaleModal";

// Client orchestrator for the Progressor Network. Owns tab / search / filter /
// sort state, the in-page storefront screen, the connect modal and the assign-a-
// sale modal. Connection state is the server's truth (the real agency->business
// handshake); after a connect / withdraw / assign we refresh the server data.
// Saves are in-session only for now (persistence lands in a later phase).
// See docs/active/progressor-network/SPEC.md.

type SortKey = "match" | "completion-rate" | "fastest" | "most-exchanges" | "team";
type AvailKey = "all" | "accepting";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "match", label: "Best match" },
  { key: "completion-rate", label: "Highest completion rate" },
  { key: "fastest", label: "Fastest to exchange" },
  { key: "most-exchanges", label: "Most exchanges" },
  { key: "team", label: "Largest team" },
];

const AVAIL: { key: AvailKey; label: string }[] = [
  { key: "all", label: "Any availability" },
  { key: "accepting", label: "Accepting new instructions" },
];

// Specialism facets come from the shared NETWORK_SPECIALISMS controlled vocab.

const TABS: { value: ProgressorNetworkTab; label: string }[] = [
  { value: "discover", label: "Discover" },
  { value: "my-progressors", label: "My progressors" },
  { value: "introductions", label: "Introductions" },
  { value: "saved", label: "Saved" },
];

function FilterButton({ open, label }: { open: boolean; label: string }) {
  return (
    <button type="button" className="agent-btn agent-btn-secondary agent-btn-sm" style={{ gap: 7 }} aria-haspopup="menu" aria-expanded={open}>
      {label}
      <CaretDown size={12} weight="bold" style={{ transition: "transform .18s ease", transform: open ? "rotate(180deg)" : "none" }} />
    </button>
  );
}

const EMPTY_REL: ProgressorRelationshipStats = { activeSales: 0, exchanged: 0 };

export function ProgressorNetwork({
  businesses,
  agencyName,
  relationships,
  handoverableSales,
}: {
  businesses: ProgressorNetworkBusiness[];
  agencyName: string;
  relationships: Record<string, ProgressorRelationshipStats>;
  handoverableSales: HandoverableSale[];
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const [tab, setTab] = useState<ProgressorNetworkTab>("discover");
  const [query, setQuery] = useState("");
  const [avail, setAvail] = useState<AvailKey>("all");
  const [specialism, setSpecialism] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("match");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [connectId, setConnectId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [, startTransition] = useTransition();
  // Saves aren't persisted yet (lands in a later phase); keep them in-session so
  // they survive the router.refresh() after a connect/withdraw without remounting.
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(businesses.filter((b) => b.saved).map((b) => b.id)));

  // Server rows are the truth for connection state; saved is layered in-session.
  const items = useMemo(
    () => businesses.map((b) => ({ ...b, saved: savedIds.has(b.id) })),
    [businesses, savedIds],
  );

  const counts = useMemo(
    () => ({
      discover: items.length,
      "my-progressors": items.filter((b) => b.connectionStatus === "connected").length,
      introductions: items.filter((b) => b.connectionStatus === "requested").length,
      saved: items.filter((b) => b.saved).length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((b) => {
      if (tab === "my-progressors" && b.connectionStatus !== "connected") return false;
      if (tab === "introductions" && b.connectionStatus !== "requested") return false;
      if (tab === "saved" && !b.saved) return false;
      if (avail === "accepting" && b.availability !== "accepting") return false;
      if (specialism !== "all" && !b.tags.includes(specialism)) return false;
      if (q && !`${b.name} ${b.blurb} ${b.tags.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      switch (sort) {
        case "completion-rate":
          return (b.stats.completionRatePct ?? -1) - (a.stats.completionRatePct ?? -1);
        case "fastest":
          return (a.stats.avgTimeToExchangeWeeks ?? 999) - (b.stats.avgTimeToExchangeWeeks ?? 999);
        case "most-exchanges":
          return (b.stats.exchangedFiles12mo ?? -1) - (a.stats.exchangedFiles12mo ?? -1);
        case "team":
          return b.stats.teamSize - a.stats.teamSize;
        default:
          return 0;
      }
    });
  }, [items, tab, query, avail, specialism, sort]);

  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Opening a modal doesn't disturb the storefront screen (if open), so the modal
  // overlays it and the page returns to the same place once the action completes.
  const openConnect = (id: string) => setConnectId(id);
  const openAssign = (id: string) => setAssignId(id);

  const sendConnect = async (note: string) => {
    if (!connectId || sending) return;
    const name = items.find((b) => b.id === connectId)?.name ?? "the business";
    setSending(true);
    const res = await requestConnectProgressorAction({ businessId: connectId, message: note.trim() || undefined });
    setSending(false);
    if (!res.ok) {
      toast.error("Couldn't send request", { description: res.error });
      return;
    }
    setConnectId(null);
    toast.success("Connection request sent", { description: `Waiting for ${name} to accept.` });
    startTransition(() => router.refresh());
  };

  const withdraw = async (id: string) => {
    const biz = businesses.find((b) => b.id === id);
    if (!biz?.requestId) return;
    const res = await withdrawNetworkRequestAction({ requestId: biz.requestId });
    if (!res.ok) {
      toast.error("Couldn't withdraw request", { description: res.error });
      return;
    }
    toast.info("Request withdrawn");
    startTransition(() => router.refresh());
  };

  const active = items.find((b) => b.id === activeId) ?? null;
  const connectTarget = items.find((b) => b.id === connectId) ?? null;
  const assignTarget = items.find((b) => b.id === assignId) ?? null;
  const filtersActive = query.trim() !== "" || avail !== "all" || specialism !== "all";
  const sortLabel = SORTS.find((s) => s.key === sort)?.label ?? "Best match";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {active ? (
        <ProgressorStorefront
          business={active}
          relationship={relationships[active.id] ?? null}
          onBack={() => setActiveId(null)}
          onConnect={(id) => openConnect(id)}
          onWithdraw={(id) => withdraw(id)}
          onToggleSave={(id) => toggleSave(id)}
          onAssign={(id) => openAssign(id)}
        />
      ) : (
        <>
          <div data-bloom>
            <NetworkValueStrip />
          </div>

          <div data-bloom>
            <SegmentedSwitch
              options={TABS.map((t) => ({ id: t.value, label: t.label, count: counts[t.value] }))}
              value={tab}
              onChange={(v) => setTab(v)}
              ariaLabel="Progressor network views"
            />
          </div>

          <div className={`pn-body${tab === "discover" ? " pn-body--rail" : ""}`}>
            {tab === "discover" && (
              <aside data-bloom>
                <HowItWorksRail />
              </aside>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div className="pn-controls" data-bloom>
                <div className="pn-search">
                  <SearchField value={query} onChange={setQuery} placeholder="Search businesses, regions or specialisms…" ariaLabel="Search the network" />
                </div>
                <div className="pn-filters">
                  <Popover placement="bottom-start" trigger={(open) => <FilterButton open={open} label={`Availability: ${avail === "all" ? "Any" : "Accepting"}`} />}>
                    {(close) =>
                      AVAIL.map((a) => (
                        <PopoverMenuItem
                          key={a.key}
                          icon={a.key === avail ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                          onClick={() => {
                            setAvail(a.key);
                            close();
                          }}
                        >
                          {a.label}
                        </PopoverMenuItem>
                      ))
                    }
                  </Popover>

                  <Popover placement="bottom-start" trigger={(open) => <FilterButton open={open} label={`Specialism: ${specialism === "all" ? "Any" : specialism}`} />}>
                    {(close) => (
                      <>
                        <PopoverMenuItem
                          icon={specialism === "all" ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                          onClick={() => {
                            setSpecialism("all");
                            close();
                          }}
                        >
                          Any specialism
                        </PopoverMenuItem>
                        {NETWORK_SPECIALISMS.map((s) => (
                          <PopoverMenuItem
                            key={s}
                            icon={s === specialism ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                            onClick={() => {
                              setSpecialism(s);
                              close();
                            }}
                          >
                            {s}
                          </PopoverMenuItem>
                        ))}
                      </>
                    )}
                  </Popover>

                  <Popover placement="bottom-end" trigger={(open) => <FilterButton open={open} label={`Sort: ${sortLabel}`} />}>
                    {(close) =>
                      SORTS.map((s) => (
                        <PopoverMenuItem
                          key={s.key}
                          icon={s.key === sort ? <Check size={15} weight="bold" /> : <span style={{ display: "inline-block", width: 15 }} />}
                          onClick={() => {
                            setSort(s.key);
                            close();
                          }}
                        >
                          {s.label}
                        </PopoverMenuItem>
                      ))
                    }
                  </Popover>
                </div>
              </div>

              {visible.length === 0 ? (
                <EmptyState tab={tab} filtersActive={filtersActive} />
              ) : (
                <div className="pn-grid">
                  {visible.map((b) =>
                    tab === "my-progressors" ? (
                      <ConnectedProgressorCard
                        key={b.id}
                        business={b}
                        relationship={relationships[b.id] ?? EMPTY_REL}
                        onView={(id) => setActiveId(id)}
                        onAssign={(id) => openAssign(id)}
                      />
                    ) : (
                      <ProgressorCard
                        key={b.id}
                        business={b}
                        onView={(id) => setActiveId(id)}
                        onConnect={(id) => openConnect(id)}
                        onToggleSave={(id) => toggleSave(id)}
                        onWithdraw={(id) => withdraw(id)}
                      />
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <NetworkConnectModal
        open={connectId != null}
        onClose={() => setConnectId(null)}
        onSend={sendConnect}
        agencyName={agencyName}
        progressorName={connectTarget?.name ?? ""}
        sending={sending}
      />

      <AssignSaleModal
        open={assignId != null}
        onClose={() => setAssignId(null)}
        businessId={assignId ?? ""}
        businessName={assignTarget?.name ?? ""}
        sales={handoverableSales}
      />

      <style>{`
        .pn-body{display:grid;grid-template-columns:1fr;gap:24px;align-items:start}
        .pn-body--rail{grid-template-columns:252px minmax(0,1fr)}
        @media (max-width:1080px){.pn-body--rail{grid-template-columns:1fr}}
        .pn-controls{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
        .pn-search{flex:1 1 300px;min-width:0}
        .pn-filters{display:flex;gap:8px;flex-wrap:wrap}
        .pn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:16px}
        .pn-card{transition:box-shadow .18s ease,border-color .18s ease}
        .pn-card:hover{box-shadow:0 10px 26px rgba(15,23,42,0.10);border-color:rgba(var(--agent-coral-rgb),0.30)}
        .pn-save{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;background:transparent;cursor:pointer;border-radius:8px;flex-shrink:0;transition:background .15s ease,color .15s ease}
        .pn-save:hover{background:var(--agent-surface-glass)}
      `}</style>
    </div>
  );
}

function EmptyState({ tab, filtersActive }: { tab: ProgressorNetworkTab; filtersActive: boolean }) {
  const title = filtersActive
    ? "No progressors match your filters"
    : tab === "saved"
      ? "Nothing saved yet"
      : tab === "my-progressors"
        ? "No connected progressors yet"
        : tab === "introductions"
          ? "No introductions in progress"
          : "No progressors yet";
  const body = filtersActive
    ? "Try a different search, or clear the filters."
    : tab === "saved"
      ? "Save a business from Discover to keep it here."
      : tab === "my-progressors"
        ? "Once you connect with a business, it appears here."
        : tab === "introductions"
          ? "Connection requests you send show here until they're accepted."
          : "Check back soon.";
  return (
    <div className="agent-glass-strong agent-empty-card" style={{ padding: "48px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}>
      <Compass size={32} weight="regular" style={{ color: "var(--agent-text-muted)", opacity: 0.5, margin: "0 auto 12px", display: "block" }} />
      <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "var(--agent-text-primary)" }}>{title}</p>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>{body}</p>
    </div>
  );
}

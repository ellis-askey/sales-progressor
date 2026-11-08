"use client";

// File setup tab — a free-pick accordion of the file's own details. Each row
// expands in place: the light items (photo, sale details, target date) are
// edited right here; the relational ones (contacts, solicitors, broker, chain)
// open where they live on the file. Nothing auto-advances — the agent picks the
// order.
//
// This is about how COMPLETE the file's information is, not how far the sale has
// progressed — the copy leans on that distinction on purpose. The "why" line on
// each item is the nudge: the more of this that's done, the smoother the sale.

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Check, CheckCircle, ArrowRight, CaretDown, Briefcase, User, Scales, LinkSimple, PaperPlaneTilt, Eye, BellSlash, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/Button";
import { ContactAvatar } from "@/components/ui/Avatar";
import { GlassCard } from "@/components/glass/GlassCard";
import { useGlassTag } from "@/lib/glass/use-glass-tag";
import { useTabContext } from "@/components/transaction/TabContext";
import { HeroSaleFields } from "@/components/transaction/HeroSaleFields";
import { HeroExchangeCell } from "@/components/transaction/HeroExchangeCell";
import { PhotoSetupCard } from "@/components/transaction/PhotoSetupCard";
import { requestPeopleOpen, type PeopleOpenForm } from "@/lib/transaction/people-open-intent";
import type { FileSetupSummary, FileSetupItem, FileSetupValues, FileSetupPerson, FileSetupCardStatus, PersonTone, PersonStatusIcon } from "@/lib/services/file-setup";

// Eases a number from its last value to `target` with an easeOutCubic ramp, so
// the ring counts up on tab load (0 → pct) and again whenever an item completes
// (old pct → new pct). Honours reduced-motion by snapping straight to target.
function useCountUp(target: number, durationMs = 750): number {
  const [shown, setShown] = useState(0);
  const fromRef = useRef(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) { fromRef.current = target; setShown(target); return; }
    let start: number | null = null;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (target - from) * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { fromRef.current = target; setShown(target); }
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, durationMs]);
  return shown;
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const shown = useCountUp(pct);
  const off = c * (1 - shown / 100);
  const display = Math.round(shown);
  // Three digits ("100%") need a smaller face so they don't crowd the ring —
  // keyed off the target so the size is steady through the count-up.
  const fontSize = pct >= 100 ? 11 : 13;
  return (
    <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: 52, height: 52 }}>
      <svg width={52} height={52} viewBox="0 0 52 52" aria-hidden>
        <circle cx={26} cy={26} r={r} fill="none" stroke="var(--agent-border-subtle)" strokeWidth={5} />
        <circle
          cx={26} cy={26} r={r} fill="none"
          stroke="var(--agent-coral)" strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 26 26)"
        />
      </svg>
      <span className="absolute font-bold tabular-nums text-[var(--agent-text-primary)]" style={{ fontSize }}>{display}%</span>
    </span>
  );
}

function InlineEditor({ itemKey, values }: { itemKey: string; values: FileSetupValues }) {
  if (itemKey === "photo") {
    return <PhotoSetupCard transactionId={values.transactionId} photoUrl={values.photoUrl} />;
  }
  if (itemKey === "details") {
    return (
      <div className="flex items-center gap-x-6 gap-y-2 max-[542px]:flex-col max-[542px]:items-center max-[542px]:gap-y-2.5 max-[542px]:w-full">
        <HeroSaleFields
          transactionId={values.transactionId}
          purchasePrice={values.purchasePrice}
          purchaseType={values.purchaseType}
          tenure={values.tenure}
          isShareOfFreehold={values.isShareOfFreehold}
          hasManagementPack={values.hasManagementPack}
          exchanged={values.exchanged}
        />
      </div>
    );
  }
  if (itemKey === "date") {
    return (
      <HeroExchangeCell
        transactionId={values.transactionId}
        predictedDate={values.predictedDate}
        overrideDate={values.overrideDate}
      />
    );
  }
  return null;
}

// Asymmetric collapse: open snaps instantly (no animation), close animates the
// height down (grid-rows 0fr/1fr, the app's canonical slide). Children stay
// mounted through the closing transition, then unmount. Matches the feedback
// "no animation on open but animate the collapse".
function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  const [rows, setRows] = useState(open ? "1fr" : "0fr");
  const [anim, setAnim] = useState(false);
  const prev = useRef(open);

  useEffect(() => {
    if (open === prev.current) return;
    prev.current = open;
    if (open) {
      // Instant open — no transition.
      setAnim(false);
      setMounted(true);
      setRows("1fr");
    } else {
      // Animated close — keep children mounted, ease the rows to 0 two frames
      // later so the transition reliably fires from the open height.
      setAnim(true);
      setRows("1fr");
      requestAnimationFrame(() => requestAnimationFrame(() => setRows("0fr")));
    }
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateRows: rows,
        transition: anim ? "grid-template-rows 220ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
      }}
      onTransitionEnd={() => { if (!open) setMounted(false); }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>{children}</div>
    </div>
  );
}

// A clearly recessed grey card (visibly darker than the white row) that holds
// the expanded content for a relational item. Slate tint reads in light + dark.
const SETUP_CARD = "rounded-xl border border-[var(--agent-border-subtle)] bg-[rgba(100,116,139,0.09)]";

const RELATIONAL_META: Record<string, { Icon: typeof Briefcase; empty: string; cta: string }> = {
  seller:     { Icon: User,           empty: "No seller on file yet",     cta: "Add seller" },
  buyer:      { Icon: User,           empty: "No buyer on file yet",      cta: "Add buyer" },
  solicitors: { Icon: Scales,         empty: "No solicitors on file yet", cta: "Add solicitors" },
  broker:     { Icon: Briefcase,      empty: "No broker added yet",       cta: "Add broker" },
  chain:      { Icon: LinkSimple,     empty: "No chain set up yet",       cta: "Set up the chain" },
  portal:     { Icon: PaperPlaneTilt, empty: "Clients not invited yet",   cta: "Invite the clients" },
};

const TONE_COLOUR: Record<PersonTone, string> = {
  primary: "var(--agent-coral-deep)",
  muted: "var(--agent-text-muted)",
  amber: "var(--agent-warning)",
  green: "var(--agent-success)",
  red: "var(--agent-danger)",
};

// The status glyph changes with the status — a sent plane for invited, an eye
// for an active portal, a struck bell for opted out, and so on.
const STATUS_ICON: Record<PersonStatusIcon, { Icon: typeof Check; weight: "regular" | "bold" | "fill" }> = {
  check: { Icon: Check, weight: "bold" },
  ready: { Icon: PaperPlaneTilt, weight: "regular" },
  invited: { Icon: PaperPlaneTilt, weight: "fill" },
  active: { Icon: Eye, weight: "fill" },
  optedout: { Icon: BellSlash, weight: "regular" },
  bounced: { Icon: WarningCircle, weight: "fill" },
  missing: { Icon: Scales, weight: "regular" },
};

function eyebrowColour(side: "vendor" | "purchaser" | null): string {
  return side === "vendor" ? "var(--agent-info)" : side === "purchaser" ? "var(--agent-success)" : "var(--agent-text-muted)";
}

// The right-hand value of a label/value row: the contact's avatar (photo or
// side-tinted SVG fallback) sat to the left of the name, exactly where the name
// already was. A missing solicitor side reads "Not added yet" with no avatar.
function PersonValue({ person }: { person: FileSetupPerson }) {
  if (person.missing) {
    return <span className="text-[13px] font-medium italic text-[var(--agent-text-muted)] truncate">Not added yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <ContactAvatar
        contact={{ name: person.name, roleType: person.roleType }}
        image={person.image}
        sideTint={person.side ?? undefined}
        size={26}
      />
      <span className="text-[13px] font-semibold text-[var(--agent-text-primary)] truncate">{person.name}</span>
    </span>
  );
}

// One row of a label/value card: a muted role icon + label on the left, the
// value right-aligned. The divider matches the original fields layout.
function LabelValueRow({ RowIcon, label, divided, children }: {
  RowIcon: typeof Briefcase; label: string; divided: boolean; children: ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${divided ? "border-t border-[var(--agent-border-subtle)]" : ""}`}>
      <span className="flex items-center gap-2 text-[12.5px] text-[var(--agent-text-secondary)] shrink-0">
        <RowIcon size={15} weight="regular" className="shrink-0 text-[var(--agent-text-muted)]" aria-hidden />
        {label}
      </span>
      <span className="flex items-center justify-end min-w-0">{children}</span>
    </div>
  );
}

// The Status row at the foot of a label/value card: a status-dependent glyph
// next to the "Status" label (so the glyph isn't duplicated beside the value),
// the status text in its tone colour, and the last-seen date beneath if active.
function StatusRow({ status }: { status: FileSetupCardStatus }) {
  const { Icon, weight } = STATUS_ICON[status.statusIcon];
  const colour = TONE_COLOUR[status.statusTone];
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-t border-[var(--agent-border-subtle)]">
      <span className="flex items-center gap-2 text-[12.5px] text-[var(--agent-text-secondary)] shrink-0">
        <Icon size={15} weight={weight} aria-hidden style={{ color: colour }} />
        Status
      </span>
      <span className="flex flex-col items-end text-right min-w-0">
        <span className="text-[12.5px] font-semibold" style={{ color: colour }}>{status.statusLabel}</span>
        {status.lastSeen && <span className="text-[11px] text-[var(--agent-text-muted)]">{status.lastSeen}</span>}
      </span>
    </div>
  );
}

// The portal roster row — a people list rather than a single value, so each
// client reads as avatar + role eyebrow over the name with its own invite
// status to the right (Active / Invited / Ready to invite, + last seen).
function PortalRosterRow({ person, divided }: { person: FileSetupPerson; divided: boolean }) {
  const { Icon, weight } = STATUS_ICON[person.statusIcon];
  return (
    <div className={`flex items-center gap-3 py-2.5 ${divided ? "border-t border-[var(--agent-border-subtle)]" : ""}`}>
      <ContactAvatar
        contact={{ name: person.name, roleType: person.roleType }}
        image={person.image}
        sideTint={person.side ?? undefined}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold leading-tight" style={{ color: eyebrowColour(person.side), letterSpacing: "0.01em" }}>
          {person.label}
        </span>
        <span className="block text-[13.5px] font-semibold text-[var(--agent-text-primary)] truncate">{person.name}</span>
      </div>
      <span className="flex flex-col items-end shrink-0 text-right">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: TONE_COLOUR[person.statusTone] }}>
          <Icon size={13} weight={weight} aria-hidden />
          {person.statusLabel}
        </span>
        {person.lastSeen && <span className="text-[11px] text-[var(--agent-text-muted)] mt-0.5">{person.lastSeen}</span>}
      </span>
    </div>
  );
}

// Card on the left, CTA up on its row. Under 600px the CTA drops full-width below.
function RelationalRow({ card, cta }: { card: ReactNode; cta: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 min-[600px]:flex-row min-[600px]:items-center">
      <div className="flex-1 min-w-0">{card}</div>
      {cta}
    </div>
  );
}

// Undone relational item: a recessed empty-state card (bare coral icon, no
// backer) + an "add" CTA.
function RelationalEmpty({ item, onAdd }: { item: FileSetupItem; onAdd: () => void }) {
  const meta = RELATIONAL_META[item.key];
  const Icon = meta?.Icon ?? Briefcase;
  return (
    <RelationalRow
      card={
        <div className={`flex items-center gap-3 px-3.5 py-3 ${SETUP_CARD}`}>
          <Icon size={24} weight="regular" className="shrink-0 text-[var(--agent-coral-deep)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--agent-text-primary)]">{meta?.empty ?? "Not set up yet"}</p>
            <p className="text-[12px] text-[var(--agent-text-secondary)] leading-snug">{item.description}</p>
          </div>
        </div>
      }
      cta={
        <Button variant="primary" size="sm" onClick={onAdd} className="shrink-0 max-[599px]:w-full"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {meta?.cta ?? "Take me there"}
          <ArrowRight size={14} weight="bold" aria-hidden />
        </Button>
      }
    />
  );
}

// Done / part-done relational item: a recessed card of people rows (clients,
// solicitors per side, broker), or — for the chain, which has no people — a
// single prominent status line. The CTA reads "View on file" once done, else
// the item's own add label (so a one-solicitor file still invites the second).
function RelationalCard({ item, onGo }: { item: FileSetupItem; onGo: () => void }) {
  const meta = RELATIONAL_META[item.key];
  const RowIcon = meta?.Icon ?? CheckCircle;
  return (
    <RelationalRow
      card={
        <div className={`px-3.5 py-1 ${SETUP_CARD}`}>
          {item.key === "portal" ? (
            // Multi-client roster — each principal with its own invite status.
            item.people.map((person, i) => <PortalRosterRow key={i} person={person} divided={i > 0} />)
          ) : item.people.length > 0 ? (
            // Label/value card: identity rows (avatar left of the name) + a
            // single Status row at the foot.
            <>
              {item.people.map((person, i) => (
                <LabelValueRow key={i} RowIcon={RowIcon} label={person.label} divided={i > 0}>
                  <PersonValue person={person} />
                </LabelValueRow>
              ))}
              {item.cardStatus && <StatusRow status={item.cardStatus} />}
            </>
          ) : (
            <div className="flex items-center gap-2 py-2">
              <CheckCircle size={18} weight="fill" className="shrink-0 text-[var(--agent-success)]" aria-hidden />
              <span className="text-[13px] font-semibold text-[var(--agent-text-primary)]">{item.statusLabel ?? "On file"}</span>
            </div>
          )}
        </div>
      }
      cta={
        <Button variant="primary" size="sm" onClick={onGo} className="shrink-0 max-[599px]:w-full"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {item.done ? "View on file" : meta?.cta ?? "Take me there"}
          <ArrowRight size={14} weight="bold" aria-hidden />
        </Button>
      }
    />
  );
}

export function FileSetupChecklist({ summary }: { summary: FileSetupSummary | null }) {
  const { setActiveTab } = useTabContext();
  const [openKey, setOpenKey] = useState<string | null>(null);
  // One Design Lab row drives every section row (shared glassId). When a variant
  // is picked, drop the base surface utilities so the glass owns the surface.
  const rowTag = useGlassTag("file-setup-row", "File setup · section row", { light: "cs-b7c9ec28", dark: "v04" });
  // The inline-editor container (sale details / target date / photo). Pickable
  // in the Design Lab; keeps its current subtle surface until a variant is set.
  const inlineTag = useGlassTag("file-setup-inline", "File setup · sale details box");

  function jump(tab: string | null, anchor: string | null, peopleTab?: "clients" | "professionals", openForm?: PeopleOpenForm) {
    // Register the intent up front so the matching add-form opens whenever its
    // leaf mounts, whatever order the tab + sub-tab land in.
    if (openForm) requestPeopleOpen(openForm);
    if (tab) setActiveTab(tab);
    const reduce =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Two frames so the target tab has committed to visible (and the People
    // panel has mounted) before we open its side + scroll.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (peopleTab) window.dispatchEvent(new CustomEvent("sp_open_people_tab", { detail: peopleTab }));
        // When a form auto-opens, its own reveal owns the scroll + flash (it
        // centres the actual field), so skip the card-level scroll here to avoid
        // a double hop in the welcoming beat.
        if (!anchor || openForm) return;
        const el = document.querySelector(anchor);
        if (!el) return;
        el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        el.classList.add("agent-row-flash");
        window.setTimeout(() => el.classList.remove("agent-row-flash"), 750);
      }),
    );
  }

  if (!summary || summary.totalCount === 0 || !summary.values) {
    return (
      <GlassCard glassId="file-setup" label="File setup" defaultVariant="v25" style={{ borderRadius: 12, padding: 20 }}>
        <p className="text-sm text-[var(--agent-text-secondary)]">Nothing else to set up.</p>
      </GlassCard>
    );
  }

  const { items, values, doneCount, totalCount, remaining, pct } = summary;
  const complete = doneCount === totalCount;

  return (
    <GlassCard glassId="file-setup" label="File setup" defaultVariant="v25" style={{ borderRadius: 12, padding: 20 }}>
      {/* header */}
      <div className="flex items-center gap-4">
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-[var(--agent-text-primary)]">File setup</h2>
          <p className="text-[13px] text-[var(--agent-text-secondary)] mt-0.5">
            Everything this file needs to be ready for progression.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[13px] font-semibold text-[var(--agent-text-primary)] tabular-nums">{doneCount} of {totalCount}</div>
          {remaining > 0 ? (
            <div className="text-[12px] text-[var(--agent-text-secondary)] mt-0.5">est. {remaining} min{remaining === 1 ? "" : "s"} left</div>
          ) : (
            <div className="text-[12px] font-medium text-[var(--agent-success)] mt-0.5">All done</div>
          )}
        </div>
      </div>

      {complete && (
        <div
          className="mt-4 rounded-xl px-4 py-3 flex items-center gap-2.5"
          style={{
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 18px rgba(5,150,105,0.30)",
          }}
        >
          <CheckCircle size={18} weight="fill" className="shrink-0 text-white" aria-hidden />
          <span className="text-[13px] font-semibold text-white">
            File setup complete. Everything needed to progress this sale is on file.
          </span>
        </div>
      )}

      {/* rows */}
      <div className="mt-4 flex flex-col gap-2">
        {items.map((item: FileSetupItem) => {
          const open = openKey === item.key;
          return (
            <div
              key={item.key}
              {...rowTag.props}
              className={`rounded-xl border transition-colors ${rowTag.className} ${
                rowTag.picked
                  ? ""
                  : open
                  ? "border-[var(--agent-border-default)] bg-[var(--agent-surface-glass)]"
                  : "border-[var(--agent-border-subtle)] bg-[var(--agent-surface-subtle)] hover:bg-[var(--agent-surface-glass)]"
              }`}
            >
              <button
                onClick={() => setOpenKey(open ? null : item.key)}
                aria-expanded={open}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
              >
                {item.done ? (
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white"
                    style={{
                      background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 2px rgba(16,185,129,0.30)",
                    }}
                  >
                    <Check size={15} weight="bold" aria-hidden />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border-2 border-[var(--agent-border-strong)] shrink-0" aria-hidden />
                )}
                {/* Full-colour title, no subtext once done — reads as a clean
                    "done" state (the value lives in the expanded done-state). */}
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] font-semibold text-[var(--agent-text-primary)] truncate">
                    {item.label}
                  </span>
                </span>
                {!item.done && !open && (
                  <span className="text-[12.5px] font-medium text-[var(--agent-coral-deep)] shrink-0">
                    {item.hint ?? (item.inline ? "Set up" : "Open")}
                  </span>
                )}
                <CaretDown
                  size={15}
                  weight="bold"
                  aria-hidden
                  className={`shrink-0 text-[var(--agent-text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              <Collapse open={open}>
                <div className={`px-3 pt-1 ${item.inline && item.key === "details" ? "pb-2.5" : "pb-3.5"}`}>
                  {/* The "why" line only shows while there's still something to
                      do, and never on mobile (keeps the phone tight). */}
                  {item.inline && item.key === "details" ? (
                    // Sale details: no description line — tenure and method come
                    // straight from the sale, and price is edited in the cells
                    // themselves — so the editable block sits centred on desktop.
                    <div className="flex justify-center py-0.5">
                      <InlineEditor itemKey={item.key} values={values} />
                    </div>
                  ) : item.inline ? (
                    <>
                      <div className="mb-3">
                        <p className="text-[12.5px] text-[var(--agent-text-secondary)]">{item.description}</p>
                        {!item.done && <p className="text-[12px] text-[var(--agent-text-muted)] italic mt-1 max-[600px]:hidden">{item.why}</p>}
                      </div>
                      <div
                        {...inlineTag.props}
                        className={`px-3.5 py-3 ${inlineTag.className} ${inlineTag.picked ? "rounded-lg" : SETUP_CARD}`}
                      >
                        <InlineEditor itemKey={item.key} values={values} />
                      </div>
                    </>
                  ) : item.people.length > 0 || item.statusLabel ? (
                    <RelationalCard item={item} onGo={() => jump(item.tab, item.anchor, item.peopleTab, item.openForm)} />
                  ) : (
                    <RelationalEmpty item={item} onAdd={() => jump(item.tab, item.anchor, item.peopleTab, item.openForm)} />
                  )}
                </div>
              </Collapse>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

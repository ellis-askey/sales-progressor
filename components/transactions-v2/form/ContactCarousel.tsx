"use client";

import { useState, useRef, useEffect } from "react";
import { ContactCard } from "./ContactsSection";
import type { ContactEntry, MemoSource } from "@/components/transactions-v2/types";
import { FieldHint } from "./FieldIndicator";
import { Pill } from "@/components/ui/Pill";

const MAX_ENTRIES = 4;

type ContactConflict = { kind: "phone" | "email"; withName: string };

type Props = {
  label: string;
  contacts: ContactEntry[];
  memoSource: MemoSource;
  isOutsourced: boolean;
  progressedBy: "agent" | "progressor";
  error: string | null;
  // Per-card phone/email duplication conflicts (keyed by card index).
  // Drives the amber-dot indicator on the tab pill and the inline error
  // passed down to the active ContactCard.
  conflicts?: Record<number, ContactConflict>;
  onChange: (contacts: ContactEntry[]) => void;
  onEdit: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isEntryInvalid(c: ContactEntry, isOutsourced: boolean): boolean {
  if (!isOutsourced) return false;
  return !c.name.trim() || (!c.phone.trim() && !c.email.trim());
}

function isSectionFilled(contacts: ContactEntry[]): boolean {
  return contacts.some((c) => c.name.trim() && (c.phone.trim() || c.email.trim()));
}

// ── Section pill badge ────────────────────────────────────────────────────────

// "Needed" pill, shown only in the strict (outsourced) context. Once the section
// is valid (a name + a contact method) it fades and collapses away, so the box
// tightens rather than leaving a stale "Needed" badge (critique #194).
function SectionPill({ isOutsourced, filled }: { isOutsourced: boolean; filled: boolean }) {
  if (!isOutsourced) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        overflow: "hidden",
        opacity: filled ? 0 : 1,
        maxWidth: filled ? 0 : 90,
        marginLeft: filled ? 0 : 5,
        transition: "opacity 200ms ease, max-width 260ms ease, margin-left 260ms ease",
      }}
    >
      {/* No outer drop shadow here: the collapse wrapper's overflow:hidden would
          clip the glass pill's 0 3px 10px shadow flat. On this opaque card the
          top sheen alone reads clean. */}
      <Pill glass tone="warning" size="sm" style={{ flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.06em", verticalAlign: "middle", whiteSpace: "nowrap", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)" }}>
        Needed
      </Pill>
    </span>
  );
}

// ── Empty state (count === 0) ─────────────────────────────────────────────────

function EmptyStateCard({ isOutsourced, label }: { isOutsourced: boolean; label: string }) {
  const singular = label.slice(0, -1).toLowerCase();
  if (isOutsourced) {
    return (
      <div style={{
        textAlign: "center",
        padding: "14px 16px",
        background: "rgba(245,158,11,0.04)",
        border: "0.5px dashed rgba(245,158,11,0.30)",
        borderRadius: 12,
      }}>
        <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 500, color: "var(--nv2-text-primary)" }}>
          Add a {singular}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: "var(--nv2-text-secondary)" }}>
          Add a name and a phone number or email.
        </p>
      </div>
    );
  }
  return (
    <div style={{
      textAlign: "center",
      padding: "14px 16px",
      background: "rgba(var(--agent-coral-base-rgb), 0.02)",
      border: "0.5px dashed rgba(var(--agent-coral-base-rgb), 0.20)",
      borderRadius: 12,
    }}>
      <p style={{ margin: 0, fontSize: 11, color: "var(--nv2-text-muted)" }}>
        No {label.toLowerCase()} added · you can add them later
      </p>
    </div>
  );
}

// ── Single-entry mode header ──────────────────────────────────────────────────

function SectionLabel({ label, isOutsourced, memoSource, canAdd, onAdd, progressedBy, filled }: {
  label: string;
  isOutsourced: boolean;
  memoSource: MemoSource;
  canAdd: boolean;
  onAdd: () => void;
  progressedBy: "agent" | "progressor";
  filled: boolean;
}) {
  const singular = label.slice(0, -1).toLowerCase();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isOutsourced ? 4 : 10 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--nv2-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center" }}>
        {label}
        {isOutsourced && <span style={{ color: "var(--agent-coral-deep)", marginLeft: 2, fontWeight: 700 }}>*</span>}
        <SectionPill isOutsourced={isOutsourced} filled={filled} />
      </p>
      {canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="agent-link"
          style={{ fontSize: 12, fontWeight: 600, padding: 0 }}
        >
          + Add {singular}
        </button>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContactCarousel({ label, contacts, memoSource, isOutsourced, progressedBy, error, conflicts, onChange, onEdit }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [lastDir, setLastDir] = useState<"next" | "prev">("next");
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const filled = isSectionFilled(contacts);

  // Clamp active index when entries are removed
  useEffect(() => {
    if (contacts.length > 0 && activeIndex >= contacts.length) {
      setActiveIndex(contacts.length - 1);
    }
  }, [contacts.length, activeIndex]);

  // Auto-navigate to first invalid entry when error appears
  useEffect(() => {
    if (!error || contacts.length < 2) return;
    const firstInvalid = contacts.findIndex((c) => isEntryInvalid(c, isOutsourced));
    if (firstInvalid >= 0 && firstInvalid !== activeIndex) {
      navigate(firstInvalid > activeIndex ? "next" : "prev", firstInvalid);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  function navigate(dir: "next" | "prev", toIndex?: number) {
    const newIndex = toIndex ?? (dir === "next" ? activeIndex + 1 : activeIndex - 1);
    if (newIndex < 0 || newIndex >= contacts.length) return;
    setLastDir(dir);
    setAnimKey((k) => k + 1);
    setActiveIndex(newIndex);
  }

  function goTo(index: number) {
    if (index === activeIndex) return;
    navigate(index > activeIndex ? "next" : "prev", index);
  }

  function addEntry() {
    if (contacts.length >= MAX_ENTRIES) return;
    const newContacts = [...contacts, { name: "", phone: "", email: "" }];
    onChange(newContacts);
    onEdit();
    const newIndex = newContacts.length - 1;
    setLastDir("next");
    setAnimKey((k) => k + 1);
    setActiveIndex(newIndex);
    setTimeout(() => {
      cardRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    }, 270);
  }

  function removeEntry(index: number) {
    const newContacts = contacts.filter((_, i) => i !== index);
    onChange(newContacts);
    onEdit();
  }

  function updateEntry(index: number, patch: Partial<ContactEntry>) {
    onChange(contacts.map((c, i) => (i === index ? { ...c, ...patch } : c)));
    onEdit();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (contacts.length < 2) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); navigate("prev"); }
    if (e.key === "ArrowRight") { e.preventDefault(); navigate("next"); }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;
    if (Math.abs(delta) >= 50) navigate(delta > 0 ? "next" : "prev");
  }

  const canAdd = contacts.length < MAX_ENTRIES;
  const singular = label.slice(0, -1).toLowerCase();

  // ── Empty state (count === 0) ──────────────────────────────────────────────

  if (contacts.length === 0) {
    return (
      <div>
        <SectionLabel
          label={label}
          isOutsourced={isOutsourced}
          memoSource={memoSource}
          canAdd={true}
          onAdd={addEntry}
          progressedBy={progressedBy}
          filled={false}
        />
        <EmptyStateCard isOutsourced={isOutsourced} label={label} />
        <FieldHint source={memoSource} failedText="Couldn't read this. Add contact details manually." />
      </div>
    );
  }

  // ── Single-entry mode ──────────────────────────────────────────────────────

  if (contacts.length === 1) {
    return (
      <div>
        <SectionLabel
          label={label}
          isOutsourced={isOutsourced}
          memoSource={memoSource}
          canAdd={true}
          onAdd={addEntry}
          progressedBy={progressedBy}
          filled={filled}
        />
        {/* Section-level "add at least one…" removed: it duplicated the
            per-contact reachability line on the card below. The NEEDED pill in
            the header carries the section-incomplete signal. */}
        {error && (
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-danger)", fontWeight: 500 }}>{error}</p>
        )}
        <ContactCard
          contact={contacts[0]}
          index={0}
          label={label.slice(0, -1)}
          canRemove={false}
          isOutsourced={isOutsourced}
          progressedBy={progressedBy}
          conflict={conflicts?.[0]}
          onChange={(patch) => updateEntry(0, patch)}
          onRemove={() => {}}
          onEdit={onEdit}
        />
        <FieldHint source={memoSource} failedText="Couldn't read this. Add contact details manually." />
      </div>
    );
  }

  // ── Multi-entry mode (2+) — labelled tabs + clean card ───────────────────

  const capitalisedSingular = label.slice(0, -1);

  return (
    <div onKeyDown={handleKeyDown}>
      {/* Header — same shape as single-entry: label on the left, the "+ Add"
          line top-right (kept here rather than moved into a tab-strip pill). */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--nv2-text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 2 }}>
          {label}
          {isOutsourced && <span style={{ color: "var(--agent-coral-deep)", fontWeight: 700, marginLeft: 1 }}>*</span>}
          <SectionPill isOutsourced={isOutsourced} filled={filled} />
        </p>
        {canAdd && (
          <button type="button" onClick={addEntry} className="agent-link" style={{ fontSize: 12, fontWeight: 600, padding: 0 }}>
            + Add {singular}
          </button>
        )}
      </div>

      {/* Tab strip — one pill per contact. Pills show the contact's name once
          entered; otherwise a "{Singular} N" fallback. Active pill is filled
          coral; invalid pill shows an amber dot. (Add now lives in the header.) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {contacts.map((c, i) => {
          const isActive = i === activeIndex;
          // hasErr drives the amber dot. It fires when this card is
          // outsourced-invalid OR it has a phone/email conflict with
          // another contact on the file.
          const hasErr = (!!error && isEntryInvalid(c, isOutsourced)) || !!conflicts?.[i];
          const name = c.name?.trim();
          const tabLabel = name
            ? name.length > 18 ? name.slice(0, 16) + "…" : name
            : `${capitalisedSingular} ${i + 1}`;
          return (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Switch to ${singular} ${i + 1}`}
              aria-pressed={isActive}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 11px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                background: isActive ? "var(--agent-coral)" : "transparent",
                color: isActive ? "white" : hasErr ? "var(--agent-warning)" : "var(--nv2-text-secondary)",
                border: isActive
                  ? "1px solid var(--agent-coral)"
                  : hasErr
                    ? "1px solid rgba(245,158,11,0.55)"
                    : "1px solid var(--nv2-border-medium)",
                cursor: "pointer",
                transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
                lineHeight: 1.2,
              }}
            >
              {hasErr && !isActive && (
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#f59e0b",
                    display: "inline-block",
                  }}
                />
              )}
              {tabLabel}
            </button>
          );
        })}
      </div>

      {error && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--agent-danger)", fontWeight: 500 }}>{error}</p>
      )}

      {/* Active card — single, clean. Slide-in on switch, x in the corner
          to remove. No background slivers or depth illusions. */}
      <div
        key={animKey}
        ref={cardRef}
        style={{
          position: "relative",
          animation: `carousel-slide-${lastDir === "next" ? "left" : "right"} 240ms cubic-bezier(0.16,1,0.3,1) both`,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ContactCard
          contact={contacts[activeIndex]}
          index={activeIndex}
          label={capitalisedSingular}
          canRemove={false}
          isOutsourced={isOutsourced}
          progressedBy={progressedBy}
          conflict={conflicts?.[activeIndex]}
          onChange={(patch) => updateEntry(activeIndex, patch)}
          onRemove={() => removeEntry(activeIndex)}
          onEdit={onEdit}
        />
        <button
          type="button"
          onClick={() => removeEntry(activeIndex)}
          aria-label={`Remove ${singular} ${activeIndex + 1}`}
          className="agent-icon-btn agent-icon-btn-sm"
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 2,
          }}
        >
          ×
        </button>
      </div>

      <FieldHint source={memoSource} failedText="Couldn't read this. Add contact details manually." />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import {
  Buildings,
  Scales,
  Bank,
  ArrowSquareOut,
  MagnifyingGlass,
} from "@phosphor-icons/react";

// Directory of professional partners (conveyancers + mortgage brokers) with
// client-side search and sort. The server page (app/agent/partners/page.tsx)
// fetches and scopes the data, attaches per-firm intelligence, and hands plain
// serialisable objects to this component.

type ContactWithFiles = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  activeFiles: { id: string; propertyAddress: string; role?: "vendor" | "purchaser"; isReferral: boolean }[];
};

export type FirmIntel = {
  avgDaysToExchange: number | null;
  income: { receivedPence: number; pendingPence: number; pendingCount: number } | null;
};

export type DirectoryFirm = {
  id: string;
  name: string;
  website?: string | null;
  totalActiveFiles: number;
  referralActiveFiles: number;
  contacts: ContactWithFiles[];
  intel: FirmIntel;
};

type SortKey = "name" | "active" | "exchange";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "active", label: "Most active" },
  { key: "exchange", label: "Fastest exchange" },
];

function formatGBP(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

function matchesQuery(firm: DirectoryFirm, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (firm.name.toLowerCase().includes(needle)) return true;
  return firm.contacts.some((c) => c.name.toLowerCase().includes(needle));
}

function sortFirms(firms: DirectoryFirm[], key: SortKey): DirectoryFirm[] {
  const copy = [...firms];
  if (key === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (key === "active") {
    copy.sort((a, b) => b.totalActiveFiles - a.totalActiveFiles || a.name.localeCompare(b.name));
  } else {
    // Fastest exchange: firms with an avg come first (ascending); firms with
    // no exchange history sink to the bottom, then order by name.
    copy.sort((a, b) => {
      const av = a.intel.avgDaysToExchange;
      const bv = b.intel.avgDaysToExchange;
      if (av == null && bv == null) return a.name.localeCompare(b.name);
      if (av == null) return 1;
      if (bv == null) return -1;
      return av - bv || a.name.localeCompare(b.name);
    });
  }
  return copy;
}

export function PartnersDirectory({
  solicitorFirms,
  brokerFirms,
  showIncome,
}: {
  solicitorFirms: DirectoryFirm[];
  brokerFirms: DirectoryFirm[];
  showIncome: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const visibleSolicitors = useMemo(
    () => sortFirms(solicitorFirms.filter((f) => matchesQuery(f, query)), sort),
    [solicitorFirms, query, sort]
  );
  const visibleBrokers = useMemo(
    () => sortFirms(brokerFirms.filter((f) => matchesQuery(f, query)), sort),
    [brokerFirms, query, sort]
  );

  const noMatches = query.trim().length > 0 && visibleSolicitors.length === 0 && visibleBrokers.length === 0;

  return (
    <div className="space-y-4">
      {/* Control bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <MagnifyingGlass
            weight="regular"
            style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "var(--agent-text-muted)", pointerEvents: "none" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search firms or contacts"
            aria-label="Search partners"
            style={{
              width: "100%", padding: "8px 12px 8px 33px", fontSize: 13,
              borderRadius: 10, border: "1px solid var(--agent-border-default)",
              background: "var(--agent-surface-glass)", color: "var(--agent-text-primary)",
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, color: "var(--agent-text-muted)", flexShrink: 0 }}>Sort</span>
          <div style={{ display: "inline-flex", padding: 2, borderRadius: 10, background: "var(--agent-surface-glass)", border: "1px solid var(--agent-border-default)" }}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  aria-pressed={active}
                  style={{
                    padding: "5px 11px", fontSize: 12, fontWeight: 600, borderRadius: 8,
                    border: "none", cursor: "pointer",
                    color: active ? "var(--agent-text-primary)" : "var(--agent-text-muted)",
                    background: active ? "var(--agent-surface-raised, rgba(255,255,255,0.7))" : "transparent",
                    boxShadow: active ? "0 1px 2px rgba(15,23,42,0.06)" : "none",
                    transition: "color 120ms, background 120ms",
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {noMatches ? (
        <div
          className="agent-glass-strong"
          style={{ padding: "36px 32px", textAlign: "center", borderRadius: "var(--agent-radius-xl)" }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)" }}>
            No partners match &ldquo;{query}&rdquo;
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--agent-text-muted)" }}>
            Try a firm name or a contact&apos;s name.
          </p>
        </div>
      ) : (
        <>
          {visibleSolicitors.length > 0 && (
            <div className="space-y-3">
              <SectionHeading Icon={Scales} label="Conveyancers" count={visibleSolicitors.length} />
              {visibleSolicitors.map((firm) => (
                <FirmCard key={firm.id} firm={firm} kind="solicitor" showIncome={showIncome} />
              ))}
            </div>
          )}
          {visibleBrokers.length > 0 && (
            <div className="space-y-3">
              <SectionHeading Icon={Bank} label="Mortgage brokers" count={visibleBrokers.length} />
              {visibleBrokers.map((firm) => (
                <FirmCard key={firm.id} firm={firm} kind="broker" showIncome={showIncome} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionHeading({ Icon, label, count }: { Icon: typeof Scales; label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px" }}>
      <Icon weight="regular" style={{ width: 16, height: 16, color: "var(--agent-text-muted)" }} />
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-secondary)", letterSpacing: "-0.01em" }}>
        {label}
      </h2>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--agent-text-disabled)", fontVariantNumeric: "tabular-nums" }}>
        {count}
      </span>
    </div>
  );
}

function IntelPill({ label, tone = "muted" }: { label: string; tone?: "muted" | "success" | "warn" }) {
  const color = tone === "success" ? "var(--agent-success)" : tone === "warn" ? "#b45309" : "var(--agent-text-muted)";
  const bg = tone === "success" ? "var(--agent-success-bg)" : tone === "warn" ? "rgba(180,83,9,0.08)" : "var(--agent-surface-glass)";
  const border = tone === "success" ? "var(--agent-success-border)" : tone === "warn" ? "rgba(180,83,9,0.18)" : "var(--agent-border-default)";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 7,
      fontSize: 11, fontWeight: 600, color,
      background: bg, border: `1px solid ${border}`,
      fontVariantNumeric: "tabular-nums",
    }}>
      {label}
    </span>
  );
}

function IntelRow({ intel, showIncome }: { intel: FirmIntel; showIncome: boolean }) {
  const hasAvg = intel.avgDaysToExchange != null;
  const hasIncome = showIncome && intel.income != null && (intel.income.receivedPence > 0 || intel.income.pendingPence > 0);
  if (!hasAvg && !hasIncome) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "10px 20px 0" }}>
      {hasAvg && <IntelPill label={`${intel.avgDaysToExchange} days avg to exchange`} />}
      {hasIncome && intel.income!.receivedPence > 0 && (
        <IntelPill label={`${formatGBP(intel.income!.receivedPence)} in`} tone="success" />
      )}
      {hasIncome && intel.income!.pendingPence > 0 && (
        <IntelPill label={`${formatGBP(intel.income!.pendingPence)} due`} tone="warn" />
      )}
    </div>
  );
}

function ActiveBadge({ totalActiveFiles, referralActiveFiles }: { totalActiveFiles: number; referralActiveFiles: number }) {
  if (totalActiveFiles === 0) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, flexShrink: 0,
      padding: "3px 10px", borderRadius: 20,
      color: "var(--agent-success)",
      background: "var(--agent-success-bg)",
      border: "1px solid var(--agent-success-border)",
    }}>
      {totalActiveFiles} active
      {referralActiveFiles > 0
        ? ` · ${referralActiveFiles} referral${referralActiveFiles !== 1 ? "s" : ""}`
        : ` file${totalActiveFiles !== 1 ? "s" : ""}`}
    </span>
  );
}

function ContactFileChips({ files }: { files: ContactWithFiles["activeFiles"] }) {
  if (files.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
      {files.map((f) => (
        <Link key={`${f.id}-${f.role ?? "purchaser"}`} href={`/agent/transactions/${f.id}`} style={{ textDecoration: "none" }}>
          <span
            className="solicitor-file-chip"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              padding: "3px 9px", borderRadius: 6,
              fontSize: 11, color: "var(--agent-text-secondary)",
              background: "var(--agent-surface-glass)",
              border: "1px solid var(--agent-border-default)",
              transition: "background 120ms",
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
              background: f.isReferral ? "#f59e0b" : f.role === "vendor" ? "#a78bfa" : "#60a5fa",
            }} />
            <span style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {f.propertyAddress}
            </span>
            {f.role && (
              <span style={{ color: "var(--agent-text-disabled)", textTransform: "capitalize" }}>({f.role})</span>
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}

function ContactRow({ contact, isLast }: { contact: ContactWithFiles; isLast: boolean }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: isLast ? "none" : "0.5px solid var(--agent-border-default)" }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--agent-text-primary)" }}>{contact.name}</p>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "2px 12px", marginTop: 3 }}>
          {contact.email && (
            <a href={`mailto:${contact.email}`} style={{ fontSize: 12, color: "var(--agent-info)", textDecoration: "none" }}>{contact.email}</a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} style={{ fontSize: 12, color: "var(--agent-text-muted)", textDecoration: "none" }}>{contact.phone}</a>
          )}
          {!contact.email && !contact.phone && (
            <span style={{ fontSize: 12, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>No contact details</span>
          )}
        </div>
      </div>
      <ContactFileChips files={contact.activeFiles} />
    </div>
  );
}

function FirmCard({ firm, kind, showIncome }: { firm: DirectoryFirm; kind: "solicitor" | "broker"; showIncome: boolean }) {
  const cleanWebsite = firm.website ? firm.website.replace(/^https?:\/\//, "") : null;
  const websiteHref = firm.website ? (firm.website.startsWith("http") ? firm.website : `https://${firm.website}`) : null;
  return (
    <Card padding="none">
      {/* Firm header */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "0.5px solid var(--agent-border-default)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <Link
          href={`/agent/partners/${kind}/${firm.id}`}
          className="partner-firm-link"
          style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, textDecoration: "none", flex: 1 }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "rgba(99,102,241,0.10)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Buildings weight="regular" style={{ width: 15, height: 15, color: "#6366f1" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--agent-text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {firm.name}
            </p>
            {websiteHref && cleanWebsite && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 1, fontSize: 11, color: "var(--agent-text-muted)" }}>
                {cleanWebsite}
              </span>
            )}
          </div>
        </Link>
        <ActiveBadge totalActiveFiles={firm.totalActiveFiles} referralActiveFiles={firm.referralActiveFiles} />
      </div>

      <IntelRow intel={firm.intel} showIncome={showIncome} />

      {firm.contacts.length === 0 ? (
        <p style={{ margin: 0, padding: "14px 20px", fontSize: 13, color: "var(--agent-text-disabled)", fontStyle: "italic" }}>
          No contacts recorded
        </p>
      ) : (
        <div style={{ marginTop: 4 }}>
          {firm.contacts.map((contact, i) => (
            <ContactRow key={contact.id} contact={contact} isLast={i === firm.contacts.length - 1} />
          ))}
        </div>
      )}

      {/* View firm detail */}
      <Link
        href={`/agent/partners/${kind}/${firm.id}`}
        className="partner-firm-link"
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 20px", borderTop: "0.5px solid var(--agent-border-default)",
          fontSize: 12, fontWeight: 600, color: "#6366f1", textDecoration: "none",
        }}
      >
        <span>View firm</span>
        <ArrowSquareOut size={13} weight="bold" />
      </Link>
    </Card>
  );
}

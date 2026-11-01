"use client";

// Migrate Sale — agency-facing flow for bringing an EXISTING in-progress sale
// onto the platform. Deliberately reuses the Add New Sale building blocks
// (HeroCard memo-drop + /api/agent/memo-parse extraction, Stage1Fields,
// Stage2Sections, FormChainSection) so it feels identical, then adds the one
// thing a migration needs: a historical-milestone grid. Submits to
// migrateBoardwalkSaleAction, which performs the SILENT import (no client
// emails/chases/invites; historical dates preserved).
//
// This is a SEPARATE orchestrator from NewSaleFlow on purpose: the Add New Sale
// flow is untouched (its drafts / earnings / billing gates don't apply to a
// migration), while the leaf input components are shared.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { HeroCard } from "@/components/transactions-v2/HeroCard";
import { Stage1Fields } from "@/components/transactions-v2/form/Stage1Fields";
import { Stage2Sections } from "@/components/transactions-v2/form/Stage2Sections";
import { FormChainSection } from "@/components/transactions-v2/form/FormChainSection";
import { MilestoneHistoryGrid, type TickMap, type MilestoneDef } from "@/components/transactions-v2/migrate/MilestoneHistoryGrid";
import { defaultFormFields, isChainLikely, chainOpenReason, type FormFields } from "@/components/transactions-v2/form/types";
import { NULL_MEMO_SOURCES, type ExtractedMemoData, type MemoSources, type ContactEntry } from "@/components/transactions-v2/types";
import type { StubFormData } from "@/components/chain/AddNodeDrawer";
import type { InMemoryStub } from "@/components/chain/ChainSection";
import { migrateBoardwalkSaleAction } from "@/app/actions/migrate-sale";
import { mapPairwiseConflicts, type ContactConflict } from "@/lib/contacts/dedupe";
import { cleanPhone, formatPostcode } from "@/lib/utils/address";
import { titleCase, titleCaseKeepAcronyms } from "@/lib/utils";
import { looksLikeBusiness } from "@/lib/contacts/business";
import { autoFillSolicitor } from "@/lib/utils/solicitor-autofill";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";

type RecommendedFirm = { id: string; defaultReferralFeePence: number | null };

const todayISO = (now: Date) => now.toISOString().slice(0, 10);

// Same business-split rule the new-sale submit uses, kept local so the two
// entry points agree without coupling MigrateSaleFlow to NewSaleFlow internals.
function resolveBusinessSplit(c: ContactEntry): { name: string; companyName: string | null } {
  const typed = c.name.trim();
  const biz = looksLikeBusiness(typed) && !c.bizDismissed;
  const person = c.contactPerson?.trim();
  if (biz) return { name: person || typed, companyName: typed };
  return { name: typed, companyName: null };
}

function populateFromExtraction(data: ExtractedMemoData): FormFields {
  const fields = defaultFormFields("agent");
  if (data.streetAddress) fields.streetAddress = titleCase(data.streetAddress);
  if (data.city) fields.city = titleCase(data.city);
  if (data.postcode) fields.postcode = formatPostcode(data.postcode);
  if (data.purchasePricePence) fields.purchasePricePence = data.purchasePricePence;
  if (data.tenure) fields.tenure = data.tenure;

  const toEntry = (p: { name: string; companyName?: string | null; phone?: string; email?: string }): ContactEntry => {
    const company = p.companyName?.trim() || (looksLikeBusiness(p.name ?? "") ? (p.name ?? "").trim() : "");
    const phone = cleanPhone(p.phone ?? "");
    const email = p.email ?? "";
    if (company) {
      const person = p.companyName?.trim() ? (p.name?.trim() ?? "") : "";
      return { name: titleCaseKeepAcronyms(company), contactPerson: person ? titleCase(person) : "", phone, email };
    }
    return { name: titleCase(p.name), phone, email };
  };

  if (data.vendors?.length) {
    const v = data.vendors.filter((x) => x.name?.trim() || x.companyName?.trim());
    if (v.length) fields.vendors = v.map(toEntry);
  }
  if (data.purchasers?.length) {
    const p = data.purchasers.filter((x) => x.name?.trim() || x.companyName?.trim());
    if (p.length) fields.purchasers = p.map(toEntry);
  }
  return fields;
}

function computeMemoSources(data: ExtractedMemoData, fields: FormFields): MemoSources {
  const fill = (extracted: boolean, hasValue: boolean): "extracted" | "failed" | null =>
    extracted ? "extracted" : hasValue ? null : "failed";
  return {
    streetAddress: fill(data.streetAddress != null, !!fields.streetAddress.trim()),
    city: fill(data.city != null, !!fields.city.trim()),
    postcode: fill(data.postcode != null, !!fields.postcode.trim()),
    purchasePricePence: fill(data.purchasePricePence != null, !!fields.purchasePricePence),
    tenure: fill(data.tenure != null, !!fields.tenure),
    purchaseType: "not_on_memos",
    vendors: fill(data.vendors.some((v) => v.name?.trim()), fields.vendors.some((v) => v.name.trim())),
    purchasers: fill(data.purchasers.some((p) => p.name?.trim()), fields.purchasers.some((p) => p.name.trim())),
    vendorSolicitor: fill(data.vendorSolicitor != null, !!fields.vendorSolicitor),
    purchaserSolicitor: fill(data.purchaserSolicitor != null, !!fields.purchaserSolicitor),
    agentFee: "not_on_memos",
  };
}

export function MigrateSaleFlow({
  recommendedFirms,
  preferredBroker,
  preferredBrokerDefaultFee,
  milestoneDefs,
  isDirector,
  assignableAgents,
}: {
  recommendedFirms: RecommendedFirm[];
  preferredBroker: BrokerSelection | null;
  preferredBrokerDefaultFee: number | null;
  milestoneDefs: MilestoneDef[];
  isDirector: boolean;
  assignableAgents: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const { toast } = useAgentToast();

  // Minted once per review session → makes the import idempotent against
  // double-submit / retry (the server resolves a repeat key to the same file).
  const idempotencyKey = useRef<string>(crypto.randomUUID()).current;
  const now = useRef<Date>(new Date()).current;
  const today = todayISO(now);

  const [flowState, setFlowState] = useState<"hero" | "extracting" | "form">("hero");
  const [formFields, setFormFields] = useState<FormFields>(() => defaultFormFields("agent"));
  const [extractedData, setExtractedData] = useState<ExtractedMemoData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [originalCreatedAt, setOriginalCreatedAt] = useState<string>(today);
  const [ticks, setTicks] = useState<TickMap>({});

  const [isFillingVendorSol, setIsFillingVendorSol] = useState(false);
  const [isFillingPurchaserSol, setIsFillingPurchaserSol] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupAddress, setDupAddress] = useState(false);

  const memoSources: MemoSources = useMemo(
    () => (extractedData ? computeMemoSources(extractedData, formFields) : NULL_MEMO_SOURCES),
    [extractedData, formFields],
  );

  const update = (patch: Partial<FormFields>) => setFormFields((f) => ({ ...f, ...patch }));

  // Per-card phone/email conflicts, computed exactly as NewSaleFlow does: one
  // combined list keyed by index, then split back per side.
  const { vendorConflicts, purchaserConflicts } = useMemo(() => {
    const labelled = [
      ...formFields.vendors.map((c, i) => ({ ...c, name: c.name.trim() || `Vendor ${i + 1}`, _role: "vendor" as const, _index: i })),
      ...formFields.purchasers.map((c, i) => ({ ...c, name: c.name.trim() || `Purchaser ${i + 1}`, _role: "purchaser" as const, _index: i })),
    ];
    const conflicts = mapPairwiseConflicts(labelled);
    const vConflicts: Record<number, ContactConflict> = {};
    const pConflicts: Record<number, ContactConflict> = {};
    for (const [k, v] of Object.entries(conflicts)) {
      const offender = labelled[Number(k)];
      if (offender._role === "vendor") vConflicts[offender._index] = v;
      else pConflicts[offender._index] = v;
    }
    return { vendorConflicts: vConflicts, purchaserConflicts: pConflicts };
  }, [formFields.vendors, formFields.purchasers]);

  async function handleFile(file: File) {
    setParseError(null);
    setFlowState("extracting");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/agent/memo-parse", { method: "POST", body });
      if (!res.ok) {
        const msg = res.status === 422 ? "Couldn't read that document. Try a clearer scan, or fill in manually." : "Upload failed. Try again or fill in manually.";
        setParseError(msg);
        setFlowState("hero");
        return;
      }
      const data = (await res.json()) as ExtractedMemoData;
      const fields = populateFromExtraction(data);
      setExtractedData(data);
      setFormFields(fields);
      setFlowState("form");

      // Reuse the solicitor matcher so an extracted firm is matched/held exactly
      // as in Add New Sale (contact matching — §4).
      if (data.vendorSolicitor?.firm) {
        setIsFillingVendorSol(true);
        autoFillSolicitor(data.vendorSolicitor.firm, data.vendorSolicitor, (v) => update({ vendorSolicitor: v }))
          .finally(() => setIsFillingVendorSol(false));
      }
      if (data.purchaserSolicitor?.firm) {
        setIsFillingPurchaserSol(true);
        autoFillSolicitor(data.purchaserSolicitor.firm, data.purchaserSolicitor, (v) => update({ purchaserSolicitor: v }))
          .finally(() => setIsFillingPurchaserSol(false));
      }
    } catch {
      setParseError("Upload failed. Try again or fill in manually.");
      setFlowState("hero");
    }
  }

  async function submit(forceCreate = false) {
    setError(null);

    if (!formFields.tenure || !formFields.purchaseType) {
      toast.error("Select tenure and purchase type to continue.");
      return;
    }
    const hasVendor = formFields.vendors.some((v) => v.name.trim());
    const hasPurchaser = formFields.purchasers.some((p) => p.name.trim());
    if (!hasVendor || !hasPurchaser) {
      toast.error("Add at least one seller and one buyer.");
      return;
    }
    // A solicitor firm without its named handler is never savable (same rule as
    // Add New Sale), but solicitors are OPTIONAL on a migration.
    if ((!!formFields.vendorSolicitor?.firmId && !formFields.vendorSolicitor?.contactId) ||
        (!!formFields.purchaserSolicitor?.firmId && !formFields.purchaserSolicitor?.contactId)) {
      toast.error("Finish adding the solicitor's case handler, or remove the firm.");
      return;
    }

    const propertyAddress = [formFields.streetAddress, formFields.city, formFields.postcode]
      .map((s) => s.trim()).filter(Boolean).join(", ");

    const contacts = [
      ...formFields.vendors.filter((v) => v.name.trim()).map((v) => {
        const { name, companyName } = resolveBusinessSplit(v);
        return { name, companyName: companyName ?? undefined, phone: v.phone.trim() || undefined, email: v.email.trim() || undefined, roleType: "vendor" as const };
      }),
      ...formFields.purchasers.filter((p) => p.name.trim()).map((p) => {
        const { name, companyName } = resolveBusinessSplit(p);
        return { name, companyName: companyName ?? undefined, phone: p.phone.trim() || undefined, email: p.email.trim() || undefined, roleType: "purchaser" as const };
      }),
    ];

    const completions = Object.entries(ticks)
      .filter(([, t]) => t.checked && t.date)
      .map(([milestoneDefinitionId, t]) => ({ milestoneDefinitionId, eventDate: t.date }));

    const chainStubs = formFields.chainStubs.map((s) => ({
      direction: s.direction,
      stubPropertyAddress: s.stubPropertyAddress,
      stubAgencyName: s.stubAgencyName,
      stubAgentName: s.stubAgentName || null,
      stubAgentEmail: s.stubAgentEmail || null,
      stubAgentPhone: s.stubAgentPhone || null,
      stubNotes: s.stubNotes || null,
    }));

    setSubmitting(true);
    try {
      const result = await migrateBoardwalkSaleAction({
        idempotencyKey,
        propertyAddress,
        purchasePrice: formFields.purchasePricePence,
        tenure: formFields.tenure as "freehold" | "leasehold",
        isShareOfFreehold: formFields.tenure === "leasehold" ? formFields.isShareOfFreehold : false,
        purchaseType: formFields.purchaseType as "mortgage" | "cash_buyer" | "cash_from_proceeds",
        notes: formFields.notes.trim() || null,
        originalCreatedAt,
        progressedBy: formFields.progressedBy,
        assignToUserId: formFields.assignToUserId || null,
        contacts,
        vendorSolicitorFirmId: formFields.vendorSolicitor?.firmId ?? null,
        vendorSolicitorContactId: formFields.vendorSolicitor?.contactId ?? null,
        purchaserSolicitorFirmId: formFields.purchaserSolicitor?.firmId ?? null,
        purchaserSolicitorContactId: formFields.purchaserSolicitor?.contactId ?? null,
        brokerFirmId: formFields.broker?.firmId ?? null,
        brokerContactId: formFields.broker?.contactId ?? null,
        agentFeeAmount: formFields.agentFeeType === "amount" ? formFields.agentFeeAmount : null,
        agentFeePercent: formFields.agentFeeType === "percent" ? (parseFloat(formFields.agentFeePercentStr) || null) : null,
        agentFeeIsVatInclusive: formFields.agentFeeVat === "inclusive",
        mosStoragePath: extractedData?.mosStoragePath ?? null,
        mosFileSize: extractedData?.mosFileSize ?? null,
        mosMimeType: extractedData?.mosMimeType ?? null,
        mosFilename: extractedData?.mosFilename ?? null,
        chainStubs,
        completions,
        forceCreate,
      });

      if (result.ok) {
        toast.success("Sale imported. No client messages were sent.");
        router.push(`/agent/transactions/${result.id}`);
        return;
      }

      if (result.kind === "duplicate_address") {
        setDupAddress(true);
        setError(result.message);
      } else {
        setError(result.message);
        toast.error(result.message);
      }
    } catch {
      setError("Something went wrong. No client messages were sent. Try again.");
      toast.error("Import failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (flowState === "hero" || flowState === "extracting") {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {flowState === "extracting" ? (
          <div className="agent-glass" style={{ padding: 32, borderRadius: 14, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 14, color: "var(--agent-text-secondary)" }}>Reading the memo of sale…</p>
          </div>
        ) : (
          <HeroCard
            drafts={[]}
            onFile={handleFile}
            onFillManually={() => { setFormFields(defaultFormFields("agent")); setExtractedData(null); setFlowState("form"); }}
            onLoadDraft={() => {}}
            onDeleteDraft={() => {}}
            parseError={parseError}
          />
        )}
      </div>
    );
  }

  const stage1Valid = formFields.streetAddress.trim().length >= 3 && !!formFields.tenure && !!formFields.purchaseType;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Sale start date — the one migration-specific detail above the reused form */}
      <div className="agent-glass" style={{ padding: 16, borderRadius: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--agent-text-primary)" }}>When did this sale first start?</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>The date it was agreed in your old system. Sets the file&apos;s age and exchange target. We won&apos;t message anyone about anything before today.</p>
        </div>
        <input
          type="date"
          value={originalCreatedAt}
          max={today}
          onChange={(e) => setOriginalCreatedAt(e.target.value)}
          style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--agent-hairline, rgba(0,0,0,0.12))", background: "var(--agent-input-bg, rgba(255,255,255,0.6))", color: "var(--agent-text-primary, #1a1a1a)" }}
          aria-label="Original sale start date"
        />
      </div>

      <Stage1Fields
        streetAddress={formFields.streetAddress}
        city={formFields.city}
        postcode={formFields.postcode}
        tenure={formFields.tenure}
        isShareOfFreehold={formFields.isShareOfFreehold}
        purchaseType={formFields.purchaseType}
        progressedBy={formFields.progressedBy}
        memoSources={memoSources}
        onStreetAddressChange={(v) => update({ streetAddress: v })}
        onCityChange={(v) => update({ city: v })}
        onPostcodeChange={(v) => update({ postcode: v })}
        onTenureChange={(v) => update({ tenure: v })}
        onIsShareOfFreeholdChange={(v) => update({ isShareOfFreehold: v })}
        onPurchaseTypeChange={(v) => update({ purchaseType: v })}
        onProgressedByChange={(v) => update({ progressedBy: v })}
        onEdit={() => {}}
      />

      {stage1Valid && (
        <>
          <Stage2Sections
            fields={formFields}
            memoSources={memoSources}
            onChange={update}
            onEdit={() => {}}
            isOutsourced={formFields.progressedBy === "progressor"}
            vendorError={null}
            purchaserError={null}
            isFillingVendorSolicitor={isFillingVendorSol}
            isFillingPurchaserSolicitor={isFillingPurchaserSol}
            vendorSolicitorHint={null}
            purchaserSolicitorHint={null}
            recommendedFirms={recommendedFirms}
            preferredBroker={preferredBroker}
            preferredBrokerDefaultFee={preferredBrokerDefaultFee}
            canSaveToPartners={true}
            showPortalPrompt={false}
            vendorConflicts={vendorConflicts}
            purchaserConflicts={purchaserConflicts}
          />

          <FormChainSection
            stubs={formFields.chainStubs}
            expanded={formFields.chainExpanded || isChainLikely(formFields.purchaseType)}
            originatorAddress={[formFields.streetAddress, formFields.city].filter(Boolean).join(", ")}
            autoOpenReason={chainOpenReason(formFields.purchaseType)}
            onExpand={() => update({ chainExpanded: true })}
            onCollapse={() => update({ chainExpanded: false })}
            onAddStub={(stub: InMemoryStub) => update({ chainStubs: [...formFields.chainStubs, stub] })}
            onEditStub={(id: string, data: StubFormData) => update({ chainStubs: formFields.chainStubs.map((s) => (s.id === id ? { ...s, ...data } : s)) })}
            onRemoveStub={(id: string) => update({ chainStubs: formFields.chainStubs.filter((s) => s.id !== id) })}
          />

          {isDirector && assignableAgents.length > 0 && (
            <div className="agent-glass" style={{ padding: 16, borderRadius: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--agent-text-primary)" }}>Assign to</label>
              <select
                value={formFields.assignToUserId}
                onChange={(e) => update({ assignToUserId: e.target.value })}
                style={{ marginTop: 6, width: "100%", maxWidth: 320, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--agent-hairline, rgba(0,0,0,0.12))", background: "var(--agent-input-bg, rgba(255,255,255,0.6))" }}
              >
                <option value="">Me</option>
                {assignableAgents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
          )}

          {/* Historical milestones */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--agent-text-primary)" }}>What&apos;s already been done?</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--agent-text-secondary)" }}>Mark the steps this sale has already passed and when they happened. Everything you mark is recorded silently with its real date, and no emails, chases or notifications go out. Anything left unmarked carries on as normal from here.</p>
            </div>
            <MilestoneHistoryGrid
              defs={milestoneDefs}
              tenure={formFields.tenure}
              purchaseType={formFields.purchaseType}
              value={ticks}
              onChange={setTicks}
              today={today}
            />
          </div>

          {error && (
            <div className="agent-glass" style={{ padding: 14, borderRadius: 12 }} role="alert">
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#b4231f" }}>{error}</p>
            </div>
          )}

          <div className="agent-glass" style={{ padding: 16, borderRadius: 14, display: "flex", alignItems: "center", gap: 12, position: "sticky", bottom: 12, zIndex: 5 }}>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(dupAddress)}
              style={{ padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", background: "var(--agent-coral, #FF6B4A)", border: "none", cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? "Importing…" : dupAddress ? "Import anyway" : "Import this sale"}
            </button>
            <span style={{ fontSize: 12, color: "var(--agent-text-secondary)" }}>
              The file opens ready to progress. Client updates stay paused until you turn them on from the file.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

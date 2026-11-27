"use client";

// The live invoice designer on the business owner's Business settings page. A
// two-pane editor (controls left, live preview right) over the real
// InvoiceDesign: template, brand colour, logo (uploads immediately via the
// invoice-logo route), typeface, title, message, address, terms, bank, and the
// line-detail/footer toggles. "Save design" persists the JSON via
// saveInvoiceDesignAction. Built from the account primitives.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountCard } from "@/components/account/chrome/AccountCard";
import { SegmentedSwitch } from "@/components/ui/SegmentedSwitch";
import { LiquidToggle } from "@/components/ui/LiquidToggle";
import { LabelInput } from "@/components/ui/LabelInput";
import { Button } from "@/components/arc/button/button";
import { useAgentToast } from "@/components/agent/AgentToaster";
import { saveInvoiceDesignAction } from "@/app/actions/progression-clients";
import { InvoiceDesignPreview } from "./InvoiceDesignPreview";
import { type InvoiceDesign, type InvoiceTemplate, DEFAULT_INVOICE_DESIGN } from "@/lib/progression/invoice-design";

const SWATCHES = ["#0E7490", "#1E3A8A", "#0F6B4F", "#7C3AED", "#B91C1C", "#C2410C", "#0F766E", "#111827"];
const TEMPLATES: { id: InvoiceTemplate; label: string; note: string }[] = [
  { id: "classic", label: "Classic", note: "Hairline brand bar, logo left" },
  { id: "modern", label: "Modern", note: "Bold colour header block" },
  { id: "minimal", label: "Minimal", note: "Monochrome, lots of air" },
];

export function InvoiceDesignerSection({
  initialDesign, initialLogoUrl, businessName, vatRegistered, vatNumber,
}: {
  initialDesign: InvoiceDesign;
  initialLogoUrl: string | null;
  businessName: string;
  vatRegistered: boolean;
  vatNumber: string | null;
}) {
  const router = useRouter();
  const { toast } = useAgentToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [design, setDesign] = useState<InvoiceDesign>(initialDesign);
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const accent = design.brandColor;
  function set<K extends keyof InvoiceDesign>(k: K, v: InvoiceDesign[K]) { setDesign((d) => ({ ...d, [k]: v })); setDirty(true); }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const res = await saveInvoiceDesignAction(design);
      if (res.ok) { setDirty(false); toast.success("Invoice design saved"); router.refresh(); }
      else toast.error(res.error);
    } catch { toast.error("Couldn't save. Try again."); }
    finally { setSaving(false); }
  }

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo must be under 2MB."); return; }
    setUploading(true);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
        r.onerror = () => reject(new Error("read"));
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/agent/business/invoice-logo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataBase64, mimetype: file.type }),
      });
      const json = await res.json();
      if (res.ok) { setLogoUrl(`${json.url}?t=${Date.now()}`); toast.success("Logo updated"); }
      else toast.error(json.error ?? "Upload failed.");
    } catch { toast.error("Upload failed. Try again."); }
    finally { setUploading(false); }
  }

  async function removeLogo() {
    setUploading(true);
    try {
      const res = await fetch("/api/agent/business/invoice-logo", { method: "DELETE" });
      if (res.ok) { setLogoUrl(null); toast.success("Logo removed"); }
      else toast.error("Couldn't remove the logo.");
    } catch { toast.error("Couldn't remove the logo."); }
    finally { setUploading(false); }
  }

  return (
    <AccountCard
      title="Invoice designer"
      subtitle="How the invoices you send your client agencies look. The preview updates as you go; Save design to keep it."
      headerAction={<Button type="button" variant="primary" size="sm" loading={saving} disabled={saving || !dirty} onClick={save}>Save design</Button>}
    >
      <div className="ivd-frame">
        <div className="ivd-controls">
          {/* Template */}
          <div className="ivd-group">
            <div className="ivd-group-title">Template</div>
            <div className="ivd-templates">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" className="ivd-thumb" data-on={design.template === t.id} onClick={() => set("template", t.id)}>
                  <Thumb template={t.id} color={accent} />
                  <span className="ivd-thumb-label">{t.label}</span>
                  <span className="ivd-thumb-note">{t.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Logo + colour */}
          <div className="ivd-group">
            <div className="ivd-group-title">Logo & colour</div>
            <div className="ivd-logo-row">
              <button type="button" className="ivd-logo-drop" onClick={() => fileRef.current?.click()} disabled={uploading} style={logoUrl ? undefined : { borderColor: accent }}>
                {logoUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={logoUrl} alt="Logo" style={{ maxHeight: 44, maxWidth: 150, objectFit: "contain" }} />
                  : <span className="ivd-logo-empty"><span className="ivd-logo-chip" style={{ background: accent }}>{(businessName[0] ?? "–").toUpperCase()}</span>{uploading ? "Uploading…" : "Add your logo"}</span>}
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = ""; }} />
              <div className="ivd-logo-actions">
                <div className="ivd-row-between"><span className="ivd-lab">Show logo</span><LiquidToggle checked={design.logoEnabled} onChange={() => set("logoEnabled", !design.logoEnabled)} width={44} height={24} color={accent} aria-label="Show logo" /></div>
                {logoUrl && <button type="button" className="ivd-textbtn" onClick={removeLogo} disabled={uploading}>Remove logo</button>}
                <div className="ivd-hint">PNG or JPG embeds best in the PDF. Max 2MB.</div>
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <div className="ivd-lab" style={{ marginBottom: 8 }}>Brand colour</div>
              <div className="ivd-colour">
                <label className="ivd-colour-tile" style={{ background: accent }}>
                  <input type="color" value={accent} onChange={(e) => set("brandColor", e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} aria-label="Brand colour" />
                </label>
                <input className="ivd-hex" value={accent.toUpperCase()} onChange={(e) => set("brandColor", e.target.value)} spellCheck={false} aria-label="Brand colour hex" />
                <div className="ivd-swatches">
                  {SWATCHES.map((c) => <button key={c} type="button" className="ivd-swatch" data-on={c.toLowerCase() === accent.toLowerCase()} style={{ background: c }} onClick={() => set("brandColor", c)} aria-label={`Use ${c}`} />)}
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="ivd-group">
            <div className="ivd-group-title">Content</div>
            <div className="ivd-lab" style={{ marginBottom: 8 }}>Typeface</div>
            <SegmentedSwitch options={[{ id: "sans", label: "Sans" }, { id: "serif", label: "Serif" }]} value={design.font} onChange={(v) => set("font", v as InvoiceDesign["font"])} fullWidth size="sm" ariaLabel="Typeface" />
            <div style={{ marginTop: 14 }}><LabelInput label="Invoice title" value={design.title} onChange={(e) => set("title", e.target.value)} fullWidth accent={accent} size="sm" maxLength={24} /></div>
            <div style={{ marginTop: 14 }}>
              <div className="ivd-lab" style={{ marginBottom: 6 }}>Message to the client</div>
              <textarea className="ivd-textarea" value={design.message} onChange={(e) => set("message", e.target.value)} rows={2} maxLength={240} placeholder="A thank-you or note, printed under the total." />
            </div>
            <div style={{ marginTop: 14 }}>
              <div className="ivd-lab" style={{ marginBottom: 6 }}>Your address</div>
              <textarea className="ivd-textarea" value={design.addressLines.join("\n")} onChange={(e) => set("addressLines", e.target.value.split("\n").slice(0, 6))} rows={3} placeholder={"Unit 4, The Granary\nBerkhamsted\nHP4 2DW"} />
            </div>
            {design.template !== "modern" && (
              <div className="ivd-row-between" style={{ marginTop: 12 }}><span className="ivd-lab">Show tagline under your name</span><LiquidToggle checked={design.showTagline} onChange={() => set("showTagline", !design.showTagline)} width={44} height={24} color={accent} aria-label="Show tagline" /></div>
            )}
            {design.showTagline && design.template !== "modern" && (
              <div style={{ marginTop: 10 }}><LabelInput label="Tagline" value={design.tagline} onChange={(e) => set("tagline", e.target.value)} fullWidth accent={accent} size="sm" maxLength={60} /></div>
            )}
          </div>

          {/* Line details & footer */}
          <div className="ivd-group">
            <div className="ivd-group-title">Line details & footer</div>
            <Row label="Show the sale price on each line" on={design.showSalePrice} onToggle={() => set("showSalePrice", !design.showSalePrice)} color={accent} />
            <Row label="Show the exchange-date column" on={design.showExchangeDate} onToggle={() => set("showExchangeDate", !design.showExchangeDate)} color={accent} />
            <Row label="Show payment terms" on={design.showTerms} onToggle={() => set("showTerms", !design.showTerms)} color={accent} />
            {design.showTerms && (
              <div className="ivd-row-between" style={{ padding: "9px 0" }}>
                <span className="ivd-lab">Payment terms (days)</span>
                <input className="ivd-num" type="number" min={0} max={120} value={design.paymentTermsDays} onChange={(e) => set("paymentTermsDays", Math.min(120, Math.max(0, Number(e.target.value) || 0)))} aria-label="Payment terms days" />
              </div>
            )}
            <Row label="Show bank-transfer details" on={design.showBank} onToggle={() => set("showBank", !design.showBank)} color={accent} />
            {design.showBank && (
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                <LabelInput label="Account name" value={design.bankName} onChange={(e) => set("bankName", e.target.value)} fullWidth accent={accent} size="sm" maxLength={120} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <LabelInput label="Sort code" value={design.sortCode} onChange={(e) => set("sortCode", e.target.value)} fullWidth accent={accent} size="sm" maxLength={16} />
                  <LabelInput label="Account number" value={design.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} fullWidth accent={accent} size="sm" maxLength={24} />
                </div>
              </div>
            )}
          </div>

          <div className="ivd-footer">
            <Button type="button" variant="secondary" size="sm" onClick={() => { setDesign({ ...DEFAULT_INVOICE_DESIGN }); setDirty(true); }}>Reset to default</Button>
          </div>
        </div>

        <div className="ivd-preview">
          <div className="ivd-preview-head">Live preview</div>
          <div className="ivd-stage">
            <InvoiceDesignPreview design={design} businessName={businessName} vatRegistered={vatRegistered} vatNumber={vatNumber} logoUrl={logoUrl} />
          </div>
        </div>
      </div>

      <style>{`
        .ivd-frame { display: grid; grid-template-columns: minmax(300px, 0.82fr) minmax(0, 1fr); gap: 22px; align-items: start; }
        .ivd-controls { display: flex; flex-direction: column; gap: 20px; }
        .ivd-group { }
        .ivd-group-title { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--agent-text-muted); margin-bottom: 12px; padding-bottom: 7px; border-bottom: 0.5px solid var(--agent-border-subtle); }
        .ivd-preview { position: sticky; top: 16px; }
        .ivd-preview-head { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: var(--agent-text-muted); margin-bottom: 10px; }
        .ivd-stage { background: var(--agent-surface, rgba(0,0,0,0.03)); border: 1px solid var(--agent-border-subtle); border-radius: 18px; padding: 20px; }
        .ivd-templates { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .ivd-thumb { appearance: none; background: var(--agent-surface-elevated, #fff); border: 1.5px solid var(--agent-border-subtle); border-radius: 12px; padding: 10px; cursor: pointer; text-align: left; display: flex; flex-direction: column; gap: 7px; transition: border-color .15s, box-shadow .15s; }
        .ivd-thumb:hover { border-color: var(--agent-border-default); }
        .ivd-thumb[data-on="true"] { border-color: var(--agent-coral-deep, #e0562f); box-shadow: 0 0 0 1px var(--agent-coral-deep, #e0562f); }
        .ivd-thumb-label { font-size: 12.5px; font-weight: 700; color: var(--agent-text-primary); }
        .ivd-thumb-note { font-size: 10.5px; color: var(--agent-text-muted); line-height: 1.3; }
        .ivd-logo-row { display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap; }
        .ivd-logo-drop { flex: 1; min-width: 150px; min-height: 72px; border: 1.5px dashed var(--agent-border-default); border-radius: 12px; background: var(--agent-surface, rgba(0,0,0,0.02)); cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .ivd-logo-drop:hover { background: var(--agent-hover-shade, rgba(0,0,0,0.03)); }
        .ivd-logo-drop:disabled { opacity: .6; cursor: default; }
        .ivd-logo-empty { display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: var(--agent-text-secondary); }
        .ivd-logo-chip { width: 34px; height: 34px; border-radius: 9px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; }
        .ivd-logo-actions { display: flex; flex-direction: column; gap: 8px; justify-content: center; min-width: 150px; }
        .ivd-row-between { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .ivd-lab { font-size: 13px; font-weight: 600; color: var(--agent-text-primary); }
        .ivd-hint { font-size: 11.5px; color: var(--agent-text-muted); }
        .ivd-textbtn { appearance: none; background: none; border: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--agent-danger, #c73e3e); cursor: pointer; padding: 0; text-align: left; }
        .ivd-colour { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ivd-colour-tile { width: 40px; height: 40px; border-radius: 11px; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); position: relative; flex-shrink: 0; }
        .ivd-hex { width: 104px; height: 40px; border-radius: 10px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-elevated, #fff); color: var(--agent-text-primary); font: inherit; font-size: 13px; font-variant-numeric: tabular-nums; padding: 0 12px; text-transform: uppercase; }
        .ivd-hex:focus, .ivd-num:focus { outline: none; border-color: var(--agent-coral-deep, #e0562f); }
        .ivd-num { width: 72px; height: 36px; border-radius: 9px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-elevated, #fff); color: var(--agent-text-primary); font: inherit; font-size: 13px; text-align: center; }
        .ivd-swatches { display: flex; gap: 7px; flex-wrap: wrap; }
        .ivd-swatch { width: 26px; height: 26px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); }
        .ivd-swatch[data-on="true"] { border-color: var(--agent-text-primary); }
        .ivd-textarea { width: 100%; border-radius: 12px; border: 1px solid var(--agent-border-default); background: var(--agent-surface-elevated, #fff); color: var(--agent-text-primary); font: inherit; font-size: 13.5px; line-height: 1.5; padding: 10px 12px; resize: vertical; }
        .ivd-textarea:focus { outline: none; border-color: var(--agent-coral-deep, #e0562f); }
        .ivd-footer { display: flex; align-items: center; }
        @media (max-width: 1000px) { .ivd-frame { grid-template-columns: 1fr; } .ivd-preview { position: static; } }
      `}</style>
    </AccountCard>
  );
}

function Row({ label, on, onToggle, color }: { label: string; on: boolean; onToggle: () => void; color: string }) {
  return (
    <div className="ivd-row-between" style={{ padding: "9px 0", borderBottom: "0.5px solid var(--agent-border-subtle)" }}>
      <span className="ivd-lab">{label}</span>
      <LiquidToggle checked={on} onChange={onToggle} width={44} height={24} color={color} aria-label={label} />
    </div>
  );
}

function Thumb({ template, color }: { template: InvoiceTemplate; color: string }) {
  const line = (w: string) => <div style={{ height: 4, width: w, borderRadius: 2, background: "#D7DBE0", marginBottom: 4 }} />;
  return (
    <div style={{ background: "#fff", border: "1px solid #E7E9EE", borderRadius: 7, height: 74, overflow: "hidden", boxShadow: "0 1px 3px rgba(16,24,40,0.06)" }} aria-hidden>
      {template === "modern" ? (
        <>
          <div style={{ background: color, height: 22, display: "flex", alignItems: "center", padding: "0 6px", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: "rgba(255,255,255,0.7)" }} />
            <div style={{ width: 26, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.8)" }} />
          </div>
          <div style={{ padding: 7 }}>{line("70%")}{line("82%")}{line("50%")}</div>
        </>
      ) : template === "minimal" ? (
        <div style={{ padding: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ width: 22, height: 6, borderRadius: 2, background: "#C7CDD4" }} />
            <div style={{ width: 16, height: 4, borderRadius: 2, background: "#C7CDD4" }} />
          </div>
          {line("100%")}{line("66%")}{line("88%")}
          <div style={{ height: 3, width: 30, background: color, borderRadius: 2, marginLeft: "auto", marginTop: 6 }} />
        </div>
      ) : (
        <>
          <div style={{ height: 4, background: color }} />
          <div style={{ padding: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
              <div style={{ width: 20, height: 5, borderRadius: 2, background: color }} />
            </div>
            {line("72%")}{line("84%")}{line("55%")}
          </div>
        </>
      )}
    </div>
  );
}

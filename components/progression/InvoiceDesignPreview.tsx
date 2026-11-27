"use client";

// On-screen preview of a business's client invoice, driven by its InvoiceDesign.
// A faithful guide to what the PDF (business-invoice-pdf.ts) produces — the PDF
// is the delivered artifact; this is the live preview in the designer + settings.
// White "paper" in both themes (an invoice is a document). A small fixed sample
// (fictional agency + sales) stands in so the preview is always populated.

import type { ReactNode, CSSProperties } from "react";
import type { InvoiceDesign } from "@/lib/progression/invoice-design";

const SAMPLE = {
  agencyName: "Bridgefield Estates",
  agencyContact: "accounts@bridgefield.co.uk",
  periodLabel: "November 2026",
  dueLabel: "11 Dec 2026",
  number: "NOV-2026",
  sales: [
    { address: "14 Maple Avenue, Berkhamsted", exchanged: "6 Nov", price: 42500000, completed: null, feePence: 30000 },
    { address: "3 Canal Wharf, Apsley", exchanged: "12 Nov", price: 31500000, completed: "28 Nov", feePence: 30000 },
    { address: "9 Shootersway, Berkhamsted", exchanged: "19 Nov", price: 58000000, completed: null, feePence: 30000 },
  ],
};

function money(pence: number): string {
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function money0(pence: number): string {
  return `£${Math.round(pence / 100).toLocaleString("en-GB")}`;
}

export function InvoiceDesignPreview({
  design, businessName, vatRegistered, vatNumber, logoUrl,
}: {
  design: InvoiceDesign;
  businessName: string;
  vatRegistered: boolean;
  vatNumber?: string | null;
  logoUrl?: string | null;
}) {
  const brand = design.brandColor;
  const ink = "#0F1B2D";
  const muted = "#8A93A3";
  const serif = design.font === "serif";
  const font = serif ? 'Georgia, "Times New Roman", Times, serif' : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  const initials = businessName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "–";
  const modern = design.template === "modern";
  const minimal = design.template === "minimal";

  const subtotal = SAMPLE.sales.reduce((s, x) => s + x.feePence, 0);
  const vat = vatRegistered ? Math.round(subtotal * 0.2) : 0;
  const total = subtotal + vat;

  const logoEl = design.logoEnabled
    ? (logoUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logoUrl} alt="" style={{ height: 44, maxWidth: 160, objectFit: "contain", display: "block" }} />
        : <div style={{ width: 46, height: 46, borderRadius: 11, background: brand, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }} aria-hidden>{initials}</div>)
    : null;

  let header: ReactNode;
  if (modern) {
    header = (
      <div style={{ background: brand, color: "#fff", padding: "22px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {design.logoEnabled && (logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={logoUrl} alt="" style={{ height: 42, maxWidth: 150, objectFit: "contain", background: "#fff", borderRadius: 8, padding: 4 }} />
              : <div style={{ width: 44, height: 44, borderRadius: 11, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{initials}</div>)}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{businessName}</div>
              {design.showTagline && design.tagline && <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.8)" }}>{design.tagline}</div>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: serif ? 0.5 : 1.5 }}>{design.title}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.82)", marginTop: 2 }}>{SAMPLE.number}</div>
          </div>
        </div>
      </div>
    );
  } else {
    header = (
      <>
        {!minimal && <div style={{ height: 6, background: brand }} />}
        <div style={{ padding: minimal ? "28px 28px 0" : "24px 28px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              {logoEl}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: ink }}>{businessName}</div>
                {design.showTagline && design.tagline && <div style={{ fontSize: 12, color: muted }}>{design.tagline}</div>}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: minimal ? 600 : 800, fontSize: minimal ? 13 : 19, letterSpacing: minimal ? 3 : (serif ? 0.5 : 1), textTransform: minimal ? "uppercase" : "none", color: minimal ? muted : brand }}>{design.title}</div>
              <div style={{ fontSize: minimal ? 14 : 12.5, fontWeight: minimal ? 700 : 400, color: minimal ? ink : "#54617D", marginTop: 2 }}>{SAMPLE.number}</div>
            </div>
          </div>
          {minimal && <div style={{ height: 1, background: "#EEF0F3", marginTop: 20 }} />}
        </div>
      </>
    );
  }

  return (
    <div style={{ background: "#fff", color: ink, borderRadius: 14, border: "1px solid #E7E9EE", boxShadow: "0 8px 30px rgba(16,24,40,0.10)", overflow: "hidden", fontFamily: font, fontSize: 13.5 }}>
      {header}
      <div style={{ padding: "22px 28px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Block label="From">
            <div style={{ fontWeight: 700 }}>{businessName}</div>
            {design.addressLines.map((l, i) => <div key={i} style={{ color: "#54617D" }}>{l}</div>)}
            {vatRegistered && vatNumber && <div style={{ color: "#54617D", marginTop: 4 }}>VAT {vatNumber}</div>}
          </Block>
          <Block label="Bill to">
            <div style={{ fontWeight: 700 }}>{SAMPLE.agencyName}</div>
            <div style={{ color: "#54617D" }}>{SAMPLE.agencyContact}</div>
          </Block>
        </div>

        <div style={{ display: "flex", gap: 28, marginTop: 16, fontSize: 12.5 }}>
          <Meta label="Period" value={SAMPLE.periodLabel} />
          <Meta label="Due" value={SAMPLE.dueLabel} />
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 20 }}>
          <thead>
            <tr style={{ borderBottom: minimal ? "1px solid #D7DBE0" : `2px solid ${brand}` }}>
              <th style={th}>Sale progressed</th>
              {design.showExchangeDate && <th style={th}>Exchanged</th>}
              <th style={{ ...th, textAlign: "right" }}>Fee</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE.sales.map((s, i) => {
              const sub: string[] = [];
              if (design.showSalePrice) sub.push(money0(s.price));
              if (s.completed) sub.push(`completed ${s.completed}`);
              return (
                <tr key={i} style={{ borderBottom: "1px solid #EEF0F3" }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{s.address}</div>
                    {sub.length > 0 && <div style={{ fontSize: 11.5, color: muted }}>{sub.join(" · ")}</div>}
                  </td>
                  {design.showExchangeDate && <td style={{ ...td, color: "#54617D", whiteSpace: "nowrap" }}>{s.exchanged}</td>}
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{money(s.feePence)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <div style={{ width: 240 }}>
            <TotalRow label="Subtotal" value={money(subtotal)} />
            {vatRegistered && <TotalRow label="VAT (20%)" value={money(vat)} />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 10, borderTop: `2px solid ${minimal ? brand : ink}` }}>
              <span style={{ fontWeight: 800, fontSize: 15 }}>Total due</span>
              <span style={{ fontWeight: 800, fontSize: 17, color: brand }}>{money(total)}</span>
            </div>
          </div>
        </div>

        {design.message.trim() && <div style={{ marginTop: 20, fontSize: 13, color: "#54617D", fontStyle: serif ? "italic" : "normal" }}>{design.message}</div>}

        {(design.showTerms || (design.showBank && (design.bankName || design.accountNumber))) && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #EEF0F3", display: "grid", gridTemplateColumns: design.showTerms && design.showBank ? "1fr 1fr" : "1fr", gap: 20, fontSize: 12 }}>
            {design.showTerms && (
              <div>
                <div style={{ fontWeight: 700, color: "#54617D", marginBottom: 4 }}>Payment terms</div>
                <div style={{ color: muted }}>Due within {design.paymentTermsDays} days of issue.</div>
              </div>
            )}
            {design.showBank && (design.bankName || design.accountNumber) && (
              <div>
                <div style={{ fontWeight: 700, color: "#54617D", marginBottom: 4 }}>Bank transfer</div>
                {design.bankName && <div style={{ color: muted }}>{design.bankName}</div>}
                {(design.sortCode || design.accountNumber) && <div style={{ color: muted }}>{[design.sortCode && `Sort ${design.sortCode}`, design.accountNumber && `Acc ${design.accountNumber}`].filter(Boolean).join(" · ")}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#A0A8B4", marginBottom: 6 }}>{label}</div>
      <div style={{ lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}
function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#A0A8B4" }}>{label}</div>
      <div style={{ color: "#0F1B2D", fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}
function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#54617D", padding: "3px 0" }}>
      <span>{label}</span><span style={{ fontWeight: 600, color: "#0F1B2D" }}>{value}</span>
    </div>
  );
}
const th: CSSProperties = { textAlign: "left", fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "#A0A8B4", padding: "0 0 8px" };
const td: CSSProperties = { textAlign: "left", padding: "10px 0", verticalAlign: "top" };

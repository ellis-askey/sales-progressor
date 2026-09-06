"use client";

// Elevated-card selectors for the two sale details every claim flow needs:
// tenure (freehold / leasehold) and purchase type (mortgage / cash / cash from
// proceeds). Shared by ClaimConfirmForm, ClaimLoginForm and ClaimSignupForm so the
// treatment lives in one place. Selected card fills coral with a corner check.
// Styling: .claim-choice-* in app/claim/styles/claim-flow.css.

type Tenure = "freehold" | "leasehold";
type PurchaseType = "mortgage" | "cash_buyer" | "cash_from_proceeds";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9M10 19v-5h4v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconDoc() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="4" width="12" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9h6M9 12.5h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.5 19c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function IconPound() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 20h9M9 20c1.6-1.2 1.8-3 1.4-5M7.5 12.5H14M9.4 15c-.6-2-1.2-4 .1-6 1-1.6 3.2-2 5-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17 17 7m0 0H9m8 0v8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8.5" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M16 6.2a3 3 0 0 1 0 5.8M17 14.2c2.3.3 4 2 4 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m4 10.5 3.5 3.5L16 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Card({
  on,
  onClick,
  icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button type="button" className={`claim-choice-card${on ? " on" : ""}`} onClick={onClick} aria-pressed={on}>
      <span className="claim-choice-tick"><IconCheck /></span>
      {icon}
      <span className="claim-choice-label">{label}</span>
    </button>
  );
}

export function ClaimSaleTypeFields({
  tenure,
  purchaseType,
  isShareOfFreehold,
  onTenure,
  onPurchaseType,
  onShareOfFreehold,
}: {
  tenure: Tenure | null;
  purchaseType: PurchaseType | null;
  isShareOfFreehold: boolean;
  onTenure: (t: Tenure) => void;
  onPurchaseType: (p: PurchaseType) => void;
  onShareOfFreehold: (v: boolean) => void;
}) {
  return (
    <div className="claim-choice-groups">
      <div className="claim-choice-group">
        <div className="claim-choice-q"><IconHome /> <span>What&rsquo;s the tenure?</span></div>
        <div className="claim-choice claim-choice-2">
          <Card
            on={tenure === "freehold"}
            onClick={() => { onTenure("freehold"); onShareOfFreehold(false); }}
            icon={<IconHome />}
            label="Freehold"
          />
          <Card on={tenure === "leasehold"} onClick={() => onTenure("leasehold")} icon={<IconDoc />} label="Leasehold" />
        </div>
      </div>

      <div className="claim-choice-group">
        <div className="claim-choice-q"><IconUsers /> <span>How is the property being purchased?</span></div>
        <div className="claim-choice claim-choice-3">
          <Card on={purchaseType === "mortgage"} onClick={() => onPurchaseType("mortgage")} icon={<IconPerson />} label="Mortgage" />
          <Card on={purchaseType === "cash_buyer"} onClick={() => onPurchaseType("cash_buyer")} icon={<IconPound />} label="Cash purchase" />
          <Card on={purchaseType === "cash_from_proceeds"} onClick={() => onPurchaseType("cash_from_proceeds")} icon={<IconArrow />} label="Cash from proceeds" />
        </div>
      </div>

      {tenure === "leasehold" && (
        <label className="claim-share-of-freehold">
          <input type="checkbox" checked={isShareOfFreehold} onChange={(e) => onShareOfFreehold(e.target.checked)} />
          Share of freehold
        </label>
      )}
    </div>
  );
}

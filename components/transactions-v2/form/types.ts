import type { SolicitorSelection } from "@/components/solicitors/SolicitorPicker";
import type { BrokerSelection } from "@/components/brokers/BrokerPicker";
import type { InMemoryStub } from "@/components/chain/ChainSection";
import type { ContactEntry } from "@/components/transactions-v2/types";

export type FormFields = {
  streetAddress: string;
  city: string;
  postcode: string;
  purchasePricePence: number | null;
  tenure: "freehold" | "leasehold" | "";
  isShareOfFreehold: boolean;
  purchaseType: "mortgage" | "cash_buyer" | "cash_from_proceeds" | "";
  progressedBy: "agent" | "progressor";
  vendors: ContactEntry[];
  purchasers: ContactEntry[];
  vendorSolicitor: SolicitorSelection | null;
  purchaserSolicitor: SolicitorSelection | null;
  vendorIsReferral: boolean;
  purchaserIsReferral: boolean;
  broker: BrokerSelection | null;
  agentFeeType: "amount" | "percent";
  agentFeeAmount: number | null;
  agentFeePercentStr: string;
  agentFeeVat: "inclusive" | "exclusive";
  referralFee: number | null;
  brokerReferralFee: number | null;
  purchaserBrokerReferral: boolean;
  notes: string;
  chainStubs: InMemoryStub[];
  chainExpanded: boolean;
  // Director-only: which agency user will own the new file. Defaults to
  // the current user; a director can pick a different director / negotiator
  // in their agency. Negotiators don't see the picker and the field stays
  // at the default. Empty string means "use the caller" on the server.
  assignToUserId: string;
};

export function defaultFormFields(
  progressedBy: "agent" | "progressor" = "agent",
): FormFields {
  return {
    streetAddress: "",
    city: "",
    postcode: "",
    purchasePricePence: null,
    tenure: "",
    isShareOfFreehold: false,
    purchaseType: "",
    progressedBy,
    vendors: [{ name: "", phone: "", email: "" }],
    purchasers: [{ name: "", phone: "", email: "" }],
    vendorSolicitor: null,
    purchaserSolicitor: null,
    vendorIsReferral: false,
    purchaserIsReferral: false,
    broker: null,
    agentFeeType: "amount",
    agentFeeAmount: null,
    agentFeePercentStr: "",
    agentFeeVat: "exclusive",
    referralFee: null,
    brokerReferralFee: null,
    purchaserBrokerReferral: false,
    notes: "",
    chainStubs: [],
    chainExpanded: false,
    assignToUserId: "",
  };
}

/** Purchase types where a chain is near-certain, so the new-sale form opens
 *  the chain section by default and asks outright instead of leaving it
 *  collapsed at the bottom. A mortgaged buyer is usually selling too;
 *  "cash from proceeds" is funded by another sale, i.e. a chain by
 *  definition. A pure cash buyer has no onward dependency, so the section
 *  stays optional and quiet. (Platform audit #5, 2026-08-12.) */
export function isChainLikely(purchaseType: FormFields["purchaseType"]): boolean {
  return purchaseType === "mortgage" || purchaseType === "cash_from_proceeds";
}

/** Plain-English reason the chain section auto-opened, shown to the agent so
 *  the open state never feels arbitrary. Null when the section shouldn't
 *  auto-open (cash buyer / not yet chosen). */
export function chainOpenReason(purchaseType: FormFields["purchaseType"]): string | null {
  if (purchaseType === "mortgage") return "a mortgaged buyer is usually selling too";
  if (purchaseType === "cash_from_proceeds") return "the funds are coming from another sale";
  return null;
}

export type { SolicitorSelection, BrokerSelection, InMemoryStub, ContactEntry };

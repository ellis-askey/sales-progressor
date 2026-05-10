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
};

export function defaultFormFields(): FormFields {
  return {
    streetAddress: "",
    city: "",
    postcode: "",
    purchasePricePence: null,
    tenure: "",
    purchaseType: "",
    progressedBy: "agent",
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
  };
}

export type { SolicitorSelection, BrokerSelection, InMemoryStub, ContactEntry };

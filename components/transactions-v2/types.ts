// Shared types for the new-sale flow (transactions-v2)

export type MemoSource = "extracted" | "failed" | "not_on_memos" | null;

export type MemoSources = {
  streetAddress: MemoSource;
  city: MemoSource;
  postcode: MemoSource;
  purchasePricePence: MemoSource;
  tenure: MemoSource;
  purchaseType: MemoSource;
  vendors: MemoSource;
  purchasers: MemoSource;
  vendorSolicitor: MemoSource;
  purchaserSolicitor: MemoSource;
  agentFee: MemoSource;
};

export const NULL_MEMO_SOURCES: MemoSources = {
  streetAddress: null, city: null, postcode: null, purchasePricePence: null,
  tenure: null, purchaseType: null, vendors: null, purchasers: null,
  vendorSolicitor: null, purchaserSolicitor: null, agentFee: null,
};


export type ExtractedMemoData = {
  streetAddress: string | null;
  city: string | null;
  postcode: string | null;
  purchasePricePence: number | null;
  tenure: "freehold" | "leasehold" | null;
  vendors: { name: string; phone?: string; email?: string }[];
  purchasers: { name: string; phone?: string; email?: string }[];
  vendorSolicitor: { firm?: string; name?: string; phone?: string; email?: string } | null;
  purchaserSolicitor: { firm?: string; name?: string; phone?: string; email?: string } | null;
  mosStoragePath?: string;
  mosFileSize?: number;
  mosMimeType?: string;
  mosFilename?: string;
};

export type FlowState = "hero" | "extracting" | "extracted" | "manual";

export type ContactEntry = {
  name: string;
  phone: string;
  email: string;
};

export type DraftEntry = {
  id: string;
  propertyAddress: string;
  tenure: string | null;
  purchaseType: string | null;
  purchasePrice: number | null;
  createdAt: string;
  notes: string | null;
  agentFeeAmount: number | null;
  agentFeePercent: number | null;
  agentFeeIsVatInclusive: boolean | null;
  vendors: { name: string; phone: string | null; email: string | null }[];
  purchasers: { name: string; phone: string | null; email: string | null }[];
  vendorSolicitor: SolicitorSelection | null;
  purchaserSolicitor: SolicitorSelection | null;
  referredFirmId: string | null;
  referralFee: number | null;
  mosStoragePath: string | null;
  mosFileSize: number | null;
  mosMimeType: string | null;
  mosFilename: string | null;
  progressedBy: string;
  chainStubs: ChainStub[];
};

export type SolicitorSelection = {
  firmId: string;
  firmName: string;
  contactId: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
};

export type ChainStub = {
  id: string;
  direction: "above" | "below";
  stubPropertyAddress: string;
  stubAgencyName: string;
  stubAgentName: string;
  stubAgentEmail: string;
  stubAgentPhone: string;
  stubNotes: string;
};
